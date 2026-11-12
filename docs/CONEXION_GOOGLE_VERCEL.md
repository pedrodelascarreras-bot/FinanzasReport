# Google conectado para siempre (Vercel)

Con la app publicada en Vercel te conectás a Google **una vez por dispositivo** y no se
vuelve a pedir. Cada vez que abrís Fluxen se sincroniza Drive y, si está prendido
**Configuración → Reglas Gmail → Actualizar gastos al abrir**, se traen los gastos nuevos de Gmail.

Cómo funciona: la carpeta `api/google` es una función chica que guarda la "llave de
renovación" de Google cifrada en una cookie del propio navegador. No hay base de datos.
Si la app se abre sin esas rutas (por ejemplo en local con `http-server`), funciona como
antes: el permiso del navegador que dura una hora.

## 1. Antes de mudarte: subir todo a Drive

Los datos de cada dispositivo quedan guardados por dirección web. En la dirección nueva la
app arranca vacía y trae todo de Drive. Antes de pasarte, abrí la app en la dirección
vieja, en la compu, conectá Google y esperá el cartel "✓ Datos sincronizados".

## 2. Publicar en Vercel

1. En vercel.com: **Add New → Project** e importá el repositorio de GitHub.
2. Framework: **Other**. El resto lo toma de `vercel.json` (corre `npm run build` y publica `dist/`).
3. **Deploy**. Anotá la dirección que te da (por ejemplo `https://tu-app.vercel.app`).

## 3. Google Cloud (el mismo proyecto del Client ID que ya usa la app)

En **APIs y servicios → Credenciales**, abrí el cliente OAuth de la app:

- **Orígenes de JavaScript autorizados:** agregá `https://tu-app.vercel.app`
- **URIs de redireccionamiento autorizados:** agregá `https://tu-app.vercel.app/api/google/callback`
- Copiá el **Secreto del cliente** (si no lo tenés, **Agregar secreto**).

En **Pantalla de consentimiento de OAuth → Público**, tocá **Publicar app** para que quede
**En producción**. Si queda en "Prueba", Google vence la conexión cada 7 días.
Como la usás solo vos, no hace falta verificarla.

## 4. Variables en Vercel

En el proyecto: **Settings → Environment Variables** (para Production):

| Nombre | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | el Client ID de la app (el mismo que figura en Configuración) |
| `GOOGLE_CLIENT_SECRET` | el secreto del paso 3 |
| `COOKIE_SECRET` | opcional: una frase larga al azar (`openssl rand -base64 32`). Si no está, se usa el secreto de Google |

Después: **Deployments → … → Redeploy** para que tome las variables.

## 5. Conectar cada dispositivo (una sola vez)

- **Compu:** abrí la dirección de Vercel, creá tu PIN, **Configuración → Conectar / reconectar**.
- **Celular:** abrí la dirección de Vercel en Safari, **Compartir → Agregar a inicio** (de
  nuevo, porque es otra dirección), abrí la app desde el ícono y tocá **Conectar con Google**.

Google te va a mostrar "Google no verificó esta app": tocá **Avanzado → Ir a …** y aceptá
los permisos. Es una sola vez por dispositivo.

## Desconectar

**Configuración → Desconectar / revocar** le avisa a Google y borra la conexión de ese
dispositivo. También se puede sacar el acceso desde myaccount.google.com → Seguridad →
Apps de terceros.
