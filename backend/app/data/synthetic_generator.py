"""
Generador de datos sintéticos de nómina ecuatoriana para KAPIROLL.

Uso:
    python -m app.data.synthetic_generator --mode=sql      # Imprime INSERT SQL
    python -m app.data.synthetic_generator --mode=csv      # Imprime CSV
    python -m app.data.synthetic_generator --mode=supabase # Inserta directo en Supabase
"""

import argparse
import csv
import io
import json
import os
import random
import sys
from datetime import date, timedelta
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# Constantes ecuatorianas 2025
# ---------------------------------------------------------------------------
SBU_2025 = 460.0          # Salario Básico Unificado
IESS_PERSONAL = 0.0945     # Aporte personal IESS
IESS_PATRONAL = 0.1115     # Aporte patronal IESS
FONDOS_RESERVA = 0.0833    # Fondos de reserva (> 1 año)

PERIODOS = [f"2025-{m:02d}" for m in range(1, 13)]

# ---------------------------------------------------------------------------
# Pool de nombres ecuatorianos
# ---------------------------------------------------------------------------
NOMBRES_MASCULINOS = [
    "Carlos", "Luis", "Juan", "Pedro", "Miguel", "Andrés", "Fernando",
    "José", "David", "Ricardo", "Santiago", "Sebastián", "Diego", "Mauricio",
    "Esteban", "Cristian", "Byron", "Edison", "Wilmer", "Freddy",
]

NOMBRES_FEMENINOS = [
    "María", "Ana", "Laura", "Paola", "Gabriela", "Verónica", "Sofía",
    "Camila", "Daniela", "Jessica", "Andrea", "Patricia", "Carmen", "Rosa",
    "Lucía", "Valeria", "Nathaly", "Karina", "Mónica", "Silvia",
]

APELLIDOS = [
    "Rodríguez", "Gómez", "Pacheco", "Toapanta", "Caiza", "Morocho",
    "Quispe", "Velasco", "Intriago", "Cevallos", "Guamán", "Pilataxi",
    "Espinoza", "Andrade", "Herrera", "Salazar", "Castillo", "Paredes",
    "Mendoza", "Reyes", "Flores", "Vega", "Torres", "Muñoz",
    "Chávez", "Aguirre", "Bravo", "Jaramillo", "Loor", "Zambrano",
]

# ---------------------------------------------------------------------------
# Definición de áreas
# ---------------------------------------------------------------------------
AREAS_CONFIG = {
    # area: (count, salary_min, salary_max, overtime_prob, night_prob)
    "Produccion":     (18, 460,  1200, 0.60, 0.25),
    "Ventas":         (10, 600,  2000, 0.20, 0.00),
    "Logistica":      (10, 500,  1500, 0.40, 0.15),
    "Administracion": ( 8, 800,  3000, 0.05, 0.00),
    "Contabilidad":   ( 6, 700,  2500, 0.05, 0.00),
    "TI":             ( 4, 1200, 4500, 0.05, 0.00),
    "RRHH":           ( 4, 700,  2000, 0.05, 0.00),
}

CONTRATOS = ["Fijo", "Temporal", "Por Obra"]
CONTRATO_WEIGHTS = [0.65, 0.25, 0.10]

# ---------------------------------------------------------------------------
# Generación de cédulas ecuatorianas (ficticias pero con formato válido)
# ---------------------------------------------------------------------------
_used_cedulas: set = set()


def _gen_cedula() -> str:
    while True:
        provincia = random.randint(1, 24)
        tercero = random.randint(0, 5)
        secuencia = random.randint(1000, 9999)
        base = f"{provincia:02d}{tercero}{secuencia:04d}"
        # Dígito verificador simplificado
        check = sum(int(d) for d in base) % 10
        cedula = f"{base}{check}"
        if cedula not in _used_cedulas:
            _used_cedulas.add(cedula)
            return cedula


# ---------------------------------------------------------------------------
# Generación de empleados
# ---------------------------------------------------------------------------
def _generate_employees() -> List[Dict[str, Any]]:
    random.seed(42)
    employees: List[Dict[str, Any]] = []
    all_names_used: set = set()

    for area, (count, sal_min, sal_max, ot_prob, night_prob) in AREAS_CONFIG.items():
        for _ in range(count):
            # Nombre único
            while True:
                is_male = random.random() < 0.55
                first = random.choice(NOMBRES_MASCULINOS if is_male else NOMBRES_FEMENINOS)
                last1 = random.choice(APELLIDOS)
                last2 = random.choice(APELLIDOS)
                full_name = f"{first} {last1} {last2}"
                if full_name not in all_names_used:
                    all_names_used.add(full_name)
                    break

            base_salary = round(random.uniform(sal_min, sal_max), 2)
            contrato = random.choices(CONTRATOS, weights=CONTRATO_WEIGHTS, k=1)[0]

            # Fecha de ingreso: entre 2018-01-01 y 2025-06-01
            start_date = date(2018, 1, 1)
            end_date = date(2025, 6, 1)
            days_range = (end_date - start_date).days
            fecha_ingreso = start_date + timedelta(days=random.randint(0, days_range))

            # ¿Tiene préstamos IESS?
            has_hipotecario = random.random() < 0.15
            has_quirografario = random.random() < 0.25
            pr_h_monthly = round(random.uniform(50, 300), 2) if has_hipotecario else 0.0
            pr_q_monthly = round(random.uniform(30, 150), 2) if has_quirografario else 0.0

            employees.append({
                "cedula": _gen_cedula(),
                "nombre": full_name,
                "area": area,
                "tipo_contrato": contrato,
                "fecha_ingreso": fecha_ingreso,
                "base_salary": base_salary,
                "overtime_prob": ot_prob,
                "night_prob": night_prob,
                "pr_h_iess": pr_h_monthly,
                "pr_q_iess": pr_q_monthly,
            })

    return employees


# ---------------------------------------------------------------------------
# Generación de registros mensuales
# ---------------------------------------------------------------------------
def _seasonal_factor(month: int) -> float:
    """Factor estacional: diciembre alto, marzo/abril bajo."""
    factors = {
        1: 1.00, 2: 1.01, 3: 0.97, 4: 0.96, 5: 1.00, 6: 1.02,
        7: 1.01, 8: 1.03, 9: 1.02, 10: 1.04, 11: 1.05, 12: 1.15,
    }
    return factors.get(month, 1.0)


def _generate_rows(employees: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    random.seed(42)
    rows: List[Dict[str, Any]] = []

    for periodo in PERIODOS:
        year, month = int(periodo[:4]), int(periodo[5:])
        # Tendencia creciente mensual ~0.5%
        trend = 1.0 + (month - 1) * 0.005
        season = _seasonal_factor(month)

        for emp in employees:
            # Salario con variación mensual
            variation = random.uniform(0.98, 1.02)
            salary = round(emp["base_salary"] * trend * season * variation, 2)

            # Horas extras
            h_ext_100 = 0.0
            h_ext_50 = 0.0
            recnocturno = 0.0
            hourly_rate = salary / 240  # 30 días x 8 horas

            if random.random() < emp["overtime_prob"]:
                hours_100 = random.randint(2, 20)
                h_ext_100 = round(hours_100 * hourly_rate * 2.0, 2)
                hours_50 = random.randint(4, 30)
                h_ext_50 = round(hours_50 * hourly_rate * 1.5, 2)

            if random.random() < emp["night_prob"]:
                hours_night = random.randint(4, 24)
                recnocturno = round(hours_night * hourly_rate * 0.25, 2)

            total_ingresos = round(salary + h_ext_100 + h_ext_50 + recnocturno, 2)

            # Provisiones
            decimo_13 = round(total_ingresos / 12, 2)
            decimo_14 = round(SBU_2025 / 12, 2)
            vacaciones_prov = round(total_ingresos / 24, 2)

            # Fondos de reserva solo si tiene más de 1 año
            tenure_at_period = date(year, month, 1) - emp["fecha_ingreso"]
            has_fondos = tenure_at_period.days >= 365
            fondos_reserva = round(total_ingresos * FONDOS_RESERVA, 2) if has_fondos else 0.0

            iess_patronal = round(total_ingresos * IESS_PATRONAL, 2)

            total_provisiones = round(
                decimo_13 + decimo_14 + vacaciones_prov + fondos_reserva + iess_patronal, 2
            )

            # Descuentos
            iess_personal = round(total_ingresos * IESS_PERSONAL, 2)
            pr_h = emp["pr_h_iess"]
            pr_q = emp["pr_q_iess"]
            total_descuentos = round(iess_personal + pr_h + pr_q, 2)

            # Neto
            a_recibir = round(total_ingresos - total_descuentos, 2)

            rows.append({
                "cedula": emp["cedula"],
                "nombre": emp["nombre"],
                "area": emp["area"],
                "tipo_contrato": emp["tipo_contrato"],
                "fecha_ingreso": emp["fecha_ingreso"].isoformat(),
                "periodo": periodo,
                "total_ingresos": total_ingresos,
                "total_descuentos": total_descuentos,
                "total_provisiones": total_provisiones,
                "a_recibir": a_recibir,
                "h_ext_100": h_ext_100,
                "h_ext_50": h_ext_50,
                "recnocturno": recnocturno,
                "decimo_13": decimo_13,
                "decimo_14": decimo_14,
                "vacaciones_prov": vacaciones_prov,
                "fondos_reserva": fondos_reserva,
                "iess_patronal": iess_patronal,
                "iess_personal": iess_personal,
                "pr_h_iess": pr_h,
                "pr_q_iess": pr_q,
            })

    return rows


# ---------------------------------------------------------------------------
# Modos de salida
# ---------------------------------------------------------------------------
COLUMNS = [
    "cedula", "nombre", "area", "tipo_contrato", "fecha_ingreso", "periodo",
    "total_ingresos", "total_descuentos", "total_provisiones", "a_recibir",
    "h_ext_100", "h_ext_50", "recnocturno", "decimo_13", "decimo_14",
    "vacaciones_prov", "fondos_reserva", "iess_patronal", "iess_personal",
    "pr_h_iess", "pr_q_iess",
]


def _output_sql(rows: List[Dict[str, Any]]) -> None:
    print("-- Generado por synthetic_generator.py")
    print("-- Ejecutar después de schema.sql\n")
    print("DELETE FROM nomina;\n")

    for i in range(0, len(rows), 50):
        batch = rows[i:i + 50]
        cols = ", ".join(COLUMNS)
        print(f"INSERT INTO nomina ({cols}) VALUES")
        values_lines = []
        for r in batch:
            vals = []
            for c in COLUMNS:
                v = r[c]
                if isinstance(v, str):
                    escaped = v.replace("'", "''")
                    vals.append(f"'{escaped}'")
                else:
                    vals.append(str(v))
            values_lines.append(f"  ({', '.join(vals)})")
        print(",\n".join(values_lines) + ";\n")


def _output_csv(rows: List[Dict[str, Any]]) -> None:
    writer = csv.DictWriter(sys.stdout, fieldnames=COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({c: r[c] for c in COLUMNS})


def _output_supabase(rows: List[Dict[str, Any]]) -> None:
    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: paquete 'supabase' no instalado. Ejecuta: pip install supabase", file=sys.stderr)
        sys.exit(1)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL y SUPABASE_KEY deben estar configurados.", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    # Limpiar tabla
    print("Limpiando tabla nomina...")
    client.table("nomina").delete().neq("id", 0).execute()

    # Insertar en batches de 50
    total = len(rows)
    clean_rows = [{c: r[c] for c in COLUMNS} for r in rows]

    for i in range(0, total, 50):
        batch = clean_rows[i:i + 50]
        client.table("nomina").insert(batch).execute()
        print(f"  Insertados {min(i + 50, total)}/{total} registros...")

    print(f"Listo: {total} registros insertados en Supabase.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Generador de datos sintéticos de nómina")
    parser.add_argument(
        "--mode", choices=["sql", "csv", "supabase"], default="sql",
        help="Modo de salida (default: sql)"
    )
    args = parser.parse_args()

    employees = _generate_employees()
    rows = _generate_rows(employees)

    print(f"# Generados {len(rows)} registros para {len(employees)} empleados", file=sys.stderr)

    if args.mode == "sql":
        _output_sql(rows)
    elif args.mode == "csv":
        _output_csv(rows)
    elif args.mode == "supabase":
        _output_supabase(rows)


if __name__ == "__main__":
    main()
