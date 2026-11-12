// Permiso nuevo en silencio (dura una hora) usando la llave guardada en la cookie.
const { readRefreshToken, clearSessionCookie, send, guard, googleToken } = require('../_lib/google');

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) return send(res, 401, { error: 'no_session' });

  const { ok, data } = await googleToken({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  if (!ok || !data.access_token) {
    // invalid_grant = el acceso se revocó o venció: hay que volver a conectar
    if (data.error === 'invalid_grant') {
      clearSessionCookie(res);
      return send(res, 401, { error: 'expired' });
    }
    return send(res, 502, { error: data.error || 'refresh_failed' });
  }
  send(res, 200, { access_token: data.access_token, expires_in: data.expires_in });
};
