from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, locations, setups, gear

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI-guided sound engineering setup for QuPac mixers",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
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
