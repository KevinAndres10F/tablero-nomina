#!/usr/bin/env node
/*
 * Convierte NOMINA_EJEMPLO.xlsx (repo root) en un JSON consumido por la
 * Netlify Function api-proxy. Se ejecuta en el build de Netlify antes de
 * empaquetar las funciones. Los nombres de campo coinciden con los que
 * espera el frontend (index.html) y el backend (excel_service.py):
 *   decimo_13, decimo_14, decimo_14_c, decimo_14_s,
 *   d13_mens, d14_mens_cos, d14_mens_sie,
 *   vacaciones_prov, fondos_reserva,
 *   iess_patronal, iess_personal, pr_h_iess, pr_q_iess, seg_tiempo_parcial.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const REPO_ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = process.env.EXCEL_DATA_PATH
  ? path.resolve(process.env.EXCEL_DATA_PATH)
  : path.join(REPO_ROOT, "NOMINA_EJEMPLO.xlsx");
const OUTPUT_PATH = path.join(REPO_ROOT, "netlify", "functions", "nomina-data.json");

const toText = (value) => (value === null || value === undefined) ? "" : String(value).trim();

const toFloat = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  let raw = String(value).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!raw) return 0;
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(/,/g, ".")
      : raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    raw = raw.replace(/,/g, ".");
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const toDateStr = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(value).trim();
};

const normalizePeriod = (value) => {
  const raw = toText(value);
  if (!raw) return "";
  let m = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  m = raw.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  return raw;
};

const normalizeHeader = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toUpperCase()
  .replace(/\s+/g, " ")
  .trim();

// Diccionario de encabezados esperados -> indice de primera ocurrencia,
// y un override para FOND.RESERVA (usar la SEGUNDA ocurrencia, provisiones).
const buildHeaderIndex = (headerRow) => {
  const normalized = headerRow.map((h) => normalizeHeader(h));
  const first = {};
  const all = {};
  normalized.forEach((name, idx) => {
    if (!name) return;
    if (first[name] === undefined) first[name] = idx;
    (all[name] = all[name] || []).push(idx);
  });
  // Para FOND.RESERVA se usa la segunda ocurrencia (provisiones).
  if (all["FOND.RESERVA"] && all["FOND.RESERVA"].length >= 2) {
    first["FOND.RESERVA_PROV"] = all["FOND.RESERVA"][1];
  }
  return first;
};

function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`[build-nomina-data] No se encontro el Excel en ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  // Encontrar la fila de encabezados buscando "NOMBRES"; datos empiezan en la siguiente.
  let headerIdx = rows.findIndex((row) => (row || []).some((cell) =>
    normalizeHeader(cell) === "NOMBRES"));
  if (headerIdx < 0) headerIdx = 2; // fallback: fila 3 de Excel
  const dataStart = headerIdx + 1;
  const col = buildHeaderIndex(rows[headerIdx] || []);

  const g = (raw, name) => {
    const idx = col[name];
    return idx === undefined ? null : raw[idx];
  };

  const data = [];
  for (let i = dataStart; i < rows.length; i += 1) {
    const raw = rows[i] || [];
    const nombre = toText(g(raw, "NOMBRES"));
    const cedula = toText(g(raw, "CEDULA"));
    if (!nombre && !cedula) continue;

    const decimo14c = toFloat(g(raw, "DECIMO 14 C"));
    const decimo14s = toFloat(g(raw, "DECIMO 14 S"));
    const h_ext_100 = toFloat(g(raw, "VALOR HORAS EXT 100%"));
    const h_ext_50 = 0; // el archivo solo trae 100%

    data.push({
      nombre,
      cedula,
      genero: toText(g(raw, "GENERO")),
      discapacidad: toText(g(raw, "DISCAPACIDAD")).toUpperCase().startsWith("S"),
      tipo_contrato: toText(g(raw, "TIPO CONTRATO")),
      // El backend y el frontend usan CLASS como "area" (Premium / Outlet / Regular)
      area: toText(g(raw, "CLASS")),
      canal_venta: toText(g(raw, "CANAL DE VENTA")),
      cargo: toText(g(raw, "CARGO")),
      centro_costo: toText(g(raw, "CENTRO DE COSTO")),
      location: toText(g(raw, "LOCATION")),
      mall: toText(g(raw, "MALL")),
      provincia: toText(g(raw, "PROVINCIA")),
      ciudad: toText(g(raw, "CIUDAD")),
      region: toText(g(raw, "REGION")),
      jornada: toText(g(raw, "JORNADA")),
      fecha_ingreso: toDateStr(g(raw, "FEC_INGRESO")),
      fecha_salida: toDateStr(g(raw, "FEC_SALIDA")),
      periodo: normalizePeriod(g(raw, "PERIODO")),

      total_ingresos:    toFloat(g(raw, "TOTAL INGRESOS")),
      total_descuentos:  toFloat(g(raw, "TOTAL DESCUENTOS")),
      total_provisiones: toFloat(g(raw, "TOTAL PROVISIONES")),
      a_recibir:         toFloat(g(raw, "VALOR A RECIBIR")),

      h_ext_100,
      h_ext_50,
      horas_extras: h_ext_100 + h_ext_50,
      recnocturno:  toFloat(g(raw, "VALOR REC.NOCTURNO")),

      decimo_13:   toFloat(g(raw, "DECIMO 13")),
      decimo_14_c: decimo14c,
      decimo_14_s: decimo14s,
      decimo_14:   decimo14c + decimo14s,
      d13_mens:     toFloat(g(raw, "D13 MENS")),
      d14_mens_cos: toFloat(g(raw, "D14 MENS COS")),
      d14_mens_sie: toFloat(g(raw, "D14 MENS SIE")),

      vacaciones_prov: toFloat(g(raw, "VACACIONES")),
      // FOND.RESERVA aparece dos veces (ingresos + provisiones); usamos la de provisiones.
      fondos_reserva:  toFloat(g(raw, "FOND.RESERVA_PROV") ?? g(raw, "FOND.RESERVA")),
      iess_patronal:   toFloat(g(raw, "IESS PATRONA") ?? g(raw, "IESS PATRONAL")),
      iess_personal:   toFloat(g(raw, "IESSPERSONAL") ?? g(raw, "IESS PERSONAL")),
      pr_h_iess: toFloat(g(raw, "PR. H IESS")),
      pr_q_iess: toFloat(g(raw, "PR. Q IESS")),
      seg_tiempo_parcial: toFloat(g(raw, "AD 4.41 JP")),
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ rows: data }));
  console.log(`[build-nomina-data] ${data.length} filas escritas en ${OUTPUT_PATH}`);
}

main();
