from anthropic import AsyncAnthropic
from app.config import get_settings

settings = get_settings()


class ClaudeService:
    """Service for interacting with Claude API"""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.anthropic_api_key
        self.client = AsyncAnthropic(api_key=self.api_key)
        self.model = settings.claude_model

    async def generate_setup(self, system_prompt: str, user_prompt: str) -> str:
        """Generate a setup using Claude API"""
        message = await self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )

        return message.content[0].text
