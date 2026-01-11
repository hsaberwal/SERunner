from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.gear import Gear
from app.utils.auth import get_current_user

router = APIRouter()


class GearCreate(BaseModel):
    type: str  # mic, mixer, speaker, etc.
    brand: Optional[str] = None
    model: Optional[str] = None
    specs: Optional[dict] = None
    default_settings: Optional[dict] = None


class GearUpdate(BaseModel):
    type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    specs: Optional[dict] = None
    default_settings: Optional[dict] = None


class GearResponse(BaseModel):
    id: UUID
    type: str
    brand: Optional[str]
    model: Optional[str]
    specs: Optional[dict]
    default_settings: Optional[dict]
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[GearResponse])
async def get_gear(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all gear for current user"""
    result = await db.execute(
        select(Gear).where(Gear.user_id == current_user.id).order_by(Gear.type, Gear.brand)
    )
    gear = result.scalars().all()
    return gear


@router.post("", response_model=GearResponse, status_code=status.HTTP_201_CREATED)
async def create_gear(
    gear_data: GearCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create new gear entry"""
    gear = Gear(
        user_id=current_user.id,
        **gear_data.model_dump()
    )
    db.add(gear)
    await db.commit()
    await db.refresh(gear)
    return gear


@router.get("/{gear_id}", response_model=GearResponse)
async def get_gear_item(
    gear_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific gear item"""
    result = await db.execute(
        select(Gear).where(
            Gear.id == gear_id,
            Gear.user_id == current_user.id
        )
    )
    gear = result.scalar_one_or_none()

    if not gear:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gear not found"
        )

    return gear


@router.put("/{gear_id}", response_model=GearResponse)
async def update_gear(
    gear_id: UUID,
    gear_data: GearUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a gear item"""
    result = await db.execute(
        select(Gear).where(
            Gear.id == gear_id,
            Gear.user_id == current_user.id
        )
    )
    gear = result.scalar_one_or_none()

    if not gear:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gear not found"
        )

    # Update fields
    for field, value in gear_data.model_dump(exclude_unset=True).items():
        setattr(gear, field, value)

    await db.commit()
    await db.refresh(gear)
    return gear


@router.delete("/{gear_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gear(
    gear_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a gear item"""
    result = await db.execute(
        select(Gear).where(
            Gear.id == gear_id,
            Gear.user_id == current_user.id
        )
    )
    gear = result.scalar_one_or_none()

    if not gear:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gear not found"
        )

    await db.delete(gear)
    await db.commit()
