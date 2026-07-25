from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.clock import now
from app.config import get_settings
from app.routes import day_plans, learners, sessions

settings = get_settings()

app = FastAPI(title="AI Communication Coach API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.client_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(learners.router)
app.include_router(day_plans.router)
app.include_router(sessions.router)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "coach-server",
        "demo_mode": settings.demo_mode,
        # The clock the scheduler reads, offset included, so the demo's Day Three
        # injection is visible rather than hidden.
        "engine_time": now().isoformat(),
        "clock_offset_hours": settings.demo_clock_offset_hours,
    }
