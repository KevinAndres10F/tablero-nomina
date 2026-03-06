# Guia rapida: Render con BigQuery (modo original)

Objetivo: dejar el tablero funcionando como antes, usando BigQuery en Render.

## 1) Variables en Render (servicio `kapiroll-api`)

- `DATA_SOURCE=bigquery`
- `BQ_PROJECT_ID=<tu_project_id>`
- `BQ_DATASET=<tu_dataset>`
- `BQ_TABLE=<tu_tabla>`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON={...}`

Notas:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` debe ir en una sola linea.
- El Service Account debe tener permisos de lectura sobre la tabla de BigQuery.

## 2) Verificacion del backend

```bash
curl https://kapiroll-api.onrender.com/api/health
curl "https://kapiroll-api.onrender.com/api/overview"
```

Esperado:
- `/api/health` con `"data_source": "bigquery"`
- `/api/overview` con `employees` y `kpis` con datos

## 3) Variables en Netlify

- `BACKEND_API_ORIGIN=https://kapiroll-api.onrender.com`
- `RENDER_API_ORIGIN=https://kapiroll-api.onrender.com`
- `BACKEND_PROXY_TIMEOUT_MS=25000`
- `NETLIFY_DIRECT_SHEETS=false`

Luego hacer redeploy de Netlify.

## 4) Diagnostico rapido

1. Si `/api/health` no muestra `bigquery`, revisar `DATA_SOURCE`.
2. Si `/api/overview` devuelve `error`, revisar permisos del Service Account.
3. Si frontend falla pero backend responde, revisar variables de Netlify.
