// ══ STATE ══
let state={
  transactions:[],categories:[...DEFAULT_CATS],categoryGroups:[...DEFAULT_CATEGORY_GROUPS],
  income:{ars:0,varArs:0,usd:0,varUsd:0},
  savingsGoal:20,alertThreshold:80,spendPct:100,insightsBufferMonths:3,tendChartMode:'bar',
  imports:[],compareMode:'month',balanceView:'summary',repDesign:'executive',tendMode:'visa',
  activeTendCats:null,
  usdRateHistory:[],
  _selectedTxns:new Set(),
  cuotas:[],autoCuotaConfig:{},subscriptions:[],fixedExpenses:[],
  // NEW
  incomeSources:[],      // [{id,name,type,currency,base,color}] — legacy
  incomeMonths:[],       // V1: [{id,month,sources,extraArs,extraUsd}] · V2: [{id,month,schemaVersion:2,salary:{ars,usd,commissions},extras:[]}]
  bankAccounts:[],       // [{id,name,currency,emoji,createdAt}] — for income destination tracking
  savAccounts:[],        // [{id,name,emoji,balance,currency,type,yieldPct,color}]
  savGoals:[],           // [{id,name,emoji,target,currency,current,deadline,accountId,color,stageId,tags:[],contributions:[{id,amount,currency,month}],pinned,completedAt}]
  savDeposits:[],        // [{id,month:'2025-03',accountId,amount,currency,note,kind}] — 100% manual
  savStages:[],          // [{id,name,color}] — etapas del pipeline de metas (se auto-inicializa con defaults)
  savPlan:null,          // Plan de ahorro del mes: {targets:[{id,name,amountUsd}],discretionaryCats:[catName],active:{targetId,cycleId,activatedAt}|null}
  movingCalc:null,       // Calculadora "¿Me puedo mudar?": {name,rentCur,rent,expensas,expCur,servicios,servCur,deposito,comision,otros,mueblesTotal,mueblesCuotas,moveInDate,currentSavings,monthlySaving,incomeUsd}
  incViewCurrency:'ARS',
  tcConfig:{cardName:'',closeDay:0,dueDay:0,limit:0,mixTarget:70},
  viewCycleConfig:{
    visa:{openDay:26,closeDay:25,dueDay:10},
    amex:{openDay:11,closeDay:10,dueDay:27}
  },
  tcCycles:[],
  hiddenTcCycles:[],
  dashTcCycle:null,
  dashView:'visa',
  chartMode:'bars',
  dashMonth:null,
  txnFilterMode:'visa',
  charts:{},_assigningTxnId:null,
  catRules:[],           // [{id, keyword, category, active, priority}]
  nameRules:[],          // [{id, keyword, renameTo, active, priority}]
  logoRules:[],          // [{id, keyword, logoKey, active, priority}]
  catHistory:{},         // {comercio_normalized: {cat: count}} — aprendizaje local
  txnEstadoFilter:'all', // 'all'|'pendiente_de_revision'|'duplicado_sospechoso'|'confirmado_por_usuario'|'detectado_automaticamente'
  txnCardFilter:'',      // ''|'visa'|'amex' — card filter in transactions view
  lastGmailSync: null,
  lastTransactionsExport: null,
  lastTransactionsRefresh: null,
  userName: 'Pedro',
  lastVisit: null,
  dismissedNotifs: [],   // IDs of notifications the user dismissed
  decisionCenterCollapsed:false,
  dismissedAutoCuotas:[], // keys of auto-cuotas permanently dismissed
  gmailDeletedIds:[],    // mails de Gmail cuyo gasto el usuario borró: no se vuelven a importar
  gmailAnulados:[],      // mails de anulación ya procesados
  dismissedCommitmentEntries:[], // projected commitment entries manually hidden by the user
  smartTags: [],         // string[] — all known tag names, ordered by usage
  txnTagFilter: '',      // '' or tag name for filtering movimientos by tag
  tasks: [],             // [{id,text,done,createdAt,doneAt}]
  ccCards: [],           // [{id,name,type,color,...}]
  ccCycles: [],          // [{id,cardId,tcCycleId,status,manualExpenses,excludedIds,...}]
  ccActiveCard: null,    // currently selected card ID for CC compare
  gmailImportRules: [],
  bankProfiles: [],
  importConfig: {},
  automationPrefs: {},
  userProfiles: [],
  activeUserProfileId: null,
  profileTemplate: 'personal',
  onboardingState: {},
  userEmail: '',
  manualUserEmail: '',
  userAvatar: '',
  userAvatarMode: 'generated',
  userAvatarPreset: '',
  userPrefs: { currency:'ARS', language:'es', theme:'light' },
  googleProfile: null,
};

// ══ PERSIST ══
function getStateSnapshot(){
  if(typeof syncActiveUserProfileFromState === 'function'){
    try{ syncActiveUserProfileFromState(false); }catch(e){ console.warn('profile sync error', e); }
  }
  if(typeof normalizeCategoryState === 'function'){
    try{ normalizeCategoryState(state); }catch(e){ console.warn('category normalize error', e); }
  }
  return {
    savedAt:localStorage.getItem(LS_LOCAL_EDITED_AT)||null,
    transactions:state.transactions,categories:state.categories,categoryGroups:state.categoryGroups||[],income:state.income,dashMonth:state.dashMonth||null,dashView:state.dashView||'visa',dashTcCycle:state.dashTcCycle||null,tcCycles:state.tcCycles||[],hiddenTcCycles:state.hiddenTcCycles||[],balanceView:state.balanceView||'summary',
    txnFilterMode:state.txnFilterMode||'visa',tendMode:state.tendMode||'visa',repMode:state.repMode||'visa',
    savingsGoal:state.savingsGoal,alertThreshold:state.alertThreshold,spendPct:state.spendPct||100,insightsBufferMonths:state.insightsBufferMonths||3,tendChartMode:state.tendChartMode||'bar',imports:state.imports,
    cuotas:state.cuotas,autoCuotaConfig:state.autoCuotaConfig,subscriptions:state.subscriptions,fixedExpenses:state.fixedExpenses||[],
    incomeSources:state.incomeSources,incomeMonths:state.incomeMonths,
    savAccounts:state.savAccounts,savGoals:state.savGoals,savDeposits:state.savDeposits||[],savStages:state.savStages||[],savPlan:state.savPlan||null,movingCalc:state.movingCalc||null,tcConfig:state.tcConfig,viewCycleConfig:state.viewCycleConfig||{},
    usdRate:state.usdRate||1420,usdRateBuy:state.usdRateBuy||state.usdRate||1420,usdRateSell:state.usdRateSell||state.usdRate||1420,usdRateSource:state.usdRateSource||'blue',usdRateUpdated:state.usdRateUpdated||null,usdRateHistory:state.usdRateHistory||[],
    catRules:state.catRules||[],nameRules:state.nameRules||[],logoRules:state.logoRules||[],catHistory:state.catHistory||{},
    ccCards:state.ccCards||[],ccCycles:state.ccCycles||[],ccActiveCard:state.ccActiveCard||null,
    gmailImportRules:state.gmailImportRules||[],
    bankProfiles:state.bankProfiles||[],
    importConfig:state.importConfig||{},
    automationPrefs:state.automationPrefs||{},
    userProfiles:state.userProfiles||[],
    activeUserProfileId:state.activeUserProfileId||null,
    profileTemplate:state.profileTemplate||'personal',
    onboardingState:state.onboardingState||{},
    lastGmailSync:state.lastGmailSync||null,
    lastTransactionsExport:state.lastTransactionsExport||null,
    lastTransactionsRefresh:state.lastTransactionsRefresh||null,
    gmailClientId:state.gmailClientId||localStorage.getItem('fin_gmail_client_id')||'',
    userName:state.userName||'Pedro',
    userEmail:state.userEmail||'',
    manualUserEmail:state.manualUserEmail||'',
    userAvatar:state.userAvatar||'',
    userAvatarMode:state.userAvatarMode||'generated',
    userAvatarPreset:state.userAvatarPreset||'',
    userPrefs:state.userPrefs||{ currency:'ARS', language:'es', theme:(document.body?.classList?.contains('light-mode')?'light':'dark') },
    googleProfile:state.googleProfile||null,
    lastVisit:state.lastVisit||null,
    dismissedNotifs:state.dismissedNotifs||[],
    decisionCenterCollapsed:!!state.decisionCenterCollapsed,
    dismissedAutoCuotas:state.dismissedAutoCuotas||[],
    gmailDeletedIds:state.gmailDeletedIds||[],
    gmailAnulados:state.gmailAnulados||[],
    bankAccounts:state.bankAccounts||[],
    _bankAccountsInitialized:!!state._bankAccountsInitialized,
    sharedExpenseContacts:state.sharedExpenseContacts||[],
    caminoPlan:state.caminoPlan||null,
    dismissedCommitmentEntries:state.dismissedCommitmentEntries||[],
    tasks:state.tasks||[],
    txnCardFilter:state.txnCardFilter||'',
    smartTags:state.smartTags||[]
  };
}
// ── Blindaje: un snapshot vacío no debe pisar datos buenos ──
function isStateMeaningful(s){
  return !!(s && (
    (s.transactions&&s.transactions.length) ||
    (s.incomeMonths&&s.incomeMonths.length) ||
    (s.incomeSources&&s.incomeSources.length) ||
    (s.cuotas&&s.cuotas.length) ||
    (s.subscriptions&&s.subscriptions.length) ||
    (s.fixedExpenses&&s.fixedExpenses.length) ||
    (s.savDeposits&&s.savDeposits.length)
  ));
}
// Escribe fin_state salvo que el snapshot esté vacío y el guardado previo tenga datos
function safePersistLocalSnapshot(snapshot){
  try{
    if(!isStateMeaningful(snapshot)){
      const raw=localStorage.getItem('fin_state');
      if(raw){
        let prev=null;
        try{ prev=JSON.parse(raw); }catch(_){}
        if(prev===null || isStateMeaningful(prev)){
          console.warn('[guard] escritura a localStorage bloqueada: snapshot vacío sobre datos existentes');
          return false;
        }
      }
    }
    localStorage.setItem('fin_state',JSON.stringify(snapshot));
    return true;
  }catch(e){console.warn('localStorage error',e);return false;}
}
// ── Sincronización segura con Drive ──
// LS_LOCAL_EDITED_AT: última edición hecha en este dispositivo.
// LS_LAST_SYNCED_AT: versión (savedAt) que este dispositivo subió o bajó de Drive por última vez.
// Si hay ediciones locales posteriores a la última sincronización, al conectar Google no se
// pisan con Drive (ver resolveDriveConflict en loadFromDrive).
const LS_LOCAL_EDITED_AT='fin_local_edited_at';
const LS_LAST_SYNCED_AT='fin_last_synced_at';
function markLocalEdit(){
  if(window._appBooted) localStorage.setItem(LS_LOCAL_EDITED_AT,new Date().toISOString());
}
function hasUnsyncedLocalChanges(){
  const edited=localStorage.getItem(LS_LOCAL_EDITED_AT)||'';
  const synced=localStorage.getItem(LS_LAST_SYNCED_AT)||'';
  return !!edited && edited>synced;
}
function saveState(){
  markLocalEdit();
  const snapshot = getStateSnapshot();
  // Always save to localStorage as backup
  safePersistLocalSnapshot(snapshot);
  // Save to Drive silently in background (debounced)
  scheduleDriveSave(snapshot);
}

// ── Google Drive Storage ──
const DRIVE_FILE_NAME = 'finanzas-data.json';
let driveFileId = null;
let driveAccessToken = null;
let driveSaveTimer = null;
let driveTokenClient = null;
let driveReady = false;
// true SOLO cuando sabemos con certeza qué hay en Drive (carga exitosa o archivo confirmado inexistente)
let initialLoadComplete = false;

// `let state` no crea window.state — exponerlo para shell.js, splash.js y todo código que usa window.state
window.state = state;

// ── Trazas de sincronización: cronometra cada paso del login/carga de Drive ──
// Ver en consola: window._syncTrace  (detecta dónde se pierde tiempo si la carga es lenta)
window._syncTrace = [];
let _syncT0 = 0;
function _syncMark(step){
  const now = performance.now();
  if(!_syncT0) _syncT0 = now;
  const entry = {step, ms: Math.round(now - _syncT0)};
  window._syncTrace.push(entry);
  console.log('[sync]', entry.ms+'ms', step);
}

function getDriveScopes(){ return 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/gmail.readonly'; }

function initDriveClient(autoSync){
  const clientId = getGmailClientId();
  if(!clientId) return;
  _syncT0 = 0; window._syncTrace = [];
  initialLoadComplete = false; // reconexión = volver a verificar qué hay en Drive
  _syncMark('inicio conexión Google');
  loadGoogleScript(()=>{
    _syncMark('script de Google cargado');
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: getDriveScopes(),
      callback:(resp)=>{
        const _wasReconnect=!!window._driveReconnecting;
        window._driveReconnecting=false;
        if(resp.error){
          console.warn('Drive auth error:',resp.error);
          if(_wasReconnect && typeof showToast==='function') showToast('⚠️ Se cortó la conexión con Google: tus cambios están en este dispositivo pero no en Drive. Volvé a conectar Google.','error');
          return;
        }
        if(_wasReconnect) autoSync=false;
        _syncMark('token recibido de Google');
        driveAccessToken = resp.access_token;
        gmailAccessToken = resp.access_token;
        state.onboardingState = { ...(state.onboardingState || {}), google: true };
        safePersistLocalSnapshot(getStateSnapshot());
        _syncMark('snapshot local guardado');
        updateGmailBtn('connected');
        driveReady = true;
        if(typeof showToast==='function') showToast('☁️ Sincronizando con Google Drive…','info');
        if(typeof fetchGoogleProfile === 'function') fetchGoogleProfile(true);
        loadFromDrive().then(loaded=>{
          _syncMark('loadFromDrive resuelto (loaded='+loaded+')');
          if(loaded){
            if(state.transactions.length){document.getElementById('dash-empty').style.display='none';document.getElementById('dash-content').style.display='flex';}
            updateSidebarStats();renderDashboard();renderTransactions();renderCuotas();
            _syncMark('renders completados');
          }
          if(typeof renderSettingsPage === 'function') renderSettingsPage();
          if(typeof renderOnboardingWizard === 'function') renderOnboardingWizard();
          const totalMs=window._syncTrace.length?window._syncTrace[window._syncTrace.length-1].ms:0;
          if(totalMs>8000){
            console.warn('[sync] CARGA LENTA ('+Math.round(totalMs/1000)+'s) — detalle:', JSON.stringify(window._syncTrace));
            if(typeof showToast==='function') showToast('⚠️ La sincronización tardó '+Math.round(totalMs/1000)+'s — detalle en consola','info');
          } else if(typeof showToast==='function' && loaded){
            showToast('✓ Datos sincronizados','success');
          } else if(typeof showToast==='function' && !loaded && !initialLoadComplete){
            showToast('⚠️ No se pudo sincronizar con Drive — tus datos locales están a salvo, recargá para reintentar','error');
          }
          // Auto-sync DESACTIVADO — nunca sincronizar automáticamente
          if(autoSync||window._gmailSyncPending){window._gmailSyncPending=false;openGmailPeriodModal();}
        });
      }
    });
    _syncMark('pidiendo token (silencioso)…');
    driveTokenClient.requestAccessToken({prompt:''});
  });
}

function scheduleDriveSave(snapshot){
  if(!driveReady || !driveAccessToken) return;
  if(!initialLoadComplete){
    console.warn('[guard] guardado bloqueado: carga inicial de Drive no terminada');
    return;
  }
  clearTimeout(driveSaveTimer);
  driveSaveTimer = setTimeout(()=>saveToDrive(snapshot), 1500);
}

async function readGoogleResponse(res, fallbackMessage){
  let data = null;
  try { data = await res.json(); } catch(_) {}
  if(!res.ok){
    const msg = data?.error?.message || fallbackMessage || `Google API error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function saveToDrive(snapshot){
  if(!driveAccessToken) return;
  try{
    const content = JSON.stringify(snapshot);
    const blob = new Blob([content],{type:'application/json'});

    if(!driveFileId){
      // Find existing file first
      driveFileId = await findDriveFile();
    }

    if(driveFileId){
      // Update existing file
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,{
        method:'PATCH',
        headers:{'Authorization':'Bearer '+driveAccessToken,'Content-Type':'application/json'},
        body: content
      });
      if(!res.ok) await readGoogleResponse(res, 'No se pudo actualizar el archivo principal en Drive');
    } else {
      // Create new file in appDataFolder
      const meta = {name:DRIVE_FILE_NAME, parents:['appDataFolder']};
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)],{type:'application/json'}));
      form.append('file', blob);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
        method:'POST',
        headers:{'Authorization':'Bearer '+driveAccessToken},
        body: form
      });
      const data = await readGoogleResponse(res, 'No se pudo crear el archivo principal en Drive');
      if(!data?.id) throw new Error('Google Drive no devolvió un ID para el archivo principal');
      driveFileId = data.id;
    }
    // Update Drive indicator silently
    const dot = document.getElementById('gmail-sync-dot');
    if(dot){ dot.style.background='var(--accent)'; setTimeout(()=>dot.style.background='var(--accent2)',2000); }
    localStorage.setItem(LS_LAST_SYNCED_AT, snapshot.savedAt||new Date().toISOString());
  }catch(e){
    console.warn('Drive save error:',e);
    if(e.status===401 || e.status===403){
      // El permiso de Google dura ~1 hora. Antes quedaba sin guardar en Drive sin avisar
      // (y otro dispositivo seguía con la copia vieja). Ahora se reconecta en silencio:
      // al volver, loadFromDrive ve los cambios locales sin subir y los sube.
      driveAccessToken=null; driveReady=false;
      if(driveTokenClient && !window._driveReconnecting){
        window._driveReconnecting=true;
        if(typeof showToast==='function') showToast('Reconectando con Google para guardar tus cambios en Drive…','info');
        try{ driveTokenClient.requestAccessToken({prompt:''}); }catch(_){ window._driveReconnecting=false; }
      }
    } else if(typeof showToast==='function'){
      showToast('⚠️ No se pudo guardar en Google Drive. Tus datos quedan en este dispositivo; se reintenta en el próximo cambio.','error');
    }
  }
}

async function findDriveFile(){
  // Si la consulta falla, PROPAGA el error — null significa únicamente "confirmado: no existe"
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${DRIVE_FILE_NAME}%27&fields=files(id,modifiedTime)&orderBy=modifiedTime%20desc`,{
    headers:{'Authorization':'Bearer '+driveAccessToken}
  });
  const data = await readGoogleResponse(res, 'No se pudo consultar el archivo principal en Drive');
  return data.files&&data.files.length ? data.files[0].id : null;
}

async function loadFromDrive(){
  if(!driveAccessToken) return false;
  try{
    _syncMark('buscando archivo en Drive…');
    const fileId = await findDriveFile();
    _syncMark('archivo encontrado: '+(fileId?'sí':'no'));
    if(!fileId){
      // Consulta exitosa con cero resultados: usuario nuevo real (si hubiera fallado la red,
      // findDriveFile habría tirado error y saltado al catch sin pasar por acá)
      initialLoadComplete = true;
      _syncMark('confirmado: no hay archivo en Drive (primera vez)');
      // Migrar localStorage existente a Drive para no perderlo
      const raw=localStorage.getItem('fin_state');
      if(raw){
        const snap=JSON.parse(raw);
        await saveToDrive(snap);
      }
      return false;
    }
    driveFileId = fileId;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{
      headers:{'Authorization':'Bearer '+driveAccessToken}
    });
    if(!res.ok){ _syncMark('descarga falló: HTTP '+res.status); return false; }
    const s = await res.json();
    _syncMark('archivo descargado y parseado');
    // Cambios en este dispositivo que todavía no subieron: no pisarlos con Drive
    if(hasUnsyncedLocalChanges() && isStateMeaningful(getStateSnapshot())){
      const synced=localStorage.getItem(LS_LAST_SYNCED_AT)||'';
      const driveChanged=!synced || (s.savedAt||'')>synced;
      const keepLocal=!driveChanged || confirm(
        'Hay cambios en este dispositivo que no están en Google Drive, y Drive también cambió desde otro lado.\n\n'+
        'Aceptar: conservar los datos de ESTE dispositivo (se suben a Drive).\n'+
        'Cancelar: usar los datos de Drive (se pierden los cambios de este dispositivo).'
      );
      if(keepLocal){
        initialLoadComplete = true;
        _syncMark('conservando cambios locales y subiéndolos a Drive');
        await saveToDrive(getStateSnapshot());
        return true;
      }
    }
    // Apply loaded state (same as loadState logic)
    state.transactions=(s.transactions||[]).map(t=>({...t,date:new Date(t.date)}));
    state.categories=s.categories||[...DEFAULT_CATS];
    state.categoryGroups=s.categoryGroups||state.categoryGroups||[...DEFAULT_CATEGORY_GROUPS];
    state.income=s.income||state.income;
    state.savingsGoal=s.savingsGoal||20;
    state.alertThreshold=s.alertThreshold||80;
    state.spendPct=s.spendPct||100;
    state.insightsBufferMonths=s.insightsBufferMonths||3;
    state.tendChartMode=s.tendChartMode||'bar';
    state.imports=s.imports||[];
    state.cuotas=s.cuotas||[];
    state.autoCuotaConfig=s.autoCuotaConfig||{};
    state.subscriptions=s.subscriptions||[];
    state.fixedExpenses=s.fixedExpenses||[];
    state.incomeSources=s.incomeSources||[];
    state.incomeMonths=s.incomeMonths||[];
    state.savAccounts=s.savAccounts||[];
    state.savGoals=s.savGoals||[];
    state.savDeposits=s.savDeposits||[];
    state.savStages=s.savStages||[];
    state.savPlan=s.savPlan||null;
    state.movingCalc=s.movingCalc||null;
    if(s.tcConfig)state.tcConfig={...state.tcConfig,...s.tcConfig};
    if(s.viewCycleConfig){
      state.viewCycleConfig={
        visa:{...(state.viewCycleConfig?.visa||{}),...(s.viewCycleConfig.visa||{})},
        amex:{...(state.viewCycleConfig?.amex||{}),...(s.viewCycleConfig.amex||{})}
      };
    }
    state.dashMonth=s.dashMonth||null;
    state.dashView=s.dashView||'visa';
    state.dashTcCycle=s.dashTcCycle||null;
    state.tcCycles=s.tcCycles||[];
    state.hiddenTcCycles=s.hiddenTcCycles||[];
    state.usdRate=s.usdRate||1420;
    state.usdRateBuy=s.usdRateBuy||s.usdRate||1420;
    state.usdRateSell=s.usdRateSell||s.usdRate||1420;
    state.usdRateSource=s.usdRateSource||'blue';
    state.usdRateUpdated=s.usdRateUpdated||null;
    state.usdRateHistory=Array.isArray(s.usdRateHistory)?s.usdRateHistory:[];
    USD_TO_ARS=state.usdRate;
    state.catRules=s.catRules||[];
    state.nameRules=s.nameRules||[];
    state.logoRules=s.logoRules||[];
    state.catHistory=s.catHistory||{};
    state.ccCards=s.ccCards||[];
    state.ccCycles=s.ccCycles||[];
    state.ccActiveCard=s.ccActiveCard||null;
    state.gmailImportRules=s.gmailImportRules||[];
    state.bankProfiles=s.bankProfiles||[];
    state.importConfig=s.importConfig||{};
    state.automationPrefs=s.automationPrefs||{};
    state.userProfiles=s.userProfiles||[];
    state.activeUserProfileId=s.activeUserProfileId||null;
    state.profileTemplate=s.profileTemplate||'personal';
    state.onboardingState=s.onboardingState||{};
    state.lastGmailSync=s.lastGmailSync||null;
    state.lastTransactionsExport=s.lastTransactionsExport||null;
    state.lastTransactionsRefresh=s.lastTransactionsRefresh||null;
    state.balanceView=s.balanceView||state.balanceView||'summary';
    state.gmailClientId=s.gmailClientId||'';
    state.userEmail=s.userEmail||'';
    state.manualUserEmail=s.manualUserEmail||'';
    state.userAvatar=s.userAvatar||'';
    state.userAvatarMode=s.userAvatarMode||state.userAvatarMode||'generated';
    state.userAvatarPreset=s.userAvatarPreset||'';
    state.userPrefs=s.userPrefs||state.userPrefs||{ currency:'ARS', language:'es', theme:'light' };
    state.googleProfile=s.googleProfile||null;
    state.decisionCenterCollapsed=!!s.decisionCenterCollapsed;
    state.dismissedAutoCuotas=s.dismissedAutoCuotas||[];
    state.gmailDeletedIds=s.gmailDeletedIds||[];
    state.gmailAnulados=s.gmailAnulados||[];
    if(Array.isArray(s.bankAccounts)){ state.bankAccounts=s.bankAccounts; state._bankAccountsInitialized=!!s._bankAccountsInitialized||s.bankAccounts.length>0; }
    state.sharedExpenseContacts=s.sharedExpenseContacts||state.sharedExpenseContacts||[];
    state.caminoPlan=s.caminoPlan||state.caminoPlan||null;
    state.dismissedNotifs=s.dismissedNotifs||state.dismissedNotifs||[];
    if(s.userName) state.userName=s.userName;
    state.dismissedCommitmentEntries=s.dismissedCommitmentEntries||[];
    state.tasks=s.tasks||[];
    state.txnCardFilter=s.txnCardFilter||'';
    state.smartTags=s.smartTags||[];
    state.txnFilterMode=_normalizeViewMode(s.txnFilterMode||state.txnFilterMode||'visa');
    state.tendMode=_normalizeViewMode(s.tendMode||state.tendMode||'visa');
    state.dashView=_normalizeViewMode(s.dashView||state.dashView||'visa');
    state.repMode=_normalizeViewMode(s.repMode||state.repMode||'visa');
    if(typeof normalizeCategoryState === 'function'){
      try{ normalizeCategoryState(state); }catch(e){ console.warn('category normalize error', e); }
    }
    state.transactions.forEach(t=>{if(!t.tags)t.tags=[];if(!t.week)t.week=getWeekKey(t.date);if(!t.month)t.month=getMonthKey(t.date);});
    // Migración retroactiva de payMethod con valores legacy del formulario manual
    const _pmMig={'Efectivo':'ef','Débito':'deb','Tarjeta de Crédito':'tc','USD':'ef'};
    state.transactions.forEach(t=>{if(t.payMethod&&_pmMig[t.payMethod])t.payMethod=_pmMig[t.payMethod];});
    // Migración retroactiva: los gastos importados desde Gmail conservan el comercio original del correo.
    if(typeof enrichTransaction === 'function'){
      state.transactions.forEach(t=>enrichTransaction(t, t.origen_del_movimiento||'importado_desde_resumen'));
    }
    if(typeof normalizeTcCyclesForConsistency === 'function'){
      try{ normalizeTcCyclesForConsistency(); }catch(e){ console.warn('tc cycle normalize error', e); }
    }
    if(typeof migrateCuotasToSingleSource === 'function'){
      try{ migrateCuotasToSingleSource(); }catch(e){ console.warn('cuotas migration error', e); }
    }
    if(typeof normalizeImportedSubscriptions === 'function'){
      try{ normalizeImportedSubscriptions(); }catch(e){ console.warn('subscriptions migration error', e); }
    }
    // Este dispositivo queda igual a la versión de Drive
    const _driveVersion=s.savedAt||new Date().toISOString();
    localStorage.setItem(LS_LOCAL_EDITED_AT,_driveVersion);
    localStorage.setItem(LS_LAST_SYNCED_AT,_driveVersion);
    // Also persist to localStorage
    try{
      localStorage.setItem('fin_state',JSON.stringify(getStateSnapshot()));
      if(state.gmailClientId) localStorage.setItem('fin_gmail_client_id', state.gmailClientId);
    }catch(e){}
    if(typeof ensureActiveUserProfileBootstrap === 'function'){
      try{ ensureActiveUserProfileBootstrap(); }catch(e){ console.warn('profile bootstrap error', e); }
    }
    _syncMark('estado aplicado ('+(state.transactions||[]).length+' txns)');
    initialLoadComplete = true;
    return true;
  }catch(e){
    console.warn('Drive load error:',e);
    _syncMark('ERROR en loadFromDrive: '+(e&&e.message||e));
    // initialLoadComplete queda en false: autosave a Drive bloqueado hasta una carga exitosa
    return false;
  }
}
function loadState(){
  try{
    const raw=localStorage.getItem('fin_state');if(!raw)return;const s=JSON.parse(raw);
    state.transactions=(s.transactions||[]).map(t=>({...t,date:new Date(t.date)}));
    state.categories=s.categories||[...DEFAULT_CATS];state.categoryGroups=s.categoryGroups||state.categoryGroups||[...DEFAULT_CATEGORY_GROUPS];state.income=s.income||state.income;
    state.savingsGoal=s.savingsGoal||20;state.alertThreshold=s.alertThreshold||80;state.spendPct=s.spendPct||100;state.insightsBufferMonths=s.insightsBufferMonths||3;state.tendChartMode=s.tendChartMode||'bar';
    state.imports=s.imports||[];state.cuotas=s.cuotas||[];state.autoCuotaConfig=s.autoCuotaConfig||{};
    state.subscriptions=s.subscriptions||[];
    state.fixedExpenses=s.fixedExpenses||[];
    state.incomeSources=s.incomeSources||[];state.incomeMonths=s.incomeMonths||[];
    state.savAccounts=s.savAccounts||[];state.savGoals=s.savGoals||[];state.savDeposits=s.savDeposits||[];state.savStages=s.savStages||[];state.savPlan=s.savPlan||null;state.movingCalc=s.movingCalc||null;
    if(s.tcConfig)state.tcConfig={...state.tcConfig,...s.tcConfig};
    if(s.viewCycleConfig){
      state.viewCycleConfig={
        visa:{...(state.viewCycleConfig?.visa||{}),...(s.viewCycleConfig.visa||{})},
        amex:{...(state.viewCycleConfig?.amex||{}),...(s.viewCycleConfig.amex||{})}
      };
    }
    state.dashMonth=s.dashMonth||null;
    state.dashView=s.dashView||'visa';
    state.dashTcCycle=s.dashTcCycle||null;
    state.tcCycles=s.tcCycles||[];
    state.hiddenTcCycles=s.hiddenTcCycles||[];
    state.usdRate=s.usdRate||1420;
    state.usdRateBuy=s.usdRateBuy||s.usdRate||1420;
    state.usdRateSell=s.usdRateSell||s.usdRate||1420;
    state.usdRateSource=s.usdRateSource||'blue';
    state.usdRateUpdated=s.usdRateUpdated||null;
    state.usdRateHistory=Array.isArray(s.usdRateHistory)?s.usdRateHistory:[];
    USD_TO_ARS=state.usdRate;
    state.catRules=s.catRules||[];
    state.nameRules=s.nameRules||[];
    state.logoRules=s.logoRules||[];
    state.catHistory=s.catHistory||{};
    state.ccCards=s.ccCards||[];
    state.ccCycles=s.ccCycles||[];
    state.ccActiveCard=s.ccActiveCard||null;
    state.gmailImportRules=s.gmailImportRules||[];
    state.bankProfiles=s.bankProfiles||[];
    state.importConfig=s.importConfig||{};
    state.automationPrefs=s.automationPrefs||{};
    state.userProfiles=s.userProfiles||[];
    state.activeUserProfileId=s.activeUserProfileId||null;
    state.profileTemplate=s.profileTemplate||'personal';
    state.onboardingState=s.onboardingState||{};
    state.lastGmailSync=s.lastGmailSync||null;
    state.lastTransactionsExport=s.lastTransactionsExport||null;
    state.lastTransactionsRefresh=s.lastTransactionsRefresh||null;
    state.balanceView=s.balanceView||state.balanceView||'summary';
    state.gmailClientId=s.gmailClientId||localStorage.getItem('fin_gmail_client_id')||'';
    state.userEmail=s.userEmail||'';
    state.manualUserEmail=s.manualUserEmail||'';
    state.userAvatar=s.userAvatar||'';
    state.userAvatarMode=s.userAvatarMode||state.userAvatarMode||'generated';
    state.userAvatarPreset=s.userAvatarPreset||'';
    state.userPrefs=s.userPrefs||state.userPrefs||{ currency:'ARS', language:'es', theme:'light' };
    state.googleProfile=s.googleProfile||null;
    state.decisionCenterCollapsed=!!s.decisionCenterCollapsed;
    state.dismissedAutoCuotas=s.dismissedAutoCuotas||[];
    state.gmailDeletedIds=s.gmailDeletedIds||[];
    state.gmailAnulados=s.gmailAnulados||[];
    if(Array.isArray(s.bankAccounts)){ state.bankAccounts=s.bankAccounts; state._bankAccountsInitialized=!!s._bankAccountsInitialized||s.bankAccounts.length>0; }
    state.sharedExpenseContacts=s.sharedExpenseContacts||state.sharedExpenseContacts||[];
    state.caminoPlan=s.caminoPlan||state.caminoPlan||null;
    state.dismissedNotifs=s.dismissedNotifs||state.dismissedNotifs||[];
    if(s.userName) state.userName=s.userName;
    state.dismissedCommitmentEntries=s.dismissedCommitmentEntries||[];
    state.tasks=s.tasks||[];
    state.txnCardFilter=s.txnCardFilter||'';
    state.smartTags=s.smartTags||[];
    localStorage.removeItem('fin_apikey'); // la categorización con IA se eliminó: no dejar la key guardada
    state.txnFilterMode=_normalizeViewMode(s.txnFilterMode||state.txnFilterMode||'visa');
    state.tendMode=_normalizeViewMode(s.tendMode||state.tendMode||'visa');
    state.dashView=_normalizeViewMode(s.dashView||state.dashView||'visa');
    state.repMode=_normalizeViewMode(s.repMode||state.repMode||'visa');
    if(typeof normalizeCategoryState === 'function'){
      try{ normalizeCategoryState(state); }catch(e){ console.warn('category normalize error', e); }
    }
    state.transactions.forEach(t=>{if(!t.tags)t.tags=[];if(!t.week)t.week=getWeekKey(t.date);if(!t.month)t.month=getMonthKey(t.date);});
    // Migración retroactiva de payMethod con valores legacy del formulario manual
    const _pmMigMap={'Efectivo':'ef','Débito':'deb','Tarjeta de Crédito':'tc','USD':'ef'};
    state.transactions.forEach(t=>{if(t.payMethod&&_pmMigMap[t.payMethod])t.payMethod=_pmMigMap[t.payMethod];});
    // Enrichment retroactivo: origen, nombre original Gmail, reglas y logos.
    if(typeof enrichTransaction === 'function'){
      state.transactions.forEach(t=>enrichTransaction(t, t.origen_del_movimiento||'importado_desde_resumen'));
    }
    if(typeof normalizeTcCyclesForConsistency === 'function'){
      try{ normalizeTcCyclesForConsistency(); }catch(e){ console.warn('tc cycle normalize error', e); }
    }
    if(typeof migrateCuotasToSingleSource === 'function'){
      try{ migrateCuotasToSingleSource(); }catch(e){ console.warn('cuotas migration error', e); }
    }
    if(typeof normalizeImportedSubscriptions === 'function'){
      try{ normalizeImportedSubscriptions(); }catch(e){ console.warn('subscriptions migration error', e); }
    }
    // populate legacy hidden fields for dashboard compat
    const latestInc=getLatestIncomeARS();if(latestInc)state.income.ars=latestInc;
    const incSave=document.getElementById('inc-save');const incAlert=document.getElementById('inc-alert');
    if(incSave)incSave.value=state.savingsGoal;if(incAlert)incAlert.value=state.alertThreshold;
    const incSpendPct=document.getElementById('inc-spend-pct');
    if(incSpendPct)incSpendPct.value=state.spendPct<100?state.spendPct:'';
    if(typeof ensureActiveUserProfileBootstrap === 'function'){
      try{ ensureActiveUserProfileBootstrap(); }catch(e){ console.warn('profile bootstrap error', e); }
    }

  }catch(e){console.warn('loadState error',e);}
}

function _normalizeViewMode(mode){
  if(mode==='mes'||mode==='amex') return mode;
  return 'visa';
}

// ── Varias ventanas abiertas a la vez (navegador + app en la pantalla de inicio) ──
// Cada ventana tiene su copia en memoria: si una guardaba con datos viejos, pisaba lo que se
// cambió en la otra (un gasto borrado volvía a aparecer). Cuando otra ventana guarda, esta
// recarga los datos guardados antes de seguir.
window.addEventListener('storage', e => {
  if(e.key!=='fin_state' || !e.newValue || !window._appBooted) return;
  clearTimeout(window._externalStateTimer);
  window._externalStateTimer=setTimeout(()=>{
    try{
      loadState();
      if(typeof refreshAll==='function') refreshAll();
      if(typeof showToast==='function') showToast('Datos actualizados desde otra ventana','info');
    }catch(err){ console.warn('external state reload error', err); }
  }, 300);
});
