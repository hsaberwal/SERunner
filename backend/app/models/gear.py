from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Gear(Base):
    __tablename__ = "gear"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # mic, di_box, mixer, speaker, cable, etc.
    brand = Column(String)
    model = Column(String)
    serial_number = Column(String)  # For tracking individual items
    quantity = Column(Integer, default=1)  # How many of this item you own
    specs = Column(JSONB)  # polar pattern, frequency response, etc.
    default_settings = Column(JSONB)  # typical gain, EQ starting points
    notes = Column(Text)  # Condition notes, special handling, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="gear")
    loans = relationship("GearLoan", back_populates="gear", cascade="all, delete-orphan")


class GearLoan(Base):
    """Track gear lending - who borrowed what, when, and return status"""
    __tablename__ = "gear_loans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gear_id = Column(UUID(as_uuid=True), ForeignKey("gear.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # Owner
    borrower_name = Column(String, nullable=False)  # Who borrowed it
    borrower_contact = Column(String)  # Phone or email
    quantity_loaned = Column(Integer, default=1)  # How many items loaned
    loan_date = Column(DateTime, default=datetime.utcnow)
    expected_return_date = Column(DateTime)
    actual_return_date = Column(DateTime)  # NULL if not returned yet
    is_returned = Column(Boolean, default=False)
    notes = Column(Text)  # Condition on loan, purpose, etc.
    return_notes = Column(Text)  # Condition on return, any issues

    # Relationships
    gear = relationship("Gear", back_populates="loans")
    user = relationship("User", back_populates="gear_loans")
