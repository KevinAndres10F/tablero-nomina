import { createRoot } from "react-dom/client";
import Kapibot from "./components/Kapibot";

declare global {
  interface Window {
    __getKapibotContext?: () => Record<string, unknown>;
  }
}

function buildPageContext(): string {
  const ctx = window.__getKapibotContext?.();
  if (!ctx) return "Dashboard aún no ha cargado datos.";

  const lines: string[] = [];
  const now = new Date();
  lines.push(`Fecha: ${now.toISOString().slice(0, 10)}.`);

  if (ctx.totalEmpleados != null) {
    lines.push(`Empleados: ${ctx.totalEmpleados} total (filtrados: ${ctx.empleadosFiltrados ?? ctx.totalEmpleados}).`);
  }

  // KPIs
  const kpis = ctx.kpis as Array<{ label: string; value: number; subtitle?: string }> | undefined;
  if (kpis && kpis.length > 0) {
    const kpiStr = kpis.map((k) => `${k.label} $${Math.round(k.value).toLocaleString("es-EC")}`).join(" | ");
    lines.push(`KPIs: ${kpiStr}.`);
  }

  // Monthly costs
  const monthly = ctx.monthlyCosts as Array<{ month?: string; periodo?: string; costo_total?: number }> | undefined;
  if (monthly && monthly.length > 0) {
    const monthStr = monthly
      .map((m) => `${m.month || m.periodo}: $${Math.round(m.costo_total || 0).toLocaleString("es-EC")}`)
      .join(", ");
    lines.push(`Costos mensuales: ${monthStr}.`);
  }

  // Cost breakdown
  const breakdown = ctx.costBreakdown as Array<{ label: string; percent: number; value: number }> | undefined;
  if (breakdown && breakdown.length > 0) {
    const bStr = breakdown.map((b) => `${b.label} ${b.percent}%`).join(", ");
    lines.push(`Desglose provisiones: ${bStr}.`);
  }

  // Areas
  const areas = ctx.areas as string[] | undefined;
  if (areas && areas.length > 0) {
    lines.push(`Áreas: ${areas.join(", ")}.`);
  }

  // Per-area cost breakdown for causal analysis
  const areaBreakdown = ctx.areaBreakdown as Array<{ area: string; cost: number; employees: number; avgSalary: number; overtimeTotal: number }> | undefined;
  if (areaBreakdown && areaBreakdown.length > 0) {
    const areaStr = areaBreakdown
      .map((a) => `${a.area}: $${Math.round(a.cost).toLocaleString("es-EC")} (${a.employees} emp, prom $${Math.round(a.avgSalary).toLocaleString("es-EC")}, HE: $${Math.round(a.overtimeTotal).toLocaleString("es-EC")})`)
      .join("; ");
    lines.push(`Desglose por area: ${areaStr}.`);
  }

  // Active filters
  const filters = ctx.filters as Record<string, string> | undefined;
  if (filters) {
    const activeFilters = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    if (activeFilters) {
      lines.push(`Filtros activos: ${activeFilters}.`);
    }
  }

  return lines.join("\n");
}

// Mount when DOM is ready
function mount() {
  let container = document.getElementById("kapibot-react-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "kapibot-react-root";
    document.body.appendChild(container);
  }

  const root = createRoot(container);
  root.render(<Kapibot getContext={buildPageContext} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
