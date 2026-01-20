from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    venue_type = Column(String)  # church, hall, outdoor, etc.
    notes = Column(Text)
    speaker_setup = Column(JSONB)  # FOH speakers, monitors, etc.
    default_config = Column(JSONB)  # saved QuPac scene defaults
    lr_geq_cuts = Column(JSONB)  # LR main GEQ cuts from ring-out {"250Hz": -3, "1.6kHz": -4, ...}
    monitor_geq_cuts = Column(JSONB)  # Monitor GEQ cuts from ring-out
    lr_peq = Column(JSONB)  # LR 4-band PEQ settings {band1: {freq, gain, width}, ...}
    monitor_peq = Column(JSONB)  # Monitor 4-band PEQ settings
    room_notes = Column(Text)  # Acoustic notes: dead spots, reflections, problem areas
    is_temporary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="locations")
    setups = relationship("Setup", back_populates="location", cascade="all, delete-orphan")
