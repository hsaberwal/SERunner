from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.gear import Gear, GearLoan
from app.utils.auth import get_current_user
from app.schemas import BaseResponse
from app.services.hardware_learner import HardwareLearner

router = APIRouter()


# ============== Gear Schemas ==============

class GearCreate(BaseModel):
    type: str  # mic, di_box, mixer, speaker, cable, etc.
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    quantity: int = 1
    specs: Optional[dict] = None
    default_settings: Optional[dict] = None
    notes: Optional[str] = None


class GearUpdate(BaseModel):
    type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    quantity: Optional[int] = None
    specs: Optional[dict] = None
    default_settings: Optional[dict] = None
    notes: Optional[str] = None


class HardwareLearnRequest(BaseModel):
    """Request to learn settings for new hardware"""
    hardware_type: str  # microphone, speaker, amplifier
    brand: str
    model: str
    specs: Optional[dict] = None  # polar_pattern, frequency_response, etc.
    user_notes: Optional[str] = None  # Any observations the user has


class HardwareLearnResponse(BaseModel):
    """Response with learned settings for new hardware"""
    hardware_type: str
    brand: str
    model: str
    characteristics: Optional[str] = None
    best_for: Optional[str] = None
    settings_by_source: Optional[dict] = None
    knowledge_base_entry: Optional[str] = None
    error: Optional[str] = None


class GearLoanResponse(BaseResponse):
    """Gear loan response"""
    id: UUID
    gear_id: UUID
    borrower_name: str
    borrower_contact: Optional[str]
    quantity_loaned: int
    loan_date: datetime
    expected_return_date: Optional[datetime]
    actual_return_date: Optional[datetime]
    is_returned: bool
    notes: Optional[str]
    return_notes: Optional[str]


class GearResponse(BaseResponse):
    """Gear response with automatic UUID/datetime serialization."""
    id: UUID
    type: str
    brand: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    quantity: int
    specs: Optional[dict]
    default_settings: Optional[dict]
    notes: Optional[str]
    created_at: datetime
    active_loans: Optional[List[GearLoanResponse]] = None
    quantity_available: Optional[int] = None


# ============== Loan Schemas ==============

class LoanCreate(BaseModel):
    borrower_name: str
    borrower_contact: Optional[str] = None
    quantity_loaned: int = 1
    expected_return_date: Optional[datetime] = None
    notes: Optional[str] = None


class LoanReturn(BaseModel):
    return_notes: Optional[str] = None


# ============== Gear Endpoints ==============

@router.get("", response_model=List[GearResponse])
async def get_gear(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all gear for current user with loan status"""
    result = await db.execute(
        select(Gear)
        .options(selectinload(Gear.loans))
        .where(Gear.user_id == current_user.id)
        .order_by(Gear.type, Gear.brand)
    )
    gear_items = result.scalars().all()

    # Calculate available quantity for each item
    response = []
    for gear in gear_items:
        active_loans = [loan for loan in gear.loans if not loan.is_returned]
        loaned_qty = sum(loan.quantity_loaned for loan in active_loans)

        gear_dict = {
            "id": gear.id,
            "type": gear.type,
            "brand": gear.brand,
            "model": gear.model,
            "serial_number": gear.serial_number,
            "quantity": gear.quantity,
            "specs": gear.specs,
            "default_settings": gear.default_settings,
            "notes": gear.notes,
            "created_at": gear.created_at,
            "active_loans": active_loans,
            "quantity_available": gear.quantity - loaned_qty
        }
        response.append(gear_dict)

    return response


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

    return {
        **gear.__dict__,
        "active_loans": [],
        "quantity_available": gear.quantity
    }


@router.get("/{gear_id}", response_model=GearResponse)
async def get_gear_item(
    gear_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific gear item with loans"""
    result = await db.execute(
        select(Gear)
        .options(selectinload(Gear.loans))
        .where(
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

    active_loans = [loan for loan in gear.loans if not loan.is_returned]
    loaned_qty = sum(loan.quantity_loaned for loan in active_loans)

    return {
        **gear.__dict__,
        "active_loans": active_loans,
        "quantity_available": gear.quantity - loaned_qty
    }


@router.put("/{gear_id}", response_model=GearResponse)
async def update_gear(
    gear_id: UUID,
    gear_data: GearUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a gear item"""
    result = await db.execute(
        select(Gear)
        .options(selectinload(Gear.loans))
        .where(
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

    active_loans = [loan for loan in gear.loans if not loan.is_returned]
    loaned_qty = sum(loan.quantity_loaned for loan in active_loans)

    return {
        **gear.__dict__,
        "active_loans": active_loans,
        "quantity_available": gear.quantity - loaned_qty
    }


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


# ============== Hardware Learning Endpoint ==============

@router.post("/learn", response_model=HardwareLearnResponse)
async def learn_hardware_settings(
    request: HardwareLearnRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Use Claude to generate recommended settings for new hardware.

    Returns settings that can be:
    1. Saved to the gear item's default_settings
    2. Added to the knowledge base file

    This is useful when introducing a new mic, speaker, or amp
    that isn't in the knowledge base yet.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Use user's API key if available
        api_key = current_user.api_key if current_user.api_key else None
        learner = HardwareLearner(api_key=api_key)

        result = await learner.learn_hardware(
            hardware_type=request.hardware_type,
            brand=request.brand,
            model=request.model,
            specs=request.specs,
            user_notes=request.user_notes
        )

        return HardwareLearnResponse(
            hardware_type=result.get("hardware_type", request.hardware_type),
            brand=result.get("brand", request.brand),
            model=result.get("model", request.model),
            characteristics=result.get("characteristics"),
            best_for=result.get("best_for"),
            settings_by_source=result.get("settings_by_source"),
            knowledge_base_entry=result.get("knowledge_base_entry"),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Hardware learning failed: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to learn hardware settings: {str(e)}"
        )


@router.post("/{gear_id}/learn", response_model=HardwareLearnResponse)
async def learn_from_existing_gear(
    gear_id: UUID,
    user_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Learn settings for an existing gear item.

    Uses the gear's type, brand, model, and specs to generate
    recommended settings via Claude.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Get the gear item
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

    try:
        api_key = current_user.api_key if current_user.api_key else None
        learner = HardwareLearner(api_key=api_key)

        result = await learner.learn_hardware(
            hardware_type=gear.type,
            brand=gear.brand or "Unknown",
            model=gear.model or "Unknown",
            specs=gear.specs,
            user_notes=user_notes or gear.notes
        )

        # Optionally update the gear's default_settings
        if result.get("settings_by_source") and not result.get("error"):
            gear.default_settings = result.get("settings_by_source")
            await db.commit()
            await db.refresh(gear)
            logger.info(f"Updated default_settings for gear {gear_id}")

        return HardwareLearnResponse(
            hardware_type=result.get("hardware_type", gear.type),
            brand=result.get("brand", gear.brand),
            model=result.get("model", gear.model),
            characteristics=result.get("characteristics"),
            best_for=result.get("best_for"),
            settings_by_source=result.get("settings_by_source"),
            knowledge_base_entry=result.get("knowledge_base_entry"),
            error=result.get("error")
        )
    except Exception as e:
        logger.error(f"Hardware learning failed for gear {gear_id}: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to learn hardware settings: {str(e)}"
        )


# ============== Loan Endpoints ==============

@router.post("/{gear_id}/loans", response_model=GearLoanResponse, status_code=status.HTTP_201_CREATED)
async def create_loan(
    gear_id: UUID,
    loan_data: LoanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Loan out gear to someone"""
    # Get gear with loans
    result = await db.execute(
        select(Gear)
        .options(selectinload(Gear.loans))
        .where(
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

    # Check available quantity
    active_loans = [loan for loan in gear.loans if not loan.is_returned]
    loaned_qty = sum(loan.quantity_loaned for loan in active_loans)
    available = gear.quantity - loaned_qty

    if loan_data.quantity_loaned > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough available. Have {available}, trying to loan {loan_data.quantity_loaned}"
        )

    loan = GearLoan(
        gear_id=gear_id,
        user_id=current_user.id,
        **loan_data.model_dump()
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)

    return loan


@router.get("/{gear_id}/loans", response_model=List[GearLoanResponse])
async def get_gear_loans(
    gear_id: UUID,
    include_returned: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all loans for a gear item"""
    # Verify gear ownership
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

    # Get loans
    query = select(GearLoan).where(GearLoan.gear_id == gear_id)
    if not include_returned:
        query = query.where(GearLoan.is_returned == False)
    query = query.order_by(GearLoan.loan_date.desc())

    result = await db.execute(query)
    loans = result.scalars().all()

    return loans


@router.post("/{gear_id}/loans/{loan_id}/return", response_model=GearLoanResponse)
async def return_loan(
    gear_id: UUID,
    loan_id: UUID,
    return_data: LoanReturn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a loan as returned"""
    result = await db.execute(
        select(GearLoan).where(
            GearLoan.id == loan_id,
            GearLoan.gear_id == gear_id,
            GearLoan.user_id == current_user.id
        )
    )
    loan = result.scalar_one_or_none()

    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found"
        )

    if loan.is_returned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loan already returned"
        )

    loan.is_returned = True
    loan.actual_return_date = datetime.utcnow()
    loan.return_notes = return_data.return_notes

    await db.commit()
    await db.refresh(loan)

    return loan


@router.get("/loans/outstanding", response_model=List[GearLoanResponse])
async def get_all_outstanding_loans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all outstanding (not returned) loans across all gear"""
    result = await db.execute(
        select(GearLoan)
        .where(
            GearLoan.user_id == current_user.id,
            GearLoan.is_returned == False
        )
        .order_by(GearLoan.loan_date.desc())
    )
    loans = result.scalars().all()

    return loans
