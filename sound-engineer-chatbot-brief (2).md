# Sound Engineering Chatbot — Project Brief

## Overview
A PWA application that provides step-by-step sound engineering guidance for live events. Users input their performer lineup and venue, and the app generates QuPac mixer setup instructions tailored to that specific scenario.

**Mission:** Help charity institutions manage their own sound systems with AI-guided setup instructions.

---

## Core Concept

### The Flow
1. User selects a **location** (saved venue with known setup) or creates a temp location
2. User inputs **performers** for the event (e.g., "2 vocalists, 1 acoustic guitar, 1 tabla")
3. App generates **step-by-step QuPac instructions** including:
   - Channel assignments
   - Gain staging recommendations
   - EQ starting points
   - FX suggestions
   - Monitor mix guidance
4. User can **save the setup** for future reference
5. App **learns** from saved setups to improve recommendations

---

## Architecture

```
┌─────────────────────────────────────────┐
│           PWA Frontend                  │
│  (React + Vite, mobile-first)           │
│  - Installable on phone                 │
│  - Offline capability (cached setups)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           FastAPI Backend               │
│  - Claude API integration               │
│  - JWT authentication                   │
│  - Setup generation & history           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           PostgreSQL                    │
│  (Railway managed)                      │
└─────────────────────────────────────────┘
```

---

## User's Gear (Hardcoded Initially)

### Mixer
- **Allen & Heath QuPac**
  - 16 on-board mic/line inputs (XLR/TRS)
  - Expandable to 38 via dSNAKE
  - 32 mono + 3 stereo DSP channels
  - 4 mono + 3 stereo aux sends
  - 4 stereo FX engines
  - Per-channel: HPF, gate, 4-band PEQ, compressor, delay, ducker
  - Per-output: PEQ, 1/3 octave GEQ, compressor, delay
  - Scene recall, channel libraries

### Microphones

#### Performance Mics
| Mic | Type | Typical Use |
|-----|------|-------------|
| Shure Beta 58A | Dynamic, supercardioid | Lead vocals |
| Shure Beta 57A | Dynamic, supercardioid | Instruments, guitar amps |
| AKG C1000S | Condenser, cardioid/hypercardioid | Tabla, acoustic instruments |

#### Measurement Mic
| Mic | Type | Use |
|-----|------|-----|
| PreSonus PRM1 | Condenser, omnidirectional, flat 20Hz-20kHz | Room tuning, ring out (Phase 3 & 4) |

**Why a measurement mic is needed:**
The Beta 58A is supercardioid — great for rejecting stage noise during performance, but during ring-out it doesn't "hear" the room the same way the PA excites it. Off-axis reflections and room resonances get missed.

The PRM1 is omnidirectional with flat frequency response — it captures reflections and direct signals equally, showing the true room response on the QuPac RTA.

**Important:** The PRM1 has limited dynamic range and higher self-noise. Use it ONLY for measurement (Phases 3 & 4), then switch to performance mics for soundcheck (Phase 5).

---

## Security Requirements

### Phase 1 (Single User)
- Simple JWT authentication
- API key stored in Railway environment variables
- HTTPS enforced

### Phase 2 (Multi-User)
- User registration with email verification
- Role-based access (admin, operator)
- Option for users to provide their own Claude API key
- Rate limiting per user
- Audit logging

---

## Database Schema

### users
```sql
id              UUID PRIMARY KEY
email           VARCHAR UNIQUE NOT NULL
password_hash   VARCHAR NOT NULL
role            VARCHAR DEFAULT 'operator'
api_key         VARCHAR NULL  -- optional personal API key
created_at      TIMESTAMP
```

### locations
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users
name            VARCHAR NOT NULL
venue_type      VARCHAR  -- church, hall, outdoor, etc.
notes           TEXT
speaker_setup   JSONB    -- FOH, monitors, etc.
default_config  JSONB    -- saved QuPac scene defaults
is_temporary    BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP
```

### setups
```sql
id              UUID PRIMARY KEY
location_id     UUID REFERENCES locations
user_id         UUID REFERENCES users
event_name      VARCHAR
event_date      DATE
performers      JSONB    -- array of performer objects
channel_config  JSONB    -- generated channel assignments
eq_settings     JSONB    -- per-channel EQ
fx_settings     JSONB    -- reverb, delay assignments
notes           TEXT     -- user notes, what worked/didn't
rating          INTEGER  -- 1-5, how well it worked
created_at      TIMESTAMP
```

### gear
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users
type            VARCHAR  -- mic, mixer, speaker, etc.
brand           VARCHAR
model           VARCHAR
specs           JSONB    -- polar pattern, frequency response, etc.
default_settings JSONB   -- typical gain, EQ starting points
created_at      TIMESTAMP
```

### knowledge_base
```sql
id              UUID PRIMARY KEY
category        VARCHAR  -- mixer, mic_technique, troubleshooting
title           VARCHAR
content         TEXT
source          VARCHAR  -- manual, learned, user
created_at      TIMESTAMP
```

---

## Site Workflow (App Guides User Through This)

The app follows a 6-phase workflow that matches real-world sound engineering practice.

### Phase 1: Physical Setup
- Set up PA speakers (FOH)
- Set up monitors (floor wedges)
- Connect mixer, amps, run cables
- Power on in correct order (mixer → amps last)

*App role: Checklist for the venue, recall previous setup notes*

### Phase 2: System Check
- Send pink noise or test tone through FOH
- Walk the room — listen for dead spots, reflections
- Initial assessment of room acoustics

*App role: Notes from previous visits about room issues*

### Phase 3: Ring Out Mains
- Connect **PreSonus PRM1** measurement mic to a spare QuPac channel
- Enable 48V phantom power for PRM1
- Position PRM1 at typical performer/audience position
- Slowly raise gain until ringing detected
- Identify feedback frequencies using QuPac RTA
- Cut on **LR GEQ**
- Repeat until 6-10 dB headroom above performance level

**Why PRM1 instead of Beta 58?** The Beta 58's supercardioid pattern rejects off-axis sound — great for performance, but misses room resonances during ring-out. The PRM1's omnidirectional pattern captures everything.

*App role: Show previous LR GEQ cuts for this venue, log new cuts*

**Data saved per venue:**
```
LR GEQ Cuts:
├── 250 Hz  → -3 dB (room boom)
├── 1.6 kHz → -4 dB
└── 4 kHz   → -5 dB (high ring)
```

### Phase 4: Ring Out Monitors
**User's method:**
1. Keep **PreSonus PRM1** connected (from Phase 3)
2. Also turn on ALL performance mics, positioned where performers will stand
3. QuPac signal generator → pink noise → monitor output
4. Gradually increase monitor level
5. Watch RTA for peaks that sustain/ring
6. Cut those frequencies on **Monitor Mix GEQ**
7. Repeat until clean at performance level + headroom

**Note:** Using PRM1 alongside the performance mics ensures you catch all problem frequencies — both what the room does and what the performer mics will pick up.

*App role: Show previous monitor GEQ cuts for this venue, log new cuts*

**Data saved per venue:**
```
Monitor GEQ Cuts:
├── 800 Hz  → -3 dB
└── 3.2 kHz → -4 dB
```

**Note:** User has hearing loss in high frequencies — feedback detection feature needed to visually flag sustained/ringing peaks that may not be audible.

### Phase 5: Soundcheck
**Per channel, in order:**
1. **HPF** — set high-pass filter to remove rumble
2. **EQ** — shape tone (cut mud, add presence, etc.)
3. **Compression** — control dynamics
4. **FX send** — add reverb to taste

**Channel priority:**
- Work with whoever is ready first
- Ideally process each channel in isolation
- Can work with full mix if time is tight

*App role: Provide recommended starting settings based on:*
- *Instrument/voice type (male vocal, female vocal, flute, tabla, etc.)*
- *Mic being used (Beta 58, Beta 57, C1000)*
- *What worked at this venue previously*

### Phase 6: Final Mix
- Balance fader levels in LR
- Fine-tune FX return levels
- Full run-through with all performers
- Final adjustments

*App role: Save the complete setup for future reference, allow rating/notes*

---

## Core Features (MVP)

### 1. Location Management
- Create/edit locations with venue details
- Mark as permanent or temporary
- Store speaker/monitor setup info

### 2. Setup Generator
- Input: performers (type, count, instruments)
- Output: Step-by-step QuPac instructions
- Uses Claude API with context about:
  - User's gear
  - Venue specifics
  - Past successful setups at that location

### 3. Setup History
- Save generated setups
- Rate effectiveness (1-5 stars)
- Add notes about what worked/didn't
- Reference past setups for same venue

### 4. Learning System
- When generating new setups, include context from:
  - Past setups at same location
  - Past setups with similar performer lineup
  - User ratings and notes
- Improves recommendations over time

---

## API Endpoints (Draft)

```
POST   /auth/login
POST   /auth/register
GET    /auth/me

GET    /locations
POST   /locations
GET    /locations/{id}
PUT    /locations/{id}
DELETE /locations/{id}

POST   /setups/generate          -- main AI endpoint
GET    /setups
GET    /setups/{id}
PUT    /setups/{id}              -- update notes, rating
DELETE /setups/{id}

GET    /gear
POST   /gear
PUT    /gear/{id}
DELETE /gear/{id}
```

---

## Claude API Integration

### System Prompt (Core)
The AI should know:
- QuPac capabilities and limitations
- User's available gear
- Sound engineering best practices
- How to give step-by-step instructions

### Context Injection
Each request includes:
- Location details
- Available gear
- Relevant past setups (if any)
- User's notes from similar events

### Response Format
Structured JSON with:
- Channel assignments
- Step-by-step instructions
- EQ recommendations
- FX suggestions
- Troubleshooting tips

---

## Railway Deployment

### Services
1. **Backend** (FastAPI container)
2. **Frontend** (Static site or Node container)
3. **PostgreSQL** (Railway managed)

### Environment Variables
```
DATABASE_URL=
ANTHROPIC_API_KEY=
JWT_SECRET=
FRONTEND_URL=
```

---

## File Structure (Proposed)

```
sound-engineer-app/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   │   ├── claude_service.py
│   │   │   └── setup_generator.py
│   │   └── utils/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── services/
│   ├── public/
│   │   └── manifest.json
│   ├── Dockerfile
│   └── package.json
├── knowledge/
│   ├── qupac-reference.md
│   ├── mic-techniques.md
│   └── troubleshooting.md
└── README.md
```

---

## Phase 2 Features (Future)

### Feedback Detection Tool (Priority)
**Problem:** User has high-frequency hearing loss, making it difficult to hear feedback during ring-out.

**Solution:** Audio analysis module that:
- Listens via phone/tablet mic during ring-out
- Detects sustained/growing frequencies (feedback signature)
- Visually flags the exact frequency (with QuPac GEQ band mapping)
- Provides visual flash or vibration alert when ring detected
- Auto-logs detected frequencies to venue profile
- Shows "last time at this venue, these were problem frequencies"

**Technical approach:**
- Use Web Audio API for real-time FFT analysis
- Detect peaks that sustain > X seconds or grow in amplitude
- Map detected frequency to nearest 1/3 octave GEQ band
- Display with confidence level

### Other Future Features
- Multi-user with organization accounts
- Shared location libraries within org
- Export setups as PDF
- QuPac scene file generation
- Offline mode with sync
- Voice input for hands-free operation during setup
- Integration with QuPac via network (if feasible)

---

## Notes

- User deploys to Railway.app
- User is comfortable with FastAPI + container deployments
- This is for charity sound reinforcement work
- Goal: Eventually allow charities to manage their own systems
