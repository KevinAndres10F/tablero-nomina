# Guia de migracion a Hetzner + deploy en GitHub

Esta guia deja documentado el proceso para migrar el backend a Hetzner sin perder el avance actual, y mantener despliegues desde GitHub.

## 1) Estado actual del proyecto

- Frontend: Netlify
- Backend: FastAPI
- Configuracion de Hetzner ya existente en:
  - `backend/deploy/hetzner/deploy_backend.sh`
  - `backend/deploy/hetzner/kapiroll-api.service`
  - `backend/deploy/hetzner/kapiroll-api.nginx.conf`
- Fuente de datos actual recomendada para tablero:
  - `DATA_SOURCE=sheets`
  - `GOOGLE_SHEET_ID=1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk`

## 2) Preparar VPS en Hetzner

1. Crear servidor Ubuntu 24.04 LTS.
2. Crear usuario de despliegue (ejemplo `deploy`) y habilitar SSH key.
3. Abrir puertos en firewall:
   - `22` (SSH)
   - `80` (HTTP)
   - `443` (HTTPS)
4. Configurar DNS:
   - `api.tu-dominio.com` -> IP publica del VPS.

## 3) Desplegar backend en Hetzner (primer despliegue)

En el servidor:

```bash
cd /tmp
git clone https://github.com/KevinAndres10F/tablero-nomina.git
cd tablero-nomina/backend/deploy/hetzner
chmod +x deploy_backend.sh
./deploy_backend.sh git@github.com:KevinAndres10F/tablero-nomina.git main
```

## 4) Variables de entorno en Hetzner

Editar:

```bash
sudo nano /opt/tablero-nomina/backend/.env
```

Config minima recomendada para seguir operando con Google Sheets:

```env
DATA_SOURCE=sheets
GOOGLE_SHEET_ID=1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk
GOOGLE_SHEET_SOURCE_MODE=auto
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB=
GOOGLE_SHEET_RANGE=A:ZZ

APPS_SCRIPT_CHAT_URL=https://script.google.com/macros/s/AKfycbzOoZm5eWkQtxg6waM0zDDT5H9DZCT1ykfgBlGWnmSi37pwmnPHLWbxd1r7T2aGgV_7/exec

# Opcional para hoja privada o para volver a BigQuery
GOOGLE_APPLICATION_CREDENTIALS_JSON={...}

# BigQuery (solo si DATA_SOURCE=bigquery)
BQ_PROJECT_ID=
BQ_DATASET=
BQ_TABLE=
```

Reiniciar servicio:

```bash
sudo systemctl restart kapiroll-api
sudo systemctl status kapiroll-api --no-pager
```

## 5) Verificacion post-despliegue

```bash
curl http://127.0.0.1:8000/api/health
curl http://api.tu-dominio.com/api/health
curl "http://api.tu-dominio.com/api/overview"
```

Resultado esperado en `/api/health`:
- `"status": "ok"`
- `"data_source": "sheets"`

## 6) HTTPS (recomendado)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.tu-dominio.com
```

## 7) Integracion con Netlify

En Netlify, definir:

- `BACKEND_API_ORIGIN=http://TU_IPV4_O_DOMINIO_DE_HETZNER`
- `BACKEND_PROXY_TIMEOUT_MS=15000`

Luego hacer redeploy del frontend.

## 8) Flujo de deploy desde GitHub

Flujo recomendado (manual, estable y simple):

1. Hacer cambios locales.
2. Commit y push a `main`.
3. En el VPS ejecutar script de actualizacion (o `git pull` + restart servicio).

Comandos locales:

```bash
git add .
git commit -m "feat: actualiza backend y guia de migracion hetzner"
git push origin main
```

Comandos en VPS (si no tienes pipeline automatizado):

```bash
cd /opt/tablero-nomina
git pull origin main
sudo systemctl restart kapiroll-api
sudo systemctl status kapiroll-api --no-pager
```

## 9) Volver a BigQuery cuando se solucione Hetzner

Solo cambia variables y reinicia:

```env
DATA_SOURCE=bigquery
BQ_PROJECT_ID=...
BQ_DATASET=...
BQ_TABLE=...
GOOGLE_APPLICATION_CREDENTIALS_JSON={...}
```

```bash
sudo systemctl restart kapiroll-api
```

No se elimina nada del avance con Hetzner ni de la integracion actual.
