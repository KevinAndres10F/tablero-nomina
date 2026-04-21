"""
Servicio de datos para KAPIROLL leyendo directamente un archivo Excel (.xlsx).
Expone la misma interfaz que los demás servicios:
  - fetch_filter_options()
  - fetch_employees(limit, offset, periodo, year)
  - fetch_overview(periodo, year)
"""

import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import openpyxl

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
# Ruta al Excel: se puede sobreescribir con la variable EXCEL_FILE_PATH
_DEFAULT_EXCEL = Path(__file__).parents[3] / "NOMINA_EJEMPLO.xlsx"
EXCEL_FILE_PATH = os.getenv("EXCEL_FILE_PATH", str(_DEFAULT_EXCEL))

# Fila donde están los encabezados reales (1-based)
HEADER_ROW = int(os.getenv("EXCEL_HEADER_ROW", "3"))

ROWS_CACHE_TTL        = int(os.getenv("ROWS_CACHE_TTL_SECONDS", "60"))
OVERVIEW_CACHE_TTL    = int(os.getenv("OVERVIEW_CACHE_TTL_SECONDS", "45"))
FILTER_OPTIONS_TTL    = int(os.getenv("FILTER_OPTIONS_TTL_SECONDS", "300"))

# ---------------------------------------------------------------------------
# Cache thread-safe
# ---------------------------------------------------------------------------
_rows_cache: Optional[List[Dict[str, Any]]] = None
_rows_cached_at: float = 0.0
_rows_lock = threading.Lock()

_overview_cache: Dict[Tuple, Tuple[float, Dict[str, Any]]] = {}
_overview_lock = threading.Lock()

_filter_cache: Optional[Dict[str, List[Any]]] = None
_filter_cached_at: float = 0.0
_filter_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
NUMERIC_FIELDS = [
    # Totales directos del Excel (columnas exactas)
    "total_ingresos", "total_descuentos", "total_provisiones", "a_recibir",
    # Horas extras
    "h_ext_100", "h_ext_50", "recnocturno",
    # Provisiones individuales
    "decimo_13", "decimo_14_c", "decimo_14_s", "decimo_14",
    "vacaciones_prov", "fondos_reserva",
    # Pago mensual consumido
    "d13_mens", "d14_mens_cos", "d14_mens_sie",
    # IESS
    "iess_patronal", "iess_personal", "pr_h_iess", "pr_q_iess",
    "seg_tiempo_parcial",
]


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def _month_name(month: int) -> str:
    return {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
    }.get(month, "")


def _extract_year(periodo: str) -> Optional[int]:
    m = re.match(r"^(\d{4})", str(periodo or ""))
    return int(m.group(1)) if m else None


def _normalize_period(value: Any) -> str:
    raw = str(value or "").strip()
    m = re.match(r"^(\d{4})[-/](\d{1,2})$", raw)
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}" if m else raw


# ---------------------------------------------------------------------------
# Lectura del Excel
# ---------------------------------------------------------------------------
def _load_excel_rows() -> List[Dict[str, Any]]:
    path = EXCEL_FILE_PATH
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    # Leer encabezados
    header_values = [cell.value for cell in next(
        ws.iter_rows(min_row=HEADER_ROW, max_row=HEADER_ROW)
    )]

    # Construir mapa nombre_columna → índice
    col = {str(h).strip().upper(): i for i, h in enumerate(header_values) if h}

    rows: List[Dict[str, Any]] = []
    for raw in ws.iter_rows(min_row=HEADER_ROW + 1, values_only=True):
        if not raw[col.get("NOMBRES", 1)]:
            continue

        def g(key: str):
            idx = col.get(key)
            return raw[idx] if idx is not None else None

        periodo_raw = str(g("PERIODO") or "").strip()
        # Normalizar formato: si viene como "2024-1" → "2024-01"
        periodo = _normalize_period(periodo_raw) if periodo_raw else ""

        rows.append({
            "nombre":            str(g("NOMBRES") or ""),
            "cedula":            str(g("CEDULA") or ""),
            "genero":            str(g("GENERO") or ""),
            "discapacidad":      str(g("DISCAPACIDAD") or "No").strip().upper().startswith("S"),
            # Intentar variantes del nombre de columna para mayor robustez
            "tipo_contrato":     str(g("TIPO_CONTRATO") or g("TIPO CONTRATO") or ""),
            "area":              str(g("CLASS") or ""),
            "mall":              str(g("MALL") or ""),
            "periodo":           periodo,
            "total_ingresos":    _to_float(g("TOTAL INGRESOS")),
            "total_descuentos":  _to_float(g("TOTAL DESCUENTOS")),
            "total_provisiones": _to_float(g("TOTAL PROVISIONES")),
            "a_recibir":         _to_float(g("VALOR A RECIBIR")),
            "h_ext_100":         _to_float(g("VALOR HORAS EXT 100%")),
            "h_ext_50":          0.0,
            "recnocturno":       _to_float(g("VALOR REC.NOCTURNO")),
            "decimo_13":         _to_float(g("DECIMO 13")),
            "decimo_14_c":       _to_float(g("DECIMO 14 C")),
            "decimo_14_s":       _to_float(g("DECIMO 14 S")),
            "decimo_14":         _to_float(g("DECIMO 14 C")) + _to_float(g("DECIMO 14 S")),
            "d13_mens":          _to_float(g("D13 MENS")),
            "d14_mens_cos":      _to_float(g("D14 MENS COS")),
            "d14_mens_sie":      _to_float(g("D14 MENS SIE")),
            "vacaciones_prov":   _to_float(g("VACACIONES")),
            # Fondos de reserva: columna de provisiones
            "fondos_reserva":    _to_float(g("FOND.RESERVA PROV") or g("FOND.RESERVA")),
            # IESS Patronal: el nombre incluye el porcentaje en algunos archivos
            "iess_patronal":     _to_float(g("IESS PATRONAL 12.15%") or g("IESS PATRONA") or g("IESS PATRONAL")),
            "iess_personal":     _to_float(g("IESS PERSONAL") or g("IESSPERSONAL")),
            "pr_h_iess":         _to_float(g("PR. H IESS")),
            "pr_q_iess":         _to_float(g("PR. Q IESS")),
            "seg_tiempo_parcial": _to_float(g("AD 4.41 JP") or g("AD 4.41JP") or g("SEG TIEMPO PARCIAL")),
        })

    wb.close()
    return rows


def _get_all_rows() -> List[Dict[str, Any]]:
    global _rows_cache, _rows_cached_at
    with _rows_lock:
        now = time.time()
        if _rows_cache is not None and (now - _rows_cached_at) < ROWS_CACHE_TTL:
            return _rows_cache

    rows = _load_excel_rows()

    with _rows_lock:
        _rows_cache = rows
        _rows_cached_at = time.time()

    return rows


# ---------------------------------------------------------------------------
# Filtrado
# ---------------------------------------------------------------------------
def _filter_rows(rows, periodo=None, year=None):
    if periodo:
        norm = _normalize_period(periodo)
        return [r for r in rows if r["periodo"] == norm]
    if year:
        return [r for r in rows if _extract_year(r["periodo"]) == int(year)]
    return rows


def _latest_by_employee(rows):
    latest: Dict[str, Dict] = {}
    for r in rows:
        key = r.get("cedula") or r.get("nombre")
        if not key:
            continue
        cur = latest.get(key)
        if not cur or r["periodo"] > cur["periodo"]:
            latest[key] = r
    return list(latest.values())


# ---------------------------------------------------------------------------
# Agregaciones
# ---------------------------------------------------------------------------
def _kpis(rows):
    costo = sum(r["total_ingresos"] + r["total_provisiones"] for r in rows)
    provisiones = sum(r["total_provisiones"] for r in rows)
    hext = sum(r["h_ext_100"] + r["h_ext_50"] for r in rows)
    neto = sum(r["a_recibir"] for r in rows)
    ids = {r["cedula"] for r in rows if r["cedula"]}
    n = max(len(ids) if ids else len(rows), 1)
    return [
        {"label": "Costo Total Nomina",  "value": costo,       "subtitle": f"{n} empleados",         "change_pct": 0.0, "trend": "up", "icon": "payments"},
        {"label": "Costo por Empleado",  "value": costo / n,   "subtitle": "Ingresos + Provisiones",  "change_pct": 0.0, "trend": "up", "icon": "person"},
        {"label": "Total Provisiones",   "value": provisiones,  "subtitle": "D13 + D14 + Vac + F.Res","change_pct": 0.0, "trend": "up", "icon": "savings"},
        {"label": "Horas Extras",        "value": hext,         "subtitle": "100% + 50%",              "change_pct": 0.0, "trend": "up", "icon": "schedule"},
        {"label": "Neto a Pagar",        "value": neto,         "subtitle": "Liquido empleados",       "change_pct": 0.0, "trend": "up", "icon": "account_balance_wallet"},
    ]


def _breakdown(rows):
    d13 = sum(r["decimo_13"] for r in rows)
    d14 = sum(r["decimo_14"] for r in rows)
    vac = sum(r["vacaciones_prov"] for r in rows)
    fr  = sum(r["fondos_reserva"] for r in rows)
    iep = sum(r["iess_patronal"] for r in rows)
    tot = sum(r["total_provisiones"] for r in rows) or 1
    return [
        {"label": "Decimo Tercero", "percent": round(d13/tot*100,1), "value": d13},
        {"label": "Decimo Cuarto",  "percent": round(d14/tot*100,1), "value": d14},
        {"label": "Vacaciones",     "percent": round(vac/tot*100,1), "value": vac},
        {"label": "Fondos Reserva", "percent": round(fr /tot*100,1), "value": fr},
        {"label": "IESS Patronal",  "percent": round(iep/tot*100,1), "value": iep},
    ]


def _monthly_costs(rows, year=None):
    filtered = _filter_rows(rows, year=year)
    grouped: Dict[str, Dict] = {}
    for r in filtered:
        p = r["periodo"] or "Sin periodo"
        b = grouped.setdefault(p, {
            "periodo": p, "month": p, "costo_total": 0.0,
            "ingresos": 0.0, "provisiones": 0.0, "descuentos": 0.0, "empleados": set(),
        })
        b["ingresos"]    += r["total_ingresos"]
        b["provisiones"] += r["total_provisiones"]
        b["descuentos"]  += r["total_descuentos"]
        b["costo_total"] += r["total_ingresos"] + r["total_provisiones"]
        if r["cedula"]:
            b["empleados"].add(r["cedula"])

    items = []
    for p in sorted(grouped):
        b = grouped[p]
        m = re.match(r"^(\d{4})-(\d{2})$", p)
        if m:
            b["month"] = _month_name(int(m.group(2)))[:3]
        b["empleados"] = len(b["empleados"])
        items.append(b)
    return items


def _dist_contrato(rows):
    latest = _latest_by_employee(rows)
    g: Dict[str, Dict] = {}
    for r in latest:
        label = r.get("tipo_contrato") or "Sin definir"
        b = g.setdefault(label, {"label": label, "count": 0, "value": 0.0})
        b["count"] += 1
        b["value"] += r["total_ingresos"]
    return sorted(g.values(), key=lambda x: x["count"], reverse=True)


def _dist_area(rows):
    latest = _latest_by_employee(rows)
    g: Dict[str, Dict] = {}
    for r in latest:
        label = r.get("area") or "Sin definir"
        b = g.setdefault(label, {"label": label, "count": 0, "value": 0.0})
        b["count"] += 1
        b["value"] += r["total_ingresos"]
    return sorted(g.values(), key=lambda x: x["count"], reverse=True)


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------
def fetch_filter_options() -> Dict[str, List[Any]]:
    global _filter_cache, _filter_cached_at
    with _filter_lock:
        now = time.time()
        if _filter_cache and (now - _filter_cached_at) < FILTER_OPTIONS_TTL:
            return _filter_cache

    rows = _get_all_rows()
    areas     = sorted({r["area"] for r in rows if r["area"]})
    contratos = sorted({r["tipo_contrato"] for r in rows if r["tipo_contrato"]})
    periodos_unicos = sorted({r["periodo"] for r in rows if r["periodo"]}, reverse=True)

    periodos = []
    for p in periodos_unicos:
        y = _extract_year(p)
        month, label = "01", p
        m = re.match(r"^(\d{4})-(\d{2})$", p)
        if m:
            month = m.group(2)
            label = f"{_month_name(int(month))} {m.group(1)}"
        periodos.append({"value": p, "year": str(y) if y else "", "month": month, "label": label})

    years = sorted({y for y in (_extract_year(p) for p in periodos_unicos) if y}, reverse=True)

    result = {"areas": areas, "contratos": contratos, "periodos": periodos, "years": years}
    with _filter_lock:
        _filter_cache = result
        _filter_cached_at = time.time()
    return result


def fetch_employees(limit=50, offset=0, periodo=None, year=None) -> Tuple[List[Dict], int]:
    rows = _filter_rows(_get_all_rows(), periodo=periodo, year=year)
    ordered = sorted(rows, key=lambda r: (r["periodo"], r["total_ingresos"]), reverse=True)
    total = len(ordered)
    sliced = ordered[offset: offset + limit]
    for e in sliced:
        e["horas_extras"] = e["h_ext_100"] + e["h_ext_50"]
    return sliced, total


def fetch_overview(periodo=None, year=None) -> Dict[str, Any]:
    key = (periodo, year)
    with _overview_lock:
        cached = _overview_cache.get(key)
        if cached and (time.time() - cached[0]) < OVERVIEW_CACHE_TTL:
            return cached[1]

    try:
        rows = _get_all_rows()
        filter_opts = fetch_filter_options()

        effective_year = year
        if not effective_year and not periodo:
            years = filter_opts.get("years", [])
            if years:
                effective_year = years[0]

        active = _filter_rows(rows, periodo=periodo, year=effective_year)
        employees, total_emp = fetch_employees(limit=10000, periodo=periodo, year=effective_year)
        display = _normalize_period(periodo) if periodo else (str(effective_year) if effective_year else "Todos los anos")

        result = {
            "kpis":                _kpis(active),
            "monthly_costs":       _monthly_costs(rows, year=effective_year),
            "cost_breakdown":      _breakdown(active),
            "employees":           employees,
            "distribution_contrato": _dist_contrato(active),
            "distribution_area":   _dist_area(active),
            "currency":            "USD",
            "period":              display,
            "total_employees":     total_emp,
            "filter_options":      filter_opts,
            "selected_year":       effective_year,
            "selected_periodo":    _normalize_period(periodo) if periodo else None,
        }

        with _overview_lock:
            _overview_cache[key] = (time.time(), result)
        return result

    except Exception as exc:
        return {
            "kpis": [], "monthly_costs": [], "cost_breakdown": [],
            "employees": [], "distribution_contrato": [], "distribution_area": [],
            "currency": "USD", "period": "N/D", "total_employees": 0,
            "filter_options": {"areas": [], "contratos": [], "periodos": [], "years": []},
            "error": str(exc),
        }
