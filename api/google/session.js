// ¿Este dispositivo ya quedó conectado? La app lo pregunta al abrir.
// Si esta ruta no existe (la app servida sin Vercel), la app vuelve al modo de siempre.
const { config, readRefreshToken, send } = require('../_lib/google');

module.exports = (req, res) => {
  const cfg = config();
  if (!cfg.ready) return send(res, 200, { enabled: false });
  send(res, 200, { enabled: true, clientId: cfg.clientId, connected: !!readRefreshToken(req) });
};
