import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, locations, setups, gear
from app.database import engine, Base
from app.models import User, Location, Setup, Gear, GearLoan, KnowledgeBase

# Configure logging to stdout for Railway
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

settings = get_settings()
logger.info(f"Starting {settings.app_name} with CLAUDE_MODEL={settings.claude_model}")


async def run_startup_migrations():
    """Run schema migrations on startup."""
    from sqlalchemy import text

    async with engine.begin() as conn:
        # Add columns to locations table
        for col_name, col_type in [("lr_geq_cuts", "JSONB"), ("monitor_geq_cuts", "JSONB"), ("room_notes", "TEXT")]:
            try:
                await conn.execute(text(f"ALTER TABLE locations ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
            except Exception:
                pass

        # Add columns to gear table
        for col_name, col_type in [("serial_number", "VARCHAR"), ("quantity", "INTEGER DEFAULT 1"), ("notes", "TEXT")]:
            try:
                await conn.execute(text(f"ALTER TABLE gear ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
            except Exception:
                pass

        # Create gear_loans table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS gear_loans (
                    id UUID PRIMARY KEY,
                    gear_id UUID NOT NULL REFERENCES gear(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    borrower_name VARCHAR NOT NULL,
                    borrower_contact VARCHAR,
                    quantity_loaned INTEGER DEFAULT 1,
                    loan_date TIMESTAMP NOT NULL DEFAULT NOW(),
                    expected_return_date TIMESTAMP,
                    actual_return_date TIMESTAMP,
                    is_returned BOOLEAN DEFAULT FALSE,
                    notes TEXT,
                    return_notes TEXT
                )
            """))
        except Exception:
            pass

        # Create indexes for gear_loans
        for idx_name, table, column in [("ix_gear_loans_gear_id", "gear_loans", "gear_id"), ("ix_gear_loans_user_id", "gear_loans", "user_id"), ("ix_gear_loans_is_returned", "gear_loans", "is_returned")]:
            try:
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})"))
            except Exception:
                pass

        # Add user approval fields
        for col_name, col_type in [("is_approved", "BOOLEAN DEFAULT FALSE"), ("is_admin", "BOOLEAN DEFAULT FALSE")]:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
            except Exception:
                pass

        # Set existing users as approved
        try:
            await conn.execute(text("UPDATE users SET is_approved = TRUE WHERE is_approved IS NULL OR is_approved = FALSE"))
        except Exception:
            pass

        # Set first user as admin
        try:
            await conn.execute(text("UPDATE users SET is_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)"))
        except Exception:
            pass

    logger.info("Startup migrations completed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Run migrations after tables exist
    await run_startup_migrations()
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
allowed_origins = [
    frontend_origin,
    "https://frontend-production-821b.up.railway.app",  # Explicit backup
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
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


@app.post("/admin/migrate")
async def run_migrations():
    """Add new columns to existing tables (for schema updates)."""
    from sqlalchemy import text
    migrations = []
    errors = []

    async with engine.begin() as conn:
        # Add new columns to locations table
        location_columns = [
            ("lr_geq_cuts", "JSONB"),
            ("monitor_geq_cuts", "JSONB"),
            ("room_notes", "TEXT"),
        ]
        for col_name, col_type in location_columns:
            try:
                await conn.execute(text(
                    f"ALTER TABLE locations ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                migrations.append(f"locations.{col_name}")
            except Exception as e:
                errors.append(f"locations.{col_name}: {str(e)}")

        # Add new columns to gear table
        gear_columns = [
            ("serial_number", "VARCHAR"),
            ("quantity", "INTEGER DEFAULT 1"),
            ("notes", "TEXT"),
        ]
        for col_name, col_type in gear_columns:
            try:
                await conn.execute(text(
                    f"ALTER TABLE gear ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                migrations.append(f"gear.{col_name}")
            except Exception as e:
                errors.append(f"gear.{col_name}: {str(e)}")

        # Create gear_loans table if it doesn't exist
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS gear_loans (
                    id UUID PRIMARY KEY,
                    gear_id UUID NOT NULL REFERENCES gear(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    borrower_name VARCHAR NOT NULL,
                    borrower_contact VARCHAR,
                    quantity_loaned INTEGER DEFAULT 1,
                    loan_date TIMESTAMP NOT NULL DEFAULT NOW(),
                    expected_return_date TIMESTAMP,
                    actual_return_date TIMESTAMP,
                    is_returned BOOLEAN DEFAULT FALSE,
                    notes TEXT,
                    return_notes TEXT
                )
            """))
            migrations.append("gear_loans table")
        except Exception as e:
            errors.append(f"gear_loans table: {str(e)}")

        # Create indexes for gear_loans
        indexes = [
            ("ix_gear_loans_gear_id", "gear_loans", "gear_id"),
            ("ix_gear_loans_user_id", "gear_loans", "user_id"),
            ("ix_gear_loans_is_returned", "gear_loans", "is_returned"),
        ]
        for idx_name, table, column in indexes:
            try:
                await conn.execute(text(
                    f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})"
                ))
                migrations.append(f"index {idx_name}")
            except Exception as e:
                errors.append(f"index {idx_name}: {str(e)}")

        # Add user approval fields
        user_columns = [
            ("is_approved", "BOOLEAN DEFAULT FALSE"),
            ("is_admin", "BOOLEAN DEFAULT FALSE"),
        ]
        for col_name, col_type in user_columns:
            try:
                await conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                migrations.append(f"users.{col_name}")
            except Exception as e:
                errors.append(f"users.{col_name}: {str(e)}")

        # Set existing users as approved (so current users don't get locked out)
        try:
            await conn.execute(text(
                "UPDATE users SET is_approved = TRUE WHERE is_approved IS NULL OR is_approved = FALSE"
            ))
            migrations.append("existing users marked as approved")
        except Exception as e:
            errors.append(f"update existing users: {str(e)}")

        # Set the first user (oldest) as admin
        try:
            await conn.execute(text(
                "UPDATE users SET is_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)"
            ))
            migrations.append("first user set as admin")
        except Exception as e:
            errors.append(f"set first user as admin: {str(e)}")

    return {
        "status": "success" if not errors else "partial",
        "migrations_applied": migrations,
        "errors": errors
    }
