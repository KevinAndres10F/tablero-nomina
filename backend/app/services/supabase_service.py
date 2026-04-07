"""
Servicio de datos para KAPIROLL usando Supabase como fuente.

Expone la misma interfaz que google_sheets_service y bigquery_service:
  - fetch_filter_options()
  - fetch_employees(limit, offset, periodo, year)
  - fetch_overview(periodo, year)
"""

import os
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
TABLE_NAME = os.getenv("SUPABASE_TABLE", "nomina")

FILTER_OPTIONS_TTL_SECONDS = int(os.getenv("FILTER_OPTIONS_TTL_SECONDS", "300"))
OVERVIEW_CACHE_TTL_SECONDS = int(os.getenv("OVERVIEW_CACHE_TTL_SECONDS", "45"))
ROWS_CACHE_TTL_SECONDS = int(os.getenv("ROWS_CACHE_TTL_SECONDS", "60"))

# ---------------------------------------------------------------------------
# Cache thread-safe
# ---------------------------------------------------------------------------
_filter_options_cache: Optional[Dict[str, List[Any]]] = None
_filter_options_cached_at: float = 0.0
_filter_options_lock = threading.Lock()

_overview_cache: Dict[Tuple[Optional[str], Optional[int]], Tuple[float, Dict[str, Any]]] = {}
_overview_cache_lock = threading.Lock()

_rows_cache: Optional[List[Dict[str, Any]]] = None
_rows_cached_at: float = 0.0
_rows_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Cliente Supabase
# ---------------------------------------------------------------------------
_client: Optional[Client] = None
_client_lock = threading.Lock()


def _get_client() -> Client:
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        url = SUPABASE_URL or os.getenv("SUPABASE_URL", "")
        key = SUPABASE_KEY or os.getenv("SUPABASE_KEY", "")
        if not url or not key:
            raise ValueError("SUPABASE_URL y SUPABASE_KEY deben estar configurados")
        _client = create_client(url, key)
        return _client


# ---------------------------------------------------------------------------
# Campos numéricos
# ---------------------------------------------------------------------------
NUMERIC_FIELDS = [
    "total_ingresos", "total_descuentos", "total_provisiones", "a_recibir",
    "h_ext_100", "h_ext_50", "recnocturno",
    "decimo_13", "decimo_14", "vacaciones_prov", "fondos_reserva",
    "iess_patronal", "iess_personal", "pr_h_iess", "pr_q_iess",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _month_name(month: int) -> str:
    months = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
    }
    return months.get(month, "")


def _extract_year(periodo: str) -> Optional[int]:
    match = re.match(r"^(\d{4})", str(periodo or ""))
    return int(match.group(1)) if match else None


def _normalize_period(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = re.match(r"^(\d{4})[-/](\d{1,2})$", raw)
    if match:
        return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}"
    return raw


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


# ---------------------------------------------------------------------------
# Fetch rows de Supabase (con cache)
# ---------------------------------------------------------------------------
def _fetch_all_rows_raw() -> List[Dict[str, Any]]:
    """Descarga todas las filas de la tabla nomina."""
    client = _get_client()
    response = client.table(TABLE_NAME).select("*").execute()
    rows = response.data or []

    # Asegurar tipos numéricos y campo derivado
    for row in rows:
        for field in NUMERIC_FIELDS:
            row[field] = _to_float(row.get(field))
        row["horas_extras"] = row["h_ext_100"] + row["h_ext_50"]

    return rows


def _get_all_rows() -> List[Dict[str, Any]]:
    global _rows_cache, _rows_cached_at

    with _rows_lock:
        now = time.time()
        if _rows_cache is not None and (now - _rows_cached_at) < ROWS_CACHE_TTL_SECONDS:
            return _rows_cache

    rows = _fetch_all_rows_raw()

    with _rows_lock:
        _rows_cache = rows
        _rows_cached_at = time.time()

    return rows


# ---------------------------------------------------------------------------
# Filtrado
# ---------------------------------------------------------------------------
def _filter_rows(
    rows: List[Dict[str, Any]],
    periodo: Optional[str] = None,
    year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if periodo:
        normalized = _normalize_period(periodo)
        return [r for r in rows if r.get("periodo") == normalized]
    if year:
        return [r for r in rows if _extract_year(r.get("periodo", "")) == int(year)]
    return rows


def _latest_row_by_employee(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    latest: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        key = row.get("cedula") or row.get("nombre")
        if not key:
            continue
        current = latest.get(key)
        if not current or row.get("periodo", "") > current.get("periodo", ""):
            latest[key] = row
    return list(latest.values())


# ---------------------------------------------------------------------------
# Agregaciones
# ---------------------------------------------------------------------------
def _fetch_kpis(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    costo_total = sum(r.get("total_ingresos", 0.0) + r.get("total_provisiones", 0.0) for r in rows)
    total_provisiones = sum(r.get("total_provisiones", 0.0) for r in rows)
    total_horas_extras = sum(r.get("h_ext_100", 0.0) + r.get("h_ext_50", 0.0) for r in rows)
    total_neto = sum(r.get("a_recibir", 0.0) for r in rows)

    unique_ids = {r.get("cedula") for r in rows if r.get("cedula")}
    total_empleados = max(len(unique_ids) if unique_ids else len(rows), 1)

    return [
        {
            "label": "Costo Total Nomina",
            "value": costo_total,
            "subtitle": f"{total_empleados} empleados",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "payments",
        },
        {
            "label": "Costo por Empleado",
            "value": costo_total / total_empleados,
            "subtitle": "Ingresos + Provisiones",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "person",
        },
        {
            "label": "Total Provisiones",
            "value": total_provisiones,
            "subtitle": "D13 + D14 + Vac + F.Res",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "savings",
        },
        {
            "label": "Horas Extras",
            "value": total_horas_extras,
            "subtitle": "100% + 50%",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "schedule",
        },
        {
            "label": "Neto a Pagar",
            "value": total_neto,
            "subtitle": "Liquido empleados",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "account_balance_wallet",
        },
    ]


def _fetch_cost_breakdown(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    decimo_13 = sum(r.get("decimo_13", 0.0) for r in rows)
    decimo_14 = sum(r.get("decimo_14", 0.0) for r in rows)
    vacaciones = sum(r.get("vacaciones_prov", 0.0) for r in rows)
    fondos_reserva = sum(r.get("fondos_reserva", 0.0) for r in rows)
    iess_patronal = sum(r.get("iess_patronal", 0.0) for r in rows)
    total = sum(r.get("total_provisiones", 0.0) for r in rows)

    divisor = total if total > 0 else 1.0
    return [
        {"label": "Decimo Tercero", "percent": round((decimo_13 / divisor) * 100, 1), "value": decimo_13},
        {"label": "Decimo Cuarto", "percent": round((decimo_14 / divisor) * 100, 1), "value": decimo_14},
        {"label": "Vacaciones", "percent": round((vacaciones / divisor) * 100, 1), "value": vacaciones},
        {"label": "Fondos Reserva", "percent": round((fondos_reserva / divisor) * 100, 1), "value": fondos_reserva},
        {"label": "IESS Patronal", "percent": round((iess_patronal / divisor) * 100, 1), "value": iess_patronal},
    ]


def _fetch_monthly_costs(rows: List[Dict[str, Any]], year: Optional[int] = None) -> List[Dict[str, Any]]:
    filtered = _filter_rows(rows, year=year)
    grouped: Dict[str, Dict[str, Any]] = {}

    for row in filtered:
        periodo = row.get("periodo") or "Sin periodo"
        bucket = grouped.setdefault(
            periodo,
            {
                "periodo": periodo,
                "month": periodo,
                "costo_total": 0.0,
                "ingresos": 0.0,
                "provisiones": 0.0,
                "descuentos": 0.0,
                "empleados": set(),
            },
        )
        bucket["ingresos"] += row.get("total_ingresos", 0.0)
        bucket["provisiones"] += row.get("total_provisiones", 0.0)
        bucket["descuentos"] += row.get("total_descuentos", 0.0)
        bucket["costo_total"] += row.get("total_ingresos", 0.0) + row.get("total_provisiones", 0.0)

        cedula = row.get("cedula")
        if cedula:
            bucket["empleados"].add(cedula)

    items: List[Dict[str, Any]] = []
    for periodo in sorted(grouped.keys()):
        bucket = grouped[periodo]
        match = re.match(r"^(\d{4})-(\d{2})$", periodo)
        if match:
            bucket["month"] = _month_name(int(match.group(2)))[:3]
        bucket["empleados"] = len(bucket["empleados"])
        items.append(bucket)

    return items


def _fetch_distribution_by_contract(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    latest_rows = _latest_row_by_employee(rows)
    grouped: Dict[str, Dict[str, Any]] = {}

    for row in latest_rows:
        label = row.get("tipo_contrato") or "Sin definir"
        bucket = grouped.setdefault(label, {"label": label, "count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += row.get("total_ingresos", 0.0)

    return sorted(grouped.values(), key=lambda item: item["count"], reverse=True)


def _fetch_distribution_by_area(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    latest_rows = _latest_row_by_employee(rows)
    grouped: Dict[str, Dict[str, Any]] = {}

    for row in latest_rows:
        label = row.get("area") or "Sin definir"
        bucket = grouped.setdefault(label, {"label": label, "count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += row.get("total_ingresos", 0.0)

    return sorted(grouped.values(), key=lambda item: item["count"], reverse=True)


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------
def fetch_filter_options() -> Dict[str, List[Any]]:
    global _filter_options_cache, _filter_options_cached_at

    with _filter_options_lock:
        now = time.time()
        if _filter_options_cache and (now - _filter_options_cached_at) < FILTER_OPTIONS_TTL_SECONDS:
            return _filter_options_cache

    rows = _get_all_rows()
    areas = sorted({r.get("area", "") for r in rows if r.get("area")})
    contratos = sorted({r.get("tipo_contrato", "") for r in rows if r.get("tipo_contrato")})

    periodos_unicos = sorted({r.get("periodo", "") for r in rows if r.get("periodo")}, reverse=True)
    periodos: List[Dict[str, Any]] = []
    for periodo in periodos_unicos:
        year_val = _extract_year(periodo)
        month = "01"
        month_label = periodo

        match = re.match(r"^(\d{4})-(\d{2})$", periodo)
        if match:
            month = match.group(2)
            month_label = f"{_month_name(int(month))} {match.group(1)}"

        periodos.append({
            "value": periodo,
            "year": str(year_val) if year_val else "",
            "month": month,
            "label": month_label,
        })

    years = sorted(
        {y for y in (_extract_year(p) for p in periodos_unicos) if y is not None},
        reverse=True,
    )

    response = {
        "areas": areas,
        "contratos": contratos,
        "periodos": periodos,
        "years": years,
    }

    with _filter_options_lock:
        _filter_options_cache = response
        _filter_options_cached_at = time.time()

    return response


def fetch_employees(
    limit: int = 50,
    offset: int = 0,
    periodo: Optional[str] = None,
    year: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    rows = _filter_rows(_get_all_rows(), periodo=periodo, year=year)
    ordered = sorted(rows, key=lambda r: (r.get("periodo", ""), r.get("total_ingresos", 0.0)), reverse=True)

    total = len(ordered)
    sliced = ordered[offset: offset + limit]

    employees: List[Dict[str, Any]] = []
    for row in sliced:
        employee = dict(row)
        employee["horas_extras"] = employee.get("h_ext_100", 0.0) + employee.get("h_ext_50", 0.0)
        employees.append(employee)

    return employees, total


def fetch_overview(periodo: Optional[str] = None, year: Optional[int] = None) -> Dict[str, Any]:
    cache_key = (periodo, year)
    with _overview_cache_lock:
        cached_item = _overview_cache.get(cache_key)
        if cached_item and (time.time() - cached_item[0]) < OVERVIEW_CACHE_TTL_SECONDS:
            return cached_item[1]

    try:
        rows = _get_all_rows()
        filter_options = fetch_filter_options()

        effective_year = year
        if not effective_year and not periodo:
            years = filter_options.get("years", [])
            if years:
                effective_year = years[0]

        active_rows = _filter_rows(rows, periodo=periodo, year=effective_year)
        kpis = _fetch_kpis(active_rows)
        breakdown = _fetch_cost_breakdown(active_rows)
        monthly = _fetch_monthly_costs(rows, year=effective_year)
        employees, total_employees = fetch_employees(limit=500, periodo=periodo, year=effective_year)
        dist_contrato = _fetch_distribution_by_contract(active_rows)
        dist_area = _fetch_distribution_by_area(active_rows)

        if periodo:
            display_period = _normalize_period(periodo)
        elif effective_year:
            display_period = str(effective_year)
        else:
            display_period = "Todos los anos"

        response = {
            "kpis": kpis,
            "monthly_costs": monthly,
            "cost_breakdown": breakdown,
            "employees": employees,
            "distribution_contrato": dist_contrato,
            "distribution_area": dist_area,
            "currency": "USD",
            "period": display_period,
            "total_employees": total_employees,
            "filter_options": filter_options,
            "selected_year": effective_year,
            "selected_periodo": _normalize_period(periodo) if periodo else None,
        }

        with _overview_cache_lock:
            _overview_cache[cache_key] = (time.time(), response)

        return response

    except Exception as exc:
        return {
            "kpis": [],
            "monthly_costs": [],
            "cost_breakdown": [],
            "employees": [],
            "distribution_contrato": [],
            "distribution_area": [],
            "currency": "USD",
            "period": "N/D",
            "total_employees": 0,
            "filter_options": {"areas": [], "contratos": [], "periodos": [], "years": []},
            "error": str(exc),
        }
