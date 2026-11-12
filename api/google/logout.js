// "Desconectar / revocar": le avisa a Google y borra la cookie del dispositivo.
const { readRefreshToken, clearSessionCookie, send, guard } = require('../_lib/google');

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch (_) { /* igual se borra la cookie */ }
  }
  clearSessionCookie(res);
  send(res, 200, { ok: true });
};
