import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from app.services.bigquery_service import fetch_overview, fetch_employees, fetch_filter_options

app = FastAPI(title="KAPIROLL Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "project": os.getenv("BQ_PROJECT_ID", "not-set"),
        "dataset": os.getenv("BQ_DATASET", "not-set"),
        "table": os.getenv("BQ_TABLE", "not-set")
    }


@app.get("/api/filters")
def get_filters():
    """Endpoint para obtener opciones de filtros disponibles."""
    return fetch_filter_options()


@app.get("/api/overview")
def get_overview(
    periodo: Optional[str] = Query(default=None, description="Período en formato YYYY-MM"),
    year: Optional[int] = Query(default=None, description="Año para filtrar")
):
    """Endpoint principal del dashboard con soporte para filtro de período y año."""
    return fetch_overview(periodo=periodo, year=year)


@app.get("/api/employees")
def get_employees(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """Endpoint para paginación de empleados."""
    employees, total = fetch_employees(limit=limit, offset=offset)
    return {
        "employees": employees,
        "total": total,
        "limit": limit,
        "offset": offset
    }
