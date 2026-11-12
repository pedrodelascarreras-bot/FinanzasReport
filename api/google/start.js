// "Conectar con Google" (una sola vez por dispositivo): manda a la pantalla de Google
// pidiendo acceso que no vence (access_type=offline). Al volver entra por callback.js.
const crypto = require('node:crypto');
const { STATE_COOKIE, SCOPES, config, cookie, callbackUrl, redirect } = require('../_lib/google');

module.exports = (req, res) => {
  const cfg = config();
  if (!cfg.ready) return redirect(res, '/?google=not_configured');
  const state = crypto.randomBytes(16).toString('base64url');
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // así Google siempre entrega la llave de renovación
    include_granted_scopes: 'true',
    state,
  });
  redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`, [cookie(STATE_COOKIE, state, 600)]);
};
