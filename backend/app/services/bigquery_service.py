import os
import json
import tempfile
from typing import Dict, List, Any, Tuple, Optional

from google.cloud import bigquery
from google.oauth2 import service_account
from google.api_core.exceptions import GoogleAPIError


def _get_client() -> bigquery.Client:
    project_id = os.getenv("BQ_PROJECT_ID")
    if not project_id:
        raise ValueError("BQ_PROJECT_ID is not set")
    
    # Check for JSON credentials in environment variable
    creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if creds_json:
        creds_dict = json.loads(creds_json)
        credentials = service_account.Credentials.from_service_account_info(creds_dict)
        return bigquery.Client(project=project_id, credentials=credentials)
    
    # Fall back to default credentials (local development)
    return bigquery.Client(project=project_id)


def _get_table_ref() -> str:
    project = os.getenv("BQ_PROJECT_ID")
    dataset = os.getenv("BQ_DATASET")
    table = os.getenv("BQ_TABLE")
    return f"`{project}.{dataset}.{table}`"


def fetch_available_periods() -> List[Dict[str, Any]]:
    """Obtiene los períodos (año-mes) disponibles en la base de datos."""
    client = _get_client()
    table = _get_table_ref()
    
    try:
        query = f"""
            SELECT DISTINCT 
                CAST(PERIODO AS STRING) as periodo
            FROM {table}
            WHERE PERIODO IS NOT NULL
            ORDER BY periodo DESC
        """
        result = client.query(query).result()
        periods = []
        seen = set()  # Para evitar duplicados
        
        for row in result:
            periodo = str(row.periodo).strip()
            if periodo in seen or not periodo:
                continue
            seen.add(periodo)
            
            # Parsear el período (formato esperado: YYYY-MM)
            try:
                if '-' in periodo:
                    parts = periodo.split('-')
                    year = parts[0]
                    month = parts[1] if len(parts) > 1 else '01'
                else:
                    year = periodo[:4] if len(periodo) >= 4 else periodo
                    month = periodo[4:6] if len(periodo) >= 6 else '01'
                
                month_int = int(month)
                month_name = _month_name(month_int)
                
                periods.append({
                    "value": periodo,
                    "year": year,
                    "month": month.zfill(2),
                    "label": f"{month_name} {year}"
                })
            except (ValueError, IndexError) as parse_error:
                print(f"Error parseando período '{periodo}': {parse_error}")
                continue
                
        return periods
    except Exception as e:
        print(f"No se pudo obtener períodos: {e}")
        return []


def _month_name(month: int) -> str:
    """Retorna el nombre del mes en español."""
    months = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }
    return months.get(month, "")


def fetch_available_years() -> List[int]:
    """Obtiene los años únicos disponibles en la base de datos."""
    client = _get_client()
    table = _get_table_ref()
    
    try:
        query = f"""
            SELECT DISTINCT 
                CAST(LEFT(CAST(PERIODO AS STRING), 4) AS INT64) as year
            FROM {table}
            WHERE PERIODO IS NOT NULL
            ORDER BY year DESC
        """
        result = client.query(query).result()
        years = [int(row.year) for row in result if row.year]
        return years if years else [2025]  # Default a 2025 si no hay datos
    except Exception as e:
        print(f"No se pudo obtener años: {e}")
        return [2025]


def fetch_filter_options() -> Dict[str, List[Any]]:
    """Obtiene todas las opciones disponibles para filtros."""
    client = _get_client()
    table = _get_table_ref()
    
    query = f"""
        SELECT DISTINCT 
            AREA as area,
            TIPO_CONTRATO as tipo_contrato
        FROM {table}
        WHERE AREA IS NOT NULL OR TIPO_CONTRATO IS NOT NULL
    """
    result = client.query(query).result()
    
    areas = set()
    contratos = set()
    
    for row in result:
        if row.area:
            areas.add(row.area)
        if row.tipo_contrato:
            contratos.add(row.tipo_contrato)
    
    # Obtener períodos y años disponibles
    periods = fetch_available_periods()
    years = fetch_available_years()
    
    return {
        "areas": sorted(list(areas)),
        "contratos": sorted(list(contratos)),
        "periodos": periods,
        "years": years
    }


def _build_where_clause(periodo: Optional[str] = None, year: Optional[int] = None) -> str:
    """Construye la cláusula WHERE basada en los filtros."""
    conditions = []
    if periodo:
        conditions.append(f"CAST(PERIODO AS STRING) = '{periodo}'")
    elif year:
        conditions.append(f"CAST(LEFT(CAST(PERIODO AS STRING), 4) AS INT64) = {year}")
    
    return f"WHERE {' AND '.join(conditions)}" if conditions else ""


def fetch_kpis(periodo: Optional[str] = None, year: Optional[int] = None) -> List[Dict[str, Any]]:
    """Calcula KPIs agregados de la nómina según requerimientos del especialista."""
    client = _get_client()
    table = _get_table_ref()
    where_clause = _build_where_clause(periodo, year)
    
    query = f"""
        SELECT
            -- Costo total por empleado (ingresos + provisiones)
            SUM(COALESCE(Total_INGRESOS, 0) + COALESCE(Total_PROVISIONES, 0)) as costo_total,
            
            -- Total empleados únicos
            COUNT(DISTINCT CEDULA) as total_empleados,
            
            -- Provisiones desglosadas (las que se guardan mensualmente)
            SUM(COALESCE(DECIMO_13, 0)) as decimo_tercero,
            SUM(COALESCE(DECIMO_14_S, 0)) as decimo_cuarto,
            SUM(COALESCE(VACACIONES_PROVISIONES, 0)) as vacaciones_prov,
            SUM(COALESCE(FOND_RESERVA, 0)) as fondos_reserva,
            SUM(COALESCE(Total_PROVISIONES, 0)) as total_provisiones,
            
            -- Provisiones pagadas mensualmente
            SUM(COALESCE(D13_MENS, 0)) as d13_mensual,
            SUM(COALESCE(D14_MENS_SIE, 0)) as d14_mensual,
            SUM(COALESCE(FOND_RESERV, 0)) as fondo_reserv_mensual,
            
            -- Horas extras
            SUM(COALESCE(H_EXT_100, 0)) as horas_ext_100,
            SUM(COALESCE(H_EXT_50, 0)) as horas_ext_50,
            SUM(COALESCE(H_EXT_100, 0) + COALESCE(H_EXT_50, 0)) as total_horas_extras,
            
            -- Recargo nocturno
            SUM(COALESCE(RECNOCTURNO, 0)) as recargo_nocturno,
            
            -- Neto a pagar
            SUM(COALESCE(A_RECIBIR, 0)) as total_neto
        FROM {table}
        {where_clause}
    """
    
    result = client.query(query).result()
    row = list(result)[0]
    
    costo_total = float(row.costo_total or 0)
    total_empleados = int(row.total_empleados or 1)
    total_provisiones = float(row.total_provisiones or 0)
    total_horas_extras = float(row.total_horas_extras or 0)
    total_neto = float(row.total_neto or 0)
    
    # Costo promedio por empleado (ingresos + provisiones)
    costo_por_empleado = costo_total / total_empleados if total_empleados > 0 else 0
    
    return [
        {
            "label": "Costo Total Nómina",
            "value": costo_total,
            "subtitle": f"{total_empleados} empleados",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "payments"
        },
        {
            "label": "Costo por Empleado",
            "value": costo_por_empleado,
            "subtitle": "Ingresos + Provisiones",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "person"
        },
        {
            "label": "Total Provisiones",
            "value": total_provisiones,
            "subtitle": "D13 + D14 + Vac + F.Res",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "savings"
        },
        {
            "label": "Horas Extras",
            "value": total_horas_extras,
            "subtitle": "100% + 50%",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "schedule"
        },
        {
            "label": "Neto a Pagar",
            "value": total_neto,
            "subtitle": "Líquido empleados",
            "change_pct": 0.0,
            "trend": "up",
            "icon": "account_balance_wallet"
        }
    ]


def fetch_cost_breakdown() -> List[Dict[str, Any]]:
    """Obtiene el desglose detallado de provisiones y costos."""
    client = _get_client()
    table = _get_table_ref()
    
    query = f"""
        SELECT
            -- Provisiones que se guardan
            SUM(COALESCE(DECIMO_13, 0)) as decimo_13,
            SUM(COALESCE(DECIMO_14_S, 0)) as decimo_14,
            SUM(COALESCE(VACACIONES_PROVISIONES, 0)) as vacaciones,
            SUM(COALESCE(FOND_RESERVA, 0)) as fondos_reserva,
            SUM(COALESCE(IESS_PATRONAL, 0)) as iess_patronal,
            
            -- Total para calcular porcentajes
            SUM(COALESCE(Total_PROVISIONES, 0)) as total_provisiones
        FROM {table}
    """
    
    result = client.query(query).result()
    row = list(result)[0]
    
    total = float(row.total_provisiones or 1)
    decimo_13 = float(row.decimo_13 or 0)
    decimo_14 = float(row.decimo_14 or 0)
    vacaciones = float(row.vacaciones or 0)
    fondos_reserva = float(row.fondos_reserva or 0)
    iess_patronal = float(row.iess_patronal or 0)
    
    return [
        {"label": "Décimo Tercero", "percent": round((decimo_13 / total) * 100, 1) if total else 0, "value": decimo_13},
        {"label": "Décimo Cuarto", "percent": round((decimo_14 / total) * 100, 1) if total else 0, "value": decimo_14},
        {"label": "Vacaciones", "percent": round((vacaciones / total) * 100, 1) if total else 0, "value": vacaciones},
        {"label": "Fondos Reserva", "percent": round((fondos_reserva / total) * 100, 1) if total else 0, "value": fondos_reserva},
        {"label": "IESS Patronal", "percent": round((iess_patronal / total) * 100, 1) if total else 0, "value": iess_patronal},
    ]


def fetch_monthly_costs() -> List[Dict[str, Any]]:
    """Placeholder para costos mensuales - requiere campo de fecha/periodo en la tabla."""
    return [
        {"month": "Jul", "actual": 0, "projected": 0},
        {"month": "Ago", "actual": 0, "projected": 0},
        {"month": "Sep", "actual": 0, "projected": 0},
        {"month": "Oct", "actual": 0, "projected": 0},
        {"month": "Nov", "actual": 0, "projected": 0},
        {"month": "Dic", "actual": 0, "projected": 0},
    ]


def fetch_employees(limit: int = 50, offset: int = 0, periodo: Optional[str] = None, year: Optional[int] = None) -> Tuple[List[Dict[str, Any]], int]:
    """Obtiene el detalle de empleados con todos los campos necesarios."""
    client = _get_client()
    table = _get_table_ref()
    
    # Construir cláusula WHERE
    where_clause = _build_where_clause(periodo, year)
    
    count_query = f"SELECT COUNT(*) as total FROM {table} {where_clause}"
    count_result = client.query(count_query).result()
    total = list(count_result)[0].total
    
    query = f"""
        SELECT
            CEDULA as cedula,
            NOMBRES as nombre,
            AREA as area,
            TIPO_CONTRATO as tipo_contrato,
            FECHA_INGRESO as fecha_ingreso,
            Total_INGRESOS as total_ingresos,
            Total_DESCUENTOS as total_descuentos,
            Total_PROVISIONES as total_provisiones,
            A_RECIBIR as a_recibir,
            (COALESCE(H_EXT_100, 0) + COALESCE(H_EXT_50, 0)) as horas_extras,
            
            -- Provisiones detalladas
            COALESCE(DECIMO_13, 0) as decimo_13,
            COALESCE(DECIMO_14_S, 0) as decimo_14,
            COALESCE(VACACIONES_PROVISIONES, 0) as vacaciones_prov,
            COALESCE(FOND_RESERVA, 0) as fondos_reserva,
            COALESCE(IESS_PATRONAL, 0) as iess_patronal,
            
            -- IESS y Préstamos
            COALESCE(IESS_PERSONAL, 0) as iess_personal,
            COALESCE(PR_H_IESS, 0) as pr_h_iess,
            COALESCE(PR_Q_IESS, 0) as pr_q_iess
            
        FROM {table}
        {where_clause}
        ORDER BY Total_INGRESOS DESC
        LIMIT {limit} OFFSET {offset}
    """
    
    result = client.query(query).result()
    employees = [dict(row) for row in result]
    
    return employees, total


def fetch_overview(periodo: Optional[str] = None, year: Optional[int] = None) -> Dict[str, Any]:
    """Obtiene todos los datos del dashboard con filtro opcional de período y año."""
    try:
        filter_options = fetch_filter_options()
        
        # Si no se especifica año, usar el más reciente disponible
        effective_year = year
        if not effective_year and not periodo:
            available_years = filter_options.get("years", [])
            if available_years:
                effective_year = available_years[0]  # El más reciente (ordenados DESC)
        
        kpis = fetch_kpis(periodo=periodo, year=effective_year)
        breakdown = fetch_cost_breakdown()
        monthly = fetch_monthly_costs()
        employees, total_employees = fetch_employees(periodo=periodo, year=effective_year)
        
        # Determinar el período/año a mostrar
        if periodo:
            display_period = periodo
        elif effective_year:
            display_period = str(effective_year)
        else:
            display_period = "Todos los años"
        
        return {
            "kpis": kpis,
            "monthly_costs": monthly,
            "cost_breakdown": breakdown,
            "employees": employees,
            "currency": "USD",
            "period": display_period,
            "total_employees": total_employees,
            "filter_options": filter_options,
            "selected_year": effective_year
        }
    except (GoogleAPIError, ValueError) as e:
        return {
            "kpis": [],
            "monthly_costs": [],
            "cost_breakdown": [],
            "employees": [],
            "currency": "USD",
            "period": "2025",
            "total_employees": 0,
            "filter_options": {"areas": [], "contratos": [], "periodos": [], "years": []},
            "error": str(e)
        }
