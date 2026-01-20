import json
import logging
from typing import List, Dict, Any
from app.services.claude_service import ClaudeService
from app.models.location import Location
from app.models.setup import Setup
from app.models.user import User
from app.utils.knowledge_loader import (
    load_sound_knowledge_base,
    get_troubleshooting_guide,
    get_learning_context_template
)

logger = logging.getLogger(__name__)


class SetupGenerator:
    """Generates QuPac mixer setups using Claude API"""

    def __init__(self):
        self.claude_service = ClaudeService()

    def _build_system_prompt(self) -> str:
        """Build the system prompt with QuPac knowledge and sound engineering best practices.
        
        The knowledge is loaded DYNAMICALLY from knowledge/sound-knowledge-base.md,
        so updates to that file will automatically be reflected in Claude's responses.
        """
        
        # Load the knowledge base dynamically from the markdown file
        knowledge_base = load_sound_knowledge_base()
        logger.info(f"Loaded knowledge base: {len(knowledge_base)} characters")
        
        # Equipment intro (static - specific to your setup)
        equipment_intro = """You are an expert sound engineer specializing in Allen & Heath QuPac mixers and live sound reinforcement for charity events.

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

## Speaker & Amplifier Knowledge

### Speakers

**Martin Audio CDD-10**
- Type: Compact coaxial differential dispersion
- Frequency response: 65Hz - 20kHz
- EQ tendency: Fairly neutral, may need slight 2-4kHz presence boost for speech
- Best for: Small-medium rooms, speech/vocals

**Electro-Voice ZLX-12P**
- Type: 12" powered 2-way
- Power: 1000W Class D
- EQ tendency: May need slight high-frequency rolloff if harsh
- Note: Built-in DSP presets - use "Music" for live performance

**Electro-Voice Evolve 50**
- Type: Portable column array system with subwoofer
- Best for: Gurdwaras, halls with reflective surfaces
- Special note: If using external mixer, set Evolve to "Flat" or "External"

### Amplifiers

**Crown XTi Series**: Powered amps with onboard DSP, built-in crossover
**Crown XLS Series**: Simpler, need external crossover for sub/top split
**Crown CDi 1000 (70V)**: For distributed audio - use higher HPF (150Hz+), more compression, less reverb

### Speaker-Specific Adjustments
1. **Column Arrays (Evolve 50)**: Reduce reverb slightly
2. **70V Systems (CDi 1000)**: Higher HPF (150Hz+), more compression, less reverb
3. **Compact Speakers**: Higher HPF (90-100Hz)
4. **Powered Speakers**: Watch input levels - they have built-in limiting

"""

        # JSON output format instructions (static)
        output_format = """

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
   {"fx1": "Plate Reverb (FOH Vocals)", "fx2": "Hall Medium (FOH Spacious)", "fx3": "Room (Monitor Reverb)", "fx4": "Available", "sends": {"1": {"fx1": "-10dB", "fx2": "off", "fx3": "-15dB"}, "2": {"fx1": "off", "fx2": "-8dB", "fx3": "off"}}}
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
   3. FX3 Return: Route to monitor mixes only
   4. CRITICAL: Both FX Send AND Return must be up to hear reverb!
   5. Starting fader positions: [list each channel]

   ## FINAL CHECK
   - Walk the room during soundcheck
   - [other venue-specific tips]

6. **troubleshooting_tips**: 3-5 SHORT tips specific to this lineup

Keep response under 4000 tokens. Be concise but systematic!"""

        # Combine: Equipment + Knowledge Base + Output Format
        full_prompt = equipment_intro + "\n## Sound Engineering Knowledge Base (Loaded Dynamically)\n\n" + knowledge_base + output_format
        
        logger.info(f"Built system prompt: {len(full_prompt)} total characters")
        return full_prompt

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
            if setup.get('amp', {}).get('brand') or setup.get('amp', {}).get('model'):
                amp = setup['amp']
                amp_name = f"{amp.get('brand', '')} {amp.get('model', '')}".strip()
                if amp_name:
                    prompt += f"- Amplifier: {amp_name}"
                    if amp.get('watts'):
                        prompt += f" ({amp['watts']}W)"
                    if amp.get('channels'):
                        prompt += f" [{amp['channels']} channels]"
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

        # Add context from past setups with enhanced learning
        if past_setups:
            prompt += "\n## Past Setups at This Venue (LEARN FROM THESE!)\n"
            prompt += "**IMPORTANT**: Use these past experiences to improve this setup.\n\n"

            # Separate high-rated and lower-rated setups
            high_rated = [s for s in past_setups if s.rating and s.rating >= 4]
            lower_rated = [s for s in past_setups if s.rating and s.rating < 4]

            if high_rated:
                prompt += "### Successful Setups (4-5 stars) - USE THESE SETTINGS\n"
                for i, setup in enumerate(high_rated, 1):
                    prompt += f"\n**Setup {i}** - Rating: {setup.rating}/5"
                    if setup.event_name:
                        prompt += f" ({setup.event_name})"
                    prompt += "\n"
                    prompt += f"- Performers: {json.dumps(setup.performers)}\n"

                    # Include actual settings if available
                    if setup.eq_settings:
                        prompt += f"- **EQ Settings Used**: {json.dumps(setup.eq_settings)}\n"
                    if setup.compression_settings:
                        prompt += f"- **Compression Used**: {json.dumps(setup.compression_settings)}\n"
                    if setup.fx_settings:
                        prompt += f"- **FX Settings Used**: {json.dumps(setup.fx_settings)}\n"
                    if setup.notes:
                        prompt += f"- **What Worked**: {setup.notes}\n"
                    prompt += "\n"

            if lower_rated:
                prompt += "### Setups That Needed Improvement (learn what to avoid)\n"
                for i, setup in enumerate(lower_rated, 1):
                    prompt += f"\n**Setup {i}** - Rating: {setup.rating}/5\n"
                    prompt += f"- Performers: {json.dumps(setup.performers)}\n"
                    if setup.notes:
                        prompt += f"- **Issues/Notes**: {setup.notes}\n"
                        prompt += "- **Action**: Address these issues in the new setup!\n"
                    prompt += "\n"

            # Find matching performer types from past setups
            current_performer_types = set(p.get('type', '') for p in performers)
            for setup in high_rated:
                past_performer_types = set(p.get('type', '') for p in (setup.performers or []))
                matching = current_performer_types & past_performer_types
                if matching and setup.eq_settings:
                    prompt += f"\n**Direct Match Found**: Past setup had {matching} - copy those exact channel settings!\n"

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
