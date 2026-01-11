# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SERunner** (Sound Engineering Runner) is a Progressive Web App that provides AI-guided, step-by-step sound engineering instructions for live events using QuPac mixers. The app helps charity institutions manage their own sound systems without requiring professional sound engineers.

**Core Flow:**
1. User selects/creates a venue location
2. User inputs performer lineup (e.g., "2 vocalists, 1 acoustic guitar, 1 tabla")
3. Claude API generates tailored QuPac mixer setup instructions
4. User saves setup with ratings/notes
5. System learns from past setups to improve recommendations

## Architecture

```
PWA Frontend (React + Vite, mobile-first)
    ↓
FastAPI Backend (Claude API integration, JWT auth)
    ↓
PostgreSQL (Railway managed)
```

**Key Technologies:**
- Frontend: React, Vite, PWA (installable on mobile, offline capability)
- Backend: FastAPI (Python), Claude API integration
- Database: PostgreSQL with UUID primary keys
- Deployment: Railway.app (containerized services)
- Authentication: JWT (Phase 1: single user, Phase 2: multi-user with roles)

## Database Schema

The application uses 5 core tables:

**users** - Authentication and API key management
**locations** - Venues with speaker setup and default configs (JSONB)
**setups** - Generated mixer configurations with performer details, channel assignments, EQ/FX settings (JSONB)
**gear** - User's microphones, mixers, speakers with specs (JSONB)
**knowledge_base** - Sound engineering reference content (mixer manuals, mic techniques, troubleshooting)

All tables use UUID primary keys and include timestamps.

## API Structure

```
/auth/*           - Login, register, token management
/locations/*      - CRUD for venues
/setups/generate  - Main AI endpoint (generates QuPac instructions)
/setups/*         - CRUD for saved setups with ratings/notes
/gear/*           - CRUD for user equipment
```

The `/setups/generate` endpoint is the core feature - it sends location details, gear inventory, and past successful setups to Claude API and receives structured JSON with channel assignments, EQ recommendations, FX routing, and troubleshooting tips.

## Sound Engineering Context

The app is specifically designed for the **Allen & Heath QuPac** mixer with these microphones:
- Shure Beta 58A (lead vocals)
- Shure Beta 57A (instruments, guitar amps)
- AKG C1000S (tabla, acoustic instruments)

**Critical Knowledge Base:**
- `sound-knowledge-base.md` contains real-world settings extracted from live sessions
- Includes EQ curves, compression settings, FX routing strategies per instrument
- Documents QuPac-specific quirks (e.g., FX routing requires BOTH Send AND Return in LR mix view)
- Provides instrument-specific starting points and troubleshooting steps

**When generating mixer instructions via Claude API:**
- Always reference the knowledge base for proven EQ/compression settings
- Inject context from past setups at the same location
- Provide step-by-step instructions (channel assignment → gain staging → EQ → compression → FX)
- Include troubleshooting tips specific to the performer lineup

## File Structure (Planned)

```
backend/
  app/
    main.py                  - FastAPI entry point
    config.py                - Environment variables
    database.py              - SQLAlchemy setup
    models/                  - ORM models for users, locations, setups, gear
    routers/                 - API endpoint handlers
    services/
      claude_service.py      - Claude API client
      setup_generator.py     - Core logic for generating mixer instructions
    utils/                   - JWT, validation helpers

frontend/
  src/
    components/              - React components
    pages/                   - Location, Setup Generator, History views
    hooks/                   - Custom React hooks
    services/                - API client for backend
  public/
    manifest.json            - PWA configuration

knowledge/                   - Reference docs for sound engineering
  qupac-reference.md
  mic-techniques.md
  troubleshooting.md
```

## Development Workflow

**Backend Setup:**
- Use Python 3.10+
- FastAPI with Uvicorn for dev server
- SQLAlchemy ORM with asyncio support
- Alembic for database migrations
- pytest for testing

**Frontend Setup:**
- Vite for dev server and build
- React with TypeScript recommended
- Service Worker for offline capability
- IndexedDB for caching setups locally

**Environment Variables (Railway):**
```
DATABASE_URL          - PostgreSQL connection string
ANTHROPIC_API_KEY     - Claude API key
JWT_SECRET            - For token signing
FRONTEND_URL          - CORS configuration
```

## Railway Deployment

The app deploys as 3 Railway services:
1. **Backend** - FastAPI container (Dockerfile in backend/)
2. **Frontend** - Static build or Node container (Dockerfile in frontend/)
3. **PostgreSQL** - Railway managed database

Each service needs a Dockerfile. Backend should expose port 8000, frontend should expose port 3000 or serve static files via Nginx.

## Claude API Integration Strategy

**System Prompt Structure:**
- QuPac capabilities and limitations
- Available gear (from `gear` table)
- Sound engineering best practices (from knowledge base)
- Step-by-step instruction format

**Context Injection Per Request:**
- Location details (venue type, speaker setup, default config)
- Relevant past setups (same venue or similar performer lineup)
- User ratings and notes from similar events
- Available microphones and their typical use cases

**Expected Response Format:**
Structured JSON with:
- channel_config: Assignments (e.g., Channel 1: Lead Vocal - Beta 58A)
- eq_settings: Per-channel EQ (HPF, 4-band PEQ with frequencies and gains)
- compression_settings: Attack, release, threshold, ratio, makeup gain
- fx_settings: Reverb/delay assignments with send levels
- step_by_step_instructions: Human-readable setup guide
- troubleshooting_tips: Common issues for this lineup

## Key Design Decisions

**Phase 1 (MVP):**
- Single user authentication (simplified JWT)
- Hardcoded gear (QuPac + Beta 58/57 + AKG C1000)
- Manual setup entry and rating
- Claude API generates instructions based on location + performers

**Phase 2 (Future):**
- Multi-user with organization accounts
- User-provided Claude API keys
- Export setups as PDF
- QuPac scene file generation
- Voice input for hands-free operation
- Network integration with QuPac (if feasible)

## Important Notes

- This is for charity/volunteer sound reinforcement work
- Target users are non-professionals who need guidance during setup
- Mobile-first design is critical (used on-site during setup)
- Offline mode is essential (venues may have poor connectivity)
- The app should "learn" from ratings - higher-rated setups should influence future recommendations
