"""Instrument profile routes - manage custom instrument/performer types."""

import logging
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.instrument import InstrumentProfile
from app.utils.auth import get_current_user
from app.services.instrument_learner import InstrumentLearner
from app.services.usage_tracker import check_learning_allowed, record_learning
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


# ============== Schemas ==============

class InstrumentCreate(BaseModel):
    name: str
    category: str = "other"  # vocals, speech, percussion, wind, strings, keys, other
    user_notes: Optional[str] = None


class InstrumentUpdate(BaseModel):
    display_name: Optional[str] = None
    category: Optional[str] = None
    user_notes: Optional[str] = None
    is_active: Optional[bool] = None


# ============== Endpoints ==============

@router.get("")
async def get_instruments(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all instrument profiles for the current user."""
    query = select(InstrumentProfile).where(
        InstrumentProfile.user_id == current_user.id
    )
    if category:
        query = query.where(InstrumentProfile.category == category)
    query = query.order_by(InstrumentProfile.category, InstrumentProfile.name)

    result = await db.execute(query)
    items = result.scalars().all()
    return [item.to_dict() for item in items]


@router.get("/{instrument_id}")
async def get_instrument(
    instrument_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific instrument profile."""
    result = await db.execute(
        select(InstrumentProfile).where(
            InstrumentProfile.id == instrument_id,
            InstrumentProfile.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return item.to_dict()


@router.post("/learn")
async def learn_instrument(
    request: InstrumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Learn about an instrument using Claude and save the profile."""
    # Check usage limits
    subscription = await check_learning_allowed(current_user, db)

    # Check if already exists
    learner = InstrumentLearner()
    value_key = learner._make_value_key(request.name)

    existing = await db.execute(
        select(InstrumentProfile).where(
            InstrumentProfile.user_id == current_user.id,
            InstrumentProfile.value_key == value_key
        )
    )
    existing_item = existing.scalar_one_or_none()

    # Learn from Claude
    logger.info(f"Learning instrument: {request.name} (category: {request.category})")
    learned_data = await learner.learn_instrument(
        instrument_name=request.name,
        category=request.category,
        user_notes=request.user_notes,
    )

    if learned_data.get("error"):
        raise HTTPException(
            status_code=500,
            detail=f"Learning failed: {learned_data.get('error')}"
        )

    if existing_item:
        # Update existing
        existing_item.display_name = learned_data.get("display_name", request.name)
        existing_item.description = learned_data.get("description")
        existing_item.mic_recommendations = learned_data.get("mic_recommendations")
        existing_item.eq_settings = learned_data.get("eq_settings")
        existing_item.compression_settings = learned_data.get("compression_settings")
        existing_item.fx_recommendations = learned_data.get("fx_recommendations")
        existing_item.mixing_notes = learned_data.get("mixing_notes")
        existing_item.knowledge_base_entry = learned_data.get("knowledge_base_entry")
        existing_item.user_notes = request.user_notes
        existing_item.category = request.category

        await db.commit()
        await db.refresh(existing_item)
        await record_learning(subscription, db)

        logger.info(f"Updated instrument profile: {request.name}")
        return existing_item.to_dict()
    else:
        # Create new
        new_item = InstrumentProfile(
            user_id=current_user.id,
            name=request.name,
            display_name=learned_data.get("display_name", request.name),
            category=request.category,
            value_key=value_key,
            description=learned_data.get("description"),
            mic_recommendations=learned_data.get("mic_recommendations"),
            eq_settings=learned_data.get("eq_settings"),
            compression_settings=learned_data.get("compression_settings"),
            fx_recommendations=learned_data.get("fx_recommendations"),
            mixing_notes=learned_data.get("mixing_notes"),
            knowledge_base_entry=learned_data.get("knowledge_base_entry"),
            user_notes=request.user_notes,
        )
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        await record_learning(subscription, db)

        logger.info(f"Created instrument profile: {request.name}")
        return new_item.to_dict()


@router.post("/{instrument_id}/relearn")
async def relearn_instrument(
    instrument_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Re-learn an instrument to update its settings."""
    subscription = await check_learning_allowed(current_user, db)

    result = await db.execute(
        select(InstrumentProfile).where(
            InstrumentProfile.id == instrument_id,
            InstrumentProfile.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Instrument not found")

    learner = InstrumentLearner()
    learned_data = await learner.learn_instrument(
        instrument_name=item.name,
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
    item.mic_recommendations = learned_data.get("mic_recommendations")
    item.eq_settings = learned_data.get("eq_settings")
    item.compression_settings = learned_data.get("compression_settings")
    item.fx_recommendations = learned_data.get("fx_recommendations")
    item.mixing_notes = learned_data.get("mixing_notes")
    item.knowledge_base_entry = learned_data.get("knowledge_base_entry")

    await db.commit()
    await db.refresh(item)
    await record_learning(subscription, db)

    return item.to_dict()


@router.put("/{instrument_id}")
async def update_instrument(
    instrument_id: UUID,
    update: InstrumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update instrument profile metadata (not AI-learned data)."""
    result = await db.execute(
        select(InstrumentProfile).where(
            InstrumentProfile.id == instrument_id,
            InstrumentProfile.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Instrument not found")

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


@router.delete("/{instrument_id}")
async def delete_instrument(
    instrument_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an instrument profile."""
    result = await db.execute(
        select(InstrumentProfile).where(
            InstrumentProfile.id == instrument_id,
            InstrumentProfile.user_id == current_user.id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Instrument not found")

    await db.delete(item)
    await db.commit()
    return {"status": "deleted"}
