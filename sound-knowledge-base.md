# Sound Engineering Knowledge Base
## Extracted from live session - QuPac with Beta 58/57 and AKG C1000

---

## QuPac FX Routing (CRITICAL)

### How FX Routing Actually Works
**In LR Mix view, you need BOTH FX Send AND FX Return to be UP to hear effects.**

The signal flow:
1. Individual channel sends (in FX1/FX2 mix view) → control how much of each channel goes to the FX
2. FX Send in LR view → sends the processed effect to the LR bus
3. FX Return in LR view → brings it back into LR mix

**Both Send and Return in LR view must be up** — if either is at -∞, you hear no FX at all.

### Recommended FX Return Levels (LR Mix View)
| FX | Send | Return |
|----|------|--------|
| FX1 | 0 dB | 0 dB |
| FX2 | 0 dB | 0 dB |

Adjust proportionally if overall FX is too loud/quiet.

---

## FX Assignments

### Reverb Strategy: Keep Instruments in Separate Spaces
- **FX1 (Arena)**: Flute only — wants big, spacious reverb
- **FX2 (Hall Small/Stage)**: Vocals, Tabla, Guitar — more intimate, focused space

**Important**: Don't double-reverb! If vocal is in both FX1 and FX2, it sounds distant and washy. Keep them separate.

### Send Levels (Channel → FX)
| Channel | FX1 Send (Arena) | FX2 Send (Hall Small/Stage) |
|---------|------------------|------------------------------|
| Flute | -5 dB | OFF |
| Vocal | OFF | -10 dB |
| Tabla | OFF | -20 dB |
| Guitar | -15 to -18 dB | -15 dB |

---

## EQ Settings by Instrument

### Female Vocal (Shure Beta 58)
*Goal: Round, full, present without harshness*

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 93.9 Hz | ON | Remove rumble |
| Band 1 | 683 Hz | -5.0 dB | Cut boxiness/honkiness |
| Band 2 | 331-342 Hz | +2.5 dB | Warmth/body (don't exceed +3 or gets boomy) |
| Band 3 | 4.5 kHz | +4.6 to +4.8 dB | Presence/clarity to cut through |
| Band 4 | 10 kHz | 0.0 dB | Flat (add +2-3 dB if needs more air) |

**Notes:**
- If vocal sounds boomy, reduce Band 2
- If vocal needs to cut through more, increase Band 3 (up to +6.8 dB tested)
- Female presence sits around 4-5 kHz

---

### Male Vocal (Shure Beta 58)
*Goal: Full chest tone, clear presence*

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 71.4 Hz | ON | Lower than female to keep chest resonance |
| Band 1 | 475 Hz | -4.3 dB | Cut boxiness (lower freq than female) |
| Band 2 | 260 Hz | +2.7 dB | Warmth in male chest range |
| Band 3 | 2.99 kHz | +4.6 dB | Presence (lower than female) |
| Band 4 | 9.83 kHz | +3.5 dB | Air and clarity |

**Key Differences from Female:**
- HPF lower (71 Hz vs 94 Hz)
- Warmth boost lower (260 Hz vs 330 Hz)
- Presence lower (3 kHz vs 4.5 kHz)
- Add air at high end

---

### Flute (Shure Beta 57)
*Goal: Clean, airy, expressive — Beta 57 can make flute sound thick/muddy*

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 90.7 Hz | ON | Remove handling noise/rumble |
| Band 1 | 263 Hz | -3.1 dB | Remove muddiness from Beta 57 |
| Band 2 | 200 Hz | 0.0 dB | Flat |
| Band 3 | 2.63 kHz | -3.5 dB | Reduce harshness |
| Band 4 | 9.01 kHz | +3.7 dB | Add air and sparkle (CRITICAL for flute) |

**Notes:**
- Beta 57 lacks natural airiness on flute — boost 8-10 kHz
- Can increase Band 4 to +5 dB if more air needed

---

### Tabla (Shure Beta 57)
*Goal: Punchy with bass (per artist request)*

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | OFF | - | Keep all low frequencies |
| Band 1 | 59.5 Hz | +2.6 dB | Sub-bass weight |
| Band 2 | 216 Hz | +9.7 dB | BIG warmth/body boost (artist wanted bass) |
| Band 3 | 4.5 kHz | 0.0 dB | Flat (could add +3-4 dB at 2-3 kHz for attack) |
| Band 4 | 10 kHz | 0.0 dB | Flat |

**Notes:**
- +9.7 dB at 216 Hz is aggressive but delivers the bass requested
- If muddy, reduce Band 2 to +6 or +7 dB
- For more attack/slap definition, boost 2-3 kHz

---

### Acoustic Guitar — Direct/DI (Piezo Pickup)
*Goal: Natural, warm — remove piezo harshness*

| Band | Frequency | Gain | Purpose |
|------|-----------|------|---------|
| HPF | 82 Hz | ON | Clean up low end |
| Band 1 | 174 Hz | +3.2 dB | Add body/warmth |
| Band 2 | 200 Hz | 0.0 dB | Flat |
| Band 3 | 2.61 kHz | -3.3 dB | **CRITICAL: Remove piezo quack/harshness** |
| Band 4 | 8.34 kHz | +4.9 dB | Add shimmer and string detail |

**Notes:**
- The cut at 2-3 kHz is THE critical adjustment for direct acoustic
- Without this cut, DI guitar sounds harsh, plastic-y, and unnatural
- Can increase body (Band 1) if guitar sounds thin

---

## Compression Settings by Instrument

### Vocal (Male or Female)
| Parameter | Value | Notes |
|-----------|-------|-------|
| Attack | 15 ms | Lets articulation through |
| Release | 100 ms | Smooth recovery |
| Threshold | -7.5 dB | Catches dynamics |
| Ratio | 4:1 | Firm but musical |
| Gain | 2.7 dB | Makeup gain |
| Soft Knee | ON | Smooth compression |

*Target: 3-6 dB gain reduction*

---

### Flute
| Parameter | Value | Notes |
|-----------|-------|-------|
| Attack | 17.3 ms | Lets breath through |
| Release | 100 ms | Smooth recovery |
| Threshold | -9.0 dB | Catches dynamics |
| Ratio | 3.2:1 | Gentle, musical |
| Gain | 0.9 dB | Adjust as needed |
| Soft Knee | ON | Smooth compression |

**Avoid:** Ratio at infinity (limiter mode) and very fast attack — kills expression

---

### Tabla
| Parameter | Value | Notes |
|-----------|-------|-------|
| Attack | 6.5 ms | **FAST** — catches transients |
| Release | 100 ms | Quick recovery for rhythm |
| Threshold | -9.1 dB | Catches the hits |
| Ratio | 4:1 | Firm control |
| Gain | 2.4 dB | Makeup gain |
| Soft Knee | **OFF** | Lets attack punch through |

**Key:** Fast attack + Soft Knee OFF = preserves the slap/punch character

---

### Acoustic Guitar
| Parameter | Value | Notes |
|-----------|-------|-------|
| Attack | 13.4 ms | Lets pick attack through |
| Release | 100 ms | Good for strumming/picking |
| Threshold | -11.2 dB | Catches dynamics |
| Ratio | 3.2:1 | Gentle, musical |
| Gain | 2.6 dB | Makeup gain |
| Soft Knee | ON | Smooth and musical |

---

## Key Lessons Learned

### 1. Don't Double-Reverb
If an instrument (especially vocal) is sent to multiple reverbs, it sounds distant and washy. Keep instruments in their own reverb space.

### 2. Male vs Female Vocal EQ
- Male: Lower HPF, lower warmth frequency, lower presence frequency, add air
- Female: Higher HPF, higher warmth frequency, higher presence frequency

### 3. Beta 57 on Flute Needs Help
The Beta 57 makes flute sound thick and lacks airiness. Always boost 8-10 kHz and cut low-mids.

### 4. Direct Acoustic Guitar = Cut the Quack
Piezo pickups have a harsh "plastic" sound around 2-3 kHz. This cut is essential.

### 5. Tabla Compression = Fast Attack, Hard Knee
Unlike other instruments, tabla needs fast attack to catch transients, and soft knee OFF to preserve punch.

### 6. Avoid Limiter Mode on Musical Sources
Ratio at "Inf." acts as a brick-wall limiter — use 3:1 to 5:1 for musical compression.

### 7. FX Sends vs Returns (QuPac Specific)
- **Sends** (per channel) = How much of each instrument goes to the FX
- **Returns** (in LR) = How loud the overall effect is in the mix
- You need BOTH to hear the effect

---

## Quick Reference: Starting Points

### New Female Vocalist
```
HPF: 90-100 Hz
Cut: 600-700 Hz @ -4 to -5 dB
Boost: 300-350 Hz @ +2 to +3 dB
Presence: 4-5 kHz @ +4 to +5 dB
Compression: 4:1, -8 dB threshold, 15ms attack, soft knee ON
Reverb: Hall Small/Stage @ -10 dB send
```

### New Male Vocalist
```
HPF: 70-80 Hz
Cut: 400-500 Hz @ -4 dB
Boost: 200-260 Hz @ +2 to +3 dB
Presence: 2.5-3.5 kHz @ +4 dB
Air: 9-10 kHz @ +3 dB
Compression: 4:1, -8 dB threshold, 15ms attack, soft knee ON
Reverb: Hall Small/Stage @ -10 dB send
```

### New Flute (Beta 57)
```
HPF: 90 Hz
Cut: 250-300 Hz @ -3 dB (remove mud)
Cut: 2.5-3 kHz @ -3 dB (reduce harshness)
Boost: 8-10 kHz @ +4 dB (add air)
Compression: 3:1, -9 dB threshold, 17ms attack, soft knee ON
Reverb: Arena @ -5 dB send (flute likes space)
```

### New Tabla (Beta 57)
```
HPF: OFF (keep the lows)
Boost: 60 Hz @ +2-3 dB (sub-bass)
Boost: 200-250 Hz @ +6 to +10 dB (body — adjust to taste)
Optional: 2-3 kHz @ +3 dB (attack definition)
Compression: 4:1, -9 dB threshold, 6ms attack, soft knee OFF
Reverb: Hall Small/Stage @ -20 dB send (subtle)
```

### New Acoustic Guitar (DI)
```
HPF: 80-85 Hz
Boost: 150-180 Hz @ +3 dB (body)
Cut: 2.5-3 kHz @ -3 to -4 dB (CRITICAL: piezo quack)
Boost: 8-10 kHz @ +4 to +5 dB (shimmer)
Compression: 3:1, -11 dB threshold, 13ms attack, soft knee ON
Reverb: Hall Small/Stage @ -15 dB send
```

---

## Troubleshooting

### Vocal sounds muddy/boomy
- Reduce warmth boost (300-350 Hz) to +2 dB or less
- Check if HPF is engaged

### Vocal doesn't cut through
- Increase presence (4-5 kHz for female, 2.5-3.5 kHz for male)
- Lower flute and tabla faders in LR mix

### Flute sounds dull
- Boost 8-10 kHz more (up to +5 dB)

### Flute sounds harsh
- Cut more at 2.5-3 kHz

### Tabla sounds boomy
- Reduce 200-250 Hz boost
- Consider engaging HPF at 40-50 Hz

### Guitar sounds harsh/plastic
- Cut more at 2.5-3 kHz (the piezo quack)

### Can't hear reverb
- Check BOTH FX Send AND Return in LR view are up
- Check individual channel send levels

### Reverb sounds washy
- Make sure instrument isn't being sent to multiple FX
- Reduce send level or return level
