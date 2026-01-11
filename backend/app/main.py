from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, locations, setups, gear
from app.database import engine, Base
from app.models import User, Location, Setup, Gear, KnowledgeBase

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup on shutdown (optional)
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="AI-guided sound engineering setup for QuPac mixers",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - allow frontend origin
# Strip trailing slash if present to ensure exact match
frontend_origin = settings.frontend_url.rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(locations.router, prefix="/locations", tags=["Locations"])
app.include_router(setups.router, prefix="/setups", tags=["Setups"])
app.include_router(gear.router, prefix="/gear", tags=["Gear"])


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/admin/cors-debug")
async def cors_debug():
    """Debug endpoint to check CORS configuration."""
    return {
        "frontend_url_setting": settings.frontend_url,
        "frontend_origin_used": settings.frontend_url.rstrip("/"),
    }


@app.get("/admin/db-status")
async def db_status():
    """Check database connection and table status."""
    from sqlalchemy import inspect, text
    try:
        async with engine.connect() as conn:
            # Check connection
            await conn.execute(text("SELECT 1"))

            # Get table names
            def get_tables(connection):
                inspector = inspect(connection)
                return inspector.get_table_names()

            tables = await conn.run_sync(get_tables)

            return {
                "status": "connected",
                "tables": tables,
                "tables_count": len(tables)
            }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/admin/init-db")
async def init_db():
    """Manually create all database tables."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return {
            "status": "success",
            "message": "Database tables created successfully"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
