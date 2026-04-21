#!/usr/bin/env node
/*
 * Convierte NOMINA_EJEMPLO.xlsx (repo root) en un JSON consumido por la
 * Netlify Function api-proxy. Se ejecuta en el build de Netlify antes de
 * empaquetar las funciones. Mismo mapeo que backend/app/services/excel_service.py
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const REPO_ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = process.env.EXCEL_DATA_PATH
  ? path.resolve(process.env.EXCEL_DATA_PATH)
  : path.join(REPO_ROOT, "NOMINA_EJEMPLO.xlsx");
const OUTPUT_PATH = path.join(REPO_ROOT, "netlify", "functions", "nomina-data.json");

// sheet_to_json recorta la columna A vacia, asi que el indice 0 del array
// corresponde a la columna B (NOMBRES).
const COLUMN_MAP = {
  0: "nombre",
  1: "cedula",
  2: "genero",
  3: "fecha_nacimiento",
  4: "edad",
  5: "discapacidad",
  6: "porc_discapacidad",
  7: "tipo_contrato",
  8: "fecha_ingreso",
  9: "fecha_salida",
  10: "motivo_salida",
  11: "cargo",
  12: "centro_costo",
  13: "location",
  14: "class_",
  15: "area",            // CANAL DE VENTA se usa como area en el tablero.
  16: "mall",
  17: "provincia",
  18: "ciudad",
  19: "region",
  20: "jornada",
  21: "periodo",
  22: "dias_trabajados",
  23: "remun_unif",
  24: "horas_recnocturno",
  25: "recnocturno",
  26: "num_h_ext_100",
  27: "h_ext_100",
  28: "bono",
  29: "comisiones",
  30: "d14_mens_cos",
  31: "d14_mensual",
  32: "d13_mensual",
  33: "fondo_reserva_mensual",
  34: "total_ingresos",
  35: "pr_h_iess",
  36: "pr_q_iess",
  37: "iess_personal",
  38: "imp_renta",
  39: "seg_medico",
  40: "total_descuentos",
  41: "a_recibir",
  42: "ad_441_jp",
  43: "decimo_13",
  44: "decimo_14_c",
  45: "decimo_14",
  46: "fondos_reserva",
  47: "iess_patronal",
  48: "prov_bono",
  49: "vacaciones_prov",
  50: "total_provisiones",
};

const STRING_FIELDS = new Set([
  "nombre", "cedula", "genero", "discapacidad", "tipo_contrato",
  "motivo_salida", "cargo", "centro_costo", "location", "class_",
  "area", "mall", "provincia", "ciudad", "region", "jornada",
]);
const DATE_FIELDS = new Set(["fecha_nacimiento", "fecha_ingreso", "fecha_salida"]);

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

function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`[build-nomina-data] No se encontro el Excel en ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  // Encontrar la fila de encabezados buscando "NOMBRES"; datos empiezan en la siguiente.
  let headerIdx = rows.findIndex((row) => (row || []).some((cell) => String(cell || "").trim().toUpperCase() === "NOMBRES"));
  if (headerIdx < 0) headerIdx = 2; // fallback: suponer row 3
  const dataStart = headerIdx + 1;

  const data = [];
  for (let i = dataStart; i < rows.length; i += 1) {
    const rawRow = rows[i] || [];
    const mapped = { h_ext_50: 0, horas_extras: 0 };

    for (const [idxStr, key] of Object.entries(COLUMN_MAP)) {
      const idx = Number(idxStr);
      const value = idx < rawRow.length ? rawRow[idx] : null;

      if (key === "periodo") mapped[key] = normalizePeriod(value);
      else if (DATE_FIELDS.has(key)) mapped[key] = toDateStr(value);
      else if (STRING_FIELDS.has(key)) mapped[key] = toText(value);
      else mapped[key] = toFloat(value);
    }

    mapped.horas_extras = (mapped.h_ext_100 || 0) + (mapped.h_ext_50 || 0);
    if (mapped.cedula || mapped.nombre) data.push(mapped);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ rows: data }));
  console.log(`[build-nomina-data] ${data.length} filas escritas en ${OUTPUT_PATH}`);
}

main();
