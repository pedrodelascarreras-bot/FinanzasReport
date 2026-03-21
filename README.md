# 📊 Automatización de Reporte Financiero Semanal

Sistema que genera automáticamente un reporte financiero semanal, lo convierte a PDF, genera insights con IA, y lo envía por email.

---

## ¿Cómo funciona?

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐     ┌───────────┐
│ Google Drive │ ──▶ │ Construir    │ ──▶ │ Insights IA │ ──▶ │ Generar  │ ──▶ │ Enviar    │
│ (datos JSON) │     │ reporte      │     │ (Claude)    │     │ PDF      │     │ email     │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘     └───────────┘
```

1. **Cada vez que usás la app**, los datos se sincronizan a Google Drive (carpeta `FinanzasApp/finanzas-data-sync.json`)
2. **Cada lunes a las 08:00 AM (hora Argentina)**, un GitHub Action:
   - Lee el JSON de Drive con una Service Account
   - Calcula KPIs, categorías, comparaciones, alertas
   - Genera 3 insights + 3 recomendaciones con Claude (IA)
   - Crea un PDF prolijo
   - Envía todo por email con Resend

---

## Setup paso a paso

### 1. Service Account de Google (para leer Drive)

1. Andá a [Google Cloud Console](https://console.cloud.google.com/)
2. Creá un proyecto (o usá el existente de tu app)
3. Habilitá la **Google Drive API**
4. Andá a **IAM & Admin → Service Accounts**
5. Creá una nueva Service Account (nombre: `finanzas-report`)
6. Creá una **key JSON** y descargala
7. Copiá el **email** de la Service Account (parece: `finanzas-report@proyecto.iam.gserviceaccount.com`)

### 2. Compartir la carpeta de Drive

1. Abrí tu app de finanzas y conectá Google (si no lo hiciste ya)
2. Hacé cualquier cambio para que se sincronice
3. Andá a [Google Drive](https://drive.google.com/)
4. Buscá la carpeta **FinanzasApp**
5. Click derecho → **Compartir** → pegá el email de la Service Account
6. Dale permiso de **Lector** (viewer)

### 3. Resend (para enviar emails)

1. Creá una cuenta en [resend.com](https://resend.com/)
2. Generá una **API Key**
3. Para usar tu propio dominio: configurá un dominio en Resend y verificá DNS
4. Sin dominio propio: usá `onboarding@resend.dev` como remitente (limitado a tu email)

### 4. Anthropic (para IA)

1. Andá a [console.anthropic.com](https://console.anthropic.com/)
2. Generá una **API Key**
3. Nota: si no configurás esta key, el sistema genera insights básicos sin IA (no se rompe)

### 5. Configurar secrets en GitHub

Andá a tu repositorio → **Settings → Secrets and variables → Actions** → **New repository secret**

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | El JSON completo de la key de la Service Account | `{"type":"service_account","project_id":"..."}` |
| `RESEND_API_KEY` | API key de Resend | `re_xxxxxxxxxxxx` |
| `REPORT_TO_EMAIL` | Tu email personal donde recibís el reporte | `pedro@gmail.com` |
| `REPORT_FROM_EMAIL` | Email remitente (de tu dominio Resend) | `Finanzas <finanzas@tudominio.com>` |
| `ANTHROPIC_API_KEY` | API key de Anthropic (opcional) | `sk-ant-xxxxxxxxxxxx` |

---

## Probar manualmente

### Desde GitHub:
1. Andá a **Actions** → **📊 Reporte Financiero Semanal**
2. Click en **Run workflow** → **Run workflow**
3. Revisá los logs y tu email

### Localmente:
```bash
cd report-system

# Configurar variables de entorno
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
export RESEND_API_KEY='re_xxxx'
export REPORT_TO_EMAIL='tu@email.com'
export REPORT_FROM_EMAIL='Finanzas <onboarding@resend.dev>'
export ANTHROPIC_API_KEY='sk-ant-xxxx'  # opcional

# Instalar dependencias
npm install

# Ejecutar
node scripts/main.js
```

---

## Cambiar horario y frecuencia

Editá `.github/workflows/weekly-finance-report.yml`, línea del `cron`:

| Cuándo | Cron (UTC) | Hora Argentina |
|--------|-----------|----------------|
| Lunes 08:00 AM | `0 11 * * 1` | ✅ Actual |
| Domingo 21:00 | `0 0 * * 1` | Alternativa |
| Viernes 18:00 | `0 21 * * 5` | Fin de semana |
| Todos los días 09:00 | `0 12 * * *` | Diario |

Formato: `minuto hora * * día-semana` (0=domingo, 1=lunes, etc.)

**Recordá:** GitHub usa UTC. Argentina = UTC - 3 horas.

---

## Estructura de archivos

```
report-system/
├── .github/workflows/
│   └── weekly-finance-report.yml   # GitHub Action programado
├── scripts/
│   ├── main.js                     # Orquestador principal
│   ├── fetch-data.js               # Lee datos de Google Drive
│   ├── build-report.js             # Construye reporte estructurado
│   ├── ai-insights.js              # Genera insights con Claude
│   ├── generate-pdf.js             # Genera PDF con PDFKit
│   └── send-email.js               # Envía email con Resend
├── package.json
└── README.md
```

---

## Troubleshooting

### "No se encontró la carpeta FinanzasApp"
- Abrí la app, conectá Google, y hacé un cambio para que se sincronice
- Verificá que la carpeta `FinanzasApp` aparezca en tu Drive
- Compartila con la Service Account

### "Error de autenticación de Drive"
- Verificá que el secret `GOOGLE_SERVICE_ACCOUNT_JSON` contenga el JSON **completo** de la key
- Verificá que la Drive API esté habilitada en el proyecto de Google Cloud

### "Los datos tienen más de 72 horas"
- El sistema te avisa si los datos están desactualizados
- Abrí la app y asegurate de que la conexión Google esté activa

### "Error de Resend"
- `onboarding@resend.dev` solo puede enviar a tu propia dirección verificada
- Para enviar a cualquier email, configurá tu propio dominio en Resend

### "Insights sin IA"
- Si `ANTHROPIC_API_KEY` no está configurada, el sistema genera insights básicos automáticamente
- No se rompe — el PDF y email se generan igual

---

## Limitaciones conocidas

1. **Los datos dependen de que uses la app**: Si no abrís la app en una semana, el reporte usará datos viejos. El sistema te avisa con un warning.

2. **Sync requiere sesión activa**: Los datos se sincronizan a Drive cuando la app está abierta en el browser y tenés Google conectado. No hay sync en background.

3. **Un solo usuario**: Este sistema está diseñado para uso personal. La Service Account lee una sola carpeta de Drive.
