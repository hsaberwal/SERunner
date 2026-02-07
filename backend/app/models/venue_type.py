"""
Venue Type Profile Model

Stores learned acoustic characteristics for venue types.
When a user adds a new venue type, Claude researches the general
acoustic properties, sound goals, and engineering approach.
This data is then used by the setup generator as contextual guidance.
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class VenueTypeProfile(Base):
    __tablename__ = "venue_type_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Identification
    name = Column(String(100), nullable=False)  # e.g. "Church", "Gurdwara", "Studio"
    display_name = Column(String(150))  # e.g. "Church (Reverberant Worship Space)"
    category = Column(String(50), nullable=False)  # worship, performance, commercial, education, outdoor, other
    value_key = Column(String(100), nullable=False)  # URL-safe key: "church", "gurdwara", "studio"

    # Learned from Claude - acoustic characteristics
    description = Column(Text)  # Brief description of venue type acoustics
    acoustic_characteristics = Column(JSONB)  # RT60, surfaces, ceiling height, problem freqs
    sound_goals = Column(JSONB)  # What good sound means (clarity, warmth, energy)
    acoustic_challenges = Column(JSONB)  # Common problems (reflections, standing waves)
    eq_strategy = Column(JSONB)  # General EQ approach (HPF tendency, problem bands)
    fx_approach = Column(JSONB)  # Reverb strategy (natural vs added, type, amount)
    compression_philosophy = Column(JSONB)  # How aggressive (worship=gentle, club=heavy)
    monitoring_notes = Column(Text)  # Monitor mix considerations
    special_considerations = Column(Text)  # Unique factors (ceremonies, noise restrictions)
    knowledge_base_entry = Column(Text)  # Full markdown entry for Claude context injection

    # User customization
    user_notes = Column(Text)
    is_active = Column(String(5), default="true")  # "true"/"false" - whether to show in dropdown

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="venue_type_profiles")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "display_name": self.display_name or self.name,
            "category": self.category,
            "value_key": self.value_key,
            "description": self.description,
            "acoustic_characteristics": self.acoustic_characteristics,
            "sound_goals": self.sound_goals,
            "acoustic_challenges": self.acoustic_challenges,
            "eq_strategy": self.eq_strategy,
            "fx_approach": self.fx_approach,
            "compression_philosophy": self.compression_philosophy,
            "monitoring_notes": self.monitoring_notes,
            "special_considerations": self.special_considerations,
            "knowledge_base_entry": self.knowledge_base_entry,
            "user_notes": self.user_notes,
            "is_active": self.is_active == "true",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
