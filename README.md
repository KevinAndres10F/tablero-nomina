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

## Frontend
Abre el archivo:
- frontend/index.html

Si necesitas consumir la API desde otro host, actualiza la constante API_BASE dentro de frontend/index.html.

## Variables de entorno (BigQuery)
- BQ_PROJECT_ID
- BQ_DATASET
- BQ_TABLE_PAYROLL
- GOOGLE_APPLICATION_CREDENTIALS (opcional)

## Nota
Mientras no se configuren las variables de entorno, la API devuelve datos de ejemplo para desarrollo.
