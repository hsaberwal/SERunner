"""Usage tracking service - checks and records Claude API usage against plan limits."""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)


async def get_or_create_subscription(user: User, db: AsyncSession) -> Subscription:
    """Get the user's subscription, creating a free one if none exists."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        # Create default subscription
        plan = "admin" if user.is_admin else "free"
        subscription = Subscription(
            user_id=user.id,
            plan=plan,
            status="active",
        )
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
        logger.info(f"Created {plan} subscription for user {user.email}")

    return subscription


async def check_generation_allowed(user: User, db: AsyncSession) -> Subscription:
    """Check if user can generate a setup. Raises HTTPException if not."""
    subscription = await get_or_create_subscription(user, db)

    if not subscription.can_generate():
        limit = subscription.generation_limit
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "usage_limit_reached",
                "message": f"You've used all {limit} setup generations for this billing period. Upgrade your plan for more.",
                "plan": subscription.plan,
                "used": subscription.generations_used,
                "limit": limit,
            }
        )

    return subscription


async def check_learning_allowed(user: User, db: AsyncSession) -> Subscription:
    """Check if user can learn hardware. Raises HTTPException if not."""
    subscription = await get_or_create_subscription(user, db)

    if not subscription.can_learn():
        limit = subscription.learning_limit
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "usage_limit_reached",
                "message": f"You've used all {limit} hardware learnings for this billing period. Upgrade your plan for more.",
                "plan": subscription.plan,
                "used": subscription.learning_used,
                "limit": limit,
            }
        )

    return subscription


async def record_generation(subscription: Subscription, db: AsyncSession):
    """Increment generation count after successful generation."""
    subscription.generations_used = (subscription.generations_used or 0) + 1
    await db.commit()
    logger.info(f"User generation count: {subscription.generations_used}/{subscription.generation_limit}")


async def record_learning(subscription: Subscription, db: AsyncSession):
    """Increment learning count after successful learning."""
    subscription.learning_used = (subscription.learning_used or 0) + 1
    await db.commit()
    logger.info(f"User learning count: {subscription.learning_used}/{subscription.learning_limit}")
