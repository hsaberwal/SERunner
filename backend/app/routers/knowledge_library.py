"""
Knowledge Library API Routes

Manage learned hardware information separate from inventory.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID
import logging

from app.database import get_db
from app.models.knowledge_library import LearnedHardware
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.hardware_learner import HardwareLearner
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge-library", tags=["knowledge-library"])


# Pydantic models
class LearnedHardwareCreate(BaseModel):
    hardware_type: str
    brand: str
    model: str
    user_notes: Optional[str] = None


class LearnedHardwareResponse(BaseModel):
    id: str
    hardware_type: str
    brand: str
    model: str
    characteristics: Optional[str] = None
    best_for: Optional[str] = None
    settings_by_source: Optional[dict] = None
    knowledge_base_entry: Optional[str] = None
    amp_specs: Optional[dict] = None
    user_notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    # Flattened amp specs for convenience
    watts_per_channel: Optional[str] = None
    channels: Optional[str] = None
    amplifier_class: Optional[str] = None
    frequency_response: Optional[str] = None
    response_character: Optional[str] = None
    damping_factor: Optional[str] = None
    features: Optional[List[str]] = None
    eq_compensation: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[LearnedHardwareResponse])
async def get_all_learned_hardware(
    hardware_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all learned hardware (shared across all users)"""
    query = select(LearnedHardware)
    
    if hardware_type:
        query = query.where(LearnedHardware.hardware_type == hardware_type)
    
    query = query.order_by(LearnedHardware.hardware_type, LearnedHardware.brand, LearnedHardware.model)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    return [item.to_dict() for item in items]


@router.get("/{item_id}", response_model=LearnedHardwareResponse)
async def get_learned_hardware(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific learned hardware item"""
    result = await db.execute(
        select(LearnedHardware).where(
            LearnedHardware.id == item_id
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Learned hardware not found")
    
    return item.to_dict()


@router.post("/learn", response_model=LearnedHardwareResponse)
async def learn_and_save_hardware(
    request: LearnedHardwareCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Learn about hardware using Claude and save to knowledge library"""
    from app.services.usage_tracker import check_learning_allowed, record_learning

    # Check usage limits before calling Claude
    subscription = await check_learning_allowed(current_user, db)

    settings = get_settings()
    learner = HardwareLearner(api_key=settings.anthropic_api_key)
    
    logger.info(f"Learning new hardware: {request.brand} {request.model}")
    
    # Check if already exists (globally shared)
    existing = await db.execute(
        select(LearnedHardware).where(
            LearnedHardware.brand == request.brand,
            LearnedHardware.model == request.model
        )
    )
    existing_item = existing.scalar_one_or_none()

    # If already learned by any user, return existing data (use relearn to refresh)
    if existing_item and existing_item.knowledge_base_entry:
        logger.info(f"Hardware already learned: {request.brand} {request.model} - returning existing data")
        return existing_item.to_dict()

    # Learn from Claude (only for new or incomplete items)
    learned_data = await learner.learn_hardware(
        hardware_type=request.hardware_type,
        brand=request.brand,
        model=request.model,
        user_notes=request.user_notes
    )
    
    if learned_data.get("error"):
        raise HTTPException(status_code=500, detail=f"Learning failed: {learned_data.get('error')}")
    
    # Extract amp-specific fields
    amp_specs = None
    if request.hardware_type == "amplifier":
        amp_specs = {
            "watts_per_channel": learned_data.get("watts_per_channel"),
            "channels": learned_data.get("channels"),
            "amplifier_class": learned_data.get("amplifier_class"),
            "frequency_response": learned_data.get("frequency_response"),
            "response_character": learned_data.get("response_character"),
            "damping_factor": learned_data.get("damping_factor"),
            "features": learned_data.get("features"),
            "eq_compensation": learned_data.get("eq_compensation"),
        }
    
    if existing_item:
        # Update existing
        existing_item.characteristics = learned_data.get("characteristics")
        existing_item.best_for = learned_data.get("best_for")
        existing_item.settings_by_source = learned_data.get("settings_by_source")
        existing_item.knowledge_base_entry = learned_data.get("knowledge_base_entry")
        existing_item.amp_specs = amp_specs
        existing_item.user_notes = request.user_notes
        
        await db.commit()
        await db.refresh(existing_item)
        
        logger.info(f"Updated existing learned hardware: {request.brand} {request.model}")
        # Record usage after successful learning
        await record_learning(subscription, db)
        return existing_item.to_dict()
    else:
        # Create new
        new_item = LearnedHardware(
            user_id=current_user.id,
            hardware_type=request.hardware_type,
            brand=request.brand,
            model=request.model,
            characteristics=learned_data.get("characteristics"),
            best_for=learned_data.get("best_for"),
            settings_by_source=learned_data.get("settings_by_source"),
            knowledge_base_entry=learned_data.get("knowledge_base_entry"),
            amp_specs=amp_specs,
            user_notes=request.user_notes
        )
        
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        
        logger.info(f"Saved new learned hardware: {request.brand} {request.model}")
        # Record usage after successful learning
        await record_learning(subscription, db)
        return new_item.to_dict()


@router.post("/{item_id}/relearn", response_model=LearnedHardwareResponse)
async def relearn_hardware(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Re-learn hardware to update its settings"""
    from app.services.usage_tracker import check_learning_allowed, record_learning

    # Check usage limits before calling Claude
    subscription = await check_learning_allowed(current_user, db)

    result = await db.execute(
        select(LearnedHardware).where(
            LearnedHardware.id == item_id
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Learned hardware not found")

    settings = get_settings()
    learner = HardwareLearner(api_key=settings.anthropic_api_key)
    
    logger.info(f"Re-learning hardware: {item.brand} {item.model}")
    
    learned_data = await learner.learn_hardware(
        hardware_type=item.hardware_type,
        brand=item.brand,
        model=item.model,
        user_notes=item.user_notes
    )
    
    if learned_data.get("error"):
        raise HTTPException(status_code=500, detail=f"Learning failed: {learned_data.get('error')}")
    
    # Update
    item.characteristics = learned_data.get("characteristics")
    item.best_for = learned_data.get("best_for")
    item.settings_by_source = learned_data.get("settings_by_source")
    item.knowledge_base_entry = learned_data.get("knowledge_base_entry")
    
    if item.hardware_type == "amplifier":
        item.amp_specs = {
            "watts_per_channel": learned_data.get("watts_per_channel"),
            "channels": learned_data.get("channels"),
            "amplifier_class": learned_data.get("amplifier_class"),
            "frequency_response": learned_data.get("frequency_response"),
            "response_character": learned_data.get("response_character"),
            "damping_factor": learned_data.get("damping_factor"),
            "features": learned_data.get("features"),
            "eq_compensation": learned_data.get("eq_compensation"),
        }
    
    await db.commit()
    await db.refresh(item)
    
    # Record usage after successful relearn
    await record_learning(subscription, db)

    return item.to_dict()


@router.delete("/{item_id}")
async def delete_learned_hardware(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete learned hardware from knowledge library"""
    result = await db.execute(
        select(LearnedHardware).where(
            LearnedHardware.id == item_id
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Learned hardware not found")
    
    await db.delete(item)
    await db.commit()
    
    return {"message": "Deleted successfully"}
