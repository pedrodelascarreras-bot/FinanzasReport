// Vuelta de Google: cambia el código por la llave de renovación, la guarda cifrada en la
// cookie del dispositivo y vuelve a la app.
const {
  STATE_COOKIE, config, seal, readCookie, cookie, readRefreshToken, sessionCookie,
  callbackUrl, redirect, googleToken,
} = require('../_lib/google');

module.exports = async (req, res) => {
  const cfg = config();
  const url = new URL(req.url, 'http://x');
  const clearState = cookie(STATE_COOKIE, '', 0);
  if (!cfg.ready) return redirect(res, '/?google=not_configured', [clearState]);

  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  if (url.searchParams.get('error')) return redirect(res, '/?google=cancelled', [clearState]);
  // El "state" prueba que el pedido salió de esta app y de este navegador
  if (!code || !state || state !== readCookie(req, STATE_COOKIE)) return redirect(res, '/?google=error', [clearState]);

  const { ok, data } = await googleToken({ code, grant_type: 'authorization_code', redirect_uri: callbackUrl(req) });
  const refreshToken = (ok && data.refresh_token) || readRefreshToken(req);
  if (!refreshToken) return redirect(res, '/?google=error', [clearState]);

  redirect(res, '/?google=connected', [clearState, sessionCookie(seal(refreshToken, cfg.cookieSecret))]);
};
