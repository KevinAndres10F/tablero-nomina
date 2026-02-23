import os
import json
import tempfile
from typing import Dict, List, Any, Tuple

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


def fetch_kpis() -> List[Dict[str, Any]]:
    """Calcula KPIs agregados de la nómina según requerimientos del especialista."""
    client = _get_client()
    table = _get_table_ref()
    
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


def fetch_employees(limit: int = 50, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    """Obtiene el detalle de empleados con todos los campos necesarios."""
    client = _get_client()
    table = _get_table_ref()
    
    count_query = f"SELECT COUNT(DISTINCT CEDULA) as total FROM {table}"
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
        ORDER BY Total_INGRESOS DESC
        LIMIT {limit} OFFSET {offset}
    """
    
    result = client.query(query).result()
    employees = [dict(row) for row in result]
    
    return employees, total


def fetch_overview() -> Dict[str, Any]:
    """Obtiene todos los datos del dashboard."""
    try:
        kpis = fetch_kpis()
        breakdown = fetch_cost_breakdown()
        monthly = fetch_monthly_costs()
        employees, total_employees = fetch_employees()
        
        return {
            "kpis": kpis,
            "monthly_costs": monthly,
            "cost_breakdown": breakdown,
            "employees": employees,
            "currency": "USD",
            "period": "2024",
            "total_employees": total_employees
        }
    except (GoogleAPIError, ValueError) as e:
        return {
            "kpis": [],
            "monthly_costs": [],
            "cost_breakdown": [],
            "employees": [],
            "currency": "USD",
            "period": "2024",
            "total_employees": 0,
            "error": str(e)
        }
