# SERunner

**Sound Engineering Runner** - AI-guided QuPac mixer setup for live events

A Progressive Web App that helps charity institutions manage their own sound systems by providing step-by-step, AI-generated mixer setup instructions tailored to their specific venue and performer lineup.

## Features

- **AI-Powered Setup Generation**: Uses Claude API to generate QuPac mixer configurations
- **Location Management**: Save venue details and speaker setups
- **Setup History**: Track past setups with ratings and notes
- **Learning System**: Improves recommendations based on highly-rated past setups
- **Mobile-First PWA**: Installable on phones for on-site use
- **Offline Capability**: Access saved setups without internet

## Architecture

```
React + Vite PWA → FastAPI Backend → PostgreSQL
```

- **Frontend**: React, Vite, PWA (installable, offline-capable)
- **Backend**: FastAPI (Python), Claude API integration, JWT authentication
- **Database**: PostgreSQL with JSONB for flexible data storage
- **Deployment**: Railway.app (containerized services)

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Anthropic API key

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd SERunner
   ```

2. **Backend Setup**
   ```bash
   cd backend

   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt

   # Set up environment variables
   cp .env.example .env
   # Edit .env with your database URL and API keys

   # Run database migrations
   alembic upgrade head

   # Start the server
   uvicorn app.main:app --reload
   ```

3. **Frontend Setup**
   ```bash
   cd frontend

   # Install dependencies
   npm install

   # Set up environment variables
   cp .env.example .env

   # Start dev server
   npm run dev
   ```

4. **Access the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# Run migrations
docker-compose exec backend alembic upgrade head

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Deployment to Railway

### 1. Create Railway Project

1. Go to [Railway.app](https://railway.app)
2. Create a new project
3. Add PostgreSQL database service

### 2. Deploy Backend

1. Create a new service from GitHub repo
2. Set root directory to `backend`
3. Add environment variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ANTHROPIC_API_KEY=your-api-key
   JWT_SECRET=your-secret-key
   FRONTEND_URL=https://frontend-production-821b.up.railway.app
   ```
4. Railway will auto-detect Dockerfile and deploy

### 3. Deploy Frontend

1. Create another service from same GitHub repo
2. Set root directory to `frontend`
3. Add environment variable:
   ```
   VITE_API_URL=https://backend-production-e55b3.up.railway.app
   ```
4. Railway will auto-detect Dockerfile and deploy

### 4. Initialize Database

Visit the setup page to initialize the database:
https://frontend-production-821b.up.railway.app/setup

The app will automatically create tables on startup, or you can manually initialize via the setup page.

## Production URLs

- **Frontend**: https://frontend-production-821b.up.railway.app
- **Backend API**: https://backend-production-e55b3.up.railway.app
- **API Docs**: https://backend-production-e55b3.up.railway.app/docs
- **Setup Page**: https://frontend-production-821b.up.railway.app/setup

## Project Structure

```
SERunner/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Settings & env vars
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models/              # Database models
│   │   ├── routers/             # API endpoints
│   │   ├── services/
│   │   │   ├── claude_service.py    # Claude API client
│   │   │   └── setup_generator.py   # Setup generation logic
│   │   └── utils/               # Auth, helpers
│   ├── alembic/                 # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── hooks/               # useAuth hook
│   │   ├── services/            # API client
│   │   └── main.jsx
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   ├── vite.config.js           # Vite + PWA config
│   ├── Dockerfile
│   └── package.json
├── knowledge/                   # Sound engineering reference
│   └── sound-knowledge-base.md  # Real-world EQ/compression settings
└── CLAUDE.md                    # AI assistant context
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user

### Locations
- `GET /locations` - List all locations
- `POST /locations` - Create location
- `GET /locations/{id}` - Get location details
- `PUT /locations/{id}` - Update location
- `DELETE /locations/{id}` - Delete location

### Setups
- `POST /setups/generate` - Generate new setup (main AI endpoint)
- `GET /setups` - List all setups
- `GET /setups/{id}` - Get setup details
- `PUT /setups/{id}` - Update rating/notes
- `DELETE /setups/{id}` - Delete setup

### Gear
- `GET /gear` - List all gear
- `POST /gear` - Add gear
- `PUT /gear/{id}` - Update gear
- `DELETE /gear/{id}` - Delete gear

## Database Schema

### users
- Authentication and API key management

### locations
- Venues with speaker setup and default configs (JSONB)

### setups
- Generated mixer configurations with performer details, channel assignments, EQ/FX settings (JSONB)

### gear
- User's microphones, mixers, speakers with specs (JSONB)

### knowledge_base
- Sound engineering reference content

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/serunner
ANTHROPIC_API_KEY=your-api-key
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

## Development Commands

### Backend
```bash
# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# Run tests
pytest

# Start server
uvicorn app.main:app --reload
```

### Frontend
```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Sound Engineering Context

This app is specifically designed for the **Allen & Heath QuPac** mixer with:
- Shure Beta 58A (lead vocals)
- Shure Beta 57A (instruments, guitar amps)
- AKG C1000S (tabla, acoustic instruments)

The knowledge base (`sound-knowledge-base.md`) contains real-world EQ curves, compression settings, and FX routing strategies extracted from live sessions.

## Contributing

This is a charity project to help non-professional sound operators. Contributions welcome!

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
