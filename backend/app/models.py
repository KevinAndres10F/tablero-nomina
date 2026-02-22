from typing import Literal, List
from pydantic import BaseModel


class KPI(BaseModel):
    label: str
    value: float
    change_pct: float
    trend: Literal["up", "down"]


class MonthlyCost(BaseModel):
    month: str
    actual: float
    projected: float


class CostBreakdownItem(BaseModel):
    label: str
    percent: float


class EmployeeRow(BaseModel):
    id: str
    name: str
    role: str
    base_salary: float
    overtime: float
    commission: float
    provisions: float
    total_cost: float
    status: Literal["Paid", "Pending", "Processing"]


class DashboardOverview(BaseModel):
    kpis: List[KPI]
    monthly_costs: List[MonthlyCost]
    cost_breakdown: List[CostBreakdownItem]
    employees: List[EmployeeRow]
    currency: str
    period: str
    generated_date: str
