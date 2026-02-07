"""Venue type profile routes - manage learned venue acoustic profiles."""

import logging
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.venue_type import VenueTypeProfile
from app.utils.auth import get_current_user
from app.services.venue_type_learner import VenueTypeLearner
from app.services.usage_tracker import check_learning_allowed, record_learning
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


# ============== Schemas ==============

class VenueTypeCreate(BaseModel):
    name: str
    category: str = "other"  # worship, performance, commercial, education, outdoor, other
    user_notes: Optional[str] = None


class VenueTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    category: Optional[str] = None
    user_notes: Optional[str] = None
    is_active: Optional[bool] = None


# ============== Endpoints ==============

@router.get("")
async def get_venue_types(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all venue type profiles (shared across all users)."""
    query = select(VenueTypeProfile)
    if category:
        query = query.where(VenueTypeProfile.category == category)
    query = query.order_by(VenueTypeProfile.category, VenueTypeProfile.name)

    result = await db.execute(query)
    items = result.scalars().all()
    return [item.to_dict() for item in items]


@router.get("/{venue_type_id}")
async def get_venue_type(
    venue_type_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific venue type profile."""
    result = await db.execute(
        select(VenueTypeProfile).where(
            VenueTypeProfile.id == venue_type_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Venue type not found")
    return item.to_dict()


@router.post("/learn")
async def learn_venue_type(
    request: VenueTypeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Learn about a venue type using Claude and save the profile."""
    # Check usage limits
    subscription = await check_learning_allowed(current_user, db)

    # Check if already exists
    learner = VenueTypeLearner()
    value_key = learner._make_value_key(request.name)

    existing = await db.execute(
        select(VenueTypeProfile).where(
            VenueTypeProfile.value_key == value_key
        )
    )
    existing_item = existing.scalar_one_or_none()

    # If already learned, return existing data (use relearn to refresh)
    if existing_item and existing_item.knowledge_base_entry:
        logger.info(f"Venue type already learned: {request.name} - returning existing data")
        return existing_item.to_dict()

    # Learn from Claude
    logger.info(f"Learning venue type: {request.name} (category: {request.category})")
    learned_data = await learner.learn_venue_type(
        venue_type_name=request.name,
        category=request.category,
        user_notes=request.user_notes,
    )

    if learned_data.get("error"):
        raise HTTPException(
            status_code=500,
            detail=f"Learning failed: {learned_data.get('error')}"
        )

    if existing_item:
        # Update incomplete existing item
        existing_item.display_name = learned_data.get("display_name", request.name)
        existing_item.description = learned_data.get("description")
        existing_item.acoustic_characteristics = learned_data.get("acoustic_characteristics")
        existing_item.sound_goals = learned_data.get("sound_goals")
        existing_item.acoustic_challenges = learned_data.get("acoustic_challenges")
        existing_item.eq_strategy = learned_data.get("eq_strategy")
        existing_item.fx_approach = learned_data.get("fx_approach")
        existing_item.compression_philosophy = learned_data.get("compression_philosophy")
        existing_item.monitoring_notes = learned_data.get("monitoring_notes")
        existing_item.special_considerations = learned_data.get("special_considerations")
        existing_item.knowledge_base_entry = learned_data.get("knowledge_base_entry")
        existing_item.user_notes = request.user_notes
        existing_item.category = request.category

        await db.commit()
        await db.refresh(existing_item)
        await record_learning(subscription, db)

        logger.info(f"Updated venue type profile: {request.name}")
        return existing_item.to_dict()
    else:
        # Create new
        new_item = VenueTypeProfile(
            user_id=current_user.id,
            name=request.name,
            display_name=learned_data.get("display_name", request.name),
            category=request.category,
            value_key=value_key,
            description=learned_data.get("description"),
            acoustic_characteristics=learned_data.get("acoustic_characteristics"),
            sound_goals=learned_data.get("sound_goals"),
            acoustic_challenges=learned_data.get("acoustic_challenges"),
            eq_strategy=learned_data.get("eq_strategy"),
            fx_approach=learned_data.get("fx_approach"),
            compression_philosophy=learned_data.get("compression_philosophy"),
            monitoring_notes=learned_data.get("monitoring_notes"),
            special_considerations=learned_data.get("special_considerations"),
            knowledge_base_entry=learned_data.get("knowledge_base_entry"),
            user_notes=request.user_notes,
        )
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        await record_learning(subscription, db)

        logger.info(f"Created venue type profile: {request.name}")
        return new_item.to_dict()


@router.post("/{venue_type_id}/relearn")
async def relearn_venue_type(
    venue_type_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Re-learn a venue type to update its acoustic profile."""
    subscription = await check_learning_allowed(current_user, db)

    result = await db.execute(
        select(VenueTypeProfile).where(
            VenueTypeProfile.id == venue_type_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Venue type not found")

    learner = VenueTypeLearner()
    learned_data = await learner.learn_venue_type(
        venue_type_name=item.name,
        category=item.category,
        user_notes=item.user_notes,
    )

    if learned_data.get("error"):
        raise HTTPException(
            status_code=500,
            detail=f"Learning failed: {learned_data.get('error')}"
        )

    item.display_name = learned_data.get("display_name", item.name)
    item.description = learned_data.get("description")
    item.acoustic_characteristics = learned_data.get("acoustic_characteristics")
    item.sound_goals = learned_data.get("sound_goals")
    item.acoustic_challenges = learned_data.get("acoustic_challenges")
    item.eq_strategy = learned_data.get("eq_strategy")
    item.fx_approach = learned_data.get("fx_approach")
    item.compression_philosophy = learned_data.get("compression_philosophy")
    item.monitoring_notes = learned_data.get("monitoring_notes")
    item.special_considerations = learned_data.get("special_considerations")
    item.knowledge_base_entry = learned_data.get("knowledge_base_entry")

    await db.commit()
    await db.refresh(item)
    await record_learning(subscription, db)

    return item.to_dict()


@router.put("/{venue_type_id}")
async def update_venue_type(
    venue_type_id: UUID,
    update: VenueTypeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update venue type profile metadata (not AI-learned data)."""
    result = await db.execute(
        select(VenueTypeProfile).where(
            VenueTypeProfile.id == venue_type_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Venue type not found")

    if update.display_name is not None:
        item.display_name = update.display_name
    if update.category is not None:
        item.category = update.category
    if update.user_notes is not None:
        item.user_notes = update.user_notes
    if update.is_active is not None:
        item.is_active = "true" if update.is_active else "false"

    await db.commit()
    await db.refresh(item)
    return item.to_dict()


@router.delete("/{venue_type_id}")
async def delete_venue_type(
    venue_type_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a venue type profile."""
    result = await db.execute(
        select(VenueTypeProfile).where(
            VenueTypeProfile.id == venue_type_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Venue type not found")

    await db.delete(item)
    await db.commit()
    return {"status": "deleted"}
