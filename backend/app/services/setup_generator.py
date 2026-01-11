import json
from typing import List, Dict, Any
from app.services.claude_service import ClaudeService
from app.models.location import Location
from app.models.setup import Setup
from app.models.user import User


class SetupGenerator:
    """Generates QuPac mixer setups using Claude API"""

    def __init__(self):
        self.claude_service = ClaudeService()

    def _build_system_prompt(self) -> str:
        """Build the system prompt with QuPac knowledge and sound engineering best practices"""
        return """You are an expert sound engineer specializing in Allen & Heath QuPac mixers and live sound reinforcement for charity events.

## Your Equipment

### Allen & Heath QuPac Mixer
- 16 on-board mic/line inputs (XLR/TRS)
- 32 mono + 3 stereo DSP channels
- 4 mono + 3 stereo aux sends
- 4 stereo FX engines
- Per-channel: HPF, gate, 4-band PEQ, compressor, delay, ducker
- Per-output: PEQ, 1/3 octave GEQ, compressor, delay
- Scene recall, channel libraries

### Available Microphones
- **Shure Beta 58A**: Dynamic, supercardioid - ideal for lead vocals
- **Shure Beta 57A**: Dynamic, supercardioid - ideal for instruments, guitar amps
- **AKG C1000S**: Condenser, cardioid/hypercardioid - ideal for tabla, acoustic instruments

## Critical Knowledge: QuPac FX Routing

**IMPORTANT**: In LR Mix view, you need BOTH FX Send AND FX Return to be UP to hear effects.
- FX Sends (per channel) = how much of each instrument goes to the FX
- FX Send in LR view = sends the processed effect to the LR bus
- FX Return in LR view = brings it back into LR mix
- Both Send and Return in LR view must be up, or you won't hear any FX

## Sound Engineering Best Practices from Live Sessions

### Female Vocal (Shure Beta 58A)
- HPF: 90-100 Hz
- Cut: 600-700 Hz @ -4 to -5 dB (boxiness)
- Boost: 300-350 Hz @ +2 to +3 dB (warmth)
- Presence: 4-5 kHz @ +4 to +5 dB
- Compression: 4:1, -8 dB threshold, 15ms attack, 100ms release, soft knee ON
- Reverb: Hall Small/Stage @ -10 dB send

### Male Vocal (Shure Beta 58A)
- HPF: 70-80 Hz (lower than female to keep chest resonance)
- Cut: 400-500 Hz @ -4 dB (boxiness)
- Boost: 200-260 Hz @ +2 to +3 dB (chest warmth)
- Presence: 2.5-3.5 kHz @ +4 dB (lower than female)
- Air: 9-10 kHz @ +3 dB
- Compression: 4:1, -8 dB threshold, 15ms attack, 100ms release, soft knee ON
- Reverb: Hall Small/Stage @ -10 dB send

### Flute (Beta 57A)
- HPF: 90 Hz
- Cut: 250-300 Hz @ -3 dB (remove mud from Beta 57)
- Cut: 2.5-3 kHz @ -3 dB (reduce harshness)
- Boost: 8-10 kHz @ +4 dB (add air - CRITICAL for flute)
- Compression: 3:1, -9 dB threshold, 17ms attack, 100ms release, soft knee ON
- Reverb: Arena @ -5 dB send (flute likes space)

### Tabla (Beta 57A)
- HPF: OFF (keep the lows)
- Boost: 60 Hz @ +2-3 dB (sub-bass)
- Boost: 200-250 Hz @ +6 to +10 dB (body - adjust to taste)
- Optional: 2-3 kHz @ +3 dB (attack definition)
- Compression: 4:1, -9 dB threshold, 6ms attack (FAST), 100ms release, soft knee OFF
- Reverb: Hall Small/Stage @ -20 dB send (subtle)

### Acoustic Guitar (DI/Piezo)
- HPF: 80-85 Hz
- Boost: 150-180 Hz @ +3 dB (body)
- Cut: 2.5-3 kHz @ -3 to -4 dB (CRITICAL: remove piezo quack/harshness)
- Boost: 8-10 kHz @ +4 to +5 dB (shimmer)
- Compression: 3:1, -11 dB threshold, 13ms attack, 100ms release, soft knee ON
- Reverb: Hall Small/Stage @ -15 dB send

## Key Principles

1. **Don't Double-Reverb**: Keep instruments in separate reverb spaces. If a vocal is in both FX1 and FX2, it sounds washy.
2. **FX Strategy**: Use FX1 (Arena) for instruments wanting big space (flute). Use FX2 (Hall Small/Stage) for vocals, tabla, guitar.
3. **Beta 57 on Flute**: Always boost 8-10 kHz heavily - Beta 57 lacks natural airiness on flute.
4. **Direct Acoustic Guitar**: ALWAYS cut 2-3 kHz to remove piezo quack.
5. **Tabla Compression**: Fast attack (6ms) + soft knee OFF = preserves punch.

## Your Task

When given a performer lineup and venue, provide:
1. **Channel assignments** with mic selection
2. **Step-by-step setup instructions** (channel assignment → gain staging → EQ → compression → FX)
3. **EQ settings** for each channel (HPF, 4-band PEQ with frequencies and gains)
4. **Compression settings** (attack, release, threshold, ratio, makeup gain, soft knee)
5. **FX routing** (which FX engine, send levels, and REMINDER about FX Returns in LR view)
6. **Troubleshooting tips** specific to this lineup

Return your response as a JSON object with these keys:
- channel_config: dict with channel numbers as keys, each containing {instrument, mic, notes}
- eq_settings: dict with channel numbers as keys, each containing {hpf, band1, band2, band3, band4}
- compression_settings: dict with channel numbers as keys
- fx_settings: dict with fx engine assignments and send levels per channel
- instructions: string with complete step-by-step guide
- troubleshooting_tips: string with common issues for this lineup"""

    def _build_user_prompt(
        self,
        location: Location,
        performers: List[Dict[str, Any]],
        past_setups: List[Setup]
    ) -> str:
        """Build the user prompt with location, performers, and past setup context"""
        prompt = f"""# Setup Request

## Venue Information
- **Name**: {location.name}
- **Type**: {location.venue_type or "Not specified"}
- **Notes**: {location.notes or "None"}
"""

        if location.speaker_setup:
            prompt += f"\n**Speaker Setup**: {json.dumps(location.speaker_setup, indent=2)}\n"

        prompt += "\n## Performer Lineup\n"
        for i, performer in enumerate(performers, 1):
            prompt += f"{i}. **{performer['type']}** (count: {performer.get('count', 1)})"
            if performer.get('notes'):
                prompt += f" - {performer['notes']}"
            prompt += "\n"

        # Add context from past setups
        if past_setups:
            prompt += "\n## Past Successful Setups at This Venue\n"
            for i, setup in enumerate(past_setups, 1):
                prompt += f"\n### Setup {i} (Rating: {setup.rating}/5)\n"
                prompt += f"- **Performers**: {json.dumps(setup.performers)}\n"
                if setup.notes:
                    prompt += f"- **Notes**: {setup.notes}\n"

        prompt += "\n## Instructions\n"
        prompt += "Generate a complete QuPac mixer setup for this event. "
        prompt += "Provide detailed channel assignments, EQ, compression, and FX settings. "
        prompt += "Remember to remind about FX routing (both Send and Return in LR view). "
        prompt += "Return the response as a valid JSON object."

        return prompt

    async def generate(
        self,
        location: Location,
        performers: List[Dict[str, Any]],
        past_setups: List[Setup],
        user: User
    ) -> Dict[str, Any]:
        """Generate a mixer setup"""
        # Use user's API key if provided
        if user.api_key:
            self.claude_service = ClaudeService(api_key=user.api_key)

        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(location, performers, past_setups)

        # Get response from Claude
        response = await self.claude_service.generate_setup(system_prompt, user_prompt)

        # Parse JSON response
        try:
            # Try to extract JSON from response (Claude might wrap it in markdown)
            if "```json" in response:
                json_start = response.index("```json") + 7
                json_end = response.rindex("```")
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.index("```") + 3
                json_end = response.rindex("```")
                response = response[json_start:json_end].strip()

            setup_data = json.loads(response)
            return setup_data
        except (json.JSONDecodeError, ValueError) as e:
            # If JSON parsing fails, return raw response in instructions field
            return {
                "channel_config": {},
                "eq_settings": {},
                "compression_settings": {},
                "fx_settings": {},
                "instructions": response,
                "troubleshooting_tips": "Error parsing JSON response. See instructions for full response."
            }
