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
    """Calcula KPIs agregados de la nómina."""
    client = _get_client()
    table = _get_table_ref()
    
    query = f"""
        SELECT
            SUM(Total_INGRESOS) as total_ingresos,
            SUM(Total_DESCUENTOS) as total_descuentos,
            SUM(Total_PROVISIONES) as total_provisiones,
            SUM(A_RECIBIR) as total_neto,
            SUM(COALESCE(H_EXT_100, 0) + COALESCE(H_EXT_50, 0)) as total_horas_extras,
            COUNT(DISTINCT CEDULA) as total_empleados,
            AVG(Total_INGRESOS) as promedio_ingreso
        FROM {table}
    """
    
    result = client.query(query).result()
    row = list(result)[0]
    
    total_ingresos = float(row.total_ingresos or 0)
    total_provisiones = float(row.total_provisiones or 0)
    total_horas_extras = float(row.total_horas_extras or 0)
    promedio_ingreso = float(row.promedio_ingreso or 0)
    
    return [
        {
            "label": "Costo Total Nómina",
            "value": total_ingresos + total_provisiones,
            "change_pct": 0.0,
            "trend": "up",
            "icon": "payments"
        },
        {
            "label": "Promedio por Empleado",
            "value": promedio_ingreso,
            "change_pct": 0.0,
            "trend": "up",
            "icon": "person"
        },
        {
            "label": "Total Provisiones",
            "value": total_provisiones,
            "change_pct": 0.0,
            "trend": "up",
            "icon": "account_balance"
        },
        {
            "label": "Horas Extras",
            "value": total_horas_extras,
            "change_pct": 0.0,
            "trend": "up",
            "icon": "schedule"
        }
    ]


def fetch_cost_breakdown() -> List[Dict[str, Any]]:
    """Obtiene el desglose de costos por categoría."""
    client = _get_client()
    table = _get_table_ref()
    
    query = f"""
        SELECT
            SUM(COALESCE(ANT_SUELDO, 0)) as salario_base,
            SUM(COALESCE(Total_PROVISIONES, 0)) as provisiones,
            SUM(COALESCE(H_EXT_100, 0) + COALESCE(H_EXT_50, 0) + COALESCE(RECNOCTURNO, 0)) as extras,
            SUM(COALESCE(LUNCH, 0) + COALESCE(REMUN_UNIF, 0)) as beneficios,
            SUM(COALESCE(Total_INGRESOS, 0)) as total
        FROM {table}
    """
    
    result = client.query(query).result()
    row = list(result)[0]
    
    total = float(row.total or 1)
    salario = float(row.salario_base or 0)
    provisiones = float(row.provisiones or 0)
    extras = float(row.extras or 0)
    beneficios = float(row.beneficios or 0)
    
    return [
        {"label": "Salario Base", "percent": round((salario / total) * 100, 1) if total else 0, "value": salario},
        {"label": "Provisiones", "percent": round((provisiones / total) * 100, 1) if total else 0, "value": provisiones},
        {"label": "Horas Extras", "percent": round((extras / total) * 100, 1) if total else 0, "value": extras},
        {"label": "Beneficios", "percent": round((beneficios / total) * 100, 1) if total else 0, "value": beneficios},
    ]


def fetch_monthly_costs() -> List[Dict[str, Any]]:
    """Placeholder para costos mensuales."""
    return [
        {"month": "Jul", "actual": 0, "projected": 0},
        {"month": "Ago", "actual": 0, "projected": 0},
        {"month": "Sep", "actual": 0, "projected": 0},
        {"month": "Oct", "actual": 0, "projected": 0},
        {"month": "Nov", "actual": 0, "projected": 0},
        {"month": "Dic", "actual": 0, "projected": 0},
    ]


def fetch_employees(limit: int = 50, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    """Obtiene el detalle de empleados."""
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
            Total_INGRESOS as total_ingresos,
            Total_DESCUENTOS as total_descuentos,
            Total_PROVISIONES as total_provisiones,
            A_RECIBIR as a_recibir,
            (COALESCE(H_EXT_100, 0) + COALESCE(H_EXT_50, 0)) as horas_extras
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
