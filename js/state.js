// ══ STATE ══
let state={
  transactions:[],categories:[...DEFAULT_CATS],
  income:{ars:0,varArs:0,usd:0,varUsd:0},
  savingsGoal:20,alertThreshold:80,spendPct:100,tendChartMode:'bar',
  imports:[],compareMode:'month',repDesign:'executive',tendMode:'week',
  activeTendCats:null,
  _selectedTxns:new Set(),
  cuotas:[],autoCuotaConfig:{},subscriptions:[],fixedExpenses:[],
  // NEW
  incomeSources:[],      // [{id,name,type,currency,base,color}]
  incomeMonths:[],       // [{id,month:'2025-03',sources:{srcId:amount},extraArs,extraUsd,note}]
  savAccounts:[],        // [{id,name,emoji,balance,currency,type,yieldPct,color}]
  savGoals:[],           // [{id,name,emoji,target,currency,current,deadline,accountId,color}]
  savDeposits:[],        // [{id,month:'2025-03',accountId,amount,currency,note}] — 100% manual
  incViewCurrency:'ARS',
  tcConfig:{cardName:'',closeDay:0,dueDay:0,limit:0,mixTarget:70},
  tcCycles:[],
  dashTcCycle:null,
  dashView:'mes',
  chartMode:'bars',
  dashMonth:null,
  txnFilterMode:'mes',
  charts:{},_assigningTxnId:null,apiKey:'',
  catRules:[],           // [{id, keyword, category, active, priority}]
  catHistory:{},         // {comercio_normalized: {cat: count}} — aprendizaje local
  txnEstadoFilter:'all', // 'all'|'pendiente_de_revision'|'duplicado_sospechoso'|'confirmado_por_usuario'|'detectado_automaticamente'
  txnCardFilter:'',      // ''|'visa'|'amex' — card filter in transactions view
  lastGmailSync: null,
  userName: 'Pedro',
  lastVisit: null,
  dismissedNotifs: [],   // IDs of notifications the user dismissed
  decisionCenterCollapsed:false,
  dismissedAutoCuotas:[], // keys of auto-cuotas permanently dismissed
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
};

// ══ PERSIST ══
function getStateSnapshot(){
  if(typeof syncActiveUserProfileFromState === 'function'){
    try{ syncActiveUserProfileFromState(false); }catch(e){ console.warn('profile sync error', e); }
  }
  return {
    transactions:state.transactions,categories:state.categories,income:state.income,dashMonth:state.dashMonth||null,dashView:state.dashView||'mes',dashTcCycle:state.dashTcCycle||null,tcCycles:state.tcCycles||[],
    savingsGoal:state.savingsGoal,alertThreshold:state.alertThreshold,spendPct:state.spendPct||100,tendChartMode:state.tendChartMode||'bar',imports:state.imports,
    cuotas:state.cuotas,autoCuotaConfig:state.autoCuotaConfig,subscriptions:state.subscriptions,fixedExpenses:state.fixedExpenses||[],
    incomeSources:state.incomeSources,incomeMonths:state.incomeMonths,
    savAccounts:state.savAccounts,savGoals:state.savGoals,savDeposits:state.savDeposits||[],tcConfig:state.tcConfig,
    usdRate:state.usdRate||1420,usdRateBuy:state.usdRateBuy||state.usdRate||1420,usdRateSell:state.usdRateSell||state.usdRate||1420,usdRateSource:state.usdRateSource||'blue',usdRateUpdated:state.usdRateUpdated||null,
    catRules:state.catRules||[],catHistory:state.catHistory||{},
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
    gmailClientId:state.gmailClientId||localStorage.getItem('fin_gmail_client_id')||'',
    userName:state.userName||'Pedro',
    lastVisit:state.lastVisit||null,
    dismissedNotifs:state.dismissedNotifs||[],
    decisionCenterCollapsed:!!state.decisionCenterCollapsed,
    dismissedAutoCuotas:state.dismissedAutoCuotas||[],
    txnCardFilter:state.txnCardFilter||''
  };
}
function saveState(){
  const snapshot = getStateSnapshot();
  // Always save to localStorage as backup
  try{localStorage.setItem('fin_state',JSON.stringify(snapshot));}catch(e){console.warn('localStorage error',e);}
  // Save to Drive silently in background (debounced)
  scheduleDriveSave(snapshot);
}

// ── Google Drive Storage ──
const DRIVE_FILE_NAME = 'finanzas-data.json';
const DRIVE_PUBLIC_FILE_NAME = 'finanzas-data-sync.json';
const DRIVE_SYNC_FOLDER_NAME = 'FinanzasApp';
let driveFileId = null;
let drivePublicFileId = null;
let driveSyncFolderId = null;
let driveAccessToken = null;
let driveSaveTimer = null;
let driveTokenClient = null;
let driveReady = false;

function getDriveScopes(){ return 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.readonly'; }

function initDriveClient(autoSync){
  const clientId = getGmailClientId();
  if(!clientId) return;
  loadGoogleScript(()=>{
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: getDriveScopes(),
      callback:(resp)=>{
        if(resp.error){console.warn('Drive auth error:',resp.error);return;}
        driveAccessToken = resp.access_token;
        gmailAccessToken = resp.access_token;
        state.onboardingState = { ...(state.onboardingState || {}), google: true };
        try{localStorage.setItem('fin_state',JSON.stringify(getStateSnapshot()));}catch(e){}
        updateGmailBtn('connected');
        driveReady = true;
        loadFromDrive().then(loaded=>{
          if(loaded){
            if(state.transactions.length){document.getElementById('dash-empty').style.display='none';document.getElementById('dash-content').style.display='flex';}
            updateSidebarStats();renderDashboard();renderTransactions();renderCuotas();
          }
          if(typeof renderSettingsPage === 'function') renderSettingsPage();
          if(typeof renderOnboardingWizard === 'function') renderOnboardingWizard();
          if(typeof refreshSplashGoogleState === 'function') refreshSplashGoogleState(true);
          // Auto-sync DESACTIVADO — nunca sincronizar automáticamente
          if(autoSync||window._gmailSyncPending){window._gmailSyncPending=false;openGmailPeriodModal();}
        });
      }
    });
    driveTokenClient.requestAccessToken({prompt:''});
  });
}

function scheduleDriveSave(snapshot){
  if(!driveReady || !driveAccessToken) return;
  clearTimeout(driveSaveTimer);
  driveSaveTimer = setTimeout(()=>saveToDrive(snapshot), 1500);
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
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,{
        method:'PATCH',
        headers:{'Authorization':'Bearer '+driveAccessToken,'Content-Type':'application/json'},
        body: content
      });
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
      const data = await res.json();
      driveFileId = data.id;
    }
    // Update Drive indicator silently
    const dot = document.getElementById('gmail-sync-dot');
    if(dot){ dot.style.background='var(--accent)'; setTimeout(()=>dot.style.background='var(--accent2)',2000); }
    saveToDrivePublic(snapshot).catch(e=>console.warn('Public sync error:',e));
  }catch(e){
    console.warn('Drive save error:',e);
    if(e.message&&e.message.includes('401')){ driveAccessToken=null; driveReady=false; }
  }
}

async function findDriveFile(){
  try{
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${DRIVE_FILE_NAME}%27&fields=files(id)`,{
      headers:{'Authorization':'Bearer '+driveAccessToken}
    });
    const data = await res.json();
    return data.files&&data.files.length ? data.files[0].id : null;
  }catch(e){ return null; }
}

async function saveToDrivePublic(snapshot){
  if(!driveAccessToken) return;
  try{
    const content = JSON.stringify(snapshot);
    if(!drivePublicFileId){
      const q = encodeURIComponent("name='"+DRIVE_PUBLIC_FILE_NAME+"' and trashed=false");
      const res = await fetch('https://www.googleapis.com/drive/v3/files?q='+q+'&fields=files(id)',{
        headers:{'Authorization':'Bearer '+driveAccessToken}
      });
      const data = await res.json();
      if(data.files && data.files.length) drivePublicFileId = data.files[0].id;
    }
    if(drivePublicFileId){
      await fetch('https://www.googleapis.com/upload/drive/v3/files/'+drivePublicFileId+'?uploadType=media',{
        method:'PATCH',
        headers:{'Authorization':'Bearer '+driveAccessToken,'Content-Type':'application/json'},
        body: content
      });
    } else {
      const meta = {name:DRIVE_PUBLIC_FILE_NAME};
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)],{type:'application/json'}));
      form.append('file', new Blob([content],{type:'application/json'}));
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
        method:'POST',
        headers:{'Authorization':'Bearer '+driveAccessToken},
        body: form
      });
      const data = await res.json();
      drivePublicFileId = data.id;
    }
  }catch(e){ console.warn('Error guardando copia publica en Drive:',e); }
}

async function loadFromDrive(){
  if(!driveAccessToken) return false;
  try{
    const fileId = await findDriveFile();
    if(!fileId){
      // No Drive file yet — migrate localStorage data to Drive
      const raw=localStorage.getItem('fin_state');
      if(raw){
        const snap=JSON.parse(raw);
        // Save existing localStorage data to Drive so it's not lost
        await saveToDrive(snap);
      }
      return false;
    }
    driveFileId = fileId;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{
      headers:{'Authorization':'Bearer '+driveAccessToken}
    });
    if(!res.ok) return false;
    const s = await res.json();
    // Apply loaded state (same as loadState logic)
    state.transactions=(s.transactions||[]).map(t=>({...t,date:new Date(t.date)}));
    state.categories=s.categories||[...DEFAULT_CATS];if(state.categories.length&&!state.categories[0].group){state.categories=[...DEFAULT_CATS];}
    state.income=s.income||state.income;
    state.savingsGoal=s.savingsGoal||20;
    state.alertThreshold=s.alertThreshold||80;
    state.spendPct=s.spendPct||100;
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
    if(s.tcConfig)state.tcConfig={...state.tcConfig,...s.tcConfig};
    state.dashMonth=s.dashMonth||null;
    state.dashView=s.dashView||'mes';
    state.dashTcCycle=s.dashTcCycle||null;
    state.tcCycles=s.tcCycles||[];
    state.usdRate=s.usdRate||1420;
    state.usdRateBuy=s.usdRateBuy||s.usdRate||1420;
    state.usdRateSell=s.usdRateSell||s.usdRate||1420;
    state.usdRateSource=s.usdRateSource||'blue';
    state.usdRateUpdated=s.usdRateUpdated||null;
    USD_TO_ARS=state.usdRate;
    state.catRules=s.catRules||[];
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
    state.gmailClientId=s.gmailClientId||'';
    state.decisionCenterCollapsed=!!s.decisionCenterCollapsed;
    state.dismissedAutoCuotas=s.dismissedAutoCuotas||[];
    state.txnCardFilter=s.txnCardFilter||'';
    state.transactions.forEach(t=>{if(!t.week)t.week=getWeekKey(t.date);if(!t.month)t.month=getMonthKey(t.date);});
    // Migración retroactiva de payMethod con valores legacy del formulario manual
    const _pmMig={'Efectivo':'ef','Débito':'deb','Tarjeta de Crédito':'tc','USD':'ef'};
    state.transactions.forEach(t=>{if(t.payMethod&&_pmMig[t.payMethod])t.payMethod=_pmMig[t.payMethod];});
    // Also persist to localStorage
    try{
      localStorage.setItem('fin_state',JSON.stringify(s));
      if(state.gmailClientId) localStorage.setItem('fin_gmail_client_id', state.gmailClientId);
    }catch(e){}
    return true;
  }catch(e){
    console.warn('Drive load error:',e);
    return false;
  }
}
function loadState(){
  try{
    const raw=localStorage.getItem('fin_state');if(!raw)return;const s=JSON.parse(raw);
    state.transactions=(s.transactions||[]).map(t=>({...t,date:new Date(t.date)}));
    state.categories=s.categories||[...DEFAULT_CATS];if(state.categories.length&&!state.categories[0].group){state.categories=[...DEFAULT_CATS];}state.income=s.income||state.income;
    state.savingsGoal=s.savingsGoal||20;state.alertThreshold=s.alertThreshold||80;state.spendPct=s.spendPct||100;state.tendChartMode=s.tendChartMode||'bar';
    state.imports=s.imports||[];state.cuotas=s.cuotas||[];state.autoCuotaConfig=s.autoCuotaConfig||{};
    state.subscriptions=s.subscriptions||[];
    state.fixedExpenses=s.fixedExpenses||[];
    state.incomeSources=s.incomeSources||[];state.incomeMonths=s.incomeMonths||[];
    state.savAccounts=s.savAccounts||[];state.savGoals=s.savGoals||[];state.savDeposits=s.savDeposits||[];
    if(s.tcConfig)state.tcConfig={...state.tcConfig,...s.tcConfig};
    state.dashMonth=s.dashMonth||null;
    state.dashView=s.dashView||'mes';
    state.dashTcCycle=s.dashTcCycle||null;
    state.tcCycles=s.tcCycles||[];
    state.usdRate=s.usdRate||1420;
    state.usdRateBuy=s.usdRateBuy||s.usdRate||1420;
    state.usdRateSell=s.usdRateSell||s.usdRate||1420;
    state.usdRateSource=s.usdRateSource||'blue';
    state.usdRateUpdated=s.usdRateUpdated||null;
    USD_TO_ARS=state.usdRate;
    state.catRules=s.catRules||[];
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
    state.gmailClientId=s.gmailClientId||localStorage.getItem('fin_gmail_client_id')||'';
    state.decisionCenterCollapsed=!!s.decisionCenterCollapsed;
    state.dismissedAutoCuotas=s.dismissedAutoCuotas||[];
    state.txnCardFilter=s.txnCardFilter||'';
    state.apiKey=localStorage.getItem('fin_apikey')||'';
    state.transactions.forEach(t=>{if(!t.week)t.week=getWeekKey(t.date);if(!t.month)t.month=getMonthKey(t.date);});
    // Migración retroactiva de payMethod con valores legacy del formulario manual
    const _pmMigMap={'Efectivo':'ef','Débito':'deb','Tarjeta de Crédito':'tc','USD':'ef'};
    state.transactions.forEach(t=>{if(t.payMethod&&_pmMigMap[t.payMethod])t.payMethod=_pmMigMap[t.payMethod];});
    // Enrichment retroactivo (sin sobreescribir confirmados)
    state.transactions.forEach(t=>enrichTransaction(t, t.origen_del_movimiento||'importado_desde_resumen'));
    // populate legacy hidden fields for dashboard compat
    const latestInc=getLatestIncomeARS();if(latestInc)state.income.ars=latestInc;
    const incSave=document.getElementById('inc-save');const incAlert=document.getElementById('inc-alert');
    if(incSave)incSave.value=state.savingsGoal;if(incAlert)incAlert.value=state.alertThreshold;
    const incSpendPct=document.getElementById('inc-spend-pct');
    if(incSpendPct)incSpendPct.value=state.spendPct<100?state.spendPct:'';

  }catch(e){console.warn('loadState error',e);}
}
