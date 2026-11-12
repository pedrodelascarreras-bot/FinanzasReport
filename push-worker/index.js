// Avisos de Fluxen. La app calcula en el celular qué avisos tocan y cuándo (topes, cierres,
// vencimientos, cuotas, resumen del domingo) y manda la lista acá. Cada dispositivo es un
// Durable Object que se despierta con una alarma justo cuando toca el próximo aviso:
// sin base de datos y sin revisar nada cada tanto. Mismo esquema que TasksApp.
import { DurableObject } from 'cloudflare:workers';
import { sendPush } from './webpush.js';

const MAX_DEVICES = 20;
const MAX_AVISOS = 200;
const MAX_TRIES = 3;
const STALE_MS = 6 * 3600000;          // un aviso que se atrasó más de 6 h ya no se manda
const KEEP_SENT_MS = 45 * 86400000;     // lo mandado se recuerda 45 días: no se repite en el mismo ciclo
const ORIGINS = ['https://pedrodelascarreras-bot.github.io'];

const cors = (req) => {
  const origin = req.headers.get('Origin') || '';
  const ok = ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {};
};
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
const validToken = (t) => typeof t === 'string' && /^[0-9a-f]{64}$/.test(t);
const validSubscription = (s) => !!(s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string');

async function hash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class Device extends DurableObject {
  vapid() {
    return { publicKey: this.env.VAPID_PUBLIC, privateKey: this.env.VAPID_PRIVATE, subject: this.env.VAPID_SUBJECT };
  }

  /** Lo usa el objeto "registro" para limitar cuántos dispositivos puede haber. */
  async admit(device) {
    const list = (await this.ctx.storage.get('devices')) || [];
    if (list.includes(device)) return true;
    if (list.length >= MAX_DEVICES) return false;
    list.push(device);
    await this.ctx.storage.put('devices', list);
    return true;
  }

  async register(subscription) {
    await this.ctx.storage.put('subscription', subscription);
  }

  async forget() {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  async test() {
    const sub = await this.ctx.storage.get('subscription');
    if (!sub) return { ok: false };
    const status = await sendPush(sub, { title: 'Fluxen', body: 'Los avisos funcionan. Te vamos a avisar cuando haga falta.', key: 'test' }, this.vapid());
    return { ok: status >= 200 && status < 300, status };
  }

  async sync(list) {
    const now = Date.now();
    const sent = (await this.ctx.storage.get('sent')) || {};
    for (const k of Object.keys(sent)) if (sent[k] < now - KEEP_SENT_MS) delete sent[k];
    const avisos = list
      .slice(0, MAX_AVISOS)
      .filter((a) => a && typeof a.key === 'string' && !sent[a.key] && !Number.isNaN(Date.parse(a.at)))
      .map((a) => ({ key: a.key.slice(0, 120), at: Date.parse(a.at), title: String(a.title || '').slice(0, 140), body: String(a.body || '').slice(0, 240), page: typeof a.page === 'string' ? a.page.slice(0, 30) : null, tries: 0 }))
      .sort((a, b) => a.at - b.at);
    await this.ctx.storage.put({ avisos, sent });
    await this.schedule(avisos);
    return { ok: true, count: avisos.length };
  }

  async schedule(avisos) {
    if (avisos.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, avisos[0].at));
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const now = Date.now();
    const sub = await this.ctx.storage.get('subscription');
    const avisos = (await this.ctx.storage.get('avisos')) || [];
    const sent = (await this.ctx.storage.get('sent')) || {};
    if (!sub) return;
    const due = avisos.filter((a) => a.at <= now + 1000);
    const later = avisos.filter((a) => a.at > now + 1000);
    for (const a of due) {
      if (a.at < now - STALE_MS || sent[a.key]) continue;
      let status = 0;
      try { status = await sendPush(sub, { title: a.title, body: a.body, key: a.key, page: a.page }, this.vapid()); } catch (e) { status = 0; }
      if (status === 404 || status === 410) {
        // El celular dio de baja los avisos: se borra todo hasta que se vuelvan a activar
        await this.ctx.storage.delete(['subscription', 'avisos']);
        await this.ctx.storage.deleteAlarm();
        return;
      }
      if (status >= 200 && status < 300) sent[a.key] = now;
      else if (a.tries + 1 < MAX_TRIES) later.push({ ...a, at: now + 60000, tries: a.tries + 1 });
    }
    later.sort((a, b) => a.at - b.at);
    await this.ctx.storage.put({ avisos: later, sent });
    await this.schedule(later);
  }
}

async function api(req, env) {
  const input = await req.json().catch(() => null);
  if (!input) return json(req, { error: 'body' }, 400);
  if (input.action === 'key') return json(req, { publicKey: env.VAPID_PUBLIC });
  if (!validToken(input.token)) return json(req, { error: 'token' }, 401);

  const name = await hash(input.token);
  const device = env.DEVICE.get(env.DEVICE.idFromName(name));

  if (input.action === 'register') {
    if (!validSubscription(input.subscription)) return json(req, { error: 'subscription' }, 400);
    if (!(await env.DEVICE.get(env.DEVICE.idFromName('registry')).admit(name))) return json(req, { error: 'devices' }, 403);
    await device.register(input.subscription);
    return json(req, { ok: true });
  }
  if (input.action === 'test') return json(req, await device.test());
  if (input.action === 'sync') return json(req, await device.sync(Array.isArray(input.avisos) ? input.avisos : []));
  if (input.action === 'off') { await device.forget(); return json(req, { ok: true }); }
  return json(req, { error: 'action' }, 400);
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path !== '/api/push') return new Response('Fluxen', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
    try { return await api(req, env); } catch (e) { console.error(e); return json(req, { error: 'server' }, 500); }
  },
};
