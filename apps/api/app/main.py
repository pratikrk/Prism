from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.sentry import init_sentry
from app.routes import health, jobs, plans, webhooks, workspaces

init_sentry()

app = FastAPI(title="Prism API", version="0.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(health.router)
app.include_router(workspaces.router)
app.include_router(jobs.router)
app.include_router(plans.router)
app.include_router(webhooks.router)
