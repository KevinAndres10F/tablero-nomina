from datetime import date

KPI_DATA = [
    {
        "label": "Costo total nómina",
        "value": 450200.0,
        "change_pct": 2.5,
        "trend": "up",
    },
    {
        "label": "Costo promedio por empleado",
        "value": 4280.0,
        "change_pct": -1.2,
        "trend": "down",
    },
    {
        "label": "Provisiones mensuales",
        "value": 38500.0,
        "change_pct": 0.5,
        "trend": "up",
    },
    {
        "label": "Pagos de horas extra",
        "value": 12400.0,
        "change_pct": 15.3,
        "trend": "up",
    },
]

MONTHLY_COSTS = [
    {"month": "Jul", "actual": 160000.0, "projected": 150000.0},
    {"month": "Ago", "actual": 140000.0, "projected": 148000.0},
    {"month": "Sep", "actual": 155000.0, "projected": 152000.0},
    {"month": "Oct", "actual": 175000.0, "projected": 160000.0},
    {"month": "Nov", "actual": 168000.0, "projected": 162000.0},
    {"month": "Dic", "actual": 180000.0, "projected": 170000.0},
]

COST_BREAKDOWN = [
    {"label": "Salario base", "percent": 70.0},
    {"label": "Provisiones", "percent": 18.0},
    {"label": "Comisiones", "percent": 12.0},
]

EMPLOYEE_ROWS = [
    {
        "id": "EMP-1029",
        "name": "Alexander Wright",
        "role": "Sr. Backend Engineer",
        "base_salary": 6500.0,
        "overtime": 240.0,
        "commission": 0.0,
        "provisions": 1170.0,
        "total_cost": 7910.0,
        "status": "Paid",
    },
    {
        "id": "EMP-1031",
        "name": "Sarah Jenkins",
        "role": "Product Manager",
        "base_salary": 5800.0,
        "overtime": 0.0,
        "commission": 450.0,
        "provisions": 1044.0,
        "total_cost": 7294.0,
        "status": "Paid",
    },
    {
        "id": "EMP-1035",
        "name": "Michael Chen",
        "role": "Sales Director",
        "base_salary": 7200.0,
        "overtime": 0.0,
        "commission": 2800.0,
        "provisions": 1296.0,
        "total_cost": 11296.0,
        "status": "Processing",
    },
    {
        "id": "EMP-1040",
        "name": "David Miller",
        "role": "UI/UX Designer",
        "base_salary": 4900.0,
        "overtime": 650.0,
        "commission": 0.0,
        "provisions": 882.0,
        "total_cost": 6432.0,
        "status": "Pending",
    },
]

METADATA = {
    "currency": "USD",
    "period": "Jan 2024 - Dec 2024",
    "generated_date": date.today().isoformat(),
}
