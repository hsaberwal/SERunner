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
| Mic | Type | Typical Use |
|-----|------|-------------|
| Shure Beta 58A | Dynamic, supercardioid | Lead vocals |
| Shure Beta 57A | Dynamic, supercardioid | Instruments, guitar amps |
| AKG C1000S | Condenser, cardioid/hypercardioid | Tabla, acoustic instruments |

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
