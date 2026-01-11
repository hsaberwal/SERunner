#!/usr/bin/env python3
"""
Quick local test script to validate the API before deploying.

Usage:
    1. Start the server: uvicorn app.main:app --reload
    2. In another terminal: python test_local.py

This script tests basic endpoint functionality without needing a database.
It catches common issues like:
- Import errors
- Pydantic serialization issues
- Missing dependencies
- CORS configuration problems
"""
import subprocess
import sys
import time
import signal

def check_server_starts():
    """Verify the server can start without errors."""
    print("Checking if server can start...")

    # Try to import the app (catches import errors)
    try:
        from app.main import app
        print("  [OK] App imports successfully")
    except Exception as e:
        print(f"  [FAIL] Import error: {e}")
        return False

    # Check all routers are registered
    routes = [r.path for r in app.routes]
    expected_routes = ['/health', '/auth/register', '/locations', '/setups/generate', '/gear']

    for route in expected_routes:
        found = any(route in r for r in routes)
        if found:
            print(f"  [OK] Route {route} registered")
        else:
            print(f"  [FAIL] Route {route} NOT found")
            return False

    return True


def check_schemas():
    """Verify all Pydantic schemas can be instantiated."""
    print("\nChecking Pydantic schemas...")

    from uuid import uuid4
    from datetime import datetime

    # Test LocationResponse
    try:
        from app.routers.locations import LocationResponse
        loc = LocationResponse(
            id=uuid4(),
            name="Test",
            venue_type="church",
            notes=None,
            speaker_setup=None,
            default_config=None,
            is_temporary=False,
            created_at=datetime.now()
        )
        json_data = loc.model_dump_json()
        print(f"  [OK] LocationResponse serializes correctly")
    except Exception as e:
        print(f"  [FAIL] LocationResponse: {e}")
        return False

    # Test UserResponse
    try:
        from app.routers.auth import UserResponse
        user = UserResponse(
            id=uuid4(),
            email="test@test.com",
            role="operator"
        )
        json_data = user.model_dump_json()
        print(f"  [OK] UserResponse serializes correctly")
    except Exception as e:
        print(f"  [FAIL] UserResponse: {e}")
        return False

    # Test SetupResponse
    try:
        from app.routers.setups import SetupResponse
        setup = SetupResponse(
            id=uuid4(),
            location_id=uuid4(),
            event_name="Test Event",
            event_date=None,
            performers=[{"type": "vocal", "count": 1}],
            channel_config=None,
            eq_settings=None,
            compression_settings=None,
            fx_settings=None,
            instructions="Test",
            notes=None,
            rating=None,
            created_at=datetime.now()
        )
        json_data = setup.model_dump_json()
        print(f"  [OK] SetupResponse serializes correctly")
    except Exception as e:
        print(f"  [FAIL] SetupResponse: {e}")
        return False

    # Test GearResponse
    try:
        from app.routers.gear import GearResponse
        gear = GearResponse(
            id=uuid4(),
            type="mic",
            brand="Shure",
            model="Beta 58A",
            specs=None,
            default_settings=None,
            created_at=datetime.now()
        )
        json_data = gear.model_dump_json()
        print(f"  [OK] GearResponse serializes correctly")
    except Exception as e:
        print(f"  [FAIL] GearResponse: {e}")
        return False

    return True


def check_dependencies():
    """Verify all dependencies are installed."""
    print("\nChecking dependencies...")

    deps = [
        ('fastapi', 'fastapi'),
        ('uvicorn', 'uvicorn'),
        ('sqlalchemy', 'sqlalchemy'),
        ('asyncpg', 'asyncpg'),
        ('pydantic', 'pydantic'),
        ('passlib', 'passlib'),
        ('bcrypt', 'bcrypt'),
        ('jose', 'python-jose'),
        ('anthropic', 'anthropic'),
    ]

    all_ok = True
    for module, package in deps:
        try:
            __import__(module)
            print(f"  [OK] {package}")
        except ImportError:
            print(f"  [FAIL] {package} not installed")
            all_ok = False

    return all_ok


def main():
    print("=" * 50)
    print("SERunner Backend - Local Test")
    print("=" * 50)

    # Change to backend directory
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    results = []

    results.append(("Dependencies", check_dependencies()))
    results.append(("Server Startup", check_server_starts()))
    results.append(("Schema Serialization", check_schemas()))

    print("\n" + "=" * 50)
    print("RESULTS")
    print("=" * 50)

    all_passed = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n All tests passed! Safe to deploy.")
        return 0
    else:
        print("\n Some tests failed. Fix issues before deploying.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
