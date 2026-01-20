"""
Knowledge Library Model

Stores learned hardware information that may or may not be in the user's inventory.
Useful for:
- Venue-installed equipment (amps, speakers, mixers)
- Researched gear before purchase
- Reference devices for Claude to know about
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class LearnedHardware(Base):
    __tablename__ = "learned_hardware"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Hardware identification
    hardware_type = Column(String(50), nullable=False)  # mic, speaker, amplifier, di_box, mixer
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    
    # Learned information from Claude
    characteristics = Column(Text)
    best_for = Column(Text)
    settings_by_source = Column(JSONB)  # EQ, compression settings per source type
    knowledge_base_entry = Column(Text)  # Markdown formatted entry
    
    # Amplifier-specific fields (stored in JSONB for flexibility)
    amp_specs = Column(JSONB)  # watts_per_channel, channels, class, freq_response, etc.
    
    # User notes
    user_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="learned_hardware")

    def to_dict(self):
        """Convert to dictionary for API responses"""
        result = {
            "id": str(self.id),
            "hardware_type": self.hardware_type,
            "brand": self.brand,
            "model": self.model,
            "characteristics": self.characteristics,
            "best_for": self.best_for,
            "settings_by_source": self.settings_by_source,
            "knowledge_base_entry": self.knowledge_base_entry,
            "amp_specs": self.amp_specs,
            "user_notes": self.user_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        # Flatten amp_specs for convenience
        if self.amp_specs:
            result.update(self.amp_specs)
        
        return result
