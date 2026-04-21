# PayrollOS - Tablero de Nómina

Tablero tipo Power BI para visualizar una nómina exportada a Excel. La única fuente de datos es el archivo `NOMINA_EJEMPLO.xlsx` incluido en el repositorio: no hay BigQuery, Google Sheets, Supabase ni backend en Render. El sitio se publica como estático en Netlify y las llamadas a `/api/*` se resuelven con una Netlify Function que lee una instantánea del Excel generada en build.

## Estructura del repositorio
```
.
├── NOMINA_EJEMPLO.xlsx         ← fuente única de datos
├── scripts/
│   └── build_nomina_data.js    ← convierte el Excel en JSON para la Netlify Function
├── netlify/
│   └── functions/
│       ├── api-proxy.js        ← sirve /api/overview, /api/filters, /api/employees, /api/forecast, /api/health
│       └── nomina-data.json    ← generado por build:data (no se versiona)
├── netlify.toml                ← configuración de Netlify
├── package.json                ← dependencias (xlsx) y script build:data
├── frontend/
│   ├── index.html              ← dashboard
│   ├── kapi-redesign.html
│   └── landing.html
└── backend/                    ← FastAPI opcional para correr localmente contra el Excel
```

## Despliegue (Netlify)
1. Crear el sitio apuntando a este repo.
2. Netlify ejecuta automáticamente:
   ```bash
   npm install && npm run build:data
   ```
   `build:data` lee `NOMINA_EJEMPLO.xlsx` y escribe `netlify/functions/nomina-data.json`.
3. La Function `api-proxy` responde todas las rutas `/api/*` desde ese JSON.

### Variables de entorno en Netlify
No se necesita ninguna para mostrar datos. Si se quieren **alertas por correo** (botón "Enviar correo" del tablero), configurar las de Gmail OAuth2:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM`

Cualquier otra env var antigua (`DATA_SOURCE`, `BACKEND_API_ORIGIN`, `SUPABASE_*`, `GOOGLE_AI_KEY`, `BQ_*`, `GOOGLE_SHEET_*`) ya no se lee y puede borrarse.

### Cambiar los datos
Reemplazar `NOMINA_EJEMPLO.xlsx` en la raíz del repo (manteniendo el mismo formato: encabezados en la fila 3, datos desde la fila 4) y hacer commit. Netlify regenerará el JSON automáticamente en el próximo deploy.

## Backend FastAPI (opcional)
Para correr una API local contra el mismo Excel:

```bash
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --app-dir backend
```

Endpoints:
- `GET /api/health`
- `GET /api/filters`
- `GET /api/overview?year=2025&periodo=2025-03`
- `GET /api/employees?limit=25&offset=0`
- `GET /api/forecast?year=2025&horizon=6`
- `POST /api/alerts/email`  (requiere `SMTP_*` env vars)
- `POST /api/telemetry/events`

## Formato del Excel
`NOMINA_EJEMPLO.xlsx`, hoja única. Fila 3 = encabezados; datos desde la fila 4. Columnas clave:

- Identidad y contrato: `NOMBRES`, `CEDULA`, `GENERO`, `TIPO CONTRATO`, `FEC_INGRESO`, `FEC_SALIDA`, `CLASS` (usado como `area`), `CANAL DE VENTA`, `MALL`, `PROVINCIA`, `CIUDAD`, `REGION`, `JORNADA`, `CARGO`.
- Periodo: `PERIODO` (formato `YYYY-MM`).
- Ingresos/descuentos/provisiones: `TOTAL INGRESOS`, `TOTAL DESCUENTOS`, `TOTAL PROVISIONES`, `VALOR A RECIBIR`.
- Detalle: `VALOR HORAS EXT 100%`, `VALOR REC.NOCTURNO`, `DECIMO 13`, `DECIMO 14 C`, `DECIMO 14 S`, `D13 MENS`, `D14 MENS COS`, `D14 MENS SIE`, `VACACIONES`, `FOND.RESERVA`, `IESS PATRONA`, `IESSPERSONAL`, `PR. H IESS`, `PR. Q IESS`, `AD 4.41 JP`.
