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
  if (!code || !state || state !== readCookie(req, STATE_COOKIE)) {
    console.error('[google] callback: state no coincide', { hasCode: !!code, hasState: !!state, hasCookie: !!readCookie(req, STATE_COOKIE) });
    return redirect(res, '/?google=error&reason=state', [clearState]);
  }

  const { ok, data } = await googleToken({ code, grant_type: 'authorization_code', redirect_uri: callbackUrl(req) });
  const refreshToken = (ok && data.refresh_token) || readRefreshToken(req);
  if (!refreshToken) {
    // Solo el código de error de Google (nunca claves ni tokens)
    const reason = !ok ? String(data.error || 'exchange') : 'no_refresh_token';
    console.error('[google] callback: canje fallido', { reason, description: data.error_description || '', redirectUri: callbackUrl(req) });
    return redirect(res, '/?google=error&reason=' + encodeURIComponent(reason), [clearState]);
  }

  redirect(res, '/?google=connected', [clearState, sessionCookie(seal(refreshToken, cfg.cookieSecret))]);
};
