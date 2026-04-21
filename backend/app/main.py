import os
import json
import math
import statistics
import smtplib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.services import excel_service

app = FastAPI(title="KAPIROLL Dashboard API", version="1.0.0")

DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzOoZm5eWkQtxg6waM0zDDT5H9DZCT1ykfgBlGWnmSi37pwmnPHLWbxd1r7T2aGgV_7/exec"


def _get_data_service():
    source = os.getenv("DATA_SOURCE", "excel").strip().lower()
    if source == "bigquery":
        from app.services import bigquery_service
        return bigquery_service
    if source == "supabase":
        from app.services import supabase_service
        return supabase_service
    if source == "sheets":
        from app.services import google_sheets_service
        return google_sheets_service
    return excel_service

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


class EmailAlertRequest(BaseModel):
    to: str
    subject: Optional[str] = None
    message: str


class BusinessCopilotRequest(BaseModel):
    question: str
    year: Optional[int] = None
    periodo: Optional[str] = None


class TelemetryEventRequest(BaseModel):
    event: str
    payload: Optional[Dict[str, Any]] = None


_telemetry_events: List[Dict[str, Any]] = []


def _compute_seasonal_forecast(monthly_costs: List[Dict[str, Any]], horizon: int = 6) -> Dict[str, Any]:
    series = []
    for item in monthly_costs:
        value = item.get("costo_total")
        if value is None:
            value = (item.get("total_ingresos", 0) or 0) + (item.get("total_provisiones", 0) or 0)
        try:
            value = float(value)
        except (TypeError, ValueError):
            continue

        period = str(item.get("periodo") or item.get("month") or "")
        month_idx = 1
        if "-" in period:
            parts = period.split("-")
            if len(parts) > 1 and parts[1].isdigit():
                month_idx = max(1, min(12, int(parts[1])))
        series.append({"period": period, "value": value, "month": month_idx})

    if len(series) < 6:
        return {
            "ok": False,
            "method": "seasonal-trend-v1",
            "error": "Datos insuficientes para forecast robusto (minimo 6 periodos).",
            "forecast": []
        }

    values = [x["value"] for x in series]
    n = len(values)

    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    numerator = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n)) or 1
    trend = numerator / denominator
    intercept = y_mean - trend * x_mean

    monthly_residuals: Dict[int, List[float]] = {m: [] for m in range(1, 13)}
    for i, row in enumerate(series):
        baseline = intercept + trend * i
        monthly_residuals[row["month"]].append(row["value"] - baseline)

    seasonal_index: Dict[int, float] = {}
    for m in range(1, 13):
        vals = monthly_residuals[m]
        seasonal_index[m] = sum(vals) / len(vals) if vals else 0.0

    residuals = []
    for i, row in enumerate(series):
        fitted = intercept + trend * i + seasonal_index[row["month"]]
        residuals.append(row["value"] - fitted)
    sigma = statistics.pstdev(residuals) if len(residuals) > 1 else 0.0

    forecasts = []
    last_month = series[-1]["month"]
    for step in range(1, horizon + 1):
        idx = n + step - 1
        month = ((last_month - 1 + step) % 12) + 1
        mean_forecast = intercept + trend * idx + seasonal_index[month]
        lower = max(0.0, mean_forecast - 1.96 * sigma)
        upper = max(lower, mean_forecast + 1.96 * sigma)
        forecasts.append({
            "step": step,
            "month": month,
            "forecast": round(mean_forecast, 2),
            "lower_95": round(lower, 2),
            "upper_95": round(upper, 2),
        })

    return {
        "ok": True,
        "method": "seasonal-trend-v1",
        "trend_per_period": round(trend, 2),
        "history_points": n,
        "forecast": forecasts,
    }


def _generate_business_answer(question: str, overview: Dict[str, Any]) -> str:
    q = (question or "").strip().lower()
    employees = overview.get("employees", [])
    monthly = overview.get("monthly_costs", [])

    total_cost = 0.0
    by_area: Dict[str, float] = {}
    for emp in employees:
        value = float(emp.get("total_ingresos", 0) or 0) + float(emp.get("total_provisiones", 0) or 0)
        total_cost += value
        area = str(emp.get("area") or "Sin area")
        by_area[area] = by_area.get(area, 0.0) + value

    top_area = sorted(by_area.items(), key=lambda x: x[1], reverse=True)[0] if by_area else ("Sin area", 0.0)
    top_area_pct = (top_area[1] / total_cost * 100) if total_cost > 0 else 0.0

    monthly_values = []
    for item in monthly:
        val = item.get("costo_total")
        if val is None:
            val = (item.get("total_ingresos", 0) or 0) + (item.get("total_provisiones", 0) or 0)
        monthly_values.append(float(val or 0))

    variation_text = "Sin comparativa mensual"
    if len(monthly_values) >= 2 and monthly_values[-2] > 0:
        variation = ((monthly_values[-1] - monthly_values[-2]) / monthly_values[-2]) * 100
        variation_text = f"Variacion mensual: {variation:+.1f}%"

    if "riesgo" in q or "alerta" in q:
        return (
            f"Riesgo principal: concentracion de costo en {top_area[0]} ({top_area_pct:.1f}% del total). "
            f"{variation_text}. Recomendacion: revisar horas extra y mezcla contractual del area lider."
        )

    if "por que" in q or "subio" in q or "sube" in q:
        return (
            f"El driver mas probable del incremento es la concentracion en {top_area[0]} y el cambio reciente en tendencia mensual. "
            f"{variation_text}. Analiza detalle por empleado para aislar casos atipicos."
        )

    if "que area" in q or "area" in q:
        return f"El area con mayor impacto en costo es {top_area[0]} con {top_area_pct:.1f}% del costo total visible."

    return (
        f"Resumen ejecutivo: costo total {total_cost:,.2f} USD, area lider {top_area[0]} ({top_area_pct:.1f}%). "
        f"{variation_text}. Siguiente paso sugerido: validar presupuesto vs real y revisar outliers."
    )


@app.get("/api/health")
def health_check() -> dict:
    data_source = os.getenv("DATA_SOURCE", "excel").strip().lower()
    return {
        "status": "ok",
        "data_source": data_source,
        "excel_path": os.getenv("EXCEL_FILE_PATH", "NOMINA_EJEMPLO.xlsx"),
        "google_sheet_id": os.getenv("GOOGLE_SHEET_ID", "1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk"),
        "project": os.getenv("BQ_PROJECT_ID", "not-set"),
        "dataset": os.getenv("BQ_DATASET", "not-set"),
        "table": os.getenv("BQ_TABLE", "not-set")
    }


@app.get("/api/filters")
def get_filters():
    """Endpoint para obtener opciones de filtros disponibles."""
    return _get_data_service().fetch_filter_options()


@app.get("/api/overview")
def get_overview(
    periodo: Optional[str] = Query(default=None, description="Período en formato YYYY-MM"),
    year: Optional[int] = Query(default=None, description="Año para filtrar")
):
    """Endpoint principal del dashboard con soporte para filtro de período y año."""
    return _get_data_service().fetch_overview(periodo=periodo, year=year)


@app.get("/api/employees")
def get_employees(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """Endpoint para paginación de empleados."""
    employees, total = _get_data_service().fetch_employees(limit=limit, offset=offset)
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


@app.get("/api/forecast")
def get_forecast(
    year: Optional[int] = Query(default=None, description="Año base de forecast"),
    horizon: int = Query(default=6, ge=1, le=12, description="Número de periodos a proyectar")
):
    overview = _get_data_service().fetch_overview(year=year)
    monthly = overview.get("monthly_costs", [])
    result = _compute_seasonal_forecast(monthly, horizon=horizon)
    return result


def _send_via_gmail_oauth2(to: str, subject: str, body: str) -> dict:
    """Send email using Gmail API with OAuth2 refresh token."""
    import base64
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    client_id = os.getenv("GMAIL_CLIENT_ID", "").strip()
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN", "").strip()
    from_email = os.getenv("GMAIL_FROM", "").strip()

    if not all([client_id, client_secret, refresh_token, from_email]):
        return {"ok": False, "error": "Gmail OAuth2 no configurado. Define GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN y GMAIL_FROM."}

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://mail.google.com/"],
    )

    service = build("gmail", "v1", credentials=creds)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to
    msg.set_content(body)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {"ok": True, "message": "Alerta enviada por correo (Gmail OAuth2)."}


def _send_via_smtp(to: str, subject: str, body: str) -> dict:
    """Send email using basic SMTP with App Password."""
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM", smtp_user).strip()

    if not all([smtp_host, smtp_user, smtp_password, from_email]):
        return {"ok": False, "error": "SMTP no configurado. Define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM."}

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
    return {"ok": True, "message": "Alerta enviada por correo (SMTP)."}


@app.post("/api/alerts/email")
def send_email_alert(payload: EmailAlertRequest):
    subject = payload.subject or "KAPIROLL - Alerta Operativa"

    try:
        # Try Gmail OAuth2 first, fallback to SMTP
        if os.getenv("GMAIL_REFRESH_TOKEN", "").strip():
            return _send_via_gmail_oauth2(payload.to, subject, payload.message)
        else:
            return _send_via_smtp(payload.to, subject, payload.message)
    except Exception as exc:
        return {"ok": False, "error": f"No se pudo enviar correo: {exc}"}


@app.post("/api/copilot/business-chat")
def business_chat(payload: BusinessCopilotRequest):
    question = (payload.question or "").strip()
    if not question:
        return {"ok": False, "error": "La pregunta esta vacia."}

    overview = _get_data_service().fetch_overview(periodo=payload.periodo, year=payload.year)
    answer = _generate_business_answer(question, overview)
    return {"ok": True, "answer": answer}


@app.post("/api/telemetry/events")
def ingest_telemetry(payload: TelemetryEventRequest):
    event = {
        "event": payload.event,
        "payload": payload.payload or {},
    }
    _telemetry_events.append(event)
    if len(_telemetry_events) > 300:
        del _telemetry_events[:120]
    return {"ok": True}
