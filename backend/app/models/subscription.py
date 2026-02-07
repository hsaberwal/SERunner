"""Subscription and usage tracking models for Stripe billing."""

from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    
    # Stripe IDs
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    
    # Plan info
    plan = Column(String(20), default="free")  # free, basic, pro, admin
    status = Column(String(30), default="active")  # active, past_due, canceled, trialing
    
    # Usage tracking (resets each billing period)
    generations_used = Column(Integer, default=0)
    learning_used = Column(Integer, default=0)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    canceled_at = Column(DateTime, nullable=True)

    # Relationship
    user = relationship("User", backref="subscription")

    # Plan limits
    PLAN_LIMITS = {
        "free": {"generations": 2, "learning": 3},
        "basic": {"generations": 15, "learning": 20},
        "pro": {"generations": -1, "learning": -1},  # -1 = unlimited
        "admin": {"generations": -1, "learning": -1},  # Admin gets unlimited
    }

    @property
    def generation_limit(self):
        return self.PLAN_LIMITS.get(self.plan, self.PLAN_LIMITS["free"])["generations"]

    @property
    def learning_limit(self):
        return self.PLAN_LIMITS.get(self.plan, self.PLAN_LIMITS["free"])["learning"]

    @property
    def is_active(self):
        return self.status in ("active", "trialing")

    def can_generate(self):
        """Check if user can generate a setup."""
        if self.plan in ("pro", "admin"):
            return True
        if not self.is_active:
            return False
        limit = self.generation_limit
        if limit == -1:
            return True
        return self.generations_used < limit

    def can_learn(self):
        """Check if user can learn hardware."""
        if self.plan in ("pro", "admin"):
            return True
        if not self.is_active:
            return False
        limit = self.learning_limit
        if limit == -1:
            return True
        return self.learning_used < limit

    def to_dict(self):
        gen_limit = self.generation_limit
        learn_limit = self.learning_limit
        return {
            "id": str(self.id),
            "plan": self.plan,
            "status": self.status,
            "generations_used": self.generations_used,
            "generation_limit": gen_limit if gen_limit != -1 else "unlimited",
            "learning_used": self.learning_used,
            "learning_limit": learn_limit if learn_limit != -1 else "unlimited",
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "stripe_customer_id": self.stripe_customer_id,
            "stripe_subscription_id": self.stripe_subscription_id,
            "canceled_at": self.canceled_at.isoformat() if self.canceled_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
