// Conexión con Google que no vence: guarda la "llave de renovación" (refresh token)
// cifrada en una cookie del propio navegador. No hay base de datos: cada dispositivo
// tiene su cookie y nadie más la puede leer (HttpOnly).
//
// Variables de entorno en Vercel:
//   GOOGLE_CLIENT_ID      el mismo Client ID que usa la app
//   GOOGLE_CLIENT_SECRET  la clave secreta de ese Client ID (Google Cloud → Credenciales)
//   COOKIE_SECRET         (opcional) frase larga al azar para cifrar la cookie; si no está,
//                         se deriva del GOOGLE_CLIENT_SECRET
const crypto = require('node:crypto');

const COOKIE_NAME = 'fx_google';
const COOKIE_PATH = '/api/google';
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // el máximo que aceptan los navegadores
const STATE_COOKIE = 'fx_google_state';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Los mismos permisos que pide la app: su carpeta privada de Drive y leer Gmail
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/gmail.readonly';

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const cookieSecret = process.env.COOKIE_SECRET || (clientSecret ? 'fx-cookie:' + clientSecret : '');
  return { clientId, clientSecret, cookieSecret, ready: !!(clientId && clientSecret && cookieSecret.length >= 16) };
}

function key(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function seal(text, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

function unseal(value, secret) {
  try {
    const raw = Buffer.from(String(value || ''), 'base64url');
    if (raw.length < 29) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch (_) {
    return null;
  }
}

function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function sessionCookie(value) { return cookie(COOKIE_NAME, value, COOKIE_MAX_AGE); }
function clearSessionCookie(res) { res.setHeader('Set-Cookie', cookie(COOKIE_NAME, '', 0)); }

function readRefreshToken(req) {
  const { cookieSecret } = config();
  const value = readCookie(req);
  return value ? unseal(value, cookieSecret) : null;
}

// La dirección a la que Google vuelve después de conectar (hay que cargarla en Google Cloud)
function callbackUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return `${proto}://${req.headers.host}${COOKIE_PATH}/callback`;
}

function redirect(res, location, cookies = []) {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Solo la propia app puede llamar: POST, mismo origen y un encabezado que otra página
// no puede mandar sin permiso del navegador.
function guard(req, res) {
  if (req.method !== 'POST') { send(res, 405, { error: 'method' }); return false; }
  if (req.headers['x-fluxen'] !== '1') { send(res, 403, { error: 'header' }); return false; }
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (_) {}
    if (host !== req.headers.host) { send(res, 403, { error: 'origin' }); return false; }
  }
  if (!config().ready) { send(res, 503, { error: 'not_configured' }); return false; }
  return true;
}

async function googleToken(params) {
  const { clientId, clientSecret } = config();
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let data = {};
  try { data = await r.json(); } catch (_) {}
  return { ok: r.ok, data };
}

module.exports = {
  STATE_COOKIE, SCOPES, config, seal, unseal, readCookie, cookie, readRefreshToken,
  sessionCookie, clearSessionCookie, callbackUrl, redirect, send, guard, googleToken,
};
