import os
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.services.bigquery_service import fetch_overview, fetch_employees, fetch_filter_options

app = FastAPI(title="KAPIROLL Dashboard API", version="1.0.0")

DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxgrmepTnAYHCNwp6slXLlPbBsz7VltZ8Hy2V2PL116HjFpLBdrbYOyEZBB9BL00Nzr/exec"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    ok: bool
    answer: Optional[str] = None
    error: Optional[str] = None


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


@app.post("/api/chat", response_model=ChatResponse)
def chat_with_kapibot(payload: ChatRequest):
    question = (payload.question or "").strip()
    if not question:
        return {"ok": False, "error": "La pregunta está vacía."}

    script_url = os.getenv("APPS_SCRIPT_CHAT_URL", DEFAULT_APPS_SCRIPT_URL)
    body = json.dumps({"action": "CHAT", "question": question}).encode("utf-8")
    request = Request(
        script_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        if exc.code in (401, 403):
            return {
                "ok": False,
                "error": "Apps Script requiere acceso público. En Deploy > Manage deployments > Web app configura 'Execute as: Me' y 'Who has access: Anyone'.",
            }
        return {"ok": False, "error": f"Apps Script HTTP {exc.code}"}
    except URLError:
        return {"ok": False, "error": "No se pudo conectar con Apps Script."}
    except TimeoutError:
        return {"ok": False, "error": "Tiempo de espera agotado con Apps Script."}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"ok": False, "error": "Respuesta inválida de Apps Script."}

    if not data.get("ok"):
        return {"ok": False, "error": data.get("error", "Error desde Apps Script")}

    return {"ok": True, "answer": data.get("answer", "")}
