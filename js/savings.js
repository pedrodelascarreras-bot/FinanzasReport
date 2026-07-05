// ══ SAVINGS PAGE — 100% MANUAL ══
function savSignedAmount(dep){
  const raw = Math.abs(parseFloat(dep?.amount)||0);
  return dep?.kind==='withdrawal' ? -raw : raw;
}

function applySavingsAccountDelta(accountId, currency, delta){
  if(!accountId || !delta) return;
  const acc = (state.savAccounts||[]).find(a=>a.id===accountId);
  if(!acc) return;
  if(currency && acc.currency!==currency) return;
  acc.balance = (parseFloat(acc.balance)||0) + delta;
}

// ── Pipeline de metas: categorías y etapas ──
const SAV_TAGS = [
  {key:'urgente', label:'Urgente', color:'#ff3b30'},
  {key:'esencial', label:'Esencial', color:'#ff9500'},
  {key:'viaje', label:'Viaje', color:'#0a84ff'},
  {key:'tech', label:'Tech', color:'#5e5ce6'},
  {key:'capricho', label:'Capricho', color:'#ffcc00'},
  {key:'familia', label:'Familia', color:'#34c759'},
  {key:'inversion', label:'Inversión', color:'#30b0c7'}
];
const SAV_TAG_MAP = Object.fromEntries(SAV_TAGS.map(t=>[t.key,t]));

const DEFAULT_SAV_STAGES = [
  {id:'sav_st_ideas', name:'Ideas', color:'#8e8e93'},
  {id:'sav_st_ahora', name:'Ahora', color:'#ff3b30'},
  {id:'sav_st_camino', name:'En camino', color:'#ff9500'},
  {id:'sav_st_cumplida', name:'Cumplida', color:'#34c759'}
];

const SAV_STAGE_RECOMMENDATIONS = [
  {name:'Ideas', color:'#8e8e93'},
  {name:'Ahora', color:'#ff3b30'},
  {name:'En camino', color:'#ff9500'},
  {name:'Casi lista', color:'#0a84ff'},
  {name:'Pausada', color:'#c7c7cc'},
  {name:'Cumplida', color:'#34c759'},
  {name:'Prioridad alta', color:'#ff2d55'},
  {name:'Largo plazo', color:'#5e5ce6'}
];

function ensureSavStages(){
  if(!Array.isArray(state.savStages) || !state.savStages.length){
    state.savStages = DEFAULT_SAV_STAGES.map(s=>({...s}));
  }
  const stageIds = new Set(state.savStages.map(s=>s.id));
  const firstStageId = state.savStages[0]?.id || null;
  let changed = false;
  (state.savGoals||[]).forEach(g=>{
    if(!g.stageId || !stageIds.has(g.stageId)){
      g.stageId = firstStageId;
      changed = true;
    }
    if(!Array.isArray(g.tags)){
      g.tags = [];
      changed = true;
    }
  });
  if(changed) saveState();
}

function formatSavDeadline(deadline){
  if(!deadline) return '';
  const [y,m] = String(deadline).split('-').map(Number);
  if(!y||!m) return deadline;
  return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'short',year:'numeric'}).replace('.','');
}

// ── Drag & drop state (módulo) ──
// En window (no let/const) porque el modal de etapas la referencia directo desde un atributo ondrop inline.
window._savDraggedGoalId = null;
window._savDraggedStageId = null;

function onSavCardDragStart(e, goalId){
  _savDraggedGoalId = goalId;
  e.currentTarget.classList.add('sav-pipe-dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onSavCardDragEnd(e){
  e.currentTarget.classList.remove('sav-pipe-dragging');
  _savDraggedGoalId = null;
}
function onSavStageDragStart(e, stageId){
  e.stopPropagation();
  _savDraggedStageId = stageId;
}
function onSavStageDragEnd(e){
  _savDraggedStageId = null;
}
function onSavColDragOver(e){
  e.preventDefault();
  e.currentTarget.classList.add('sav-pipe-col-dragover');
}
function onSavColDragLeave(e){
  e.currentTarget.classList.remove('sav-pipe-col-dragover');
}
function onSavColDrop(e, stageId){
  e.preventDefault();
  e.currentTarget.classList.remove('sav-pipe-col-dragover');
  if(_savDraggedGoalId){
    moveSavGoalToStage(_savDraggedGoalId, stageId);
    _savDraggedGoalId = null;
  } else if(_savDraggedStageId){
    reorderSavStageDrop(_savDraggedStageId, stageId);
    _savDraggedStageId = null;
  }
}

function moveSavGoalToStage(goalId, stageId){
  const g = (state.savGoals||[]).find(x=>x.id===goalId);
  if(!g || g.stageId===stageId) return;
  g.stageId = stageId;
  saveState();
  renderSavingsPage();
}
function toggleSavGoalTag(goalId, tagKey){
  const g = (state.savGoals||[]).find(x=>x.id===goalId);
  if(!g) return;
  if(!Array.isArray(g.tags)) g.tags=[];
  if(g.tags.includes(tagKey)) g.tags = g.tags.filter(t=>t!==tagKey);
  else g.tags.push(tagKey);
  saveState();
  renderSavingsPage();
}
function toggleSavTagPicker(goalId){
  document.querySelectorAll('.sav-pipe-tag-picker.open').forEach(p=>{
    if(p.id!=='sav-tag-picker-'+goalId) p.classList.remove('open');
  });
  const el = document.getElementById('sav-tag-picker-'+goalId);
  if(el) el.classList.toggle('open');
}
document.addEventListener('click', ()=>{
  document.querySelectorAll('.sav-pipe-tag-picker.open').forEach(p=>p.classList.remove('open'));
});

function setSavTagFilter(key){
  state.savTagFilter = state.savTagFilter===key ? null : key;
  renderSavingsPage();
}

// ── Etapas del pipeline: CRUD ──
function addSavStage(name,color){
  ensureSavStages();
  const id = 'sav_st_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  state.savStages.push({id, name:(name||'Nueva etapa').trim()||'Nueva etapa', color: color||'#5e5ce6'});
  saveState();
  return id;
}
function addSavStageFromInput(){
  const inp = document.getElementById('sav-stage-new-name');
  const name = inp.value.trim();
  if(!name){ showToast('⚠️ Ingresá un nombre','error'); return; }
  addSavStage(name, '#5e5ce6');
  inp.value='';
  renderSavStagesModalList();
  renderSavingsPage();
  showToast('✓ Etapa agregada: '+name,'success');
}
function addSavStageFromPreset(name,color){
  ensureSavStages();
  const exists = state.savStages.some(s=>s.name.trim().toLowerCase()===name.trim().toLowerCase());
  if(exists){ showToast('Ya tenés una etapa llamada "'+name+'"','info'); return; }
  addSavStage(name,color);
  renderSavStagesModalList();
  renderSavingsPage();
  showToast('✓ Etapa agregada: '+name,'success');
}
function renameSavStage(id,name){
  const st=(state.savStages||[]).find(s=>s.id===id); if(!st) return;
  st.name = name.trim() || st.name;
  saveState();
  renderSavingsPage();
}
function recolorSavStage(id,color){
  const st=(state.savStages||[]).find(s=>s.id===id); if(!st) return;
  st.color = color;
  saveState();
  renderSavingsPage();
}
function deleteSavStage(id){
  const hasGoals = (state.savGoals||[]).some(g=>g.stageId===id);
  if(hasGoals){ showToast('⚠️ Esa etapa tiene metas adentro — moveelas primero','error'); return; }
  if((state.savStages||[]).length<=1){ showToast('⚠️ Necesitás al menos una etapa','error'); return; }
  state.savStages = state.savStages.filter(s=>s.id!==id);
  saveState();
  renderSavStagesModalList();
  renderSavingsPage();
  showToast('Etapa eliminada','info');
}
function reorderSavStageDrop(draggedId, targetId){
  if(!draggedId || draggedId===targetId) return;
  const list = state.savStages||[];
  const from = list.findIndex(s=>s.id===draggedId);
  const to = list.findIndex(s=>s.id===targetId);
  if(from<0||to<0) return;
  const [moved] = list.splice(from,1);
  list.splice(to,0,moved);
  saveState();
  renderSavingsPage();
}

function openSavStagesModal(){
  ensureSavStages();
  renderSavStagesModalList();
  openModal('modal-sav-stages');
}
function renderSavStagesModalList(){
  const el = document.getElementById('sav-stages-list'); if(!el) return;
  el.innerHTML = (state.savStages||[]).map(st=>{
    const count = (state.savGoals||[]).filter(g=>g.stageId===st.id).length;
    return `
    <div class="sav-stage-row" draggable="true"
         ondragstart="onSavStageDragStart(event,'${st.id}')" ondragend="onSavStageDragEnd(event)"
         ondragover="event.preventDefault()" ondrop="reorderSavStageDrop(_savDraggedStageId,'${st.id}');renderSavStagesModalList();">
      <span class="sav-stage-drag">⠿</span>
      <input type="color" class="sav-stage-color" value="${st.color}" onchange="recolorSavStage('${st.id}',this.value)">
      <input class="input-field sav-stage-name-input" value="${esc(st.name)}" onchange="renameSavStage('${st.id}',this.value)">
      <span class="sav-stage-count">${count} meta${count!==1?'s':''}</span>
      <button class="sav-stage-del" onclick="deleteSavStage('${st.id}')" title="Eliminar etapa">✕</button>
    </div>`;
  }).join('');
  renderSavStageRecommendations();
}
function renderSavStageRecommendations(){
  const el = document.getElementById('sav-stage-recommendations'); if(!el) return;
  const existingNames = new Set((state.savStages||[]).map(s=>s.name.trim().toLowerCase()));
  const available = SAV_STAGE_RECOMMENDATIONS.filter(r=>!existingNames.has(r.name.trim().toLowerCase()));
  el.innerHTML = available.length ? available.map(r=>`
    <button class="sav-stage-chip" style="border-color:${r.color}55;color:${r.color};" onclick="addSavStageFromPreset('${r.name}','${r.color}')">
      <span class="dot" style="background:${r.color}"></span>＋ ${esc(r.name)}
    </button>`).join('') : '<div style="font-size:11.5px;color:var(--text3);">Ya agregaste todas las sugeridas 🎉</div>';
}

// ── Tags del modal de meta (multi-selección en borrador) ──
window._savGoalDraftTags = [];
function renderSavGoalTagsPicker(){
  const el = document.getElementById('sav-goal-tags-picker'); if(!el) return;
  el.innerHTML = SAV_TAGS.map(t=>{
    const checked = window._savGoalDraftTags.includes(t.key);
    return `<button type="button" class="sav-tag-chip-toggle ${checked?'active':''}" style="--tag-color:${t.color};" onclick="toggleGoalDraftTag('${t.key}')">${checked?'✓ ':''}${esc(t.label)}</button>`;
  }).join('');
}
function toggleGoalDraftTag(key){
  if(window._savGoalDraftTags.includes(key)) window._savGoalDraftTags = window._savGoalDraftTags.filter(k=>k!==key);
  else window._savGoalDraftTags.push(key);
  renderSavGoalTagsPicker();
}

function renderSavingsPage(){
  const page = document.getElementById('page-savings');
  if(!page) return;
  ensureSavStages();
  const accounts = state.savAccounts || [];
  const goals = state.savGoals || [];
  const deps = state.savDeposits || [];
  const usdRate = USD_TO_ARS || 0;
  if(state.charts?.savHistory){ state.charts.savHistory.destroy(); state.charts.savHistory = null; }
  if(state.charts?.savDonut){ state.charts.savDonut.destroy(); state.charts.savDonut = null; }

  const money = (amount,currency='USD',dec=2)=>{
    if(!Number.isFinite(Number(amount))) return '—';
    return currency === 'USD' ? 'USD '+fmtN(Number(amount),dec) : '$'+fmtN(Number(amount),dec);
  };
  const signedMoney = dep=>{
    const signed = savSignedAmount(dep);
    return (signed < 0 ? '-' : '+') + money(Math.abs(signed), dep.currency || 'ARS');
  };
  const toUsd = (amount,currency)=>currency === 'USD' ? Number(amount)||0 : (usdRate>0 ? (Number(amount)||0)/usdRate : 0);
  const toArs = (amount,currency)=>currency === 'USD' ? (Number(amount)||0)*usdRate : Number(amount)||0;
  const totalARS = accounts.filter(a=>a.currency==='ARS').reduce((s,a)=>s+(Number(a.balance)||0),0);
  const totalUSD = accounts.filter(a=>a.currency==='USD').reduce((s,a)=>s+(Number(a.balance)||0),0);
  const totalEquivUSD = totalUSD + (usdRate>0 ? totalARS/usdRate : 0);
  const totalEquivARS = totalARS + (totalUSD*usdRate);
  const allMonths = [...new Set(deps.map(d=>d.month).filter(Boolean))].sort();
  const thisYear = new Date().getFullYear();
  const ytdDeposits = deps.filter(d=>d.kind!=='withdrawal' && d.month && d.month.startsWith(String(thisYear)));
  const ytdDepositUsd = ytdDeposits.reduce((s,d)=>s+toUsd(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0);
  const depositMonths = [...new Set(ytdDeposits.map(d=>d.month).filter(Boolean))];
  const monthlyDepositUsd = depositMonths.map(month=>
    ytdDeposits.filter(d=>d.month===month).reduce((s,d)=>s+toUsd(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0)
  );
  const avgMonthlyUsd = monthlyDepositUsd.length ? monthlyDepositUsd.reduce((s,v)=>s+v,0)/monthlyDepositUsd.length : 0;
  const incMonths = {};
  (state.incomeMonths||[]).forEach(m=>{
    const total = typeof getMonthTotalARS === 'function' ? getMonthTotalARS(m) : (m.sources?Object.values(m.sources).reduce((s,v)=>s+(Number(v)||0),0):0);
    incMonths[m.month] = total;
  });
  const rateValues = depositMonths.map(month=>{
    const income = incMonths[month] || 0;
    const savedArs = ytdDeposits.filter(d=>d.month===month).reduce((s,d)=>s+toArs(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0);
    return income > 0 ? (savedArs/income)*100 : null;
  }).filter(v=>v!==null);
  const avgRate = rateValues.length ? Math.round(rateValues.reduce((s,v)=>s+v,0)/rateValues.length) : null;
  const monthNow = getMonthKey(new Date());
  const movementsThisMonth = deps.filter(d=>d.month===monthNow).length;
  const prevMonthDate = new Date(); prevMonthDate.setMonth(prevMonthDate.getMonth()-1);
  const prevMonthKey = getMonthKey(prevMonthDate);
  const depositsThisMonthUsd = deps.filter(d=>d.month===monthNow && d.kind!=='withdrawal').reduce((s,d)=>s+toUsd(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0);
  const depositsPrevMonthUsd = deps.filter(d=>d.month===prevMonthKey && d.kind!=='withdrawal').reduce((s,d)=>s+toUsd(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0);
  const momPct = depositsPrevMonthUsd>0 ? Math.round(((depositsThisMonthUsd-depositsPrevMonthUsd)/depositsPrevMonthUsd)*100) : null;
  const sortedMoves = [...deps].sort((a,b)=>(b.month||'').localeCompare(a.month||'') || String(b.id||'').localeCompare(String(a.id||'')));
  const recentMove = sortedMoves[0] || null;
  const accountById = id => accounts.find(a=>a.id===id) || null;
  const accountMovementSummary = account=>{
    const accMoves = deps.filter(d=>d.accountId===account.id && (d.currency||account.currency)===account.currency);
    if(!accMoves.length) return 'Sin movimientos';
    const net = accMoves.reduce((s,d)=>s+savSignedAmount(d),0);
    return accMoves.length+' movimiento'+(accMoves.length!==1?'s':'')+' - '+money(Math.abs(net), account.currency);
  };
  const goalCurrent = goal=>{
    if(goal.accountId){
      const acc = accountById(goal.accountId);
      return acc ? (goal.currency==='USD' ? toUsd(acc.balance,acc.currency) : toArs(acc.balance,acc.currency)) : 0;
    }
    return goal.currency==='USD' ? totalEquivUSD : totalEquivARS;
  };
  const goalModels = goals.map(g=>{
    const current = goalCurrent(g);
    const pct = g.target > 0 ? Math.min(100,Math.round((current/g.target)*100)) : 0;
    return {...g,current,pct};
  });
  const bestGoal = goalModels.length ? [...goalModels].sort((a,b)=>b.pct-a.pct)[0] : null;
  const savingsTargetUsd = Number(state.savMonthlyTargetUsd || state.savingsMonthlyTargetUsd || 500);
  const annualProjectionUsd = avgMonthlyUsd > 0 ? avgMonthlyUsd * 12 : totalEquivUSD * 12;

  const iconForAccount = account => esc(account.emoji || ({banco:'🏦',billetera:'📱',efectivo:'💵',inversion:'📈',cripto:'🔷',otro:'💰'}[account.type]||'🏦'));
  const accountCardCompact = (account,index)=>{
    const color = account.color || (index===1?'#ff3b30':'#6d4aff');
    return `<article class="sav-reg-acc-card" onclick="editSavAccount('${account.id}')">
      <div class="sav-reg-acc-avatar" style="background:${color}1e;color:${color};">${iconForAccount(account)}</div>
      <div class="sav-reg-acc-body">
        <div class="sav-reg-acc-name">${esc(account.name)}</div>
        <div class="sav-reg-acc-type">${esc(account.type||'Banco')}</div>
      </div>
      <div class="sav-reg-acc-bal">${money(Number(account.balance)||0, account.currency)}</div>
    </article>`;
  };
  const recentHtml = recentMove ? (()=>{
    const account = accountById(recentMove.accountId);
    const isOut = savSignedAmount(recentMove) < 0;
    const monthLabel = recentMove.month ? new Date(recentMove.month+'-01T12:00:00').toLocaleDateString('es-AR',{month:'long',year:'numeric'}) : 'Sin fecha';
    return `<article class="sav2-activity-card" onclick="editSavDeposit('${recentMove.id}')">
      <div class="sav2-activity-icon">${isOut?'↘':'↗'}</div>
      <div class="sav2-activity-copy">
        <div class="sav2-activity-title">${isOut?'Uso de ahorros':'Aporte a ahorros'} <span>${monthLabel}</span></div>
        <div class="sav2-activity-sub">${esc(recentMove.note || (isOut?'Pago de TC':'Movimiento'))}${account?' · '+esc(account.name):''}</div>
      </div>
      <div class="sav2-activity-amount ${isOut?'out':'in'}">${signedMoney(recentMove)}</div>
    </article>`;
  })() : '<div class="sav2-empty">Sin actividad reciente</div>';

  // ── Pipeline de metas ──
  const tagFilter = state.savTagFilter || null;
  const visibleGoals = tagFilter ? goalModels.filter(g=>(g.tags||[]).includes(tagFilter)) : goalModels;
  const savPipelineCard = g=>{
    const tags = g.tags||[];
    const isUrgent = tags.includes('urgente');
    const tagsHtml = tags.map(k=>{
      const t=SAV_TAG_MAP[k]; if(!t) return '';
      return `<span class="sav-pipe-tag" style="background:${t.color}1e;color:${t.color};">${esc(t.label)}</span>`;
    }).join('');
    const barColor = g.pct>=100 ? '#34c759' : (isUrgent ? 'linear-gradient(90deg,#ff453a,#ff9500)' : 'linear-gradient(90deg,#5e5ce6,#0a84ff)');
    const tagOptsHtml = SAV_TAGS.map(t=>{
      const checked = tags.includes(t.key);
      return `<div class="sav-pipe-tag-opt ${checked?'checked':''}" onclick="event.stopPropagation();toggleSavGoalTag('${g.id}','${t.key}')">
        <span class="chk" style="background:${checked?t.color:'transparent'};border-color:${t.color}77;">${checked?'✓':''}</span>
        <span class="dot2" style="background:${t.color}"></span>${esc(t.label)}
      </div>`;
    }).join('');
    return `
    <div class="sav-pipe-card ${isUrgent?'urgent':''}" draggable="true"
         ondragstart="onSavCardDragStart(event,'${g.id}')" ondragend="onSavCardDragEnd(event)"
         onclick="editSavGoal('${g.id}')">
      <div class="sav-pipe-card-top">
        <div class="sav-pipe-avatar" style="background:${(g.color||'#5e5ce6')}22;">${esc(g.emoji||'🎯')}</div>
        <div class="sav-pipe-card-name">${esc(g.name)}</div>
      </div>
      <div class="sav-pipe-card-amt"><b>${money(g.current||0,g.currency)}</b> / ${money(Number(g.target)||0,g.currency)}</div>
      <div class="sav-pipe-track"><div class="sav-pipe-fill" style="width:${g.pct}%;background:${barColor};"></div></div>
      ${tagsHtml?`<div class="sav-pipe-tags">${tagsHtml}</div>`:''}
      <div class="sav-pipe-card-foot">
        <span class="sav-pipe-pct">${g.pct}%${g.deadline?' · '+esc(formatSavDeadline(g.deadline)):''}</span>
        <button class="sav-pipe-tag-add" onclick="event.stopPropagation();toggleSavTagPicker('${g.id}')" title="Categorizar">🏷️</button>
      </div>
      <div class="sav-pipe-tag-picker" id="sav-tag-picker-${g.id}">${tagOptsHtml}</div>
    </div>`;
  };
  const savPipelineColumn = (stage)=>{
    const stageGoals = visibleGoals.filter(g=>g.stageId===stage.id);
    const total = stageGoals.reduce((s,g)=>s+(Number(g.target)||0),0);
    return `
    <div class="sav-pipe-col" data-stage="${stage.id}"
         ondragover="onSavColDragOver(event)" ondragleave="onSavColDragLeave(event)" ondrop="onSavColDrop(event,'${stage.id}')">
      <div class="sav-pipe-col-hd" draggable="true" ondragstart="onSavStageDragStart(event,'${stage.id}')" ondragend="onSavStageDragEnd(event)">
        <span class="sav-pipe-col-accent" style="background:${stage.color}"></span>
        <span class="sav-pipe-col-title">${esc(stage.name)}</span>
      </div>
      <div class="sav-pipe-col-stats">
        <span class="sav-pipe-col-count">${stageGoals.length}</span>
        <span class="sav-pipe-col-total">valor total: <b>$${fmtN(total,0)}</b></span>
      </div>
      <div class="sav-pipe-col-cards">${stageGoals.map(savPipelineCard).join('')}</div>
      <button class="sav-pipe-add-card" onclick="openSavGoalModal('${stage.id}')">＋ meta</button>
    </div>`;
  };
  const filterChipsHtml = SAV_TAGS.map(t=>`
    <button class="sav-pipe-filter-chip ${tagFilter===t.key?'active':''}" onclick="setSavTagFilter('${t.key}')">
      <span class="dot" style="background:${t.color}"></span>${esc(t.label)}
    </button>`).join('');
  const boardHtml = (state.savStages||[]).map(savPipelineColumn).join('');

  page.innerHTML = `
    <div class="sav2-shell">
      <header class="sav2-header">
        <div>
          <h1>Ahorros</h1>
          <p>${accounts.length} cuenta${accounts.length!==1?'s':''} · ${allMonths.length} mes${allMonths.length!==1?'es':''} con movimientos</p>
        </div>
        <div class="sav2-actions">
          <button class="sav2-btn" onclick="openSavAccountModal()">🏦 Nueva cuenta</button>
          <button class="sav2-btn" onclick="openSavGoalModal()">🎯 Nueva meta</button>
          <button class="sav2-btn-primary" onclick="openSavDepositModal()">+ Registrar movimiento</button>
        </div>
      </header>

      <section class="sav-reg-section">
        <div class="sav-reg-hd">
          <div class="sav-reg-hd-left">
            <div class="sav-reg-hd-icon">🏦</div>
            <div>
              <h2>Registro de ahorros</h2>
              <p>Lo que ya tenés guardado, cuenta por cuenta</p>
            </div>
          </div>
          <button class="sav2-btn" onclick="openSavDepositModal()">＋ Nuevo depósito</button>
        </div>

        <div class="sav-reg-grid">
          <article class="sav-reg-hero">
            <div class="sav-reg-hero-kicker">Total acumulado</div>
            <div class="sav-reg-hero-amt">${money(totalEquivUSD,'USD')}</div>
            <div class="sav-reg-hero-sub">≈ $${fmtN(Math.round(totalEquivARS),2)} ARS al TC $${fmtN(usdRate,2)}</div>
            <div class="sav-reg-hero-chips">
              ${momPct!==null?`<span class="sav-reg-hero-chip">${momPct>=0?'📈':'📉'} <b>${momPct>=0?'+':''}${momPct}%</b> vs. mes pasado</span>`:''}
              <span class="sav-reg-hero-chip">💰 <b>${money(depositsThisMonthUsd,'USD')}</b> depositado este mes</span>
            </div>
          </article>

          <div class="sav-reg-acc-panel">
            <div class="sav-reg-acc-panel-hd">
              <div>
                <div class="sav-reg-acc-panel-title">Mis cuentas</div>
                <div class="sav-reg-acc-panel-sub">${accounts.length} cuenta${accounts.length!==1?'s':''} activa${accounts.length!==1?'s':''}</div>
              </div>
            </div>
            <div class="sav-reg-acc-list">
              ${accounts.map(accountCardCompact).join('')}
              <button class="sav-reg-acc-add" onclick="openSavAccountModal()">＋ Agregar cuenta</button>
            </div>
          </div>
        </div>
      </section>

      <section class="sav2-activity-section">
        <div class="sav2-section-head compact"><h2>Actividad reciente</h2><button>Ver todo</button></div>
        ${recentHtml}
      </section>

      <section class="sav-pipe-section">
        <div class="sav-pipe-hd">
          <div class="sav-pipe-hd-left">
            <div class="sav-pipe-hd-icon">🎯</div>
            <div>
              <h2>Pipeline de metas</h2>
              <p>Arrastrá cada meta por sus etapas, como un embudo de ventas</p>
            </div>
          </div>
          <div class="sav-pipe-toolbar">
            <div class="sav-pipe-filters">${filterChipsHtml}</div>
            <button class="sav2-btn" onclick="openSavStagesModal()">⚙ Etapas</button>
            <button class="sav2-btn-primary" onclick="openSavGoalModal()">＋ Nueva meta</button>
          </div>
        </div>
        <div class="sav-pipe-board">${boardHtml}</div>
      </section>
    </div>`;
}

// ── Depósitos CRUD ──
function openSavDepositModal(){
  document.getElementById('modal-dep-title').textContent='Registrar movimiento';
  document.getElementById('modal-dep-editing').value='';
  document.getElementById('btn-del-dep').style.display='none';
  const now=new Date();
  document.getElementById('dep-month').value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('dep-amount').value='';
  document.getElementById('dep-currency').value='ARS';
  document.getElementById('dep-kind').value='deposit';
  document.getElementById('dep-note').value='';
  const sel=document.getElementById('dep-account');
  sel.innerHTML='<option value="">Sin especificar</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'">'+esc(a.name)+' ('+a.currency+')</option>').join('');
  openModal('modal-sav-deposit');
}
function editSavDeposit(id){
  const d=state.savDeposits.find(x=>x.id===id);if(!d)return;
  document.getElementById('modal-dep-title').textContent='Editar movimiento';
  document.getElementById('modal-dep-editing').value=id;
  document.getElementById('btn-del-dep').style.display='inline-flex';
  document.getElementById('dep-month').value=d.month;
  document.getElementById('dep-amount').value=Math.abs(parseFloat(d.amount)||0);
  document.getElementById('dep-currency').value=d.currency;
  document.getElementById('dep-kind').value=d.kind||'deposit';
  document.getElementById('dep-note').value=d.note||'';
  const sel=document.getElementById('dep-account');
  sel.innerHTML='<option value="">Sin especificar</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'"'+(a.id===d.accountId?' selected':'')+'>'+esc(a.name)+' ('+a.currency+')</option>').join('');
  openModal('modal-sav-deposit');
}
function saveSavDeposit(){
  const month=document.getElementById('dep-month').value;
  const amount=parseFloat(document.getElementById('dep-amount').value)||0;
  if(!month||amount<=0){showToast('⚠️ Completá mes y monto','error');return;}
  const editingId=document.getElementById('modal-dep-editing').value||Date.now().toString(36);
  const previous=state.savDeposits.find(x=>x.id===editingId)||null;
  if(previous){
    applySavingsAccountDelta(previous.accountId, previous.currency, -savSignedAmount(previous));
  }
  const obj={
    id:editingId,
    month,amount,
    kind:document.getElementById('dep-kind').value||'deposit',
    currency:document.getElementById('dep-currency').value,
    accountId:document.getElementById('dep-account').value||null,
    note:document.getElementById('dep-note').value.trim()
  };
  applySavingsAccountDelta(obj.accountId, obj.currency, savSignedAmount(obj));
  const idx=state.savDeposits.findIndex(x=>x.id===obj.id);
  if(idx>=0)state.savDeposits[idx]=obj;else state.savDeposits.push(obj);
  saveState();closeModal('modal-sav-deposit');renderSavingsPage();refreshAll();showToast(obj.kind==='withdrawal'?'✓ Uso de ahorros registrado':'✓ Ahorro registrado','success');
}
function deleteSavDeposit(){
  const id=document.getElementById('modal-dep-editing').value;
  const previous=state.savDeposits.find(d=>d.id===id);
  if(previous){
    applySavingsAccountDelta(previous.accountId, previous.currency, -savSignedAmount(previous));
  }
  state.savDeposits=state.savDeposits.filter(d=>d.id!==id);
  saveState();closeModal('modal-sav-deposit');renderSavingsPage();showToast('Movimiento eliminado','info');
}

// ── Savings account CRUD ──
function openSavAccountModal(){
  document.getElementById('modal-sav-acc-title').textContent='Nueva cuenta de ahorro';
  document.getElementById('modal-sav-acc-editing').value='';
  document.getElementById('sav-acc-name').value='';document.getElementById('sav-acc-emoji').value='';
  document.getElementById('sav-acc-balance').value='';document.getElementById('sav-acc-yield').value='';
  document.getElementById('sav-acc-currency').value='ARS';document.getElementById('sav-acc-type').value='banco';
  document.getElementById('btn-del-sav-acc').style.display='none';
  renderGenericColorPicker('sav-acc-color-picker','');openModal('modal-sav-account');
}
function editSavAccount(id){
  const a=state.savAccounts.find(x=>x.id===id);if(!a)return;
  document.getElementById('modal-sav-acc-title').textContent='Editar cuenta';
  document.getElementById('modal-sav-acc-editing').value=id;
  document.getElementById('sav-acc-name').value=a.name;document.getElementById('sav-acc-emoji').value=a.emoji||'';
  document.getElementById('sav-acc-balance').value=a.balance;document.getElementById('sav-acc-yield').value=a.yieldPct||'';
  document.getElementById('sav-acc-currency').value=a.currency;document.getElementById('sav-acc-type').value=a.type;
  document.getElementById('btn-del-sav-acc').style.display='inline-flex';
  renderGenericColorPicker('sav-acc-color-picker',a.color||'');openModal('modal-sav-account');
}
function saveSavAccount(){
  const name=document.getElementById('sav-acc-name').value.trim();if(!name){showToast('⚠️ Ingresá nombre','error');return;}
  const sw=document.querySelector('#sav-acc-color-picker .color-swatch.selected');const color=sw?rgbToHex(sw.style.backgroundColor):'#34c759';
  const obj={id:document.getElementById('modal-sav-acc-editing').value||Date.now().toString(36),name,emoji:document.getElementById('sav-acc-emoji').value||'',balance:parseFloat(document.getElementById('sav-acc-balance').value)||0,currency:document.getElementById('sav-acc-currency').value,type:document.getElementById('sav-acc-type').value,yieldPct:parseFloat(document.getElementById('sav-acc-yield').value)||0,color};
  const idx=state.savAccounts.findIndex(x=>x.id===obj.id);if(idx>=0)state.savAccounts[idx]=obj;else state.savAccounts.push(obj);
  saveState();closeModal('modal-sav-account');renderSavingsPage();refreshAll();showToast('✓ Cuenta guardada','success');
}
function deleteSavAccount(){
  const id=document.getElementById('modal-sav-acc-editing').value;
  state.savAccounts=state.savAccounts.filter(a=>a.id!==id);
  saveState();closeModal('modal-sav-account');renderSavingsPage();refreshAll();showToast('Cuenta eliminada','info');
}

// ── Savings goal CRUD ──
function openSavGoalModal(stageId){
  ensureSavStages();
  document.getElementById('modal-sav-goal-title').textContent='Nueva meta de ahorro';
  document.getElementById('modal-sav-goal-editing').value='';
  document.getElementById('sav-goal-name').value='';document.getElementById('sav-goal-emoji').value='';
  document.getElementById('sav-goal-target').value='';document.getElementById('sav-goal-current').value='';
  document.getElementById('sav-goal-deadline').value='';document.getElementById('sav-goal-currency').value='ARS';
  document.getElementById('btn-del-sav-goal').style.display='none';
  const acSel=document.getElementById('sav-goal-account');acSel.innerHTML='<option value="">Sin vincular</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
  const stSel=document.getElementById('sav-goal-stage');
  if(stSel){
    const targetStage = stageId || state.savStages[0]?.id;
    stSel.innerHTML=state.savStages.map(s=>'<option value="'+s.id+'"'+(s.id===targetStage?' selected':'')+'>'+esc(s.name)+'</option>').join('');
  }
  window._savGoalDraftTags = [];
  renderSavGoalTagsPicker();
  renderGenericColorPicker('sav-goal-color-picker','');openModal('modal-sav-goal');
}
function editSavGoal(id){
  const g=state.savGoals.find(x=>x.id===id);if(!g)return;
  ensureSavStages();
  document.getElementById('modal-sav-goal-title').textContent='Editar meta';
  document.getElementById('modal-sav-goal-editing').value=id;
  document.getElementById('sav-goal-name').value=g.name;document.getElementById('sav-goal-emoji').value=g.emoji||'';
  document.getElementById('sav-goal-target').value=g.target;document.getElementById('sav-goal-current').value=g.current;
  document.getElementById('sav-goal-deadline').value=g.deadline||'';document.getElementById('sav-goal-currency').value=g.currency;
  const acSel=document.getElementById('sav-goal-account');acSel.innerHTML='<option value="">Sin vincular</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'"'+(a.id===g.accountId?' selected':'')+'>'+esc(a.name)+'</option>').join('');
  const stSel=document.getElementById('sav-goal-stage');
  if(stSel){
    stSel.innerHTML=state.savStages.map(s=>'<option value="'+s.id+'"'+(s.id===g.stageId?' selected':'')+'>'+esc(s.name)+'</option>').join('');
  }
  window._savGoalDraftTags = Array.isArray(g.tags) ? [...g.tags] : [];
  renderSavGoalTagsPicker();
  document.getElementById('btn-del-sav-goal').style.display='inline-flex';
  renderGenericColorPicker('sav-goal-color-picker',g.color||'');openModal('modal-sav-goal');
}
function saveSavGoal(){
  const name=document.getElementById('sav-goal-name').value.trim();const target=parseFloat(document.getElementById('sav-goal-target').value)||0;
  if(!name||target<=0){showToast('⚠️ Completá nombre y monto','error');return;}
  const sw=document.querySelector('#sav-goal-color-picker .color-swatch.selected');const color=sw?rgbToHex(sw.style.backgroundColor):'#34c759';
  ensureSavStages();
  const stSel=document.getElementById('sav-goal-stage');
  const stageId=(stSel&&stSel.value)||state.savStages[0]?.id||null;
  const obj={id:document.getElementById('modal-sav-goal-editing').value||Date.now().toString(36),name,emoji:document.getElementById('sav-goal-emoji').value||'🎯',target,currency:document.getElementById('sav-goal-currency').value,current:parseFloat(document.getElementById('sav-goal-current').value)||0,deadline:document.getElementById('sav-goal-deadline').value||null,accountId:document.getElementById('sav-goal-account').value||null,color,stageId,tags:[...(window._savGoalDraftTags||[])]};
  const idx=state.savGoals.findIndex(x=>x.id===obj.id);if(idx>=0)state.savGoals[idx]=obj;else state.savGoals.push(obj);
  saveState();closeModal('modal-sav-goal');renderSavingsPage();refreshAll();showToast('✓ Meta guardada','success');
}
function deleteSavGoal(){
  const id=document.getElementById('modal-sav-goal-editing').value;
  state.savGoals=state.savGoals.filter(g=>g.id!==id);
  saveState();closeModal('modal-sav-goal');renderSavingsPage();refreshAll();showToast('Meta eliminada','info');
}

// ── Generic color picker helper ──
function renderGenericColorPicker(containerId,sel){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML=PALETTE.map(c=>'<div class="color-swatch '+(c===sel?'selected':'')+'" style="background:'+c+'" onclick="selectSwatch(\''+c+'\',this,\''+containerId+'\')"></div>').join('');
}
