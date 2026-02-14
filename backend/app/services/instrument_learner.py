"""
Instrument Learner Service

Uses Claude to research and learn the best live sound settings
for any instrument or performer type, including:
- Mic selection and placement
- EQ settings (HPF, parametric bands)
- Compression settings
- FX recommendations (reverb type, send levels)
- General mixing approach
"""

import json
import logging
from typing import Optional, Dict, Any

from app.services.claude_service import ClaudeService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class InstrumentLearner:
    def __init__(self, api_key: str = None):
        self.claude = ClaudeService(api_key=api_key or settings.anthropic_api_key)

    async def learn_instrument(
        self,
        instrument_name: str,
        category: str = "other",
        user_notes: str = None,
    ) -> Dict[str, Any]:
        """Learn comprehensive live sound settings for an instrument."""

        system_prompt = """You are a professional live sound engineer with 20+ years of experience.
You specialize in live Sikh devotional music (Kirtan) and general live sound reinforcement.

Your task is to provide comprehensive mixing knowledge for a specific instrument or performer type.
The output will be stored in a database and used to configure a QuPac digital mixer.

You MUST return a valid JSON object with this EXACT structure:
{
    "description": "Brief 1-2 sentence description of the instrument and its sound characteristics",
    "display_name": "Instrument Name (Short Description)",
    "mic_recommendations": {
        "primary": {
            "type": "dynamic|condenser|ribbon|di",
            "examples": ["Mic Model 1", "Mic Model 2"],
            "placement": "Description of optimal mic placement",
            "distance": "Recommended distance from source",
            "notes": "Any special considerations"
        },
        "alternative": {
            "type": "...",
            "examples": ["..."],
            "placement": "...",
            "notes": "When to use this alternative"
        },
        "di_notes": "If applicable - DI/piezo pickup considerations, or null"
    },
    "eq_settings": {
        "hpf": {"frequency": 80, "enabled": true, "notes": "Why this HPF frequency"},
        "band1": {"frequency": 250, "gain": -3.0, "freq_range": "170-370Hz", "purpose": "What this cut/boost achieves"},
        "band2": {"frequency": 500, "gain": 0.0, "freq_range": "330-750Hz", "purpose": "..."},
        "band3": {"frequency": 3000, "gain": 2.0, "freq_range": "2-4.5kHz", "purpose": "..."},
        "band4": {"frequency": 8000, "gain": 3.0, "freq_range": "5.2-12kHz", "purpose": "..."},
        "notes": "General EQ approach for this instrument"
    },
    "compression_settings": {
        "attack_ms": 15,
        "release_ms": 100,
        "threshold_db": -10,
        "ratio": "3:1",
        "gain_db": 2.0,
        "soft_knee": true,
        "notes": "Why these settings work for this instrument"
    },
    "fx_recommendations": {
        "primary_fx": "plate|hall|room|chamber|none",
        "fx_engine": "FX1|FX2|FX3|none",
        "send_level_db": -10,
        "suggested_preset": "e.g. Hall Large, Plate Vocal, etc. from QuPac FX Library",
        "secondary_fx": "none|hall|plate",
        "secondary_engine": "none|FX1|FX2",
        "secondary_send_db": null,
        "monitor_reverb": true,
        "monitor_send_db": -15,
        "notes": "FX approach for this instrument (our FX1=Plate category for vocals, FX2=Hall category for spacious instruments, FX3=Room category for monitors)"
    },
    "mixing_notes": "3-5 sentences covering: frequency range, common problems, interaction with other instruments, gain staging tips, and any special considerations for live Kirtan or worship music contexts.",
    "knowledge_base_entry": "A complete markdown section (like in our knowledge base) with ### heading, EQ table, compression table, and quick reference starting point. Format it ready to paste into our sound-knowledge-base.md file."
}

IMPORTANT RULES:
- EQ gain values: negative = cut, positive = boost, 0 = flat
- For each EQ band, provide freq_range showing the approximate frequency range affected (e.g., "170-370Hz")
- The QuPac PEQ displays a logarithmic curve on the touchscreen - users set width visually using the frequency range
- All frequencies in Hz (use 2500 not 2.5kHz in JSON)
- QuPac FX Library categories: Arena, Chamber, EMT, Hall, Overheads, Plate, Room, Slap, Delays, Modulators, Gated Verb
- FX engine mapping: FX1=Plate category (vocals/speech), FX2=Hall category (spacious instruments), FX3=Room category (monitors)
- Suggest specific QuPac FX Library presets where possible (e.g., Hall Large, Hall Strings, Plate Vocal)
- For Kirtan instruments, consider how they sit alongside harmonium, tabla, and vocals
- Return ONLY the JSON object, no markdown formatting or explanation outside it
"""

        user_prompt = f"""Learn comprehensive live sound settings for: **{instrument_name}**

Category: {category}

{f"User notes: {user_notes}" if user_notes else ""}

Consider:
1. What mics work best for this instrument in a LIVE setting (not studio)?
2. What frequency problems are common and how to EQ them?
3. What compression approach keeps it musical but controlled?
4. What reverb/FX type gives it the right space without muddying the mix?
5. How does it typically interact with other instruments in a live Kirtan or band setting?
6. Any special considerations for monitoring (what does the performer need to hear)?

Return the JSON object with all settings."""

        try:
            response_text, duration = await self.claude.generate_setup_with_timing(
                system_prompt=system_prompt,
                user_prompt=user_prompt
            )

            # Record timing
            from app.main import record_response_time
            await record_response_time(
                "instrument_learning",
                duration,
                prompt_length=len(user_prompt),
                response_length=len(response_text)
            )

            # Parse JSON from response
            result = self._parse_response(response_text)

            if result:
                # Generate a URL-safe value key
                result["value_key"] = self._make_value_key(instrument_name)
                result["name"] = instrument_name
                result["category"] = category
                return result
            else:
                return {"error": "Failed to parse instrument learning response"}

        except Exception as e:
            logger.error(f"Instrument learning failed: {e}")
            return {"error": str(e)}

    def _parse_response(self, text: str) -> Optional[Dict]:
        """Parse Claude's JSON response."""
        # Try direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from markdown code block
        import re
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try finding JSON object in text
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        logger.error(f"Failed to parse instrument learning response: {text[:200]}")
        return None

    def _make_value_key(self, name: str) -> str:
        """Create a URL-safe value key from instrument name."""
        import re
        key = name.lower().strip()
        key = re.sub(r'[^a-z0-9\s]', '', key)
        key = re.sub(r'\s+', '_', key)
        return key
