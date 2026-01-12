"""
Knowledge Base Loader Utility

Loads the sound engineering knowledge base from markdown files
and provides utilities for building dynamic prompts.
"""

import os
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Path to knowledge directory (relative to backend root)
KNOWLEDGE_DIR = Path(__file__).parent.parent.parent.parent / "knowledge"


def load_knowledge_file(filename: str) -> Optional[str]:
    """Load a knowledge base file by name"""
    filepath = KNOWLEDGE_DIR / filename
    if filepath.exists():
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            logger.info(f"Loaded knowledge file: {filename} ({len(content)} chars)")
            return content
        except Exception as e:
            logger.error(f"Failed to load {filename}: {e}")
            return None
    else:
        logger.warning(f"Knowledge file not found: {filepath}")
        return None


def load_sound_knowledge_base() -> str:
    """Load the main sound engineering knowledge base"""
    content = load_knowledge_file("sound-knowledge-base.md")
    if content:
        return content

    # Fallback to root directory if not in knowledge folder
    root_path = KNOWLEDGE_DIR.parent / "sound-knowledge-base.md"
    if root_path.exists():
        try:
            with open(root_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to load from root: {e}")

    return ""


def get_troubleshooting_guide() -> str:
    """Return the troubleshooting section for quick reference"""
    return """
## Troubleshooting Quick Reference

### Vocal Issues
- **Sounds muddy/boomy**: Reduce warmth boost (300-350Hz for female, 200-260Hz for male) to +2dB or less. Check HPF is engaged.
- **Doesn't cut through**: Increase presence (4-5kHz for female, 2.5-3.5kHz for male). Lower competing instruments.
- **Harsh/sibilant**: Cut 3-5kHz slightly, or use de-esser if available.
- **Feedback**: Check monitor position, reduce monitor send, cut problem frequency on channel EQ.

### Flute Issues
- **Sounds dull**: Boost 8-10kHz more (up to +5dB). Beta 57 lacks natural airiness.
- **Sounds harsh**: Cut more at 2.5-3kHz.
- **Too breathy**: Cut slightly at 500-800Hz.

### Tabla Issues
- **Sounds boomy**: Reduce 200-250Hz boost, consider engaging HPF at 40-50Hz.
- **Lacks punch**: Increase attack definition boost at 2-3kHz, ensure fast compression attack (6ms).
- **Sounds thin**: Boost 60Hz and 200Hz more.

### Guitar (DI/Piezo) Issues
- **Sounds harsh/plastic**: Cut more at 2.5-3kHz (the piezo quack) - this is CRITICAL.
- **Sounds thin**: Boost 150-180Hz for body.
- **Lacks sparkle**: Boost 8-10kHz.

### Bowed Strings (Dilruba, Taus, Violin, Sarangi) Issues
- **Piezo quack**: Always cut 2.5kHz with NARROW width.
- **Lacks warmth**: Boost 150-250Hz range.
- **Bowing sounds scratchy**: Cut slightly at 1-2kHz.

### FX Issues
- **Can't hear reverb**: Check BOTH FX Send AND Return in LR view are up. Check individual channel send levels.
- **Reverb sounds washy**: Make sure instrument isn't being sent to multiple FX. Reduce send or return level.
- **Too much reverb on one source**: Reduce that channel's FX send, not the overall return.

### General Mix Issues
- **Mix sounds muddy overall**: High-pass everything that doesn't need bass. Check for buildup around 200-400Hz.
- **Mix lacks clarity**: Ensure each instrument has its own frequency space. Cut before boosting.
- **Feedback during soundcheck**: Note the frequency and cut on GEQ. Reference previous GEQ cuts for this venue.
"""


def get_learning_context_template() -> str:
    """Return template for incorporating past setup learnings"""
    return """
## Learning from Past Setups

When past setups are provided, analyze them carefully:

1. **High-rated setups (4-5 stars)**: These worked well. Prioritize their settings as starting points.
2. **User notes**: Pay close attention to what the user noted - these are real-world observations.
3. **Performer-specific learnings**: If a past setup had the same performer type, use those exact settings.
4. **Venue-specific adjustments**: GEQ cuts from ring-out indicate room problems - always remind about these.

### How to Apply Learnings

- If a past setup rated 5/5 had specific EQ for tabla, COPY those settings exactly
- If notes mention "too much reverb on vocal", reduce vocal reverb send by 3-6dB from default
- If notes mention "guitar sounded great", preserve those guitar settings
- If notes mention any problem, explicitly address how to avoid it in the new setup

### Prioritization
1. Same venue + same performer type = highest priority (use exact settings)
2. Same venue + different performers = use venue-specific adjustments (GEQ, room notes)
3. Different venue + same performers = use performer settings but verify against new room
"""
