from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.database import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String, nullable=False)  # mixer, mic_technique, troubleshooting
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String)  # manual, learned, user
    created_at = Column(DateTime, default=datetime.utcnow)
