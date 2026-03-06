import csv
import io
import json
import os
import re
import threading
import time
import unicodedata
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


DEFAULT_SHEET_ID = "1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk"
FILTER_OPTIONS_TTL_SECONDS = int(os.getenv("FILTER_OPTIONS_TTL_SECONDS", "300"))
OVERVIEW_CACHE_TTL_SECONDS = int(os.getenv("OVERVIEW_CACHE_TTL_SECONDS", "45"))
SHEETS_CACHE_TTL_SECONDS = int(os.getenv("SHEETS_CACHE_TTL_SECONDS", "60"))

_filter_options_cache: Optional[Dict[str, List[Any]]] = None
_filter_options_cached_at: float = 0.0
_filter_options_lock = threading.Lock()
_overview_cache: Dict[Tuple[Optional[str], Optional[int]], Tuple[float, Dict[str, Any]]] = {}
_overview_cache_lock = threading.Lock()
_sheet_rows_cache: Optional[List[Dict[str, Any]]] = None
_sheet_rows_cached_at: float = 0.0
_sheet_rows_lock = threading.Lock()


def _month_name(month: int) -> str:
    months = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }
    return months.get(month, "")


def _normalize_text(value: str) -> str:
    if value is None:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return without_accents.strip().lower()


def _normalize_header(value: str) -> str:
    text = _normalize_text(value)
    return re.sub(r"[^a-z0-9]+", "", text)


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    raw = str(value).strip()
    if not raw:
        return 0.0

    cleaned = raw.replace("$", "").replace(" ", "")
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _extract_year(periodo: str) -> Optional[int]:
    match = re.match(r"^(\d{4})", str(periodo or ""))
    if not match:
        return None
    return int(match.group(1))


def _normalize_period(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    match = re.match(r"^(\d{4})[-/](\d{1,2})$", raw)
    if match:
        year = int(match.group(1))
        month = int(match.group(2))
        return f"{year:04d}-{month:02d}"

    compact = re.match(r"^(\d{4})(\d{2})$", raw)
    if compact:
        year = int(compact.group(1))
        month = int(compact.group(2))
        return f"{year:04d}-{month:02d}"

    # Formatos de texto: ene 2025, enero-2025, 2025 enero
    month_tokens = {
        "ene": 1, "enero": 1,
        "feb": 2, "febrero": 2,
        "mar": 3, "marzo": 3,
        "abr": 4, "abril": 4,
        "may": 5, "mayo": 5,
        "jun": 6, "junio": 6,
        "jul": 7, "julio": 7,
        "ago": 8, "agosto": 8,
        "sep": 9, "sept": 9, "septiembre": 9,
        "oct": 10, "octubre": 10,
        "nov": 11, "noviembre": 11,
        "dic": 12, "diciembre": 12,
    }
    text = _normalize_text(raw)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    token_match_1 = re.match(r"^([a-z]+)\s+(\d{4})$", text)
    token_match_2 = re.match(r"^(\d{4})\s+([a-z]+)$", text)
    if token_match_1:
        month = month_tokens.get(token_match_1.group(1))
        year = int(token_match_1.group(2))
        if month:
            return f"{year:04d}-{month:02d}"
    if token_match_2:
        year = int(token_match_2.group(1))
        month = month_tokens.get(token_match_2.group(2))
        if month:
            return f"{year:04d}-{month:02d}"

    return raw


def _build_csv_url() -> str:
    custom_url = os.getenv("GOOGLE_SHEET_CSV_URL", "").strip()
    if custom_url:
        return custom_url

    sheet_id = os.getenv("GOOGLE_SHEET_ID", DEFAULT_SHEET_ID)
    gid = os.getenv("GOOGLE_SHEET_GID", "0")
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


@lru_cache(maxsize=1)
def _get_cached_credentials():
    creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if not creds_json:
        return None

    creds_dict = json.loads(creds_json)
    return service_account.Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )


@lru_cache(maxsize=1)
def _get_sheets_client():
    credentials = _get_cached_credentials()
    if not credentials:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON no esta configurado para usar Sheets API")
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def _header_aliases() -> Dict[str, str]:
    return {
        "cedula": "cedula",
        "identificacion": "cedula",
        "documento": "cedula",
        "nombres": "nombre",
        "nombre": "nombre",
        "apellidosynombres": "nombre",
        "nombresyapellidos": "nombre",
        "nombrecompleto": "nombre",
        "area": "area",
        "departamento": "area",
        "tipocontrato": "tipo_contrato",
        "contrato": "tipo_contrato",
        "fechaingreso": "fecha_ingreso",
        "fingreso": "fecha_ingreso",
        "periodo": "periodo",
        "mes": "periodo",
        "totalingresos": "total_ingresos",
        "ingresos": "total_ingresos",
        "totaldescuentos": "total_descuentos",
        "descuentos": "total_descuentos",
        "totalprovisiones": "total_provisiones",
        "provisiones": "total_provisiones",
        "arecibir": "a_recibir",
        "neto": "a_recibir",
        "hext100": "h_ext_100",
        "h100": "h_ext_100",
        "h_ext_100": "h_ext_100",
        "h_ext100": "h_ext_100",
        "h_ext50": "h_ext_50",
        "h50": "h_ext_50",
        "h_ext_50": "h_ext_50",
        "recnocturno": "recnocturno",
        "decimo13": "decimo_13",
        "d13": "decimo_13",
        "decimo14s": "decimo_14",
        "decimo14": "decimo_14",
        "d14": "decimo_14",
        "vacacionesprovisiones": "vacaciones_prov",
        "vacaciones": "vacaciones_prov",
        "fondreserva": "fondos_reserva",
        "fondoreserva": "fondos_reserva",
        "iesspatronal": "iess_patronal",
        "iesspersonal": "iess_personal",
        "prhiess": "pr_h_iess",
        "prqiess": "pr_q_iess",
    }


def _resolve_canonical_key(raw_key: str) -> str:
    normalized = _normalize_header(raw_key)
    aliases = _header_aliases()
    if normalized in aliases:
        return aliases[normalized]

    # Fallback por coincidencia parcial para encabezados no estandar.
    partials = [
        ("ced", "cedula"),
        ("identif", "cedula"),
        ("nombre", "nombre"),
        ("apellido", "nombre"),
        ("area", "area"),
        ("depart", "area"),
        ("contrato", "tipo_contrato"),
        ("period", "periodo"),
        ("ingres", "total_ingresos"),
        ("descuent", "total_descuentos"),
        ("provision", "total_provisiones"),
        ("recibir", "a_recibir"),
        ("neto", "a_recibir"),
        ("noct", "recnocturno"),
        ("iesspat", "iess_patronal"),
        ("iessper", "iess_personal"),
    ]
    for token, canonical in partials:
        if token in normalized:
            return canonical

    return ""


def _empty_employee_row() -> Dict[str, Any]:
    return {
        "cedula": "",
        "nombre": "",
        "area": "",
        "tipo_contrato": "",
        "fecha_ingreso": "",
        "periodo": "",
        "total_ingresos": 0.0,
        "total_descuentos": 0.0,
        "total_provisiones": 0.0,
        "a_recibir": 0.0,
        "h_ext_100": 0.0,
        "h_ext_50": 0.0,
        "recnocturno": 0.0,
        "decimo_13": 0.0,
        "decimo_14": 0.0,
        "vacaciones_prov": 0.0,
        "fondos_reserva": 0.0,
        "iess_patronal": 0.0,
        "iess_personal": 0.0,
        "pr_h_iess": 0.0,
        "pr_q_iess": 0.0,
    }


def _map_raw_row(record: Dict[str, Any]) -> Dict[str, Any]:
    row = _empty_employee_row()

    for key, value in record.items():
        canonical_key = _resolve_canonical_key(key)
        if not canonical_key:
            continue

        if canonical_key in {"cedula", "nombre", "area", "tipo_contrato", "fecha_ingreso"}:
            row[canonical_key] = str(value or "").strip()
        elif canonical_key == "periodo":
            row[canonical_key] = _normalize_period(value)
        else:
            row[canonical_key] = _to_float(value)

    # Campo derivado requerido por el frontend
    row["horas_extras"] = row["h_ext_100"] + row["h_ext_50"]
    return row


def _has_any_metric(row: Dict[str, Any]) -> bool:
    return any(
        [
            row.get("cedula"),
            row.get("nombre"),
            row.get("periodo"),
            row.get("total_ingresos", 0) != 0,
            row.get("a_recibir", 0) != 0,
        ]
    )


def _parse_csv_payload(payload: str) -> List[Dict[str, Any]]:
    if not payload.strip():
        return []

    if payload.lstrip().startswith("<!DOCTYPE html"):
        raise ValueError("No se puede leer el CSV del Sheet. Revisa permisos de comparticion.")

    reader = csv.DictReader(io.StringIO(payload))
    if not reader.fieldnames:
        raise ValueError("El Sheet no tiene encabezados validos en la primera fila.")

    rows: List[Dict[str, Any]] = []
    for record in reader:
        mapped = _map_raw_row(record)
        if _has_any_metric(mapped):
            rows.append(mapped)
    return rows


def _fetch_rows_via_csv() -> List[Dict[str, Any]]:
    csv_url = _build_csv_url()
    request = Request(csv_url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8-sig")
    except HTTPError as exc:
        raise ValueError(f"Error HTTP leyendo CSV del Sheet: {exc.code}") from exc
    except URLError as exc:
        raise ValueError("No se pudo conectar al Google Sheet por CSV") from exc

    return _parse_csv_payload(payload)


def _read_values_from_api() -> List[List[str]]:
    sheet_id = os.getenv("GOOGLE_SHEET_ID", DEFAULT_SHEET_ID)
    sheet_name = os.getenv("GOOGLE_SHEET_TAB", "").strip()
    read_range = os.getenv("GOOGLE_SHEET_RANGE", "A:ZZ").strip() or "A:ZZ"

    client = _get_sheets_client().spreadsheets()

    if not sheet_name:
        meta = client.get(spreadsheetId=sheet_id, fields="sheets(properties(title))").execute()
        sheets = meta.get("sheets", [])
        if not sheets:
            raise ValueError("El documento no contiene pestanas")
        sheet_name = sheets[0]["properties"]["title"]

    full_range = f"{sheet_name}!{read_range}"
    result = client.values().get(spreadsheetId=sheet_id, range=full_range, majorDimension="ROWS").execute()
    return result.get("values", [])


def _fetch_rows_via_api() -> List[Dict[str, Any]]:
    try:
        values = _read_values_from_api()
    except HttpError as exc:
        status = getattr(exc, "status_code", None)
        if status is None and getattr(exc, "resp", None) is not None:
            status = getattr(exc.resp, "status", "unknown")
        raise ValueError(f"Sheets API devolvio HTTP {status}") from exc

    if not values:
        return []

    headers = values[0]
    body = values[1:]
    rows: List[Dict[str, Any]] = []

    for raw_row in body:
        record = {headers[i]: raw_row[i] if i < len(raw_row) else "" for i in range(len(headers))}
        mapped = _map_raw_row(record)
        if _has_any_metric(mapped):
            rows.append(mapped)

    return rows


def _fetch_sheet_rows() -> List[Dict[str, Any]]:
    mode = os.getenv("GOOGLE_SHEET_SOURCE_MODE", "auto").strip().lower()
    errors: List[str] = []

    if mode in {"auto", "api"}:
        try:
            return _fetch_rows_via_api()
        except Exception as exc:
            errors.append(f"api: {exc}")
            if mode == "api":
                raise

    if mode in {"auto", "csv"}:
        try:
            return _fetch_rows_via_csv()
        except Exception as exc:
            errors.append(f"csv: {exc}")
            if mode == "csv":
                raise

    message = "; ".join(errors) if errors else "No fue posible leer datos del Sheet"
    guidance = (
        " Configura GOOGLE_APPLICATION_CREDENTIALS_JSON y comparte la hoja con el Service Account, "
        "o publica la hoja para acceso CSV."
    )
    raise ValueError(message + guidance)


def _get_sheet_rows() -> List[Dict[str, Any]]:
    global _sheet_rows_cache, _sheet_rows_cached_at

    with _sheet_rows_lock:
        now = time.time()
        if _sheet_rows_cache is not None and (now - _sheet_rows_cached_at) < SHEETS_CACHE_TTL_SECONDS:
            return _sheet_rows_cache

    rows = _fetch_sheet_rows()

    with _sheet_rows_lock:
        _sheet_rows_cache = rows
        _sheet_rows_cached_at = time.time()

    return rows


def _filter_rows(rows: List[Dict[str, Any]], periodo: Optional[str] = None, year: Optional[int] = None) -> List[Dict[str, Any]]:
    if periodo:
        normalized_periodo = _normalize_period(periodo)
        return [r for r in rows if r.get("periodo") == normalized_periodo]

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
        if not current:
            latest[key] = row
            continue

        if row.get("periodo", "") > current.get("periodo", ""):
            latest[key] = row

    return list(latest.values())


def fetch_filter_options() -> Dict[str, List[Any]]:
    global _filter_options_cache, _filter_options_cached_at

    with _filter_options_lock:
        now = time.time()
        if _filter_options_cache and (now - _filter_options_cached_at) < FILTER_OPTIONS_TTL_SECONDS:
            return _filter_options_cache

    rows = _get_sheet_rows()
    areas = sorted({r.get("area", "") for r in rows if r.get("area")})
    contratos = sorted({r.get("tipo_contrato", "") for r in rows if r.get("tipo_contrato")})

    periodos_unicos = sorted({r.get("periodo", "") for r in rows if r.get("periodo")}, reverse=True)
    periodos: List[Dict[str, Any]] = []
    for periodo in periodos_unicos:
        year = _extract_year(periodo)
        month = "01"
        month_label = periodo

        match = re.match(r"^(\d{4})-(\d{2})$", periodo)
        if match:
            month = match.group(2)
            month_label = f"{_month_name(int(month))} {match.group(1)}"

        periodos.append({
            "value": periodo,
            "year": str(year) if year else "",
            "month": month,
            "label": month_label,
        })

    years = sorted({y for y in (_extract_year(p) for p in periodos_unicos) if y is not None}, reverse=True)

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


def fetch_employees(limit: int = 50, offset: int = 0, periodo: Optional[str] = None, year: Optional[int] = None) -> Tuple[List[Dict[str, Any]], int]:
    rows = _filter_rows(_get_sheet_rows(), periodo=periodo, year=year)
    ordered = sorted(rows, key=lambda r: (r.get("periodo", ""), r.get("total_ingresos", 0.0)), reverse=True)

    total = len(ordered)
    sliced = ordered[offset: offset + limit]

    employees: List[Dict[str, Any]] = []
    for row in sliced:
        employee = dict(row)
        employee["horas_extras"] = employee.get("h_ext_100", 0.0) + employee.get("h_ext_50", 0.0)
        employees.append(employee)

    return employees, total


def _fetch_kpis(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    costo_total = sum(r.get("total_ingresos", 0.0) + r.get("total_provisiones", 0.0) for r in rows)
    total_provisiones = sum(r.get("total_provisiones", 0.0) for r in rows)
    total_horas_extras = sum(r.get("h_ext_100", 0.0) + r.get("h_ext_50", 0.0) for r in rows)
    total_neto = sum(r.get("a_recibir", 0.0) for r in rows)

    unique_ids = {r.get("cedula") for r in rows if r.get("cedula")}
    total_empleados = len(unique_ids) if unique_ids else len(rows)
    total_empleados = max(total_empleados, 1)

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


def fetch_overview(periodo: Optional[str] = None, year: Optional[int] = None) -> Dict[str, Any]:
    cache_key = (periodo, year)
    with _overview_cache_lock:
        cached_item = _overview_cache.get(cache_key)
        if cached_item and (time.time() - cached_item[0]) < OVERVIEW_CACHE_TTL_SECONDS:
            return cached_item[1]

    try:
        rows = _get_sheet_rows()
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
