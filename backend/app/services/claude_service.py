import httpx
from anthropic import AsyncAnthropic
from app.config import get_settings

settings = get_settings()


class ClaudeService:
    """Service for interacting with Claude API"""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.anthropic_api_key
        # Set a longer timeout for Claude API calls (3 minutes)
        self.client = AsyncAnthropic(
            api_key=self.api_key,
            timeout=httpx.Timeout(180.0, connect=30.0)
        )
        self.model = settings.claude_model

    async def generate_setup(self, system_prompt: str, user_prompt: str) -> str:
        """Generate a setup using Claude API"""
        print(f"=== CLAUDE SERVICE: Using model {self.model} ===", flush=True)
        print(f"=== CLAUDE SERVICE: System prompt length={len(system_prompt)} ===", flush=True)
        print(f"=== CLAUDE SERVICE: User prompt length={len(user_prompt)} ===", flush=True)

        try:
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=8192,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )

            print(f"=== CLAUDE SERVICE: Response stop_reason={message.stop_reason} ===", flush=True)
            print(f"=== CLAUDE SERVICE: Response content length={len(message.content)} ===", flush=True)
            print(f"=== CLAUDE SERVICE: Response usage={message.usage} ===", flush=True)

            if message.content and len(message.content) > 0:
                text = message.content[0].text
                print(f"=== CLAUDE SERVICE: Text length={len(text) if text else 0} ===", flush=True)
                return text
            else:
                print("=== CLAUDE SERVICE: No content in response! ===", flush=True)
                return ""
        except httpx.TimeoutException as e:
            print(f"=== CLAUDE SERVICE: TIMEOUT ERROR: {e} ===", flush=True)
            raise Exception(f"Claude API timeout after 180 seconds: {str(e)}")
        except Exception as e:
            print(f"=== CLAUDE SERVICE: ERROR: {type(e).__name__}: {e} ===", flush=True)
            raise
