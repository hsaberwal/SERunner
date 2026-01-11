from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

from app.database import get_db
from app.models.user import User
from app.models.setup import Setup
from app.models.location import Location
from app.utils.auth import get_current_user
from app.services.setup_generator import SetupGenerator
from app.schemas import BaseResponseWithLocation

router = APIRouter()


class PerformerInput(BaseModel):
    type: str  # vocal, guitar, tabla, flute, etc.
    count: int = 1
    notes: Optional[str] = None


class SetupGenerateRequest(BaseModel):
    location_id: UUID
    event_name: Optional[str] = None
    event_date: Optional[date] = None
    performers: List[PerformerInput]


class SetupCreate(BaseModel):
    location_id: UUID
    event_name: Optional[str] = None
    event_date: Optional[date] = None
    performers: List[dict]
    channel_config: Optional[dict] = None
    eq_settings: Optional[dict] = None
    compression_settings: Optional[dict] = None
    fx_settings: Optional[dict] = None
    instructions: Optional[str] = None
    notes: Optional[str] = None


class SetupUpdate(BaseModel):
    notes: Optional[str] = None
    rating: Optional[int] = None


class SetupResponse(BaseResponseWithLocation):
    """Setup response with automatic UUID/datetime serialization."""
    id: UUID
    location_id: UUID
    event_name: Optional[str]
    event_date: Optional[date]
    performers: List[dict]
    channel_config: Optional[dict]
    eq_settings: Optional[dict]
    compression_settings: Optional[dict]
    fx_settings: Optional[dict]
    instructions: Optional[str]
    notes: Optional[str]
    rating: Optional[int]
    created_at: datetime


@router.post("/generate", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
async def generate_setup(
    request: SetupGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a new setup using Claude API"""
    # Verify location exists and belongs to user
    result = await db.execute(
        select(Location).where(
            Location.id == request.location_id,
            Location.user_id == current_user.id
        )
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Get past setups for this location (for learning)
    past_setups_result = await db.execute(
        select(Setup).where(
            Setup.location_id == request.location_id,
            Setup.rating >= 4  # Only use highly-rated setups
        ).order_by(Setup.created_at.desc()).limit(3)
    )
    past_setups = past_setups_result.scalars().all()

    # Generate setup using Claude API
    generator = SetupGenerator()
    setup_data = await generator.generate(
        location=location,
        performers=[p.model_dump() for p in request.performers],
        past_setups=past_setups,
        user=current_user
    )

    # Create setup record
    setup = Setup(
        location_id=request.location_id,
        user_id=current_user.id,
        event_name=request.event_name,
        event_date=request.event_date,
        performers=[p.model_dump() for p in request.performers],
        channel_config=setup_data.get("channel_config"),
        eq_settings=setup_data.get("eq_settings"),
        compression_settings=setup_data.get("compression_settings"),
        fx_settings=setup_data.get("fx_settings"),
        instructions=setup_data.get("instructions")
    )
    db.add(setup)
    await db.commit()
    await db.refresh(setup)

    return setup


@router.get("", response_model=List[SetupResponse])
async def get_setups(
    location_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all setups for current user, optionally filtered by location"""
    query = select(Setup).where(Setup.user_id == current_user.id)

    if location_id:
        query = query.where(Setup.location_id == location_id)

    query = query.order_by(Setup.created_at.desc())

    result = await db.execute(query)
    setups = result.scalars().all()
    return setups


@router.get("/{setup_id}", response_model=SetupResponse)
async def get_setup(
    setup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific setup"""
    result = await db.execute(
        select(Setup).where(
            Setup.id == setup_id,
            Setup.user_id == current_user.id
        )
    )
    setup = result.scalar_one_or_none()

    if not setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setup not found"
        )

    return setup


@router.put("/{setup_id}", response_model=SetupResponse)
async def update_setup(
    setup_id: UUID,
    setup_data: SetupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a setup (notes and rating)"""
    result = await db.execute(
        select(Setup).where(
            Setup.id == setup_id,
            Setup.user_id == current_user.id
        )
    )
    setup = result.scalar_one_or_none()

    if not setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setup not found"
        )

    # Validate rating
    if setup_data.rating is not None and (setup_data.rating < 1 or setup_data.rating > 5):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )

    # Update fields
    for field, value in setup_data.model_dump(exclude_unset=True).items():
        setattr(setup, field, value)

    await db.commit()
    await db.refresh(setup)
    return setup


@router.delete("/{setup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setup(
    setup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a setup"""
    result = await db.execute(
        select(Setup).where(
            Setup.id == setup_id,
            Setup.user_id == current_user.id
        )
    )
    setup = result.scalar_one_or_none()

    if not setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setup not found"
        )

    await db.delete(setup)
    await db.commit()
