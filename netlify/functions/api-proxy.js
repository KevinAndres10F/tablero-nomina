const DEFAULT_SHEET_ID = "1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk";

const normalizeBackendOrigin = (rawOrigin) => {
  if (!rawOrigin) return "";

  const trimmed = rawOrigin.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withProtocol.replace(/\/api\/?$/i, "").replace(/\/$/, "");
};

const monthNameShort = (month) => {
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return names[month - 1] || "";
};

const normalizeText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const normalizeHeader = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, "");

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  const raw = String(value).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!raw) return 0;

  let cleaned = raw;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(/,/g, ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/,/g, ".");
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const normalizePeriod = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const ymd = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${String(Number(ymd[2])).padStart(2, "0")}`;
  }

  const compact = raw.match(/^(\d{4})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}`;
  }

  return raw;
};

const extractYear = (periodo) => {
  const match = String(periodo || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
};

const resolveCanonicalKey = (rawHeader) => {
  const key = normalizeHeader(rawHeader);
  const map = {
    cedula: "cedula",
    identificacion: "cedula",
    documento: "cedula",
    nombres: "nombre",
    nombre: "nombre",
    apellidosynombres: "nombre",
    nombresyapellidos: "nombre",
    nombrecompleto: "nombre",
    area: "area",
    departamento: "area",
    tipocontrato: "tipo_contrato",
    contrato: "tipo_contrato",
    fechaingreso: "fecha_ingreso",
    periodo: "periodo",
    mes: "periodo",
    totalingresos: "total_ingresos",
    ingresos: "total_ingresos",
    totaldescuentos: "total_descuentos",
    descuentos: "total_descuentos",
    totalprovisiones: "total_provisiones",
    provisiones: "total_provisiones",
    arecibir: "a_recibir",
    neto: "a_recibir",
    hext100: "h_ext_100",
    h_ext_100: "h_ext_100",
    hext50: "h_ext_50",
    h_ext_50: "h_ext_50",
    recnocturno: "recnocturno",
    decimo13: "decimo_13",
    d13: "decimo_13",
    decimo14: "decimo_14",
    decimo14s: "decimo_14",
    d14: "decimo_14",
    vacacionesprovisiones: "vacaciones_prov",
    vacaciones: "vacaciones_prov",
    fondreserva: "fondos_reserva",
    fondoreserva: "fondos_reserva",
    iesspatronal: "iess_patronal",
    iesspersonal: "iess_personal",
    prhiess: "pr_h_iess",
    prqiess: "pr_q_iess",
  };

  if (map[key]) return map[key];
  if (key.includes("ingres")) return "total_ingresos";
  if (key.includes("descuent")) return "total_descuentos";
  if (key.includes("provision")) return "total_provisiones";
  if (key.includes("period")) return "periodo";
  if (key.includes("contrato")) return "tipo_contrato";
  if (key.includes("area") || key.includes("depart")) return "area";
  if (key.includes("ced") || key.includes("ident")) return "cedula";
  if (key.includes("nombre") || key.includes("apellido")) return "nombre";
  return "";
};

const emptyEmployee = () => ({
  cedula: "",
  nombre: "",
  area: "",
  tipo_contrato: "",
  fecha_ingreso: "",
  periodo: "",
  total_ingresos: 0,
  total_descuentos: 0,
  total_provisiones: 0,
  a_recibir: 0,
  h_ext_100: 0,
  h_ext_50: 0,
  recnocturno: 0,
  decimo_13: 0,
  decimo_14: 0,
  vacaciones_prov: 0,
  fondos_reserva: 0,
  iess_patronal: 0,
  iess_personal: 0,
  pr_h_iess: 0,
  pr_q_iess: 0,
  horas_extras: 0,
});

const parseCsv = (csv) => {
  const lines = String(csv || "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const splitCsvLine = (line) => {
    const out = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out.map((cell) => cell.trim());
  };

  const headers = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row = emptyEmployee();

    headers.forEach((header, idx) => {
      const canonical = resolveCanonicalKey(header);
      if (!canonical) return;

      const value = values[idx] ?? "";
      if (["cedula", "nombre", "area", "tipo_contrato", "fecha_ingreso"].includes(canonical)) {
        row[canonical] = String(value || "").trim();
      } else if (canonical === "periodo") {
        row[canonical] = normalizePeriod(value);
      } else {
        row[canonical] = toNumber(value);
      }
    });

    row.horas_extras = row.h_ext_100 + row.h_ext_50;
    if (row.cedula || row.nombre || row.periodo || row.total_ingresos || row.a_recibir) {
      rows.push(row);
    }
  }

  return rows;
};

const fetchSheetRows = async () => {
  const explicitUrl = (process.env.GOOGLE_SHEET_CSV_URL || "").trim();
  const sheetId = (process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID).trim();
  const gid = (process.env.GOOGLE_SHEET_GID || "0").trim();
  const csvUrl = explicitUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const response = await fetch(csvUrl, {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Google Sheet CSV HTTP ${response.status}`);
  }
  if (/<!DOCTYPE html>/i.test(body)) {
    throw new Error("Google Sheet devolvio HTML. Revisa permisos/publicacion del documento");
  }

  return parseCsv(body);
};

const filterRows = (rows, periodo, year) => {
  if (periodo) {
    const p = normalizePeriod(periodo);
    return rows.filter((row) => row.periodo === p);
  }
  if (year) {
    const y = Number(year);
    return rows.filter((row) => extractYear(row.periodo) === y);
  }
  return rows;
};

const latestRowsByEmployee = (rows) => {
  const latest = new Map();
  rows.forEach((row) => {
    const key = row.cedula || row.nombre;
    if (!key) return;
    const current = latest.get(key);
    if (!current || String(row.periodo || "") > String(current.periodo || "")) {
      latest.set(key, row);
    }
  });
  return Array.from(latest.values());
};

const buildFilterOptions = (rows) => {
  const areas = Array.from(new Set(rows.map((r) => r.area).filter(Boolean))).sort();
  const contratos = Array.from(new Set(rows.map((r) => r.tipo_contrato).filter(Boolean))).sort();
  const periodosValues = Array.from(new Set(rows.map((r) => r.periodo).filter(Boolean))).sort().reverse();

  const periodos = periodosValues.map((value) => {
    const m = String(value).match(/^(\d{4})-(\d{2})$/);
    if (!m) {
      return { value, year: "", month: "", label: value };
    }
    const year = m[1];
    const month = Number(m[2]);
    return {
      value,
      year,
      month: String(month).padStart(2, "0"),
      label: `${monthNameShort(month)} ${year}`,
    };
  });

  const years = Array.from(new Set(periodosValues.map(extractYear).filter(Boolean))).sort((a, b) => b - a);
  return { areas, contratos, periodos, years };
};

const buildOverviewFromRows = (rows, periodo, year) => {
  const filterOptions = buildFilterOptions(rows);
  const effectiveYear = !periodo && !year && filterOptions.years.length > 0 ? filterOptions.years[0] : (year ? Number(year) : null);
  const active = filterRows(rows, periodo, effectiveYear);

  const totalIngresos = active.reduce((sum, row) => sum + row.total_ingresos, 0);
  const totalProvisiones = active.reduce((sum, row) => sum + row.total_provisiones, 0);
  const totalDescuentos = active.reduce((sum, row) => sum + row.total_descuentos, 0);
  const totalNeto = active.reduce((sum, row) => sum + row.a_recibir, 0);
  const totalHorasExtras = active.reduce((sum, row) => sum + row.h_ext_100 + row.h_ext_50, 0);
  const totalEmpleados = active.length;
  const costoTotal = totalIngresos + totalProvisiones;
  const costoPorEmpleado = totalEmpleados > 0 ? costoTotal / totalEmpleados : 0;

  const monthlyMap = new Map();
  filterRows(rows, null, effectiveYear).forEach((row) => {
    const periodoKey = row.periodo || "Sin periodo";
    const current = monthlyMap.get(periodoKey) || {
      periodo: periodoKey,
      month: periodoKey,
      costo_total: 0,
      ingresos: 0,
      provisiones: 0,
      descuentos: 0,
      empleados: new Set(),
    };
    current.costo_total += row.total_ingresos + row.total_provisiones;
    current.ingresos += row.total_ingresos;
    current.provisiones += row.total_provisiones;
    current.descuentos += row.total_descuentos;
    if (row.cedula) current.empleados.add(row.cedula);
    monthlyMap.set(periodoKey, current);
  });
  const monthlyCosts = Array.from(monthlyMap.values())
    .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
    .map((item) => {
      const m = String(item.periodo).match(/^(\d{4})-(\d{2})$/);
      return {
        periodo: item.periodo,
        month: m ? monthNameShort(Number(m[2])) : item.month,
        costo_total: item.costo_total,
        ingresos: item.ingresos,
        provisiones: item.provisiones,
        descuentos: item.descuentos,
        empleados: item.empleados.size,
      };
    });

  const totalProvSafe = totalProvisiones > 0 ? totalProvisiones : 1;
  const decimo13 = active.reduce((sum, row) => sum + row.decimo_13, 0);
  const decimo14 = active.reduce((sum, row) => sum + row.decimo_14, 0);
  const vacaciones = active.reduce((sum, row) => sum + row.vacaciones_prov, 0);
  const fondos = active.reduce((sum, row) => sum + row.fondos_reserva, 0);
  const iessPatronal = active.reduce((sum, row) => sum + row.iess_patronal, 0);
  const costBreakdown = [
    { label: "Decimo Tercero", percent: Number(((decimo13 / totalProvSafe) * 100).toFixed(1)), value: decimo13 },
    { label: "Decimo Cuarto", percent: Number(((decimo14 / totalProvSafe) * 100).toFixed(1)), value: decimo14 },
    { label: "Vacaciones", percent: Number(((vacaciones / totalProvSafe) * 100).toFixed(1)), value: vacaciones },
    { label: "Fondos Reserva", percent: Number(((fondos / totalProvSafe) * 100).toFixed(1)), value: fondos },
    { label: "IESS Patronal", percent: Number(((iessPatronal / totalProvSafe) * 100).toFixed(1)), value: iessPatronal },
  ];

  const latestRows = latestRowsByEmployee(active);
  const distributionBy = (field) => {
    const grouped = new Map();
    latestRows.forEach((row) => {
      const label = row[field] || "Sin definir";
      const current = grouped.get(label) || { label, count: 0, value: 0 };
      current.count += 1;
      current.value += row.total_ingresos;
      grouped.set(label, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  };

  return {
    kpis: [
      { label: "Costo Total Nomina", value: costoTotal, subtitle: `${totalEmpleados} empleados`, change_pct: 0, trend: "up", icon: "payments" },
      { label: "Costo por Empleado", value: costoPorEmpleado, subtitle: "Ingresos + Provisiones", change_pct: 0, trend: "up", icon: "person" },
      { label: "Total Provisiones", value: totalProvisiones, subtitle: "D13 + D14 + Vac + F.Res", change_pct: 0, trend: "up", icon: "savings" },
      { label: "Horas Extras", value: totalHorasExtras, subtitle: "100% + 50%", change_pct: 0, trend: "up", icon: "schedule" },
      { label: "Neto a Pagar", value: totalNeto, subtitle: "Liquido empleados", change_pct: 0, trend: "up", icon: "account_balance_wallet" },
    ],
    monthly_costs: monthlyCosts,
    cost_breakdown: costBreakdown,
    employees: active
      .slice()
      .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)) || b.total_ingresos - a.total_ingresos)
      .slice(0, 500),
    distribution_contrato: distributionBy("tipo_contrato"),
    distribution_area: distributionBy("area"),
    currency: "USD",
    period: periodo ? normalizePeriod(periodo) : (effectiveYear || "Todos los anos"),
    total_employees: totalEmpleados,
    filter_options: filterOptions,
    selected_year: effectiveYear,
    selected_periodo: periodo ? normalizePeriod(periodo) : null,
  };
};

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
  },
  body: JSON.stringify(payload),
});

const tryServeFromSheet = async (event) => {
  const rawSplat = event.path.replace(/^\/\.netlify\/functions\/api-proxy\/?/, "");
  const splat = rawSplat.replace(/^\/+/, "").replace(/^api\/+/, "");
  const pathname = (splat || "").split("?")[0];

  if (!["overview", "filters", "employees", "health", ""].includes(pathname)) {
    return null;
  }

  const params = new URLSearchParams(event.rawQuery || "");
  const periodo = params.get("periodo");
  const year = params.get("year");
  const limit = Number(params.get("limit") || "25");
  const offset = Number(params.get("offset") || "0");

  try {
    const rows = await fetchSheetRows();

    if (pathname === "health" || pathname === "") {
      return jsonResponse(200, {
        status: "ok",
        data_source: "sheets",
        mode: "netlify-direct",
        google_sheet_id: (process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID),
      });
    }

    if (pathname === "filters") {
      return jsonResponse(200, buildFilterOptions(rows));
    }

    if (pathname === "employees") {
      const filtered = filterRows(rows, periodo, year)
        .slice()
        .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)) || b.total_ingresos - a.total_ingresos);
      const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 25;
      const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
      return jsonResponse(200, {
        employees: filtered.slice(safeOffset, safeOffset + safeLimit),
        total: filtered.length,
        limit: safeLimit,
        offset: safeOffset,
      });
    }

    const overview = buildOverviewFromRows(rows, periodo, year);
    return jsonResponse(200, overview);
  } catch (error) {
    return jsonResponse(200, {
      kpis: [],
      monthly_costs: [],
      cost_breakdown: [],
      employees: [],
      distribution_contrato: [],
      distribution_area: [],
      currency: "USD",
      period: "N/D",
      total_employees: 0,
      filter_options: { areas: [], contratos: [], periodos: [], years: [] },
      data_source: "sheets",
      error: `No se pudo leer Google Sheet en Netlify: ${error.message}`,
    });
  }
};

const proxyRequest = async (targetUrl, event, timeoutMs) => {
  const headers = { ...event.headers };
  delete headers.host;
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers["x-nf-client-connection-ip"];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
      signal: controller.signal,
    });
    const responseBody = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    };
  } finally {
    clearTimeout(timeout);
  }
};

exports.handler = async (event) => {
  const backendOrigin = normalizeBackendOrigin(process.env.BACKEND_API_ORIGIN || "");

  const forceSheetsOnly = (process.env.DATA_SOURCE || "sheets").toLowerCase() === "sheets";

  // Si se configura modo sheets o no hay backend, responde directo desde Google Sheet.
  if (forceSheetsOnly || !backendOrigin) {
    const sheetResponse = await tryServeFromSheet(event);
    if (sheetResponse) return sheetResponse;
  }

  if (!backendOrigin) {
    return jsonResponse(500, {
      ok: false,
      error: "Falta BACKEND_API_ORIGIN y no se pudo servir desde Google Sheet",
    });
  }

  const rawSplat = event.path.replace(/^\/\.netlify\/functions\/api-proxy\/?/, "");
  const splat = rawSplat.replace(/^\/+/, "").replace(/^api\/+/, "");
  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const targetUrl = splat
    ? `${backendOrigin}/api/${splat}${query}`
    : `${backendOrigin}/api${query}`;

  const timeoutMs = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 15000);

  try {
    return await proxyRequest(targetUrl, event, timeoutMs);
  } catch (error) {
    // Fallback: si backend falla, intenta servir directamente desde Google Sheet.
    const sheetResponse = await tryServeFromSheet(event);
    if (sheetResponse) return sheetResponse;

    try {
      return await proxyRequest(targetUrl, event, timeoutMs);
    } catch (retryError) {
      return jsonResponse(502, {
        ok: false,
        error: "No se pudo conectar con el backend en Hetzner",
        detail: retryError.message,
        target: targetUrl,
      });
    }
  }
};
