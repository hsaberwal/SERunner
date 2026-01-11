from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="operator")  # operator, admin
    api_key = Column(String, nullable=True)  # optional personal Claude API key
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    locations = relationship("Location", back_populates="user", cascade="all, delete-orphan")
    setups = relationship("Setup", back_populates="user", cascade="all, delete-orphan")
    gear = relationship("Gear", back_populates="user", cascade="all, delete-orphan")
