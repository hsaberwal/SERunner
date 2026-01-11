"""Base Pydantic models with common serialization patterns.

All response models should inherit from BaseResponse to ensure consistent
UUID and datetime serialization across the API.
"""
from pydantic import BaseModel, field_serializer
from uuid import UUID
from datetime import datetime
from typing import Optional


class BaseResponse(BaseModel):
    """Base response model with automatic UUID and datetime serialization.

    Inherit from this class for any response model that includes:
    - id: UUID field
    - created_at: datetime field

    Example:
        class LocationResponse(BaseResponse):
            id: UUID
            name: str
            created_at: datetime
            # UUID and datetime are automatically serialized to strings
    """
    model_config = {"from_attributes": True}

    @field_serializer('id', check_fields=False)
    def serialize_id(self, value: UUID) -> str:
        """Convert UUID to string for JSON serialization."""
        return str(value) if value else None

    @field_serializer('created_at', check_fields=False)
    def serialize_created_at(self, value: datetime) -> str:
        """Convert datetime to ISO format string for JSON serialization."""
        return value.isoformat() if value else None


class BaseResponseWithLocation(BaseResponse):
    """Base response for models that have a location_id field."""

    @field_serializer('location_id', check_fields=False)
    def serialize_location_id(self, value: UUID) -> str:
        """Convert location UUID to string for JSON serialization."""
        return str(value) if value else None


class BaseResponseWithUser(BaseResponse):
    """Base response for models that have a user_id field."""

    @field_serializer('user_id', check_fields=False)
    def serialize_user_id(self, value: UUID) -> str:
        """Convert user UUID to string for JSON serialization."""
        return str(value) if value else None
