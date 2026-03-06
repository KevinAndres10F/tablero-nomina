# Guia rapida: Tablero en Render con Google Sheets

Objetivo: que todas las tablas y analisis se alimenten desde Google Sheets a traves del backend en Render.

## 1) Backend en Render

Servicio esperado: `kapiroll-api`

Variables en Render:

- `DATA_SOURCE=sheets`
- `GOOGLE_SHEET_ID=1pyzugIeZBDCMq0kTCyWBis9toyzTXWmubGjLhng9vhk`
- `GOOGLE_SHEET_SOURCE_MODE=api`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON={...}`

Notas:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` debe contener el JSON completo en una sola linea.
- Comparte el Google Sheet con el correo del Service Account de ese JSON.

## 2) Verificacion del backend

Una vez desplegado en Render:

```bash
curl https://kapiroll-api.onrender.com/api/health
curl "https://kapiroll-api.onrender.com/api/overview"
```

Resultado esperado:
- En `/api/health`, `"data_source": "sheets"`
- En `/api/overview`, `employees` con datos y sin `error`

## 3) Netlify apuntando a Render

Variables en Netlify:

- `BACKEND_API_ORIGIN=https://kapiroll-api.onrender.com`
- `RENDER_API_ORIGIN=https://kapiroll-api.onrender.com`
- `BACKEND_PROXY_TIMEOUT_MS=25000`
- `NETLIFY_DIRECT_SHEETS=false`

Luego hacer redeploy del frontend.

## 4) Diagnostico rapido si no carga

Si aparece error en el banner del frontend:

1. Revisar `/api/health` en Render
2. Revisar `/api/overview` en Render
3. Verificar que la hoja este compartida con el Service Account
4. Confirmar que Netlify tiene `BACKEND_API_ORIGIN` correcto
