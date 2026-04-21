/*
 * Netlify Function que atiende /api/* desde el sitio estatico del tablero.
 * Fuente unica de datos: NOMINA_EJEMPLO.xlsx (pre-procesado en build a
 * ./nomina-data.json). Si hay BACKEND_API_ORIGIN configurado se siguen
 * reenviando endpoints auxiliares (forecast, alerts, telemetry, chat).
 * El envio de correos Gmail OAuth2 sigue resolviendose directo aqui.
 */

let _nominaRows = null;

const loadNominaRows = () => {
  if (_nominaRows) return _nominaRows;
  try {
    // eslint-disable-next-line global-require
    const payload = require("./nomina-data.json");
    _nominaRows = Array.isArray(payload.rows) ? payload.rows : [];
  } catch (error) {
    console.warn("[api-proxy] no se pudo cargar nomina-data.json:", error.message);
    _nominaRows = [];
  }
  return _nominaRows;
};

const MONTH_NAMES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_NAMES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const monthNameShort = (month) => MONTH_NAMES_SHORT[month - 1] || "";
const monthNameFull = (month) => MONTH_NAMES_FULL[month - 1] || "";

const normalizePeriod = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const ymd = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${String(Number(ymd[2])).padStart(2, "0")}`;
  const compact = raw.match(/^(\d{4})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}`;
  return raw;
};

const extractYear = (periodo) => {
  const match = String(periodo || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
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
  const periodosValues = Array.from(new Set(rows.map((r) => r.periodo).filter(Boolean)))
    .sort()
    .reverse();

  const periodos = periodosValues.map((value) => {
    const m = String(value).match(/^(\d{4})-(\d{2})$/);
    if (!m) return { value, year: "", month: "", label: value };
    const year = m[1];
    const month = Number(m[2]);
    return {
      value,
      year,
      month: String(month).padStart(2, "0"),
      label: `${monthNameFull(month)} ${year}`,
    };
  });

  const years = Array.from(new Set(periodosValues.map(extractYear).filter(Boolean)))
    .sort((a, b) => b - a);

  return { areas, contratos, periodos, years };
};

const buildKpis = (rows) => {
  const totalIngresos = rows.reduce((sum, r) => sum + (r.total_ingresos || 0), 0);
  const totalProvisiones = rows.reduce((sum, r) => sum + (r.total_provisiones || 0), 0);
  const totalHorasExtras = rows.reduce((sum, r) => sum + (r.h_ext_100 || 0) + (r.h_ext_50 || 0), 0);
  const totalNeto = rows.reduce((sum, r) => sum + (r.a_recibir || 0), 0);
  const costoTotal = totalIngresos + totalProvisiones;
  const uniqueIds = new Set(rows.map((r) => r.cedula).filter(Boolean));
  const totalEmpleados = Math.max(uniqueIds.size || rows.length, 1);

  return [
    { label: "Costo Total Nomina", value: costoTotal, subtitle: `${totalEmpleados} empleados`, change_pct: 0, trend: "up", icon: "payments" },
    { label: "Costo por Empleado", value: costoTotal / totalEmpleados, subtitle: "Ingresos + Provisiones", change_pct: 0, trend: "up", icon: "person" },
    { label: "Total Provisiones", value: totalProvisiones, subtitle: "D13 + D14 + Vac + F.Res", change_pct: 0, trend: "up", icon: "savings" },
    { label: "Horas Extras", value: totalHorasExtras, subtitle: "100% + 50%", change_pct: 0, trend: "up", icon: "schedule" },
    { label: "Neto a Pagar", value: totalNeto, subtitle: "Liquido empleados", change_pct: 0, trend: "up", icon: "account_balance_wallet" },
  ];
};

const buildCostBreakdown = (rows) => {
  const totalProv = rows.reduce((s, r) => s + (r.total_provisiones || 0), 0);
  const divisor = totalProv > 0 ? totalProv : 1;
  const sum = (field) => rows.reduce((s, r) => s + (r[field] || 0), 0);
  const decimo13 = sum("decimo_13");
  const decimo14 = sum("decimo_14");
  const vacaciones = sum("vacaciones_prov");
  const fondos = sum("fondos_reserva");
  const iessPatronal = sum("iess_patronal");
  return [
    { label: "Decimo Tercero", percent: Number(((decimo13 / divisor) * 100).toFixed(1)), value: decimo13 },
    { label: "Decimo Cuarto", percent: Number(((decimo14 / divisor) * 100).toFixed(1)), value: decimo14 },
    { label: "Vacaciones", percent: Number(((vacaciones / divisor) * 100).toFixed(1)), value: vacaciones },
    { label: "Fondos Reserva", percent: Number(((fondos / divisor) * 100).toFixed(1)), value: fondos },
    { label: "IESS Patronal", percent: Number(((iessPatronal / divisor) * 100).toFixed(1)), value: iessPatronal },
  ];
};

const buildMonthlyCosts = (rows, year) => {
  const scoped = filterRows(rows, null, year);
  const grouped = new Map();

  scoped.forEach((row) => {
    const periodo = row.periodo || "Sin periodo";
    const bucket = grouped.get(periodo) || {
      periodo,
      month: periodo,
      costo_total: 0,
      ingresos: 0,
      provisiones: 0,
      descuentos: 0,
      empleados: new Set(),
    };
    bucket.costo_total += (row.total_ingresos || 0) + (row.total_provisiones || 0);
    bucket.ingresos += row.total_ingresos || 0;
    bucket.provisiones += row.total_provisiones || 0;
    bucket.descuentos += row.total_descuentos || 0;
    if (row.cedula) bucket.empleados.add(row.cedula);
    grouped.set(periodo, bucket);
  });

  return Array.from(grouped.values())
    .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
    .map((b) => {
      const m = String(b.periodo).match(/^(\d{4})-(\d{2})$/);
      return {
        periodo: b.periodo,
        month: m ? monthNameShort(Number(m[2])) : b.month,
        costo_total: b.costo_total,
        ingresos: b.ingresos,
        provisiones: b.provisiones,
        descuentos: b.descuentos,
        empleados: b.empleados.size,
      };
    });
};

const distributionBy = (rows, field) => {
  const latest = latestRowsByEmployee(rows);
  const grouped = new Map();
  latest.forEach((row) => {
    const label = row[field] || "Sin definir";
    const bucket = grouped.get(label) || { label, count: 0, value: 0 };
    bucket.count += 1;
    bucket.value += row.total_ingresos || 0;
    grouped.set(label, bucket);
  });
  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
};

const sortEmployeesForTable = (rows) => rows
  .slice()
  .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)) || (b.total_ingresos || 0) - (a.total_ingresos || 0));

const buildOverview = (rows, periodo, year) => {
  const filterOptions = buildFilterOptions(rows);

  let effectiveYear = null;
  if (year) effectiveYear = Number(year);
  else if (!periodo && filterOptions.years.length > 0) effectiveYear = filterOptions.years[0];

  const active = filterRows(rows, periodo, effectiveYear);

  return {
    kpis: buildKpis(active),
    monthly_costs: buildMonthlyCosts(rows, effectiveYear),
    cost_breakdown: buildCostBreakdown(active),
    employees: sortEmployeesForTable(active).slice(0, 500),
    distribution_contrato: distributionBy(active, "tipo_contrato"),
    distribution_area: distributionBy(active, "area"),
    currency: "USD",
    period: periodo ? normalizePeriod(periodo) : (effectiveYear ? String(effectiveYear) : "Todos los anos"),
    total_employees: active.length,
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

const computeSeasonalForecast = (monthly, horizon = 6) => {
  const series = [];
  monthly.forEach((item) => {
    let value = item.costo_total;
    if (value === undefined || value === null) {
      value = (item.total_ingresos || 0) + (item.total_provisiones || 0);
    }
    value = Number(value);
    if (!Number.isFinite(value)) return;
    const period = String(item.periodo || item.month || "");
    let monthIdx = 1;
    if (period.includes("-")) {
      const parts = period.split("-");
      if (parts[1] && /^\d+$/.test(parts[1])) {
        monthIdx = Math.max(1, Math.min(12, Number(parts[1])));
      }
    }
    series.push({ period, value, month: monthIdx });
  });

  if (series.length < 6) {
    return {
      ok: false,
      method: "seasonal-trend-v1",
      error: "Datos insuficientes para forecast robusto (minimo 6 periodos).",
      forecast: [],
    };
  }

  const values = series.map((s) => s.value);
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const trend = num / (den || 1);
  const intercept = yMean - trend * xMean;

  const monthlyResiduals = {};
  for (let m = 1; m <= 12; m += 1) monthlyResiduals[m] = [];
  series.forEach((row, i) => {
    const baseline = intercept + trend * i;
    monthlyResiduals[row.month].push(row.value - baseline);
  });
  const seasonalIndex = {};
  for (let m = 1; m <= 12; m += 1) {
    const arr = monthlyResiduals[m];
    seasonalIndex[m] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  const residuals = [];
  series.forEach((row, i) => {
    const fitted = intercept + trend * i + seasonalIndex[row.month];
    residuals.push(row.value - fitted);
  });
  const mean = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
  const variance = residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / (residuals.length || 1);
  const sigma = Math.sqrt(variance);

  const forecasts = [];
  const lastMonth = series[series.length - 1].month;
  for (let step = 1; step <= horizon; step += 1) {
    const idx = n + step - 1;
    const month = ((lastMonth - 1 + step) % 12) + 1;
    const mf = intercept + trend * idx + seasonalIndex[month];
    const lower = Math.max(0, mf - 1.96 * sigma);
    const upper = Math.max(lower, mf + 1.96 * sigma);
    forecasts.push({
      step,
      month,
      forecast: Number(mf.toFixed(2)),
      lower_95: Number(lower.toFixed(2)),
      upper_95: Number(upper.toFixed(2)),
    });
  }

  return {
    ok: true,
    method: "seasonal-trend-v1",
    trend_per_period: Number(trend.toFixed(2)),
    history_points: n,
    forecast: forecasts,
  };
};

const getPathname = (event) => {
  const raw = event.path.replace(/^\/\.netlify\/functions\/api-proxy\/?/, "");
  const splat = raw.replace(/^\/+/, "").replace(/^api\/+/, "");
  return (splat || "").split("?")[0];
};

const parseQuery = (event) => new URLSearchParams(event.rawQuery || "");

const serveFromExcel = (event) => {
  const pathname = getPathname(event);
  if (!["overview", "filters", "employees", "health", "forecast", ""].includes(pathname)) return null;

  const rows = loadNominaRows();
  const params = parseQuery(event);
  const periodo = params.get("periodo");
  const year = params.get("year");

  if (pathname === "health" || pathname === "") {
    return jsonResponse(200, {
      status: "ok",
      data_source: "excel",
      mode: "netlify-direct",
      total_rows: rows.length,
      source_file: "NOMINA_EJEMPLO.xlsx",
    });
  }

  if (pathname === "filters") {
    return jsonResponse(200, buildFilterOptions(rows));
  }

  if (pathname === "employees") {
    const limit = Number(params.get("limit") || "25");
    const offset = Number(params.get("offset") || "0");
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 25;
    const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const filtered = sortEmployeesForTable(filterRows(rows, periodo, year));
    return jsonResponse(200, {
      employees: filtered.slice(safeOffset, safeOffset + safeLimit),
      total: filtered.length,
      limit: safeLimit,
      offset: safeOffset,
    });
  }

  if (pathname === "forecast") {
    const horizon = Math.max(1, Math.min(12, Number(params.get("horizon") || "6")));
    const filterOptions = buildFilterOptions(rows);
    let effectiveYear = null;
    if (year) effectiveYear = Number(year);
    else if (filterOptions.years.length > 0) effectiveYear = filterOptions.years[0];
    const monthly = buildMonthlyCosts(rows, effectiveYear);
    return jsonResponse(200, computeSeasonalForecast(monthly, horizon));
  }

  return jsonResponse(200, buildOverview(rows, periodo, year));
};

// ---------------------------------------------------------------------------
// Gmail OAuth2 - envio de correo directo desde Netlify Function
// ---------------------------------------------------------------------------
const sendGmailOAuth2 = async (to, subject, body) => {
  const clientId = (process.env.GMAIL_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GMAIL_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.GMAIL_REFRESH_TOKEN || "").trim();
  const fromEmail = (process.env.GMAIL_FROM || "").trim();

  if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
    return {
      ok: false,
      error: "Gmail OAuth2 no configurado. Define GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN y GMAIL_FROM en Netlify.",
    };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    return { ok: false, error: `Error obteniendo access token: ${err}` };
  }

  const { access_token } = await tokenResponse.json();

  const emailLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  const raw = Buffer.from(emailLines).toString("base64url");

  const sendResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!sendResponse.ok) {
    const err = await sendResponse.text();
    return { ok: false, error: `Error enviando correo: ${err}` };
  }

  return { ok: true, message: "Alerta enviada por correo (Gmail OAuth2)." };
};

const tryHandleEmail = async (event) => {
  const pathname = getPathname(event);
  if (pathname !== "alerts/email" || event.httpMethod !== "POST") return null;

  try {
    const payload = JSON.parse(event.body || "{}");
    const to = (payload.to || "").trim();
    const subject = (payload.subject || "KAPIROLL - Alerta Operativa").trim();
    const message = (payload.message || "").trim();

    if (!to || !message) {
      return jsonResponse(400, { ok: false, error: "Faltan campos: to, message" });
    }

    const result = await sendGmailOAuth2(to, subject, message);
    return jsonResponse(result.ok ? 200 : 500, result);
  } catch (err) {
    return jsonResponse(500, { ok: false, error: `Error procesando email: ${err.message}` });
  }
};

exports.handler = async (event) => {
  // 1. Correo Gmail OAuth2 (feature interna, no proxy).
  const emailResponse = await tryHandleEmail(event);
  if (emailResponse) return emailResponse;

  // 2. Endpoints del tablero -> SIEMPRE desde el Excel embebido.
  const excelResponse = serveFromExcel(event);
  if (excelResponse) return excelResponse;

  // 3. Cualquier otra ruta no existe en este modo (sin backend externo).
  return jsonResponse(404, {
    ok: false,
    error: "Endpoint no soportado",
    path: getPathname(event),
  });
};
