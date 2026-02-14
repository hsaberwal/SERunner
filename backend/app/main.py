import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, locations, setups, gear, knowledge_library, billing, instruments, venue_types
from app.database import engine, Base, AsyncSessionLocal
from app.models import User, Location, Setup, Gear, GearLoan, KnowledgeBase, LearnedHardware, Subscription, InstrumentProfile, VenueTypeProfile

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
        for col_name, col_type in [("lr_geq_cuts", "JSONB"), ("monitor_geq_cuts", "JSONB"), ("room_notes", "TEXT"), ("lr_peq", "JSONB"), ("monitor_peq", "JSONB")]:
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

        # Add sharing columns to setups table
        for col_name, col_type in [("is_shared", "BOOLEAN DEFAULT FALSE"), ("shared_full_access", "BOOLEAN DEFAULT FALSE"), ("corrections", "JSONB")]:
            try:
                await conn.execute(text(f"ALTER TABLE setups ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
            except Exception:
                pass

        # Create index for shared setups
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_setups_is_shared ON setups(is_shared)"))
        except Exception:
            pass

        # Create learned_hardware table for knowledge library
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS learned_hardware (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    hardware_type VARCHAR(50) NOT NULL,
                    brand VARCHAR(100) NOT NULL,
                    model VARCHAR(100) NOT NULL,
                    characteristics TEXT,
                    best_for TEXT,
                    settings_by_source JSONB,
                    knowledge_base_entry TEXT,
                    amp_specs JSONB,
                    user_notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
        except Exception:
            pass

        # Create indexes for learned_hardware
        for idx_name, column in [
            ("ix_learned_hardware_user_id", "user_id"),
            ("ix_learned_hardware_type", "hardware_type"),
            ("ix_learned_hardware_brand_model", "brand, model")
        ]:
            try:
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON learned_hardware({column})"))
            except Exception:
                pass

        # Create claude_response_times table for tracking API timing
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS claude_response_times (
                    id SERIAL PRIMARY KEY,
                    operation_type VARCHAR(50) NOT NULL,
                    duration_seconds FLOAT NOT NULL,
                    prompt_length INTEGER,
                    response_length INTEGER,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
        except Exception:
            pass

        # Create subscriptions table for Stripe billing
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    stripe_customer_id VARCHAR,
                    stripe_subscription_id VARCHAR,
                    plan VARCHAR(20) DEFAULT 'free',
                    status VARCHAR(30) DEFAULT 'active',
                    generations_used INTEGER DEFAULT 0,
                    learning_used INTEGER DEFAULT 0,
                    period_start TIMESTAMP,
                    period_end TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    canceled_at TIMESTAMP,
                    UNIQUE(user_id)
                )
            """))
        except Exception:
            pass

        # Create indexes for subscriptions
        for idx_name, column in [
            ("ix_subscriptions_user_id", "user_id"),
            ("ix_subscriptions_stripe_customer_id", "stripe_customer_id"),
            ("ix_subscriptions_stripe_subscription_id", "stripe_subscription_id"),
        ]:
            try:
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON subscriptions({column})"))
            except Exception:
                pass

        # Auto-create admin subscription for existing admins
        try:
            await conn.execute(text("""
                INSERT INTO subscriptions (id, user_id, plan, status)
                SELECT gen_random_uuid(), id, 'admin', 'active'
                FROM users
                WHERE is_admin = TRUE
                AND id NOT IN (SELECT user_id FROM subscriptions)
            """))
        except Exception:
            pass

        # Create instrument_profiles table for custom performer/instrument types
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS instrument_profiles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    display_name VARCHAR(150),
                    category VARCHAR(50) NOT NULL,
                    value_key VARCHAR(100) NOT NULL,
                    description TEXT,
                    mic_recommendations JSONB,
                    eq_settings JSONB,
                    compression_settings JSONB,
                    fx_recommendations JSONB,
                    mixing_notes TEXT,
                    knowledge_base_entry TEXT,
                    user_notes TEXT,
                    is_active VARCHAR(5) DEFAULT 'true',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
        except Exception:
            pass

        # Create indexes for instrument_profiles
        for idx_name, column in [
            ("ix_instrument_profiles_user_id", "user_id"),
            ("ix_instrument_profiles_category", "category"),
            ("ix_instrument_profiles_value_key", "value_key"),
        ]:
            try:
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON instrument_profiles({column})"))
            except Exception:
                pass

        # Create venue_type_profiles table for learned venue acoustic profiles
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS venue_type_profiles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    display_name VARCHAR(150),
                    category VARCHAR(50) NOT NULL,
                    value_key VARCHAR(100) NOT NULL,
                    description TEXT,
                    acoustic_characteristics JSONB,
                    sound_goals JSONB,
                    acoustic_challenges JSONB,
                    eq_strategy JSONB,
                    fx_approach JSONB,
                    compression_philosophy JSONB,
                    monitoring_notes TEXT,
                    special_considerations TEXT,
                    knowledge_base_entry TEXT,
                    user_notes TEXT,
                    is_active VARCHAR(5) DEFAULT 'true',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
        except Exception:
            pass

        # Create indexes for venue_type_profiles
        for idx_name, column in [
            ("ix_venue_type_profiles_user_id", "user_id"),
            ("ix_venue_type_profiles_category", "category"),
            ("ix_venue_type_profiles_value_key", "value_key"),
        ]:
            try:
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON venue_type_profiles({column})"))
            except Exception:
                pass

    logger.info("Startup migrations completed")


async def seed_venue_types():
    """Auto-learn the standard venue types if they don't exist yet."""
    import json
    from sqlalchemy import text

    SEED_VENUE_TYPES = [
        ("Gurdwara", "worship"),
        ("Church", "worship"),
        ("Temple", "worship"),
        ("Hall", "performance"),
        ("Cafe", "commercial"),
        ("Outdoor", "outdoor"),
        ("School", "education"),
        ("Studio", "commercial"),
    ]

    try:
        async with AsyncSessionLocal() as db:
            # Check if any venue types exist already
            result = await db.execute(text("SELECT COUNT(*) FROM venue_type_profiles"))
            count = result.scalar()

            if count > 0:
                logger.info(f"Venue types already seeded ({count} exist), skipping")
                return

            # Get the first admin user for the user_id audit field
            result = await db.execute(text(
                "SELECT id FROM users WHERE is_admin = TRUE ORDER BY created_at ASC LIMIT 1"
            ))
            admin_row = result.first()

            if not admin_row:
                logger.warning("No admin user found, skipping venue type seeding")
                return

            admin_id = admin_row[0]

            from app.services.venue_type_learner import VenueTypeLearner
            learner = VenueTypeLearner()

            for name, category in SEED_VENUE_TYPES:
                try:
                    value_key = learner._make_value_key(name)

                    # Check if this specific one exists (in case of partial seed)
                    existing = await db.execute(text(
                        "SELECT id FROM venue_type_profiles WHERE value_key = :vk"
                    ), {"vk": value_key})
                    if existing.first():
                        continue

                    logger.info(f"Seeding venue type: {name} ({category})")
                    learned_data = await learner.learn_venue_type(name, category)

                    if learned_data.get("error"):
                        logger.error(f"Failed to learn venue type {name}: {learned_data['error']}")
                        continue

                    from app.models.venue_type import VenueTypeProfile
                    new_vt = VenueTypeProfile(
                        user_id=admin_id,
                        name=name,
                        display_name=learned_data.get("display_name", name),
                        category=category,
                        value_key=value_key,
                        description=learned_data.get("description"),
                        acoustic_characteristics=learned_data.get("acoustic_characteristics"),
                        sound_goals=learned_data.get("sound_goals"),
                        acoustic_challenges=learned_data.get("acoustic_challenges"),
                        eq_strategy=learned_data.get("eq_strategy"),
                        fx_approach=learned_data.get("fx_approach"),
                        compression_philosophy=learned_data.get("compression_philosophy"),
                        monitoring_notes=learned_data.get("monitoring_notes"),
                        special_considerations=learned_data.get("special_considerations"),
                        knowledge_base_entry=learned_data.get("knowledge_base_entry"),
                    )
                    db.add(new_vt)
                    await db.commit()
                    logger.info(f"Seeded venue type: {name}")

                except Exception as e:
                    logger.error(f"Error seeding venue type {name}: {e}")
                    await db.rollback()
                    continue

            logger.info("Venue type seeding complete")
    except Exception as e:
        logger.error(f"Venue type seeding failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup if they don't exist."""
    import asyncio
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Run migrations after tables exist
    await run_startup_migrations()
    # Seed venue types in background (non-blocking - app serves requests immediately)
    asyncio.create_task(seed_venue_types())
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
app.include_router(knowledge_library.router, tags=["Knowledge Library"])
app.include_router(billing.router, prefix="/billing", tags=["Billing"])
app.include_router(instruments.router, prefix="/instruments", tags=["Instruments"])
app.include_router(venue_types.router, prefix="/venue-types", tags=["Venue Types"])


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


@app.get("/api/response-times")
async def get_response_times():
    """Get average Claude API response times for UI estimation."""
    from sqlalchemy import text
    
    try:
        async with engine.begin() as conn:
            # Get stats for setup generation (last 20 calls)
            result = await conn.execute(text("""
                SELECT 
                    operation_type,
                    AVG(duration_seconds) as avg_duration,
                    MIN(duration_seconds) as min_duration,
                    MAX(duration_seconds) as max_duration,
                    COUNT(*) as sample_count
                FROM claude_response_times
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY operation_type
            """))
            rows = result.fetchall()
            
            stats = {}
            for row in rows:
                stats[row[0]] = {
                    "avg_seconds": round(row[1], 1) if row[1] else 60,
                    "min_seconds": round(row[2], 1) if row[2] else 30,
                    "max_seconds": round(row[3], 1) if row[3] else 120,
                    "sample_count": row[4]
                }
            
            # Default values if no data
            if "setup_generation" not in stats:
                stats["setup_generation"] = {
                    "avg_seconds": 60,
                    "min_seconds": 30,
                    "max_seconds": 120,
                    "sample_count": 0
                }
            if "hardware_learning" not in stats:
                stats["hardware_learning"] = {
                    "avg_seconds": 20,
                    "min_seconds": 10,
                    "max_seconds": 45,
                    "sample_count": 0
                }
            
            return stats
    except Exception as e:
        logger.error(f"Error getting response times: {e}")
        # Return defaults on error
        return {
            "setup_generation": {"avg_seconds": 60, "min_seconds": 30, "max_seconds": 120, "sample_count": 0},
            "hardware_learning": {"avg_seconds": 20, "min_seconds": 10, "max_seconds": 45, "sample_count": 0}
        }


async def record_response_time(operation_type: str, duration_seconds: float, prompt_length: int = None, response_length: int = None):
    """Record a Claude API response time for analytics."""
    from sqlalchemy import text
    
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                INSERT INTO claude_response_times (operation_type, duration_seconds, prompt_length, response_length)
                VALUES (:op_type, :duration, :prompt_len, :response_len)
            """), {
                "op_type": operation_type,
                "duration": duration_seconds,
                "prompt_len": prompt_length,
                "response_len": response_length
            })
    except Exception as e:
        logger.error(f"Error recording response time: {e}")


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
            ("lr_peq", "JSONB"),
            ("monitor_peq", "JSONB"),
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

        # Add sharing columns to setups table
        setup_columns = [
            ("is_shared", "BOOLEAN DEFAULT FALSE"),
            ("shared_full_access", "BOOLEAN DEFAULT FALSE"),
            ("corrections", "JSONB"),
        ]
        for col_name, col_type in setup_columns:
            try:
                await conn.execute(text(
                    f"ALTER TABLE setups ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                migrations.append(f"setups.{col_name}")
            except Exception as e:
                errors.append(f"setups.{col_name}: {str(e)}")

        # Create index for shared setups
        try:
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_setups_is_shared ON setups(is_shared)"
            ))
            migrations.append("index ix_setups_is_shared")
        except Exception as e:
            errors.append(f"index ix_setups_is_shared: {str(e)}")

    return {
        "status": "success" if not errors else "partial",
        "migrations_applied": migrations,
        "errors": errors
    }
