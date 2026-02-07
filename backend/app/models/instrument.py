"""
Instrument Profile Model

Stores learned instrument/performer type settings.
When a user adds a new instrument, Claude researches the best
mic placement, EQ, compression, FX, and general mixing approach.
This data is then used by the setup generator for accurate recommendations.
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class InstrumentProfile(Base):
    __tablename__ = "instrument_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Identification
    name = Column(String(100), nullable=False)  # e.g. "Dhol", "Sitar", "Bansuri"
    display_name = Column(String(150))  # e.g. "Dhol (Double-Headed Drum)"
    category = Column(String(50), nullable=False)  # vocals, speech, percussion, wind, strings, keys, other
    value_key = Column(String(100), nullable=False)  # URL-safe key for dropdown, e.g. "dhol", "sitar"

    # Learned from Claude
    description = Column(Text)  # Brief description of the instrument
    mic_recommendations = Column(JSONB)  # Best mic types, placement, distance
    eq_settings = Column(JSONB)  # HPF, band recommendations
    compression_settings = Column(JSONB)  # Attack, release, ratio, etc.
    fx_recommendations = Column(JSONB)  # Which FX, send levels
    mixing_notes = Column(Text)  # General mixing approach and tips
    knowledge_base_entry = Column(Text)  # Full markdown entry for Claude

    # User customization
    user_notes = Column(Text)
    is_active = Column(String(5), default="true")  # "true"/"false" - whether to show in dropdown

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="instrument_profiles")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "display_name": self.display_name or self.name,
            "category": self.category,
            "value_key": self.value_key,
            "description": self.description,
            "mic_recommendations": self.mic_recommendations,
            "eq_settings": self.eq_settings,
            "compression_settings": self.compression_settings,
            "fx_recommendations": self.fx_recommendations,
            "mixing_notes": self.mixing_notes,
            "knowledge_base_entry": self.knowledge_base_entry,
            "user_notes": self.user_notes,
            "is_active": self.is_active == "true",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
