from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import DashboardOverview
from app.services.bigquery_service import fetch_overview

app = FastAPI(title="PayrollOS Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/api/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.get("/api/overview", response_model=DashboardOverview)
def get_overview() -> DashboardOverview:
    data = fetch_overview()
    return DashboardOverview(**data)
