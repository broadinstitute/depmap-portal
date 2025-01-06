from fastapi import APIRouter

# This temp prefix is intended to convey to API users that these contracts may change.
# Most of these endpoints are intended to support feature-specific functionality
router = APIRouter(prefix="/temp", tags=["temp"])
