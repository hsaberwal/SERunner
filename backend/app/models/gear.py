from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Gear(Base):
    __tablename__ = "gear"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # mic, mixer, speaker, etc.
    brand = Column(String)
    model = Column(String)
    specs = Column(JSONB)  # polar pattern, frequency response, etc.
    default_settings = Column(JSONB)  # typical gain, EQ starting points
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="gear")
