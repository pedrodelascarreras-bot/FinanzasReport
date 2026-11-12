// ══ CONEXIÓN CON GOOGLE QUE QUEDA GUARDADA ══
// Con la app publicada en Vercel (carpeta api/google), te conectás una vez por dispositivo
// y después cada apertura pide el permiso en silencio: sin ventanas ni toques.
// Si esas rutas no existen (por ejemplo, la app abierta en local), todo sigue como antes:
// el permiso del navegador que dura una hora.

const GS_AUTO_IMPORT_KEY = 'fin_gmail_auto_open';   // interruptor "Actualizar gastos al abrir"
const GS_AUTO_AT_KEY = 'fin_gmail_auto_at';          // última importación automática en este dispositivo
const GS_RESUME_MIN_MS = 15 * 60 * 1000;             // al volver a la app, no más de una vez cada 15 min

let gsMode = 'unknown';      // 'unknown' | 'server' | 'browser'
let gsConnected = false;     // este dispositivo tiene la llave guardada
let gsRefreshTimer = null;
let gsAutoImportRunning = false;
let gsCheckPromise = null;

function gsIsServerMode(){ return gsMode === 'server'; }

function gsCheckServer(){
  if(gsCheckPromise) return gsCheckPromise;
  gsCheckPromise = (async ()=>{
    try{
      if(!/^https?:$/.test(String(window.location && window.location.protocol))) throw new Error('sin servidor');
      const res = await fetch('/api/google/session', { cache:'no-store', credentials:'same-origin' });
      const data = res.ok ? await res.json() : null;
      if(data && data.enabled){ gsMode = 'server'; gsConnected = !!data.connected; }
      else gsMode = 'browser';
    }catch(_){ gsMode = 'browser'; }
    return gsMode;
  })();
  return gsCheckPromise;
}

async function gsPost(path){
  return fetch(path, {
    method:'POST',
    credentials:'same-origin',
    headers:{ 'Content-Type':'application/json', 'X-Fluxen':'1' },
    body:'{}'
  });
}

// Permiso nuevo (una hora) usando la llave guardada. null = no hay sesión o venció.
async function gsSilentToken(){
  try{
    const res = await gsPost('/api/google/token');
    if(res.status === 401){ gsConnected = false; return null; }
    if(!res.ok) return null;
    const data = await res.json();
    if(!data || !data.access_token) return null;
    gsConnected = true;
    gsScheduleRefresh(data.expires_in);
    return data;
  }catch(_){ return null; }
}

// Renueva el permiso antes de que venza, sin recargar nada
function gsScheduleRefresh(expiresIn){
  clearTimeout(gsRefreshTimer);
  const ms = Math.max(60, (Number(expiresIn) || 3600) - 300) * 1000;
  gsRefreshTimer = setTimeout(gsRefreshQuietly, ms);
}
async function gsRefreshQuietly(){
  const data = await gsSilentToken();
  if(!data) return false;
  driveAccessToken = data.access_token;
  gmailAccessToken = data.access_token;
  window._driveTokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  if(!driveReady && initialLoadComplete) driveReady = true;
  return true;
}

// ¿Lo pidió el usuario recién (un toque)? Sirve para no salir de la app por una reconexión automática
let gsLastTapAt = 0;
if(typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('pointerdown', ()=>{ gsLastTapAt = Date.now(); }, true);
}
function gsUserJustTapped(){ return Date.now() - gsLastTapAt < 10000; }

// Va a la pantalla de Google (una sola vez por dispositivo). Antes deja todo guardado acá.
async function gsGoToGoogle(){
  try{ await safePersistLocalSnapshot(getStateSnapshot()); }catch(_){}
  window.location.href = '/api/google/start';
}

// Reemplaza al "token client" de Google en modo servidor: initDriveClient y las
// reconexiones llaman a requestAccessToken igual que siempre.
function gsCreateTokenClient(callback){
  return {
    requestAccessToken(){
      if(!gsConnected){
        if(gsUserJustTapped() && !window._driveReconnecting) gsGoToGoogle();
        else callback({ error:'not_connected' });
        return;
      }
      gsSilentToken().then(data=>{
        if(data){ callback(data); return; }
        if(gsUserJustTapped() && !window._driveReconnecting){ gsGoToGoogle(); return; }
        callback({ error:'session_expired' });
        if(typeof showToast === 'function') showToast('Se cortó la conexión con Google. Tocá "Conectar con Google" para volver a conectar.', 'error');
      });
    }
  };
}

async function gsDisconnect(){
  clearTimeout(gsRefreshTimer);
  gsConnected = false;
  try{ await gsPost('/api/google/logout'); }catch(_){}
}

// ── Actualizar gastos al abrir ──
function gsAutoImportEnabled(){
  try{ return localStorage.getItem(GS_AUTO_IMPORT_KEY) !== '0'; }catch(_){ return true; }
}
function gsSetAutoImport(on){
  try{ localStorage.setItem(GS_AUTO_IMPORT_KEY, on ? '1' : '0'); }catch(_){}
  if(typeof showToast === 'function') showToast(on ? 'Los gastos nuevos de Gmail se van a importar al abrir la app' : 'Importación automática apagada', 'info');
}

// Desde cuándo buscar: la última vez (con 7 días de margen, por si un mail llega tarde).
// Lo ya importado, borrado o anulado no se repite, así que el margen no duplica nada.
function gsAutoImportRange(now){
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
  let last = null;
  try{ last = localStorage.getItem(GS_AUTO_AT_KEY); }catch(_){}
  last = last || state.lastGmailSync;
  let from = last ? new Date(new Date(last).getTime() - 7 * 86400000) : new Date(now.getFullYear(), now.getMonth(), 1);
  if(isNaN(from) || from < sixtyDaysAgo) from = last ? sixtyDaysAgo : new Date(now.getFullYear(), now.getMonth(), 1);
  return { from, to: now };
}

async function gsAutoImportGmail(){
  if(gsAutoImportRunning || !gsAutoImportEnabled() || !gmailAccessToken) return;
  if(typeof fetchSantanderEmails !== 'function') return;
  gsAutoImportRunning = true;
  try{
    // Si la compu estuvo dormida, el permiso pudo vencer sin que se renueve
    if((Number(window._driveTokenExpiresAt) || 0) - Date.now() < 2 * 60 * 1000 && gsIsServerMode()){
      if(!(await gsRefreshQuietly())) return;
    }
    const now = new Date();
    const { from, to } = gsAutoImportRange(now);
    const ok = await fetchSantanderEmails(from, to, { auto:true });
    if(ok) try{ localStorage.setItem(GS_AUTO_AT_KEY, now.toISOString()); }catch(_){}
  }finally{ gsAutoImportRunning = false; }
}

// Lo que trajo la importación automática: lo que no tiene dudas entra directo;
// si algo parece repetido, se muestra la lista de siempre para que decidas vos.
function gsFinishAutoImport(txns, dateFrom, dateTo){
  const { conflicts, clean } = findPossibleDuplicates(txns);
  state.lastGmailSync = new Date().toISOString();
  if(clean.length){
    const labels = [...new Set(clean.map(t => t.sourceBank || t.importRuleName || 'Gmail'))];
    finishImport(clean, 'Gmail · ' + labels.join(' + '));
  } else {
    saveState();
  }
  if(conflicts.length){
    pendingGmailTxns = conflicts.map(c => c.incoming);
    showGmailResultModal(pendingGmailTxns, pendingGmailTxns.length, dateFrom, dateTo);
  }
}

// ── Al abrir ──
function gsReadReturnParam(){
  let result = '';
  try{
    const url = new URL(window.location.href);
    result = url.searchParams.get('google') || '';
    if(result){
      url.searchParams.delete('google');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }catch(_){}
  return result;
}

async function gsBoot(){
  const mode = await gsCheckServer();
  const result = gsReadReturnParam();
  if(mode !== 'server') return;
  if(result === 'cancelled') showToast('No se conectó Google', 'info');
  else if(result === 'error') showToast('No se pudo conectar con Google. Probá de nuevo.', 'error');
  else if(result === 'not_configured') showToast('Falta configurar Google en Vercel', 'error');
  // Arma el cliente en modo servidor; si ya está conectado, sincroniza Drive y, al terminar,
  // importa los gastos nuevos de Gmail (ver el final del callback en initDriveClient)
  window._gsBootImport = gsConnected;
  initDriveClient(false, { prepareOnly: !gsConnected });
}

// Al volver a la app (el celular la deja abierta de fondo): permiso al día y gastos nuevos
async function gsOnResume(){
  if(document.visibilityState !== 'visible' || !gsIsServerMode() || !gsConnected) return;
  const expiresAt = Number(window._driveTokenExpiresAt) || 0;
  if(expiresAt - Date.now() < 5 * 60 * 1000){
    if(!(await gsRefreshQuietly())) return;
  }
  let last = 0;
  try{ last = new Date(localStorage.getItem(GS_AUTO_AT_KEY) || 0).getTime() || 0; }catch(_){}
  if(Date.now() - last > GS_RESUME_MIN_MS) gsAutoImportGmail();
}

if(typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('fluxen:state-ready', ()=>{ gsBoot(); }, { once:true });
  document.addEventListener('visibilitychange', ()=>{ gsOnResume(); });
}
