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
Ahora el frontend se despliega como sitio estatico en Render (`kapiroll-web`) y consume el backend de Render (`kapiroll-api`).

Si necesitas usar otro backend, define en `frontend/index.html`:

```html
<script>
   window.__KAPIROLL_API_BASE__ = "https://api.tu-dominio.com";
</script>
```

### Despliegue completo en Render (backend + frontend)
Guia detallada paso a paso:

- `docs/GUIA_DEPLOY_RENDER_PASO_A_PASO.md`

1. En Render crea un Blueprint usando este repositorio (usa `render.yaml`).
2. Se crearán dos servicios:
- `kapiroll-api` (FastAPI)
- `kapiroll-web` (sitio estático)
3. Configura en `kapiroll-api` las variables para BigQuery:
- `DATA_SOURCE=bigquery`
- `BQ_PROJECT_ID`
- `BQ_DATASET`
- `BQ_TABLE`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
4. Haz manual deploy de ambos servicios.
5. Abre la URL pública de `kapiroll-web`.

Nota: el frontend ya viene apuntando por defecto a `https://kapiroll-api.onrender.com`.

### Alternativa con Hetzner (opcional)
Si necesitas volver a Hetzner, puedes mantener el backend en VPS y solo ajustar `window.__KAPIROLL_API_BASE__` en `frontend/index.html`.

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
