"""
Venue Type Learner Service

Uses Claude to research and learn the general acoustic characteristics
of a venue type, including:
- Typical acoustic properties (RT60, surfaces, problem frequencies)
- Sound goals (clarity vs warmth vs energy)
- EQ strategy, FX approach, compression philosophy
- Monitoring considerations and special factors

This contextual guidance is used by the setup generator to tailor
mixer recommendations for the specific venue type.
"""

import json
import logging
import re
from typing import Optional, Dict, Any

from app.services.claude_service import ClaudeService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VenueTypeLearner:
    def __init__(self, api_key: str = None):
        self.claude = ClaudeService(api_key=api_key or settings.anthropic_api_key)

    async def learn_venue_type(
        self,
        venue_type_name: str,
        category: str = "other",
        user_notes: str = None,
    ) -> Dict[str, Any]:
        """Learn comprehensive acoustic characteristics for a venue type."""

        system_prompt = """You are a professional live sound engineer with 20+ years of experience
in diverse venue types. You specialize in live sound reinforcement for worship, performance,
and community events using Allen & Heath QuPac digital mixers.

Your task is to provide comprehensive acoustic knowledge about a specific VENUE TYPE.
This is NOT about a specific building - it's about the GENERAL characteristics of this
type of venue and how they affect live sound reinforcement.

The output will be stored in a database and used to provide CONTEXTUAL GUIDANCE to a
sound engineer setting up an Allen & Heath QuPac mixer.

You MUST return a valid JSON object with this EXACT structure:
{
    "description": "Brief 2-3 sentence description of this venue type's acoustic character",
    "display_name": "Venue Type Name (Short Acoustic Description)",
    "acoustic_characteristics": {
        "typical_rt60_range": "0.5-1.5s or similar estimate",
        "typical_size": "Small/Medium/Large/Variable",
        "common_surfaces": ["hard floors", "high ceilings", "etc."],
        "typical_ceiling_height": "3-6m or similar estimate",
        "natural_reverb_character": "Short/Medium/Long/Very Long",
        "problem_frequencies": ["Description of typical problem frequency ranges"],
        "notes": "Any other general acoustic observations"
    },
    "sound_goals": {
        "primary_goal": "e.g., Speech clarity, Musical warmth, Energy and punch",
        "tonal_character": "e.g., Warm and clear, Bright and punchy, Natural and spacious",
        "dynamics": "e.g., Gentle and controlled, Punchy and dynamic, Wide dynamic range",
        "spatial_feel": "e.g., Intimate, Grand, Immersive, Tight",
        "notes": "What 'good sound' means in this venue type"
    },
    "acoustic_challenges": {
        "primary_challenges": ["List of 3-5 most common acoustic issues"],
        "frequency_problems": "Description of typical problem frequency ranges and why",
        "feedback_risks": "What makes feedback more/less likely in this venue type",
        "intelligibility_notes": "How speech clarity is typically affected",
        "notes": "General advice for dealing with these challenges"
    },
    "eq_strategy": {
        "hpf_tendency": "Typical HPF approach (e.g., 'Higher than normal due to room resonance')",
        "low_mid_approach": "How to handle 200-500Hz range in this venue type",
        "mid_approach": "How to handle 500Hz-2kHz",
        "presence_approach": "How to handle 2-6kHz for clarity",
        "high_approach": "How to handle 6kHz+ (air, sibilance)",
        "notes": "General EQ philosophy for this venue type"
    },
    "fx_approach": {
        "reverb_strategy": "Add reverb vs rely on natural, and why",
        "recommended_reverb_type": "plate/hall/room/none and reasoning",
        "reverb_amount": "Less than normal / Normal / More than normal",
        "delay_notes": "If delay is useful in this venue type",
        "notes": "Overall FX philosophy"
    },
    "compression_philosophy": {
        "overall_approach": "Gentle/Moderate/Aggressive and why",
        "vocal_compression": "How to approach vocal compression in this space",
        "instrument_compression": "General instrument compression guidance",
        "notes": "Why this compression approach suits this venue type"
    },
    "monitoring_notes": "2-3 sentences about monitor mix considerations for this venue type",
    "special_considerations": "Any unique factors (ceremonies, noise restrictions, distributed audio, etc.)",
    "knowledge_base_entry": "A complete markdown section with ## heading that summarizes all the above in a format ready for injection into a sound engineering AI prompt. This should be 150-300 words of practical, contextual guidance that helps an AI sound engineer make better decisions. Focus on WHAT to be aware of and WHY, not specific dB values."
}

IMPORTANT RULES:
- This is about GENERAL venue type characteristics, not specific buildings
- Focus on CONTEXTUAL GUIDANCE, not prescriptive mixer settings
- The knowledge_base_entry is the most important field - it must be concise but comprehensive
- Consider how this venue type interacts with live Kirtan/worship music if it's a worship venue
- Return ONLY the JSON object, no markdown formatting or explanation outside it
"""

        user_prompt = f"""Learn about the acoustic characteristics of this venue type: **{venue_type_name}**

Category: {category}

{f"Additional context: {user_notes}" if user_notes else ""}

Consider:
1. What are the typical acoustic properties of this type of venue?
2. What are the most common sound challenges engineers face here?
3. What is the general EQ strategy to achieve good sound in this space?
4. How should reverb/FX be approached given the natural acoustics?
5. What compression philosophy works best?
6. Any special considerations for monitoring in this space?
7. If this is a worship/religious venue, what are the specific audio expectations?

Return the JSON object with all acoustic guidance."""

        try:
            response_text, duration = await self.claude.generate_setup_with_timing(
                system_prompt=system_prompt,
                user_prompt=user_prompt
            )

            # Record timing
            from app.main import record_response_time
            await record_response_time(
                "venue_type_learning",
                duration,
                prompt_length=len(user_prompt),
                response_length=len(response_text)
            )

            # Parse JSON from response
            result = self._parse_response(response_text)

            if result:
                result["value_key"] = self._make_value_key(venue_type_name)
                result["name"] = venue_type_name
                result["category"] = category
                return result
            else:
                return {"error": "Failed to parse venue type learning response"}

        except Exception as e:
            logger.error(f"Venue type learning failed: {e}")
            return {"error": str(e)}

    def _parse_response(self, text: str) -> Optional[Dict]:
        """Parse Claude's JSON response."""
        # Try direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from markdown code block
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

        logger.error(f"Failed to parse venue type learning response: {text[:200]}")
        return None

    def _make_value_key(self, name: str) -> str:
        """Create a URL-safe value key from venue type name."""
        key = name.lower().strip()
        key = re.sub(r'[^a-z0-9\s]', '', key)
        key = re.sub(r'\s+', '_', key)
        return key
