// Puente de los avisos del celular. La app le habla a su propia dirección (/api/push) y esta
// función le pasa el pedido al Worker de avisos (push-worker/). Así no depende de qué
// direcciones tenga permitidas el Worker: el pedido sale del servidor, no del navegador.
const { send } = require('./_lib/google');

const WORKER = 'https://fluxen-push.pedrotasks.workers.dev/api/push';
const MAX_BODY = 200 * 1024;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.resolve(null); }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > MAX_BODY) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const body = await readBody(req);
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'body' });
  try {
    const r = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await r.json(); } catch (_) {}
    send(res, r.status, data);
  } catch (e) {
    send(res, 502, { error: 'worker' });
  }
};
