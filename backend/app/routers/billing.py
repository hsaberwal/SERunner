"""Billing routes for Stripe subscription management."""

import logging
import stripe
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.utils.auth import get_current_user
from app.services.usage_tracker import get_or_create_subscription
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Initialize Stripe
stripe.api_key = settings.stripe_secret_key


# ============== Schemas ==============

class CreateCheckoutRequest(BaseModel):
    plan: str  # "basic" or "pro"
    success_url: str
    cancel_url: str


class BillingResponse(BaseModel):
    plan: str
    status: str
    generations_used: int
    generation_limit: object  # int or "unlimited"
    learning_used: int
    learning_limit: object  # int or "unlimited"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    canceled_at: Optional[str] = None


# ============== Endpoints ==============

@router.get("/status")
async def get_billing_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's billing status and usage."""
    subscription = await get_or_create_subscription(current_user, db)
    return subscription.to_dict()


@router.get("/plans")
async def get_plans():
    """Get available subscription plans and pricing."""
    return {
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price": 0,
                "interval": "month",
                "features": [
                    "2 AI setup generations per month",
                    "3 hardware learnings per month",
                    "View & manage locations",
                    "Gear inventory management",
                ],
                "limits": Subscription.PLAN_LIMITS["free"],
            },
            {
                "id": "basic",
                "name": "Basic",
                "price": 8,
                "interval": "month",
                "stripe_price_id": settings.stripe_price_basic,
                "features": [
                    "15 AI setup generations per month",
                    "20 hardware learnings per month",
                    "Smart setup matching & reuse",
                    "Full event wizard access",
                    "Knowledge library",
                ],
                "limits": Subscription.PLAN_LIMITS["basic"],
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 18,
                "interval": "month",
                "stripe_price_id": settings.stripe_price_pro,
                "features": [
                    "Unlimited AI setup generations",
                    "Unlimited hardware learnings",
                    "Priority AI processing",
                    "Full event wizard access",
                    "Knowledge library",
                    "Shared setups",
                ],
                "limits": Subscription.PLAN_LIMITS["pro"],
            },
        ],
        "publishable_key": settings.stripe_publishable_key,
    }


@router.post("/create-checkout")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a Stripe Checkout session for subscription."""
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured. Please contact the administrator."
        )

    # Validate plan
    price_map = {
        "basic": settings.stripe_price_basic,
        "pro": settings.stripe_price_pro,
    }

    if request.plan not in price_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan. Choose 'basic' or 'pro'."
        )

    price_id = price_map[request.plan]
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stripe price for '{request.plan}' plan is not configured."
        )

    subscription = await get_or_create_subscription(current_user, db)

    try:
        # Get or create Stripe customer
        if subscription.stripe_customer_id:
            customer_id = subscription.stripe_customer_id
        else:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": str(current_user.id)},
            )
            customer_id = customer.id
            subscription.stripe_customer_id = customer_id
            await db.commit()

        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=request.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.cancel_url,
            metadata={
                "user_id": str(current_user.id),
                "plan": request.plan,
            },
            subscription_data={
                "metadata": {
                    "user_id": str(current_user.id),
                    "plan": request.plan,
                },
            },
        )

        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment service error: {str(e)}"
        )


@router.post("/create-portal")
async def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a Stripe Customer Portal session for managing billing."""
    subscription = await get_or_create_subscription(current_user, db)

    if not subscription.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Subscribe to a plan first."
        )

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=settings.frontend_url + "/billing",
        )
        return {"portal_url": portal_session.url}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating portal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment service error: {str(e)}"
        )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # Verify webhook signature if secret is configured
    if settings.stripe_webhook_secret:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
        except stripe.error.SignatureVerificationError:
            logger.error("Webhook signature verification failed")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        import json
        event = json.loads(payload)

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    logger.info(f"Stripe webhook received: {event_type}")

    try:
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(data, db)

        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(data, db)

        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(data, db)

        elif event_type == "invoice.paid":
            await handle_invoice_paid(data, db)

        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(data, db)

    except Exception as e:
        logger.error(f"Error handling webhook {event_type}: {e}")
        # Don't raise - always return 200 to Stripe to avoid retries on our errors

    return {"status": "ok"}


# ============== Webhook Handlers ==============

async def handle_checkout_completed(data: dict, db: AsyncSession):
    """Handle successful checkout - activate subscription."""
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")
    metadata = data.get("metadata", {})
    plan = metadata.get("plan", "basic")

    # Find subscription by customer ID
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        subscription.stripe_subscription_id = subscription_id
        subscription.plan = plan
        subscription.status = "active"
        subscription.generations_used = 0  # Reset on new subscription
        subscription.learning_used = 0
        await db.commit()
        logger.info(f"Activated {plan} subscription for customer {customer_id}")
    else:
        logger.warning(f"No subscription found for customer {customer_id}")


async def handle_subscription_updated(data: dict, db: AsyncSession):
    """Handle subscription updates (plan changes, status changes)."""
    subscription_id = data.get("id")
    status_val = data.get("status")
    plan = data.get("metadata", {}).get("plan")

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        if status_val:
            subscription.status = status_val
        if plan:
            subscription.plan = plan
        
        # Update period dates
        current_period_start = data.get("current_period_start")
        current_period_end = data.get("current_period_end")
        if current_period_start:
            subscription.period_start = datetime.fromtimestamp(current_period_start)
        if current_period_end:
            subscription.period_end = datetime.fromtimestamp(current_period_end)

        cancel_at = data.get("canceled_at")
        if cancel_at:
            subscription.canceled_at = datetime.fromtimestamp(cancel_at)

        await db.commit()
        logger.info(f"Updated subscription {subscription_id}: status={status_val}, plan={plan}")


async def handle_subscription_deleted(data: dict, db: AsyncSession):
    """Handle subscription cancellation - downgrade to free."""
    subscription_id = data.get("id")

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        subscription.plan = "free"
        subscription.status = "canceled"
        subscription.canceled_at = datetime.utcnow()
        subscription.stripe_subscription_id = None
        await db.commit()
        logger.info(f"Subscription {subscription_id} canceled - downgraded to free")


async def handle_invoice_paid(data: dict, db: AsyncSession):
    """Handle successful payment - reset usage counters for new period."""
    subscription_id = data.get("subscription")
    if not subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        # Reset usage for new billing period
        subscription.generations_used = 0
        subscription.learning_used = 0
        subscription.status = "active"

        # Update period dates from the invoice's subscription data
        period_start = data.get("period_start")
        period_end = data.get("period_end")
        if period_start:
            subscription.period_start = datetime.fromtimestamp(period_start)
        if period_end:
            subscription.period_end = datetime.fromtimestamp(period_end)

        await db.commit()
        logger.info(f"Invoice paid for subscription {subscription_id} - usage reset")


async def handle_payment_failed(data: dict, db: AsyncSession):
    """Handle failed payment - mark as past_due."""
    subscription_id = data.get("subscription")
    if not subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        subscription.status = "past_due"
        await db.commit()
        logger.warning(f"Payment failed for subscription {subscription_id} - marked past_due")


# ============== Admin Endpoints ==============

@router.get("/admin/subscriptions")
async def get_all_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all subscriptions (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(Subscription, User).join(User, Subscription.user_id == User.id)
    )
    rows = result.all()

    return [
        {
            **sub.to_dict(),
            "email": user.email,
        }
        for sub, user in rows
    ]


@router.put("/admin/set-plan/{user_id}")
async def admin_set_plan(
    user_id: str,
    plan: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: manually set a user's plan."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from uuid import UUID as PyUUID
    uid = PyUUID(user_id)

    # Find user
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get or create subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == uid)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        subscription = Subscription(user_id=uid, plan=plan, status="active")
        db.add(subscription)
    else:
        subscription.plan = plan
        subscription.status = "active"

    await db.commit()
    await db.refresh(subscription)

    return subscription.to_dict()
