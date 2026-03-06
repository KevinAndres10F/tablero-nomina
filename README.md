# PayrollOS - Tablero de Nómina

Tablero de visualización tipo Power BI con backend en FastAPI y datos de BigQuery (Google Sheets queda como alternativa opcional).

## Requisitos
- Python 3.10+
- Credenciales de servicio de Google (recomendado si la hoja no es publica)

## Backend
1. Copia el archivo de ejemplo y configura tus variables:
   - backend/.env.example → backend/.env
2. Instala dependencias:
   - pip install -r backend/requirements.txt
3. Ejecuta la API:
   - uvicorn app.main:app --reload --app-dir backend

El endpoint principal es:
- GET /api/overview

### Fuente de datos por defecto: BigQuery
El backend vuelve a operar como antes, consultando BigQuery.

Variables recomendadas en `backend/.env`:

- `DATA_SOURCE=bigquery`
- `BQ_PROJECT_ID=<tu-proyecto>`
- `BQ_DATASET=<tu-dataset>`
- `BQ_TABLE=<tu-tabla>`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON={...}`

### Fuente alternativa: Google Sheets (opcional)
Si necesitas usar Sheet temporalmente:

- `https://docs.google.com/spreadsheets/d/1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk`

Variables recomendadas en `backend/.env`:

- `DATA_SOURCE=sheets`
- `GOOGLE_SHEET_ID=1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk`
- `GOOGLE_SHEET_SOURCE_MODE=auto`

Notas de acceso:

- Si la hoja es privada, comparte la hoja con el email del Service Account usado en `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
- Si la hoja es publica, el backend puede leer por CSV sin credenciales.

### Despliegue backend en Hetzner (VPS)
El repositorio incluye plantilla lista para migrar desde Render:

- Servicio systemd: `backend/deploy/hetzner/kapiroll-api.service`
- Proxy Nginx: `backend/deploy/hetzner/kapiroll-api.nginx.conf`
- Script base de despliegue: `backend/deploy/hetzner/deploy_backend.sh`

#### 1) Preparar servidor
- Crear DNS tipo A para `api.tu-dominio.com` apuntando al VPS.
- Conectarte por SSH al servidor Hetzner.

#### 2) Ejecutar despliegue base
```bash
cd /tmp
git clone https://github.com/KevinAndres10F/tablero-nomina.git
cd tablero-nomina/backend/deploy/hetzner
chmod +x deploy_backend.sh
./deploy_backend.sh git@github.com:KevinAndres10F/tablero-nomina.git main
```

#### 3) Configurar variables de entorno en el servidor
Editar `/opt/tablero-nomina/backend/.env` con:

- `BQ_PROJECT_ID`
- `BQ_DATASET`
- `BQ_TABLE`
- `APPS_SCRIPT_CHAT_URL`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (JSON completo en una sola línea)

Luego reiniciar:
```bash
sudo systemctl restart kapiroll-api
```

#### 4) Verificar API
```bash
curl http://127.0.0.1:8000/api/health
curl http://api.tu-dominio.com/api/health
```

#### 5) Habilitar HTTPS (recomendado)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.tu-dominio.com
```

> Importante: reemplaza `api.tu-dominio.com` por tu dominio real antes de producción.

## Frontend
Abre el archivo:
- frontend/index.html

Por defecto el frontend usa `/api` en el mismo origen. Si necesitas otro host, define:

```html
<script>
   window.__KAPIROLL_API_BASE__ = "https://api.tu-dominio.com";
</script>
```

También puedes mantener frontend en Netlify y redirigir `/api/*` en `netlify.toml` al dominio de Hetzner.

### Configuracion recomendada: Backend en Render + Frontend en Netlify
La configuracion esta preparada para usar un proxy interno de Netlify hacia Render:

- Función: `netlify/functions/api-proxy.js`
- Redirect: `/api/*` → `/.netlify/functions/api-proxy/:splat`

1. Despliega/actualiza el backend en Render con `render.yaml`.
2. En Render configura variables del servicio `kapiroll-api`:

- `DATA_SOURCE=sheets`
- `GOOGLE_SHEET_ID=1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk`
- `GOOGLE_SHEET_SOURCE_MODE=api`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON={...}` (obligatorio para hoja privada)

3. En Netlify (Site settings -> Environment variables):

- `BACKEND_API_ORIGIN=https://kapiroll-api.onrender.com`
- `RENDER_API_ORIGIN=https://kapiroll-api.onrender.com` (opcional, fallback)
- `BACKEND_PROXY_TIMEOUT_MS=25000` (recomendado en Render Free)
- `NETLIFY_DIRECT_SHEETS=false`

4. Redeploy en Netlify.

Solo si quieres fallback directo desde Sheet en Netlify (no recomendado para hoja privada):

- `NETLIFY_DIRECT_SHEETS=true`

- `BACKEND_API_ORIGIN=https://kapiroll-api.onrender.com`
- `BACKEND_PROXY_TIMEOUT_MS=25000` (opcional)

Despues, redeploy del sitio para aplicar variables.

### Sin dominio (igual que Render, pero en Hetzner)
Si no tienes dominio, puedes publicar el backend con la IPv4 pública del servidor.

1. En el VPS, despliega normalmente con `backend/deploy/hetzner/deploy_backend.sh`.
2. Nginx queda escuchando en `:80` para cualquier host.
3. Prueba backend directo:
   - `curl http://TU_IPV4_DE_HETZNER/api/health`
4. En Netlify usa:
   - `BACKEND_API_ORIGIN=http://TU_IPV4_DE_HETZNER`
5. Redeploy en Netlify.

Con esto el frontend sigue usando `/api/*` (como antes con Render) y Netlify reenvía al backend en tu IP de Hetzner.

Notas del proxy Netlify:
- Si pones solo la IP (sin `http://`), el proxy la normaliza automáticamente.
- Si pones `.../api`, el proxy corrige la ruta para evitar duplicar `/api/api`.

## Variables de entorno (BigQuery + Sheets)
- DATA_SOURCE (`bigquery` o `sheets`)
- GOOGLE_SHEET_ID
- GOOGLE_SHEET_SOURCE_MODE (`auto`, `api`, `csv`)
- GOOGLE_SHEET_GID (opcional, para CSV)
- GOOGLE_SHEET_TAB (opcional, para API)
- GOOGLE_SHEET_RANGE (opcional, default `A:ZZ`)
- BQ_PROJECT_ID
- BQ_DATASET
- BQ_TABLE
- GOOGLE_APPLICATION_CREDENTIALS_JSON (opcional si Sheet publica, requerido para Sheet privada o BigQuery)

## Nota
Si `DATA_SOURCE=bigquery`, el dashboard usa BigQuery como antes. Si `DATA_SOURCE=sheets`, usa Google Sheets.
