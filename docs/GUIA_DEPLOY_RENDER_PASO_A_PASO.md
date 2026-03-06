# Deploy en Render - Paso a Paso (Backend + Frontend)

Objetivo: dejar `kapiroll-api` y `kapiroll-web` funcionando en Render con datos desde BigQuery.

## 1) Prerrequisitos

- Repositorio en GitHub con `render.yaml` en la raiz.
- Proyecto de GCP con BigQuery habilitado.
- Service Account con permisos de lectura sobre la tabla.
- JSON de credenciales del Service Account (en una sola linea para variable de entorno).

## 2) Crear Blueprint en Render

1. Entrar a Render: Dashboard > New > Blueprint.
2. Conectar el repositorio `KevinAndres10F/tablero-nomina`.
3. Confirmar el archivo `render.yaml`.
4. Crear el Blueprint.

Servicios esperados:

- `kapiroll-api` (Web Service, Python)
- `kapiroll-web` (Static Site)

## 3) Configurar variables del backend (`kapiroll-api`)

En Render, abrir `kapiroll-api` > Environment y definir:

- `DATA_SOURCE=bigquery`
- `BQ_PROJECT_ID=<tu_project_id>`
- `BQ_DATASET=<tu_dataset>`
- `BQ_TABLE=<tu_tabla>`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON={...}`
- `APPS_SCRIPT_CHAT_URL=<url_web_app_apps_script>` (opcional, para KapiBot)

Notas:

- `GOOGLE_APPLICATION_CREDENTIALS_JSON` debe ser JSON plano en una sola linea.
- No usar base64 para esta variable con la implementacion actual.

## 4) Desplegar servicios

1. En `kapiroll-api`, hacer Manual Deploy > Deploy latest commit.
2. Esperar estado `Live`.
3. En `kapiroll-web`, hacer Manual Deploy > Deploy latest commit.
4. Esperar estado `Live`.

## 5) Verificar backend

Probar salud:

```bash
curl https://kapiroll-api.onrender.com/api/health
```

Resultado esperado minimo:

- `"status": "ok"`
- `"data_source": "bigquery"`
- `"project"`, `"dataset"`, `"table"` con valores no `not-set`

Probar datos:

```bash
curl "https://kapiroll-api.onrender.com/api/overview"
```

Resultado esperado:

- Respuesta JSON con `employees` y `kpis`
- Sin campo de error

## 6) Verificar frontend

Abrir:

- `https://kapiroll-web.onrender.com`

Validar:

- Carga de KPIs
- Carga de tabla de empleados
- Sin banner de error de fuente de datos

## 7) Troubleshooting rapido

1. `data_source` no es `bigquery`:
   revisar `DATA_SOURCE` y redeploy de `kapiroll-api`.
2. `/api/overview` falla por permisos:
   revisar roles del Service Account en BigQuery y contenido de `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
3. Frontend sin datos pero API responde:
   redeploy de `kapiroll-web` y revisar DevTools del navegador (CORS y errores JS).
4. `project/dataset/table` en `not-set`:
   falta configurar variables `BQ_PROJECT_ID`, `BQ_DATASET`, `BQ_TABLE`.

## 8) Checklist final

- [ ] `kapiroll-api` en estado `Live`
- [ ] `kapiroll-web` en estado `Live`
- [ ] `/api/health` con `data_source=bigquery`
- [ ] `/api/overview` devuelve datos
- [ ] Frontend muestra KPIs y empleados
