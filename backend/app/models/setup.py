from sqlalchemy import Column, String, Text, Integer, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Setup(Base):
    __tablename__ = "setups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_name = Column(String)
    event_date = Column(Date)
    performers = Column(JSONB, nullable=False)  # array of performer objects
    channel_config = Column(JSONB)  # generated channel assignments
    eq_settings = Column(JSONB)  # per-channel EQ
    compression_settings = Column(JSONB)  # per-channel compression
    fx_settings = Column(JSONB)  # reverb, delay assignments
    instructions = Column(Text)  # step-by-step guide
    notes = Column(Text)  # user notes, what worked/didn't
    rating = Column(Integer)  # 1-5, how well it worked
    corrections = Column(JSONB)  # per-channel corrections made during event
    created_at = Column(DateTime, default=datetime.utcnow)
    # Sharing settings
    is_shared = Column(Boolean, default=False)  # visible to other users
    shared_full_access = Column(Boolean, default=False)  # others can edit if True, read-only if False

    # Relationships
    location = relationship("Location", back_populates="setups")
    user = relationship("User", back_populates="setups")
