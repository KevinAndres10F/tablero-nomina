from typing import Literal, List, Optional
from pydantic import BaseModel


class KPI(BaseModel):
    label: str
    value: float
    change_pct: float
    trend: Literal["up", "down"]
    icon: str = "payments"


class MonthlyCost(BaseModel):
    month: str
    actual: float
    projected: float


class CostBreakdownItem(BaseModel):
    label: str
    percent: float
    value: float = 0.0


class EmployeeRow(BaseModel):
    cedula: str
    nombre: str
    area: str
    tipo_contrato: str
    total_ingresos: float
    total_descuentos: float
    total_provisiones: float
    a_recibir: float
    horas_extras: float


class DashboardOverview(BaseModel):
    kpis: List[KPI]
    monthly_costs: List[MonthlyCost]
    cost_breakdown: List[CostBreakdownItem]
    employees: List[EmployeeRow]
    currency: str
    period: str
    total_employees: int = 0
    error: Optional[str] = None
