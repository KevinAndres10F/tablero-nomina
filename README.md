# PayrollOS - Tablero de Nómina

Tablero de visualización tipo Power BI con backend en FastAPI y datos de BigQuery.

## Requisitos
- Python 3.10+
- Credenciales de servicio de BigQuery (opcional para usar datos reales)

## Backend
1. Copia el archivo de ejemplo y configura tus variables:
   - backend/.env.example → backend/.env
2. Instala dependencias:
   - pip install -r backend/requirements.txt
3. Ejecuta la API:
   - uvicorn app.main:app --reload --app-dir backend

El endpoint principal es:
- GET /api/overview

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

### Configuración para kapi-nomina.netlify.app
La configuración ya está preparada para usar un proxy interno de Netlify:

- Función: `netlify/functions/api-proxy.js`
- Redirect: `/api/*` → `/.netlify/functions/api-proxy/:splat`

Solo falta configurar en Netlify (Site settings → Environment variables):

- `BACKEND_API_ORIGIN=http://TU_IPV4_DE_HETZNER`

Ejemplo real:

- `BACKEND_API_ORIGIN=http://65.21.XXX.XXX`

Después, redeploy del sitio para aplicar la variable.

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

## Variables de entorno (BigQuery)
- BQ_PROJECT_ID
- BQ_DATASET
- BQ_TABLE_PAYROLL
- GOOGLE_APPLICATION_CREDENTIALS (opcional)

## Nota
Mientras no se configuren las variables de entorno, la API devuelve datos de ejemplo para desarrollo.
