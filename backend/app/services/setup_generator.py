import json
import logging
from typing import List, Dict, Any
from app.services.claude_service import ClaudeService
from app.models.location import Location
from app.models.setup import Setup
from app.models.user import User

logger = logging.getLogger(__name__)


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

### Q (Width) Guide - QuPac PEQ Width Slider
Q is the Width control on QuPac. Lower Q = wider, Higher Q = narrower.
- Q 0.5-1.0 = Wide (width slider toward "wide") - gentle tone shaping
- Q 1.5-2.5 = Medium (width slider middle) - typical EQ moves
- Q 3.0-5.0 = Narrow (width slider toward "narrow") - surgical cuts
- Q 6.0+ = Very narrow - problem frequency removal only

### Female Vocal (Shure Beta 58A)
- HPF: 95 Hz
- Band 1: 325 Hz, +2.5 dB, Q 2.0 (warmth)
- Band 2: 650 Hz, -4.5 dB, Q 2.5 (cut boxiness)
- Band 3: 4.5 kHz, +4.5 dB, Q 2.0 (presence)
- Band 4: 10 kHz, +2 dB, Q 1.5 (air)
- Compression: 4:1, -8 dB threshold, 15ms attack, 100ms release, soft knee ON
- Reverb: Hall Small/Stage @ -10 dB send

### Male Vocal (Shure Beta 58A)
- HPF: 75 Hz
- Band 1: 230 Hz, +2.5 dB, Q 2.0 (chest warmth)
- Band 2: 450 Hz, -4 dB, Q 2.5 (cut boxiness)
- Band 3: 3 kHz, +4 dB, Q 2.0 (presence - lower than female)
- Band 4: 9.5 kHz, +3 dB, Q 1.5 (air)
- Compression: 4:1, -8 dB threshold, 15ms attack, 100ms release, soft knee ON
- Reverb: Hall Small/Stage @ -10 dB send

### Flute (Beta 57A)
- HPF: 90 Hz
- Band 1: 280 Hz, -3 dB, Q 2.0 (remove mud from Beta 57)
- Band 2: 2.8 kHz, -3 dB, Q 2.5 (reduce harshness)
- Band 3: 5 kHz, +2 dB, Q 1.5 (articulation)
- Band 4: 9 kHz, +5 dB, Q 1.5 (CRITICAL: add air - Beta 57 lacks this)
- Compression: 3:1, -9 dB threshold, 17ms attack, 100ms release, soft knee ON
- Reverb: Arena @ -5 dB send (flute likes space)

### Tabla (Beta 57A)
- HPF: OFF (keep the lows!)
- Band 1: 60 Hz, +2.5 dB, Q 1.5 (sub-bass for bayan)
- Band 2: 220 Hz, +7 dB, Q 2.0 (body - KEY frequency, adjust +6 to +10)
- Band 3: 2.5 kHz, +3 dB, Q 2.0 (attack definition)
- Band 4: 8 kHz, +1.5 dB, Q 1.5 (harmonics)
- Compression: 4:1, -9 dB threshold, 6ms attack (FAST!), 100ms release, soft knee OFF
- Reverb: Hall Small/Stage @ -20 dB send (subtle)

### Acoustic Guitar (DI/Piezo)
- HPF: 82 Hz
- Band 1: 165 Hz, +3 dB, Q 2.0 (body)
- Band 2: 2.7 kHz, -4 dB, Q 3.0 (CRITICAL: remove piezo quack - use narrow Q)
- Band 3: 5 kHz, +2 dB, Q 1.5 (string definition)
- Band 4: 9 kHz, +4.5 dB, Q 1.5 (shimmer)
- Compression: 3:1, -11 dB threshold, 13ms attack, 100ms release, soft knee ON
- Reverb: Hall Small/Stage @ -15 dB send

## Key Principles

1. **Don't Double-Reverb**: Keep instruments in separate reverb spaces. If a vocal is in both FX1 and FX2, it sounds washy.
2. **FX Strategy**: Use FX1 (Arena) for instruments wanting big space (flute). Use FX2 (Hall Small/Stage) for vocals, tabla, guitar.
3. **Beta 57 on Flute**: Always boost 8-10 kHz heavily - Beta 57 lacks natural airiness on flute.
4. **Direct Acoustic Guitar**: ALWAYS cut 2-3 kHz to remove piezo quack.
5. **Tabla Compression**: Fast attack (6ms) + soft knee OFF = preserves punch.

## Your Task

Generate a SYSTEMATIC mixer setup that goes CHANNEL BY CHANNEL.

Return a JSON object (no markdown, just raw JSON) with these keys:

1. **channel_config**: dict with channel numbers as keys:
   ```
   {"1": {"instrument": "Female Vocal", "mic": "Beta 58A", "position": "2-3 inches from mouth"}}
   ```

2. **eq_settings**: dict with channel numbers as keys, include Q values:
   ```
   {"1": {"hpf": "95Hz", "band1": "325Hz +2.5dB Q2.0", "band2": "650Hz -4dB Q2.5", "band3": "4.5kHz +4dB Q2.0", "band4": "10kHz +2dB Q1.5"}}
   ```

3. **compression_settings**: dict with channel numbers, SHORT format:
   ```
   {"1": {"ratio": "4:1", "threshold": "-8dB", "attack": "15ms", "release": "100ms", "knee": "soft"}}
   ```

4. **fx_settings**: dict with FX engine config and per-channel sends:
   ```
   {"fx1": "Arena Reverb", "fx2": "Hall Small", "sends": {"1": {"fx1": "off", "fx2": "-10dB"}, "2": {"fx1": "-5dB", "fx2": "off"}}}
   ```

5. **instructions**: A SYSTEMATIC step-by-step guide in this EXACT format:

   ## CHANNEL 1: [Instrument] - [Mic]
   1. Connect [Mic] to Channel 1
   2. Set gain: have performer play, target -12 to -8dB peaks
   3. HPF: [setting]
   4. EQ Band 1: [freq] [gain] Q[width] - [why]
   5. EQ Band 2: [freq] [gain] Q[width] - [why]
   6. EQ Band 3: [freq] [gain] Q[width] - [why]
   7. EQ Band 4: [freq] [gain] Q[width] - [why]
   8. Compression: [ratio], [threshold], [attack], [release], [knee]
   9. FX Send: [which FX] at [level]

   ## CHANNEL 2: [Instrument] - [Mic]
   [repeat same structure]

   ## LR MIX SETUP
   1. FX1 Return: set to -5dB
   2. FX2 Return: set to -5dB
   3. CRITICAL: Both FX Send AND Return must be up to hear reverb!
   4. Starting fader positions: [list each channel]

   ## FINAL CHECK
   - Walk the room during soundcheck
   - [other venue-specific tips]

6. **troubleshooting_tips**: 3-5 SHORT tips specific to this lineup

Keep response under 4000 tokens. Be concise but systematic!"""

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
        print("=== CALLING CLAUDE API ===", flush=True)
        logger.info("Calling Claude API...")
        response = await self.claude_service.generate_setup(system_prompt, user_prompt)
        print(f"=== CLAUDE RESPONSE LENGTH: {len(response) if response else 0} ===", flush=True)
        print(f"=== CLAUDE RESPONSE PREVIEW: {response[:500] if response else 'EMPTY'} ===", flush=True)
        logger.info(f"Claude API response length: {len(response) if response else 0}")
        logger.info(f"Claude API response preview: {response[:500] if response else 'EMPTY'}")

        # Parse JSON response
        raw_response = response  # Keep original for fallback
        try:
            # Try to extract JSON from response (Claude might wrap it in markdown)
            json_text = response
            if "```json" in response:
                json_start = response.index("```json") + 7
                json_end = response.rindex("```")
                json_text = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.index("```") + 3
                json_end = response.rindex("```")
                json_text = response[json_start:json_end].strip()

            print(f"=== JSON TEXT TO PARSE (first 500 chars): {json_text[:500]} ===", flush=True)
            setup_data = json.loads(json_text)
            logger.info(f"Successfully parsed JSON with keys: {list(setup_data.keys())}")
            return setup_data
        except (json.JSONDecodeError, ValueError) as e:
            # If JSON parsing fails, return raw response in instructions field
            logger.error(f"JSON parsing failed: {e}")
            logger.error(f"Raw response: {raw_response[:1000] if raw_response else 'EMPTY'}")
            print(f"=== JSON PARSE ERROR: {e} ===", flush=True)
            return {
                "channel_config": {},
                "eq_settings": {},
                "compression_settings": {},
                "fx_settings": {},
                "instructions": raw_response if raw_response else "No response from Claude API",
                "troubleshooting_tips": f"Error parsing JSON response: {str(e)}"
            }
