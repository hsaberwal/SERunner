from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

from app.database import get_db
from app.models.user import User
from app.models.setup import Setup
from app.models.location import Location
from app.models.gear import Gear
from app.utils.auth import get_current_user
from app.services.setup_generator import SetupGenerator
from app.schemas import BaseResponseWithLocation

router = APIRouter()


class PerformerInput(BaseModel):
    type: str  # vocal, guitar, tabla, flute, etc.
    count: int = 1
    input_source: Optional[str] = None  # beta_58a, beta_57a, c1000s, di_piezo, direct
    notes: Optional[str] = None


class SetupGenerateRequest(BaseModel):
    location_id: UUID
    event_name: Optional[str] = None
    event_date: Optional[date] = None
    performers: List[PerformerInput]
    force_generate: bool = False  # If True, skip matching and always use Claude


class MatchingSetupResponse(BaseModel):
    """Response when checking for matching past setups"""
    has_match: bool
    match_quality: Optional[str] = None  # "exact", "similar", "partial"
    matching_setup: Optional[dict] = None
    match_details: Optional[str] = None


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
    is_shared: Optional[bool] = None
    shared_full_access: Optional[bool] = None


class SetupResponse(BaseResponseWithLocation):
    """Setup response with automatic UUID/datetime serialization."""
    id: UUID
    location_id: UUID
    user_id: Optional[UUID] = None  # Include for shared setups
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
    is_shared: Optional[bool] = False
    shared_full_access: Optional[bool] = False
    owner_name: Optional[str] = None  # For shared setups, show who owns it


def calculate_performer_match(request_performers: List[dict], past_performers: List[dict]) -> tuple[str, float]:
    """Calculate how well performers match between request and past setup.
    Returns (match_quality, match_score) where score is 0-1."""
    if not past_performers:
        return ("none", 0.0)

    request_types = {}
    for p in request_performers:
        ptype = p.get('type', '')
        count = p.get('count', 1)
        request_types[ptype] = request_types.get(ptype, 0) + count

    past_types = {}
    for p in past_performers:
        ptype = p.get('type', '')
        count = p.get('count', 1)
        past_types[ptype] = past_types.get(ptype, 0) + count

    # Check for exact match (same types and counts)
    if request_types == past_types:
        return ("exact", 1.0)

    # Check for similar match (same types, different counts)
    if set(request_types.keys()) == set(past_types.keys()):
        return ("similar", 0.8)

    # Check for partial match (overlapping types)
    common_types = set(request_types.keys()) & set(past_types.keys())
    if common_types:
        overlap_ratio = len(common_types) / max(len(request_types), len(past_types))
        if overlap_ratio >= 0.5:
            return ("partial", overlap_ratio * 0.6)

    return ("none", 0.0)


@router.post("/check-match", response_model=MatchingSetupResponse)
async def check_matching_setup(
    request: SetupGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if there's a matching past setup that can be reused"""
    # Get highly-rated past setups for this location
    past_setups_result = await db.execute(
        select(Setup).where(
            Setup.location_id == request.location_id,
            Setup.user_id == current_user.id,
            Setup.rating >= 4  # Only consider successful setups
        ).order_by(Setup.rating.desc(), Setup.created_at.desc()).limit(10)
    )
    past_setups = past_setups_result.scalars().all()

    if not past_setups:
        return MatchingSetupResponse(has_match=False)

    # Find the best matching setup
    best_match = None
    best_quality = "none"
    best_score = 0.0

    request_performers = [p.model_dump() for p in request.performers]

    for setup in past_setups:
        quality, score = calculate_performer_match(request_performers, setup.performers or [])
        # Boost score for higher ratings
        adjusted_score = score * (0.8 + (setup.rating or 3) * 0.04)

        if adjusted_score > best_score:
            best_score = adjusted_score
            best_quality = quality
            best_match = setup

    if best_match and best_quality in ("exact", "similar"):
        return MatchingSetupResponse(
            has_match=True,
            match_quality=best_quality,
            matching_setup={
                "id": str(best_match.id),
                "event_name": best_match.event_name,
                "event_date": str(best_match.event_date) if best_match.event_date else None,
                "performers": best_match.performers,
                "rating": best_match.rating,
                "notes": best_match.notes,
                "channel_config": best_match.channel_config,
                "eq_settings": best_match.eq_settings,
                "compression_settings": best_match.compression_settings,
                "fx_settings": best_match.fx_settings,
                "instructions": best_match.instructions
            },
            match_details=f"Found {best_quality} match from {best_match.event_name or 'previous event'} (rated {best_match.rating}/5)"
        )

    return MatchingSetupResponse(has_match=False)


@router.post("/reuse/{setup_id}", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
async def reuse_setup(
    setup_id: UUID,
    request: SetupGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reuse settings from a past setup without calling Claude"""
    # Get the past setup to reuse
    result = await db.execute(
        select(Setup).where(
            Setup.id == setup_id,
            Setup.user_id == current_user.id
        )
    )
    past_setup = result.scalar_one_or_none()

    if not past_setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Past setup not found"
        )

    # Create new setup by copying settings from past setup
    new_setup = Setup(
        location_id=request.location_id,
        user_id=current_user.id,
        event_name=request.event_name,
        event_date=request.event_date,
        performers=[p.model_dump() for p in request.performers],
        channel_config=past_setup.channel_config,
        eq_settings=past_setup.eq_settings,
        compression_settings=past_setup.compression_settings,
        fx_settings=past_setup.fx_settings,
        instructions=f"[Reused from: {past_setup.event_name or 'previous setup'}]\n\n{past_setup.instructions or ''}"
    )
    db.add(new_setup)
    await db.commit()
    await db.refresh(new_setup)

    return new_setup


@router.post("/generate", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
async def generate_setup(
    request: SetupGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a new setup using Claude API"""
    import logging
    logger = logging.getLogger(__name__)

    try:
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
        # Include ALL rated setups - we learn from both successes AND problems
        past_setups_result = await db.execute(
            select(Setup).where(
                Setup.location_id == request.location_id,
                Setup.rating.isnot(None)  # Only setups that have been rated
            ).order_by(Setup.rating.desc(), Setup.created_at.desc()).limit(5)
        )
        past_setups = past_setups_result.scalars().all()
        logger.info(f"Found {len(past_setups)} past rated setups for learning")

        # Get user's gear inventory with learned settings
        gear_result = await db.execute(
            select(Gear).where(Gear.user_id == current_user.id)
        )
        gear_items = gear_result.scalars().all()
        
        # Convert gear to dict format for the generator
        user_gear = []
        for gear in gear_items:
            gear_dict = {
                "id": str(gear.id),
                "type": gear.type,
                "brand": gear.brand,
                "model": gear.model,
                "quantity": gear.quantity,
                "specs": gear.specs,
                "default_settings": gear.default_settings,
                "notes": gear.notes
            }
            user_gear.append(gear_dict)
        logger.info(f"Found {len(user_gear)} gear items in user's inventory")

        # Generate setup using Claude API
        logger.info(f"Generating setup for location {location.name} with {len(request.performers)} performers")
        generator = SetupGenerator()
        setup_data = await generator.generate(
            location=location,
            performers=[p.model_dump() for p in request.performers],
            past_setups=past_setups,
            user=current_user,
            user_gear=user_gear
        )
        logger.info("Setup generated successfully from Claude API")

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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating setup: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating setup: {type(e).__name__}: {str(e)}"
        )


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


@router.get("/shared/all", response_model=List[SetupResponse])
async def get_shared_setups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all shared setups from other users"""
    result = await db.execute(
        select(Setup, User).join(User, Setup.user_id == User.id).where(
            Setup.is_shared == True,
            Setup.user_id != current_user.id  # Exclude own setups
        ).order_by(Setup.created_at.desc())
    )
    rows = result.all()

    setups_with_owner = []
    for setup, owner in rows:
        response = SetupResponse.model_validate(setup)
        response.owner_name = owner.name or owner.email
        setups_with_owner.append(response)

    return setups_with_owner


@router.get("/admin/all", response_model=List[SetupResponse])
async def get_all_setups_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all setups from all users (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    result = await db.execute(
        select(Setup, User).join(User, Setup.user_id == User.id)
        .order_by(Setup.created_at.desc())
    )
    rows = result.all()

    setups_with_owner = []
    for setup, owner in rows:
        response = SetupResponse.model_validate(setup)
        response.owner_name = owner.name or owner.email
        setups_with_owner.append(response)

    return setups_with_owner


@router.get("/{setup_id}", response_model=SetupResponse)
async def get_setup(
    setup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific setup (own, shared, or any if admin)"""
    # Build query - admins can see all, others can see own or shared
    if current_user.is_admin:
        result = await db.execute(
            select(Setup, User).join(User, Setup.user_id == User.id).where(
                Setup.id == setup_id
            )
        )
    else:
        result = await db.execute(
            select(Setup, User).join(User, Setup.user_id == User.id).where(
                Setup.id == setup_id,
                or_(
                    Setup.user_id == current_user.id,
                    Setup.is_shared == True
                )
            )
        )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setup not found"
        )

    setup, owner = row
    # Add owner name for setups not owned by current user
    response = SetupResponse.model_validate(setup)
    if setup.user_id != current_user.id:
        response.owner_name = owner.name or owner.email
    return response


@router.post("/{setup_id}/refresh", response_model=SetupResponse)
async def refresh_setup(
    setup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh a setup by regenerating it with Claude using latest knowledge.

    This keeps the same event details (location, performers, event name/date)
    but regenerates the channel config, EQ, compression, FX, and instructions
    using the latest knowledge base and any new learnings from rated setups.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Get the existing setup
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

    # Get the location
    result = await db.execute(
        select(Location).where(
            Location.id == setup.location_id,
            Location.user_id == current_user.id
        )
    )
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    try:
        # Get past setups for learning (excluding this one)
        past_setups_result = await db.execute(
            select(Setup).where(
                Setup.location_id == setup.location_id,
                Setup.rating.isnot(None),
                Setup.id != setup_id  # Exclude current setup
            ).order_by(Setup.rating.desc(), Setup.created_at.desc()).limit(5)
        )
        past_setups = past_setups_result.scalars().all()
        logger.info(f"Refreshing setup {setup_id} with {len(past_setups)} past setups for learning")

        # Get user's gear inventory with learned settings
        gear_result = await db.execute(
            select(Gear).where(Gear.user_id == current_user.id)
        )
        gear_items = gear_result.scalars().all()
        
        # Convert gear to dict format for the generator
        user_gear = []
        for gear in gear_items:
            gear_dict = {
                "id": str(gear.id),
                "type": gear.type,
                "brand": gear.brand,
                "model": gear.model,
                "quantity": gear.quantity,
                "specs": gear.specs,
                "default_settings": gear.default_settings,
                "notes": gear.notes
            }
            user_gear.append(gear_dict)
        logger.info(f"Found {len(user_gear)} gear items for refresh")

        # Regenerate using Claude API
        generator = SetupGenerator()
        setup_data = await generator.generate(
            location=location,
            performers=setup.performers or [],
            past_setups=past_setups,
            user=current_user,
            user_gear=user_gear
        )
        logger.info("Setup regenerated successfully from Claude API")

        # Update the setup with new data
        setup.channel_config = setup_data.get("channel_config")
        setup.eq_settings = setup_data.get("eq_settings")
        setup.compression_settings = setup_data.get("compression_settings")
        setup.fx_settings = setup_data.get("fx_settings")
        setup.instructions = f"[Refreshed on {datetime.now().strftime('%Y-%m-%d %H:%M')}]\n\n{setup_data.get('instructions', '')}"

        await db.commit()
        await db.refresh(setup)

        return setup
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing setup: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing setup: {type(e).__name__}: {str(e)}"
        )


@router.put("/{setup_id}", response_model=SetupResponse)
async def update_setup(
    setup_id: UUID,
    setup_data: SetupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a setup (notes, rating, sharing settings)"""
    # First check if user owns it
    result = await db.execute(
        select(Setup).where(Setup.id == setup_id)
    )
    setup = result.scalar_one_or_none()

    if not setup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setup not found"
        )

    is_owner = setup.user_id == current_user.id
    is_admin = current_user.is_admin
    has_full_access = setup.is_shared and setup.shared_full_access

    # Check permissions - admins can edit anything
    if not is_owner and not is_admin and not has_full_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this setup"
        )

    # Only owner or admin can change sharing settings
    if not is_owner and not is_admin:
        if setup_data.is_shared is not None or setup_data.shared_full_access is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can change sharing settings"
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
