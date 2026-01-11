from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.location import Location
from app.utils.auth import get_current_user

router = APIRouter()


class LocationCreate(BaseModel):
    name: str
    venue_type: Optional[str] = None
    notes: Optional[str] = None
    speaker_setup: Optional[dict] = None
    default_config: Optional[dict] = None
    is_temporary: bool = False


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    venue_type: Optional[str] = None
    notes: Optional[str] = None
    speaker_setup: Optional[dict] = None
    default_config: Optional[dict] = None
    is_temporary: Optional[bool] = None


class LocationResponse(BaseModel):
    id: UUID
    name: str
    venue_type: Optional[str]
    notes: Optional[str]
    speaker_setup: Optional[dict]
    default_config: Optional[dict]
    is_temporary: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[LocationResponse])
async def get_locations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all locations for current user"""
    result = await db.execute(
        select(Location).where(Location.user_id == current_user.id).order_by(Location.created_at.desc())
    )
    locations = result.scalars().all()
    return locations


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new location"""
    location = Location(
        user_id=current_user.id,
        **location_data.model_dump()
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific location"""
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.user_id == current_user.id
        )
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    return location


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: UUID,
    location_data: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a location"""
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.user_id == current_user.id
        )
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Update fields
    for field, value in location_data.model_dump(exclude_unset=True).items():
        setattr(location, field, value)

    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a location"""
    result = await db.execute(
        select(Location).where(
            Location.id == location_id,
            Location.user_id == current_user.id
        )
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    await db.delete(location)
    await db.commit()
