import os
from typing import Dict, List

from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPIError

from app.data.sample_data import (
    KPI_DATA,
    MONTHLY_COSTS,
    COST_BREAKDOWN,
    EMPLOYEE_ROWS,
    METADATA,
)


def _is_configured() -> bool:
    return all(
        os.getenv(var)
        for var in ["BQ_PROJECT_ID", "BQ_DATASET", "BQ_TABLE_PAYROLL"]
    )


def _get_client() -> bigquery.Client:
    project_id = os.getenv("BQ_PROJECT_ID")
    if not project_id:
        raise ValueError("BQ_PROJECT_ID is not set")
    return bigquery.Client(project=project_id)


def fetch_overview() -> Dict[str, List[Dict]]:
    if not _is_configured():
        return {
            "kpis": KPI_DATA,
            "monthly_costs": MONTHLY_COSTS,
            "cost_breakdown": COST_BREAKDOWN,
            "employees": EMPLOYEE_ROWS,
            **METADATA,
        }

    dataset = os.getenv("BQ_DATASET")
    table = os.getenv("BQ_TABLE_PAYROLL")

    query = f"""
        SELECT
            employee_id AS id,
            employee_name AS name,
            role,
            base_salary,
            overtime,
            commission,
            provisions,
            total_cost,
            status
        FROM `{dataset}.{table}`
        ORDER BY total_cost DESC
        LIMIT 25
    """

    try:
        client = _get_client()
        rows = client.query(query).result()
        employees = [dict(row) for row in rows]
    except (GoogleAPIError, ValueError):
        employees = EMPLOYEE_ROWS

    return {
        "kpis": KPI_DATA,
        "monthly_costs": MONTHLY_COSTS,
        "cost_breakdown": COST_BREAKDOWN,
        "employees": employees,
        **METADATA,
    }
