from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime, timedelta
from typing import List

from app.database import get_db
from app.models.user import User
from app.utils.auth import (
    create_access_token,
    verify_password,
    get_password_hash,
    get_current_user
)
from app.config import get_settings
from app.schemas import BaseResponse

router = APIRouter()
settings = get_settings()


class UserRegister(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    is_approved: bool
    is_admin: bool


class UserResponse(BaseResponse):
    """User response with automatic UUID serialization."""
    id: UUID
    email: str
    role: str
    is_approved: bool
    is_admin: bool


class UserAdminResponse(BaseResponse):
    """Admin view of user with all details."""
    id: UUID
    email: str
    role: str
    is_approved: bool
    is_admin: bool
    created_at: datetime


class UserApproval(BaseModel):
    is_approved: bool


class UserAdminUpdate(BaseModel):
    is_approved: bool | None = None
    is_admin: bool | None = None


class RegistrationResponse(BaseModel):
    message: str
    pending_approval: bool


@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user - requires admin approval before access is granted"""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if this is the first user (make them admin automatically)
    count_result = await db.execute(select(func.count(User.id)))
    user_count = count_result.scalar()
    is_first_user = user_count == 0

    # Create new user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        is_approved=is_first_user,  # First user is auto-approved
        is_admin=is_first_user  # First user is auto-admin
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    if is_first_user:
        return {
            "message": "Account created! You are the first user and have been granted admin access.",
            "pending_approval": False
        }
    else:
        return {
            "message": "Registration submitted. Please wait for an admin to approve your account.",
            "pending_approval": True
        }


@router.post("/login", response_model=LoginResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login user and return JWT token"""
    # Find user
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is approved
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval. Please contact an administrator."
        )

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_approved": user.is_approved,
        "is_admin": user.is_admin
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user


# ============== Admin Endpoints ==============

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the current user is an admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("/admin/users", response_model=List[UserAdminResponse])
async def get_all_users(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all users (admin only)"""
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return users


@router.get("/admin/users/pending", response_model=List[UserAdminResponse])
async def get_pending_users(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Get users pending approval (admin only)"""
    result = await db.execute(
        select(User).where(User.is_approved == False).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return users


@router.put("/admin/users/{user_id}/approve", response_model=UserAdminResponse)
async def approve_user(
    user_id: UUID,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Approve a user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_approved = True
    await db.commit()
    await db.refresh(user)

    return user


@router.put("/admin/users/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_user(
    user_id: UUID,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Reject and delete a pending user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject an already approved user. Use revoke instead."
        )

    await db.delete(user)
    await db.commit()


@router.put("/admin/users/{user_id}/revoke", response_model=UserAdminResponse)
async def revoke_user(
    user_id: UUID,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke access for an approved user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke your own access"
        )

    user.is_approved = False
    await db.commit()
    await db.refresh(user)

    return user


@router.put("/admin/users/{user_id}/toggle-admin", response_model=UserAdminResponse)
async def toggle_admin(
    user_id: UUID,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle admin status for a user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own admin status"
        )

    user.is_admin = not user.is_admin
    await db.commit()
    await db.refresh(user)

    return user


class AdminCreateUser(BaseModel):
    email: EmailStr
    password: str
    plan: str = "free"  # free, basic, pro


@router.post("/admin/users/create", response_model=UserAdminResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    user_data: AdminCreateUser,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user directly (admin only) - pre-approved with optional plan."""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create user (pre-approved)
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        is_approved=True,
        is_admin=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create subscription with the specified plan
    from app.models.subscription import Subscription
    subscription = Subscription(
        user_id=user.id,
        plan=user_data.plan,
        status="active",
    )
    db.add(subscription)
    await db.commit()

    return user
