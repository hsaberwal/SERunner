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
- **Shure Beta 57A**: Dynamic, supercardioid - ideal for instruments, guitar amps, tabla (when C1000S unavailable)
- **AKG C1000S**: Condenser, cardioid/hypercardioid - ideal for tabla, acoustic instruments

### DI Boxes for Piezo Instruments
- **Radial PZ-DI**: Active DI optimized for piezo pickups
  - Default settings: Ground LIFT, Pad OFF, Filter OFF, Phase NORMAL
  - Use -15dB pad if signal is too hot (clipping on QuPac input)
  - Low-cut filter on DI can help if there's excessive handling noise
- **Radial StageBug SB-4**: Compact piezo DI, similar to PZ-DI
  - Default settings: Ground LIFT, Pad OFF
  - Great backup or for smaller setups

**DI Box Usage**: Any acoustic instrument with piezo pickup (Guitar, Rabab, Dilruba, Taus, Violin, Sarangi) should go through a DI box. The DI provides:
1. Impedance matching (piezo needs high impedance input)
2. Ground lift to eliminate hum
3. Balanced output to QuPac XLR input

## Critical Knowledge: QuPac FX Routing

**IMPORTANT**: In LR Mix view, you need BOTH FX Send AND FX Return to be UP to hear effects.
- FX Sends (per channel) = how much of each instrument goes to the FX
- FX Send in LR view = sends the processed effect to the LR bus
- FX Return in LR view = brings it back into LR mix
- Both Send and Return in LR view must be up, or you won't hear any FX

## Sound Engineering Best Practices from Live Sessions

### PEQ Width Guide for QuPac (NO Q NUMBERS!)
On the QuPac, the Width slider controls how wide/narrow the EQ band is.
ALWAYS describe width in TWO ways:
1. **Visual description**: "very wide", "wide", "medium", "narrow", "very narrow"
2. **Frequency range**: "affects roughly 200Hz to 500Hz" (shows the user what range to expect)

Width descriptions:
- **Very Wide** (slider far left): affects 2+ octaves, ~3x the center frequency range
- **Wide** (slider left of center): affects ~1.5 octaves, ~2x the center frequency
- **Medium** (slider at center): affects ~1 octave, ~1.5x the center frequency
- **Narrow** (slider right of center): affects ~1/2 octave, focused cut/boost
- **Very Narrow** (slider far right): surgical, pinpoint adjustment

### QuPac Compressor Limits
- Attack: 0.3ms to 300ms
- Release: 100ms to 2000ms (minimum 100ms!)
- Threshold: -46dB to +18dB
- Ratio: 1:1 to infinity
- Makeup Gain: 0dB to +18dB
- Knee: Soft or Hard
- Type: Manual RMS (default), Manual Peak, Auto Slow Opto, Auto Punchbag

### Female Vocal (Shure Beta 58A)
- HPF: 95 Hz
- Band 1: 325 Hz, +2.5 dB, MEDIUM width (affects ~220-480Hz) - warmth
- Band 2: 650 Hz, -4.5 dB, MEDIUM width (affects ~430-980Hz) - cut boxiness
- Band 3: 4.5 kHz, +4.5 dB, MEDIUM width (affects ~3-6.7kHz) - presence
- Band 4: 10 kHz, +2 dB, WIDE width (affects ~6.5-15kHz) - air
- Compression: 4:1, -8dB threshold, 15ms attack, 100ms release, soft knee, +3dB gain, Manual RMS
- Reverb: Hall Small/Stage @ -10 dB send

### Male Vocal (Shure Beta 58A)
- HPF: 75 Hz
- Band 1: 230 Hz, +2.5 dB, MEDIUM width (affects ~155-340Hz) - chest warmth
- Band 2: 450 Hz, -4 dB, MEDIUM width (affects ~300-680Hz) - cut boxiness
- Band 3: 3 kHz, +4 dB, MEDIUM width (affects ~2-4.5kHz) - presence
- Band 4: 9.5 kHz, +3 dB, WIDE width (affects ~6-15kHz) - air
- Compression: 4:1, -8dB threshold, 15ms attack, 100ms release, soft knee, +3dB gain, Manual RMS
- Reverb: Hall Small/Stage @ -10 dB send

### Flute (Beta 57A)
- HPF: 90 Hz
- Band 1: 280 Hz, -3 dB, MEDIUM width (affects ~190-420Hz) - remove mud
- Band 2: 2.8 kHz, -3 dB, MEDIUM width (affects ~1.9-4.2kHz) - reduce harshness
- Band 3: 5 kHz, +2 dB, WIDE width (affects ~3.3-7.5kHz) - articulation
- Band 4: 9 kHz, +5 dB, WIDE width (affects ~6-14kHz) - CRITICAL: add air
- Compression: 3:1, -9dB threshold, 17ms attack, 100ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Arena @ -5 dB send (flute likes space)

### Tabla (Beta 57A)
- HPF: OFF (keep the lows!)
- Band 1: 60 Hz, +2.5 dB, WIDE width (affects ~40-90Hz) - sub-bass for bayan
- Band 2: 220 Hz, +7 dB, MEDIUM width (affects ~150-330Hz) - body (KEY!)
- Band 3: 2.5 kHz, +3 dB, MEDIUM width (affects ~1.7-3.7kHz) - attack definition
- Band 4: 8 kHz, +1.5 dB, WIDE width (affects ~5.3-12kHz) - harmonics
- Compression: 4:1, -9dB threshold, 6ms attack (FAST!), 100ms release, hard knee, +4dB gain, Manual Peak
- Reverb: Hall Small/Stage @ -20 dB send (subtle)

### Acoustic Guitar (DI/Piezo)
- HPF: 82 Hz
- Band 1: 165 Hz, +3 dB, MEDIUM width (affects ~110-250Hz) - body
- Band 2: 2.7 kHz, -4 dB, NARROW width (affects ~2-3.6kHz) - CRITICAL: piezo quack
- Band 3: 5 kHz, +2 dB, WIDE width (affects ~3.3-7.5kHz) - string definition
- Band 4: 9 kHz, +4.5 dB, WIDE width (affects ~6-14kHz) - shimmer
- Compression: 3:1, -11dB threshold, 13ms attack, 100ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Hall Small/Stage @ -15 dB send
- DI Box: Radial PZ-DI or SB-4, Ground LIFT, Pad OFF

### Rabab / Rubab (DI/Piezo)
- HPF: 65 Hz (keep low resonance of goat skin)
- Band 1: 180 Hz, +4 dB, MEDIUM width (affects ~120-270Hz) - body warmth
- Band 2: 2.5 kHz, -5 dB, NARROW width (affects ~1.9-3.3kHz) - CRITICAL: piezo quack
- Band 3: 4 kHz, +3 dB, MEDIUM width (affects ~2.7-6kHz) - pluck definition
- Band 4: 8 kHz, +3 dB, WIDE width (affects ~5.3-12kHz) - sympathetic shimmer
- Compression: 3:1, -10dB threshold, 12ms attack, 100ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Hall Small/Stage @ -12 dB send
- DI Box: Radial PZ-DI or SB-4, Ground LIFT, Pad OFF

### Dilruba / Esraj (DI/Piezo)
- HPF: 70 Hz
- Band 1: 200 Hz, +3 dB, MEDIUM width (affects ~135-300Hz) - body resonance
- Band 2: 800 Hz, -2 dB, MEDIUM width (affects ~530-1.2kHz) - reduce nasal
- Band 3: 2.5 kHz, -4 dB, NARROW width (affects ~1.9-3.3kHz) - piezo quack
- Band 4: 6 kHz, +4 dB, WIDE width (affects ~4-9kHz) - bowing articulation
- Compression: 2.5:1, -12dB threshold, 20ms attack, 150ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Arena @ -8 dB send (bowed strings love space)
- DI Box: Radial PZ-DI or SB-4, Ground LIFT, Pad OFF

### Taus / Mayuri (DI/Piezo)
- HPF: 55 Hz (very low instrument)
- Band 1: 120 Hz, +3 dB, WIDE width (affects ~80-180Hz) - deep body
- Band 2: 350 Hz, +2 dB, MEDIUM width (affects ~235-520Hz) - mid warmth
- Band 3: 2.5 kHz, -4 dB, NARROW width (affects ~1.9-3.3kHz) - piezo quack
- Band 4: 5 kHz, +3 dB, WIDE width (affects ~3.3-7.5kHz) - bow articulation
- Compression: 2.5:1, -12dB threshold, 25ms attack, 150ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Arena @ -8 dB send
- DI Box: Radial PZ-DI or SB-4, Ground LIFT, Pad OFF

### Violin (DI/Piezo)
- HPF: 180 Hz (violin doesn't need lows)
- Band 1: 250 Hz, -2 dB, MEDIUM width (affects ~170-375Hz) - reduce boxiness
- Band 2: 2.5 kHz, -4 dB, NARROW width (affects ~1.9-3.3kHz) - piezo quack CRITICAL
- Band 3: 5 kHz, +3 dB, MEDIUM width (affects ~3.3-7.5kHz) - bow articulation
- Band 4: 10 kHz, +4 dB, WIDE width (affects ~6.5-15kHz) - brilliance
- Compression: 3:1, -10dB threshold, 15ms attack, 100ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Hall Small/Stage @ -10 dB send
- DI Box: Radial PZ-DI or SB-4, Ground LIFT, Pad OFF

### Sarangi (DI/Piezo)
- HPF: 90 Hz
- Band 1: 200 Hz, +3 dB, MEDIUM width (affects ~135-300Hz) - body warmth
- Band 2: 600 Hz, -3 dB, MEDIUM width (affects ~400-900Hz) - reduce honkiness
- Band 3: 2.5 kHz, -4 dB, NARROW width (affects ~1.9-3.3kHz) - piezo quack
- Band 4: 7 kHz, +5 dB, WIDE width (affects ~4.6-10.5kHz) - sympathetic strings
- Compression: 2.5:1, -11dB threshold, 18ms attack, 120ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Arena @ -6 dB send
- DI Box: Radial PZ-DI or SB-4, Ground LIFT, Pad OFF

### Harmonium (Direct/DI or Mic)
- HPF: 80 Hz
- Band 1: 200 Hz, +2 dB, MEDIUM width (affects ~135-300Hz) - reed body
- Band 2: 500 Hz, -3 dB, MEDIUM width (affects ~335-750Hz) - reduce mud
- Band 3: 2 kHz, +2 dB, MEDIUM width (affects ~1.3-3kHz) - note clarity
- Band 4: 6 kHz, +3 dB, WIDE width (affects ~4-9kHz) - bellows air
- Compression: 3:1, -10dB threshold, 20ms attack, 150ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Hall Small/Stage @ -15 dB send
- If using mic (Beta 57A): position 6-8 inches from reeds, angled

### Keyboard/Synth (Direct/DI)
- HPF: OFF or 30 Hz (depends on patches used)
- Band 1: 100 Hz, 0 dB, MEDIUM width - adjust based on patch
- Band 2: 500 Hz, -2 dB, MEDIUM width (affects ~335-750Hz) - clean up mids
- Band 3: 3 kHz, +2 dB, MEDIUM width (affects ~2-4.5kHz) - presence
- Band 4: 10 kHz, +2 dB, WIDE width (affects ~6.5-15kHz) - sparkle
- Compression: 2:1, -12dB threshold, 20ms attack, 150ms release, soft knee, +1dB gain, Manual RMS
- Reverb: Depends on patch - often OFF if patch has built-in reverb

### Podium / Speech Mic (Beta 58A)
Purpose: Clear speech delivery - intelligibility is critical, minimal reverb
- HPF: 120 Hz (remove all rumble, speech doesn't need lows)
- Band 1: 200 Hz, -2 dB, MEDIUM width (affects ~135-300Hz) - reduce boom
- Band 2: 500 Hz, -2 dB, MEDIUM width (affects ~335-750Hz) - reduce muddiness
- Band 3: 3.5 kHz, +5 dB, MEDIUM width (affects ~2.3-5.2kHz) - CRITICAL: speech clarity
- Band 4: 8 kHz, +2 dB, WIDE width (affects ~5.3-12kHz) - articulation, consonants
- Compression: 4:1, -10dB threshold, 10ms attack, 100ms release, soft knee, +3dB gain, Manual RMS
- Reverb: OFF or very minimal (-25dB send) - clarity over ambience

### Ardas Mic (Beta 58A)
Purpose: Sikh prayer recitation - voice should linger with gentle reverb, warm and reverent
- HPF: 90 Hz
- Band 1: 250 Hz, +2 dB, MEDIUM width (affects ~170-375Hz) - warmth
- Band 2: 500 Hz, -2 dB, MEDIUM width (affects ~335-750Hz) - reduce boxiness
- Band 3: 3 kHz, +3 dB, MEDIUM width (affects ~2-4.5kHz) - clarity
- Band 4: 8 kHz, +2 dB, WIDE width (affects ~5.3-12kHz) - gentle presence
- Compression: 3:1, -10dB threshold, 15ms attack, 100ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Hall Medium @ -8 dB send (noticeable reverb, voice lingers respectfully)

### Palki / Guru Granth Sahib Reading (Beta 58A)
Purpose: Sacred scripture reading - requires significant reverb for divine atmosphere
- HPF: 85 Hz
- Band 1: 220 Hz, +3 dB, MEDIUM width (affects ~150-330Hz) - rich warmth
- Band 2: 450 Hz, -2 dB, MEDIUM width (affects ~300-680Hz) - reduce mud
- Band 3: 2.5 kHz, +3 dB, MEDIUM width (affects ~1.7-3.7kHz) - presence without harshness
- Band 4: 7 kHz, +2 dB, WIDE width (affects ~4.6-10.5kHz) - subtle air
- Compression: 3:1, -12dB threshold, 20ms attack, 150ms release, soft knee, +2dB gain, Manual RMS
- Reverb: Arena @ -5 dB send (HIGH reverb - creates sacred, ethereal atmosphere)
- Note: The high reverb is intentional - scripture reading should fill the space reverently

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

2. **eq_settings**: dict with channel numbers as keys, include width AND frequency range:
   ```
   {"1": {"hpf": "95Hz", "band1": "325Hz +2.5dB MEDIUM (220-480Hz)", "band2": "650Hz -4dB MEDIUM (430-980Hz)", "band3": "4.5kHz +4dB MEDIUM (3-6.7kHz)", "band4": "10kHz +2dB WIDE (6.5-15kHz)"}}
   ```

3. **compression_settings**: dict with channel numbers, include all params:
   ```
   {"1": {"ratio": "4:1", "threshold": "-8dB", "attack": "15ms", "release": "100ms", "knee": "soft", "gain": "+3dB", "type": "Manual RMS"}}
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
   4. EQ Band 1: [freq] [gain], [WIDTH] width (affects [low]-[high]) - [why]
   5. EQ Band 2: [freq] [gain], [WIDTH] width (affects [low]-[high]) - [why]
   6. EQ Band 3: [freq] [gain], [WIDTH] width (affects [low]-[high]) - [why]
   7. EQ Band 4: [freq] [gain], [WIDTH] width (affects [low]-[high]) - [why]
   8. Compression: [ratio], [threshold], [attack], [release], [knee], [gain], [type]
   9. FX Send: [which FX] at [level]

   Example EQ line: "4.5kHz +4dB, MEDIUM width (affects 3-6.7kHz) - adds presence"

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
            prompt += "\n**Speaker Setup**:\n"
            setup = location.speaker_setup
            if setup.get('lr_mains', {}).get('brand'):
                mains = setup['lr_mains']
                prompt += f"- LR Mains: {mains.get('quantity', 2)}x {mains['brand']} {mains.get('model', '')}"
                prompt += f" ({'Powered' if mains.get('powered', True) else 'Passive'})\n"
            if setup.get('sub', {}).get('brand') and setup.get('sub', {}).get('quantity', 0) > 0:
                sub = setup['sub']
                prompt += f"- Subwoofer: {sub['quantity']}x {sub['brand']} {sub.get('model', '')}"
                prompt += f" ({'Powered' if sub.get('powered', True) else 'Passive'})\n"
            if setup.get('monitors', {}).get('brand') and setup.get('monitors', {}).get('quantity', 0) > 0:
                mon = setup['monitors']
                prompt += f"- Monitors: {mon['quantity']}x {mon['brand']} {mon.get('model', '')}"
                prompt += f" ({'Powered' if mon.get('powered', True) else 'Passive'})\n"
            if setup.get('amp', {}).get('brand'):
                amp = setup['amp']
                prompt += f"- Amplifier: {amp['brand']} {amp.get('model', '')}"
                if amp.get('watts'):
                    prompt += f" ({amp['watts']}W)"
                prompt += "\n"
            prompt += "\n"

        # Include GEQ cuts from previous ring-outs at this venue
        if location.lr_geq_cuts:
            prompt += f"\n**Previous LR GEQ Cuts** (from ring-out): {json.dumps(location.lr_geq_cuts)}\n"
            prompt += "Note: These frequencies caused feedback before - remind user to check these during soundcheck.\n"

        if location.monitor_geq_cuts:
            prompt += f"\n**Previous Monitor GEQ Cuts** (from ring-out): {json.dumps(location.monitor_geq_cuts)}\n"

        if location.room_notes:
            prompt += f"\n**Room Acoustics Notes**: {location.room_notes}\n"

        # Map input source codes to readable names
        input_source_names = {
            'beta_58a': 'Shure Beta 58A',
            'beta_57a': 'Shure Beta 57A',
            'c1000s': 'AKG C1000S',
            'di_piezo': 'DI Box (Piezo)',
            'direct': 'Direct/Line'
        }

        prompt += "\n## Performer Lineup\n"
        for i, performer in enumerate(performers, 1):
            performer_type = performer.get('type', 'Unknown')
            count = performer.get('count', 1)
            input_source = performer.get('input_source', '')
            input_name = input_source_names.get(input_source, input_source)
            notes = performer.get('notes', '')

            prompt += f"{i}. **{performer_type}** (count: {count})"
            if input_name:
                prompt += f" - Using: {input_name}"
            if notes:
                prompt += f" - {notes}"
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
        if location.lr_geq_cuts or location.monitor_geq_cuts:
            prompt += "Include a reminder about the known problem frequencies from previous ring-outs. "
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
