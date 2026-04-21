import os
import smtplib
import statistics
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.services import excel_service

app = FastAPI(title="KAPIROLL Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmailAlertRequest(BaseModel):
    to: str
    subject: Optional[str] = None
    message: str


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
            "forecast": [],
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


@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "data_source": "excel",
        "excel_path": os.getenv("EXCEL_FILE_PATH", "NOMINA_EJEMPLO.xlsx"),
    }


@app.get("/api/filters")
def get_filters():
    return excel_service.fetch_filter_options()


@app.get("/api/overview")
def get_overview(
    periodo: Optional[str] = Query(default=None, description="Periodo en formato YYYY-MM"),
    year: Optional[int] = Query(default=None, description="Ano para filtrar"),
):
    return excel_service.fetch_overview(periodo=periodo, year=year)


@app.get("/api/employees")
def get_employees(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    employees, total = excel_service.fetch_employees(limit=limit, offset=offset)
    return {"employees": employees, "total": total, "limit": limit, "offset": offset}


@app.get("/api/forecast")
def get_forecast(
    year: Optional[int] = Query(default=None, description="Ano base de forecast"),
    horizon: int = Query(default=6, ge=1, le=12, description="Numero de periodos a proyectar"),
):
    overview = excel_service.fetch_overview(year=year)
    return _compute_seasonal_forecast(overview.get("monthly_costs", []), horizon=horizon)


def _send_via_smtp(to: str, subject: str, body: str) -> dict:
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
        return _send_via_smtp(payload.to, subject, payload.message)
    except Exception as exc:
        return {"ok": False, "error": f"No se pudo enviar correo: {exc}"}


@app.post("/api/telemetry/events")
def ingest_telemetry(payload: TelemetryEventRequest):
    _telemetry_events.append({"event": payload.event, "payload": payload.payload or {}})
    if len(_telemetry_events) > 300:
        del _telemetry_events[:120]
    return {"ok": True}
