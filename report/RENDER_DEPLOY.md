# Deploy del servidor de reportes en Render

## Qué hace
Este servicio:
- lee `finanzas-data-sync.json` desde Google Drive
- arma el reporte
- genera PDF
- lo envía por email con Resend

## Variables necesarias en Render

- `RESEND_API_KEY`
- `REPORT_TO_EMAIL`
- `REPORT_FROM_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `ANTHROPIC_API_KEY`

## Importante sobre `GOOGLE_SERVICE_ACCOUNT_JSON`
Pegá el JSON completo de la service account en una sola variable de entorno.

Además:
1. Compartí el archivo `finanzas-data-sync.json` con el email de esa service account.
2. Verificá que el archivo exista en tu Drive.

## Deploy
1. Subí este repo a GitHub.
2. En Render, elegí `New +` -> `Blueprint`.
3. Seleccioná el repo.
4. Render va a leer `render.yaml` y crear `finanzas-report-server`.
5. Cargá las variables de entorno.
6. Deploy.

## Después del deploy
Cuando Render te dé una URL como:

`https://finanzas-report-server.onrender.com`

guardala en la app para que el frontend use ese backend en vez de `localhost`.

Podés hacerlo temporalmente desde consola:

```js
localStorage.setItem('fin_report_server_url', 'https://finanzas-report-server.onrender.com')
location.reload()
```

## Health check
- `GET /`
- `GET /health`

## Envío
El frontend ya quedó preparado para:
- usar la URL guardada en `localStorage`
- caer a `http://localhost:3001` si no hay ninguna configurada
