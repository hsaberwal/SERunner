"""
Hardware Learning Service

When new hardware (mics, speakers, amps) is introduced, this service
uses Claude to generate recommended settings and formats them for
adding to the knowledge base.
"""

import json
import logging
from typing import Dict, Any, Optional
from app.services.claude_service import ClaudeService
from app.utils.knowledge_loader import load_sound_knowledge_base

logger = logging.getLogger(__name__)


class HardwareLearner:
    """Generates knowledge base entries for new hardware using Claude"""

    def __init__(self, api_key: str = None):
        self.claude_service = ClaudeService(api_key=api_key)

    def _build_system_prompt(self) -> str:
        """Build system prompt for hardware learning"""
        return """You are an expert sound engineer helping to build a knowledge base for live sound reinforcement.

You will be given information about a new piece of hardware (microphone, speaker, or amplifier) and your task is to generate:
1. Recommended settings for use with common instruments/sources
2. Formatted markdown entry for the knowledge base

## Context
The knowledge base is used with Allen & Heath QuPac mixers for live events at charity venues.
Common sources include: vocals (male/female), tabla, flute, harmonium, acoustic guitar, dilruba, rabab, taus, sarangi, keyboard.

## QuPac PEQ Width Guide (CRITICAL - NO Q NUMBERS!)
Always describe EQ width as:
- **Very Wide**: affects 2+ octaves
- **Wide**: affects ~1.5 octaves
- **Medium**: affects ~1 octave
- **Narrow**: affects ~1/2 octave
- **Very Narrow**: surgical, pinpoint

## QuPac Compressor Limits
- Attack: 0.3ms to 300ms
- Release: 100ms to 2000ms (minimum 100ms!)
- Threshold: -46dB to +18dB
- Ratio: 1:1 to infinity
- Makeup Gain: 0dB to +18dB

## Your Task
Return a JSON object with:

1. **hardware_type**: "microphone", "speaker", or "amplifier"
2. **brand**: The brand name
3. **model**: The model name/number
4. **characteristics**: Key sonic characteristics
5. **best_for**: What sources/situations it's best suited for
6. **settings_by_source**: Dict of source types with recommended settings
7. **knowledge_base_entry**: Formatted markdown for the knowledge base file

For amplifiers, ALSO include these fields:
8. **watts_per_channel**: Power output string (e.g., "500W x2 @ 4Ω" or "1200W x4 @ 4Ω")
9. **channels**: Number of output channels as string (e.g., "2" or "4")
10. **amplifier_class**: The amplifier class (e.g., "Class D", "Class AB")
11. **features**: List of features (e.g., ["DSP", "Limiters", "Crossover"])

For microphones, include settings for relevant sources:
- EQ (HPF, 4 bands with frequency, gain, width description, frequency range affected)
- Compression (ratio, threshold, attack, release, knee, gain, type)
- FX recommendations

For speakers, include:
- EQ tendencies (what frequencies may need adjustment)
- HPF recommendations for channels
- Best practices

For amplifiers, include:
- **watts_per_channel**: Power output per channel at 4Ω (e.g., "500W x2 @ 4Ω")
- **channels**: Number of channels (e.g., "2" or "4")
- **amplifier_class**: Class D, Class AB, etc.
- **features**: DSP, limiters, crossover, etc.
- Crossover recommendations
- DSP tips if applicable
- Integration with QuPac
- Best speaker pairings

Keep response focused and practical. Real-world tested settings preferred over theoretical."""

    def _build_user_prompt(
        self,
        hardware_type: str,
        brand: str,
        model: str,
        specs: Optional[Dict[str, Any]] = None,
        user_notes: Optional[str] = None
    ) -> str:
        """Build user prompt with hardware details"""
        prompt = f"""# New Hardware to Add to Knowledge Base

## Hardware Type
{hardware_type.title()}

## Brand & Model
**{brand} {model}**

"""
        if specs:
            prompt += "## Specifications\n"
            for key, value in specs.items():
                prompt += f"- **{key}**: {value}\n"
            prompt += "\n"

        if user_notes:
            prompt += f"""## User Notes
{user_notes}

"""

        prompt += """## Instructions
Generate recommended settings for this hardware for use in live sound reinforcement.
Include a formatted markdown entry that can be added to the knowledge base.
Return as JSON with the structure specified in the system prompt."""

        return prompt

    async def learn_hardware(
        self,
        hardware_type: str,
        brand: str,
        model: str,
        specs: Optional[Dict[str, Any]] = None,
        user_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate knowledge base entry for new hardware"""
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(
            hardware_type=hardware_type,
            brand=brand,
            model=model,
            specs=specs,
            user_notes=user_notes
        )

        logger.info(f"Learning new hardware: {brand} {model} ({hardware_type})")

        response = await self.claude_service.generate_setup(system_prompt, user_prompt)

        # Parse JSON response
        try:
            json_text = response
            if "```json" in response:
                json_start = response.index("```json") + 7
                json_end = response.rindex("```")
                json_text = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.index("```") + 3
                json_end = response.rindex("```")
                json_text = response[json_start:json_end].strip()

            result = json.loads(json_text)
            logger.info(f"Successfully generated knowledge for {brand} {model}")
            return result
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse hardware learning response: {e}")
            return {
                "hardware_type": hardware_type,
                "brand": brand,
                "model": model,
                "error": str(e),
                "raw_response": response
            }
