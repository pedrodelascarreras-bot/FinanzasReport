// ══ APP DEL CELULAR ══
// Cuatro pantallas, siempre en la vista Tarjetas (Visa + Amex): Inicio, Movimientos,
// Compromisos y Tarjetas. El celular sirve para mirar y para traer gastos de Gmail;
// lo único que se edita desde acá son los ciclos de las tarjetas.

const MX_PAY_LABEL={visa:'Visa',amex:'Amex',deb:'Débito',ef:'Efectivo'};
const MX_GROUP_LABEL={cuotas:'Cuota',suscripciones:'Suscripción',fijos:'Gasto fijo'};
const MX_THEME_COLOR={light:'#F4F6FB',dark:'#0B1020'};

function mxIsMobile(){ return window.innerWidth<=768; }
function mxMoney(n, currency){
  if((currency||'ARS')==='USD') return 'USD '+(Number(n)||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2});
  return '$'+Math.round(Number(n)||0).toLocaleString('es-AR');
}
function mxShortDate(value){
  const d=value instanceof Date?value:new Date(String(value).length===10?value+'T12:00:00':value);
  return d.toLocaleDateString('es-AR',{day:'numeric',month:'short'}).replace('.','');
}
function mxEndOfToday(){ const d=new Date(); d.setHours(23,59,59,999); return d; }

// El ciclo de las tarjetas que incluye hoy (o el mes, si todavía no hay ciclos)
function mxPeriod(){
  const today=dateToYMD(new Date());
  const cycles=getTcCycles('tarjetas')||[];
  const idx=cycles.findIndex((c,i)=>{ const op=getTcCycleOpen(cycles,i); return op && today>=op && today<=c.closeDate; });
  const cycle=cycles[idx]||cycles[0]||null;
  if(!cycle){
    const r=getMonthRange(getMonthKey(new Date()));
    return {cycle:null, start:r.startStr, end:r.endStr, daysLeft:null};
  }
  const start=getTcCycleOpen(cycles, cycles.indexOf(cycle));
  const daysLeft=Math.round((new Date(cycle.closeDate+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);
  return {cycle, start, end:cycle.closeDate, daysLeft};
}
function mxPeriodTotals(period, card){
  return getPeriodTotals({startStr:period.start, endStr:period.end, card, todayRef:mxEndOfToday(), amountMode:'full'});
}
function mxPeriodLabel(period){
  return mxShortDate(period.start)+' al '+mxShortDate(period.end);
}
// Cuotas, suscripciones y fijos del período, de cualquier tarjeta o débito
function mxPeriodCommitments(period){
  const cardTxns=(state.transactions||[]).filter(t=>{
    const d=dateToYMD(t.date);
    return d>=period.start && d<=period.end && payMethodMatchesCard(t.payMethod,'tarjetas');
  });
  const meta={cycle:period.cycle, openStr:period.start, closeStr:period.end};
  return getTxnCycleCommitmentEntries('tarjetas', meta, '', cardTxns, mxEndOfToday(), '')
    .filter(e=>MX_GROUP_LABEL[e.group]);
}

const MX_MENU_ICON='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
function mxHeader(){
  return '<header class="mx-header">'
    +'<button class="mx-menu" onclick="openMobDrawer()" aria-label="Menú">'+MX_MENU_ICON+'</button>'
    +'<img class="mx-logo" src="brand/fluxen-logo.png" alt="Fluxen">'
    +'<span class="mx-header-gap"></span>'
  +'</header>';
}
function mxImportButton(label){
  const last=state.lastGmailSync?new Date(state.lastGmailSync):null;
  const lastText=last&&!isNaN(last)?'Última vez: '+mxShortDate(last)+', '+last.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
  return '<button class="mx-import" onclick="mxImportGmail()">'
    +'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    +esc(label||'Traer gastos de Gmail')+'</button>'
    +(lastText?'<div class="mx-import-last">'+esc(lastText)+'</div>':'');
}

// ── Google: el navegador del teléfono solo abre la ventana de Google si sale directo del toque,
// así que la conexión se deja preparada al abrir la app ──
function mxPrepareGoogle(){
  if(typeof driveTokenClient==='undefined' || driveTokenClient) return;
  try{ initDriveClient(false,{prepareOnly:true}); }catch(e){ console.warn('[mobile] Google no disponible', e); }
}
function mxImportGmail(){
  if(!gmailAccessToken && !driveTokenClient){
    mxPrepareGoogle();
    showToast('Preparando la conexión con Google… tocá de nuevo en un segundo','info');
    return;
  }
  gmailSync();
}

// El color de la barra del teléfono es el mismo que el fondo de la app
function mxSyncThemeColor(){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta && mxIsMobile()) meta.setAttribute('content', document.body.classList.contains('light-mode')?MX_THEME_COLOR.light:MX_THEME_COLOR.dark);
}

function mxHasData(){
  return !!((state.transactions||[]).length || (state.cuotas||[]).length || (state.subscriptions||[]).length);
}
function mxEmptyHtml(){
  return mxHeader()
    +'<div class="mx-card mx-empty">'
      +'<div class="mx-empty-title">Todavía no hay datos en este celular</div>'
      +'<div class="mx-empty-sub">Conectá tu cuenta de Google y traemos todo lo que tenés en la compu.</div>'
      +mxImportButton('Conectar con Google')
    +'</div>';
}

// ── Inicio ──
function renderMobileDashboard(){
  const shell=document.getElementById('mob-dash-shell');
  if(!shell || !mxIsMobile()) return;
  mxSyncThemeColor();
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml(); return; }
  const period=mxPeriod();
  const all=mxPeriodTotals(period,'tarjetas');
  const visa=mxPeriodTotals(period,'visa');
  const amex=mxPeriodTotals(period,'amex');
  const projection=getPeriodProjection({startStr:period.start, endStr:period.end, card:'tarjetas', todayRef:mxEndOfToday(), amountMode:'full'});

  const rate=window.USD_TO_ARS||USD_TO_ARS||1;
  const toArs=e=>(Number(e.amount)||0)*((e.currency||'ARS')==='USD'?rate:1);
  const commitments=mxPeriodCommitments(period);
  const committedTotal=commitments.reduce((s,e)=>s+toArs(e),0);
  const paid=commitments.filter(e=>e.isSettled===true).reduce((s,e)=>s+toArs(e),0);
  // Lo ya cobrado en las tarjetas está en el gasto; se suma el resto (lo que falta y lo que va por débito)
  const notInSpent=commitments.filter(e=>!(e.inView!==false && e.isSettled===true)).reduce((s,e)=>s+toArs(e),0);
  const spentWithCommitments=all.totalArs+notInSpent;

  const rows=commitments.map(e=>{
    const settled=e.isSettled===true;
    return '<div class="mx-row">'
      +'<div class="mx-row-main"><div class="mx-row-title">'+esc(e.title)+'</div>'
      +'<div class="mx-row-sub">'+esc([mxShortDate(e.date), e.payLabel==='Sin medio de pago'?'':e.payLabel].filter(Boolean).join(' · '))+'</div></div>'
      +'<div class="mx-row-side"><div class="mx-row-amount">'+esc(mxMoney(e.amount,e.currency))+'</div>'
      +'<div class="mx-status '+(settled?'ok':'pend')+'">'+(settled?'Cobrado':'Sin cobrar')+'</div></div>'
    +'</div>';
  }).join('');

  shell.innerHTML=mxHeader()
    +'<section class="mx-card mx-hero">'
      +'<div class="mx-kicker">Gastado con tus tarjetas</div>'
      +'<div class="mx-hero-amount">'+esc(mxMoney(all.totalArs))+'</div>'
      +'<div class="mx-hero-period">'+esc(mxPeriodLabel(period))+(period.daysLeft!=null&&period.daysLeft>=0?' · faltan '+period.daysLeft+' día'+(period.daysLeft===1?'':'s'):'')+'</div>'
      +'<div class="mx-split">'
        +'<div class="mx-split-row"><span>Visa</span><strong>'+esc(mxMoney(visa.totalArs))+'</strong></div>'
        +'<div class="mx-split-row"><span>Amex</span><strong>'+esc(mxMoney(amex.totalArs))+'</strong></div>'
      +'</div>'
      +mxImportButton()
    +'</section>'
    +'<section class="mx-card">'
      +'<div class="mx-section-head"><span>Compromisos del período</span><strong>'+esc(mxMoney(committedTotal))+'</strong></div>'
      +'<div class="mx-pills">'
        +'<span class="mx-status ok">Cobrado '+esc(mxMoney(paid))+'</span>'
        +'<span class="mx-status pend">Sin cobrar '+esc(mxMoney(committedTotal-paid))+'</span>'
      +'</div>'
      +(rows?'<div class="mx-list">'+rows+'</div>':'<div class="mx-none">No hay compromisos en este período</div>')
      +'<div class="mx-total-line"><span>Gastado + compromisos</span><strong>'+esc(mxMoney(spentWithCommitments))+'</strong></div>'
    +'</section>'
    +'<section class="mx-two">'
      +'<div class="mx-card"><div class="mx-kicker">Proyección al cierre</div><div class="mx-stat">'+esc(mxMoney(projection.projected))+'</div>'
        +(projection.tooEarly?'<div class="mx-stat-note">Se afina a partir del día '+projection.minDays+'</div>':'')+'</div>'
      +'<div class="mx-card"><div class="mx-kicker">Promedio diario</div><div class="mx-stat">'+esc(mxMoney(projection.dailyVariable))+'</div></div>'
    +'</section>';
}

// ── Movimientos: solo lectura ──
function renderMobileTransactions(){
  const shell=document.getElementById('mob-txn-shell');
  if(!shell || !mxIsMobile()) return;
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml(); return; }
  const period=mxPeriod();
  const totals=mxPeriodTotals(period,'tarjetas');
  const entries=[...totals.entries].sort((a,b)=>new Date(b.date)-new Date(a.date));
  let lastDay='';
  const list=entries.map(e=>{
    const day=dateToYMD(e.date);
    const heading=day!==lastDay?'<div class="mx-day">'+esc(mxShortDate(e.date))+'</div>':'';
    lastDay=day;
    const tag=[MX_PAY_LABEL[String(e.payMethod||'').toLowerCase()]||'', e.isProjected?MX_GROUP_LABEL[e.group]||'':e.category||''].filter(Boolean).join(' · ');
    return heading+'<div class="mx-row">'
      +'<div class="mx-row-main"><div class="mx-row-title">'+esc(e.description||'Movimiento')+'</div><div class="mx-row-sub">'+esc(tag)+'</div></div>'
      +'<div class="mx-row-side"><div class="mx-row-amount">'+esc(mxMoney(e.amount,e.currency))+'</div></div>'
    +'</div>';
  }).join('');
  shell.innerHTML=mxHeader()
    +'<h1 class="mx-title">Movimientos</h1>'
    +'<div class="mx-subtitle">Visa + Amex · '+esc(mxPeriodLabel(period))+'</div>'
    +'<section class="mx-card mx-totals">'
      +'<div><span>ARS</span><strong>'+esc(mxMoney(totals.ars))+'</strong></div>'
      +'<div><span>USD</span><strong>'+esc(mxMoney(totals.usd,'USD'))+'</strong></div>'
      +'<div><span>Total</span><strong>'+esc(mxMoney(totals.totalArs))+'</strong></div>'
    +'</section>'
    +mxImportButton()
    +'<section class="mx-card">'+(list||'<div class="mx-none">Todavía no hay gastos en este período</div>')+'</section>';
}

// ── Compromisos ──
function renderMobileCompromisos(){
  const shell=document.getElementById('mob-comp-shell');
  if(!shell || !mxIsMobile()) return;
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml(); return; }
  const {fixedItems,subsItems,cuotaItems,allActive}=commitmentsBuildData();
  const sum=list=>list.reduce((s,i)=>s+(Number(i.amountArs)||0),0);
  const section=(title,items)=>{
    if(!items.length) return '';
    const rows=[...items].sort((a,b)=>(a.due?.sortDays??999)-(b.due?.sortDays??999)).map(item=>{
      const status=item.due?.status==='overdue'?'bad':item.due?.status==='soon'?'pend':'';
      const progress=item.type==='quota'&&item.total?item.paid+'/'+item.total+' cuotas':'';
      return '<div class="mx-row">'
        +'<div class="mx-row-main"><div class="mx-row-title">'+esc(item.name)+'</div>'+(progress?'<div class="mx-row-sub">'+esc(progress)+'</div>':'')+'</div>'
        +'<div class="mx-row-side"><div class="mx-row-amount">'+esc(mxMoney(item.amount,item.currency))+'</div>'
        +(item.due?.label?'<div class="mx-status '+status+'">'+esc(item.due.label)+'</div>':'')+'</div>'
      +'</div>';
    }).join('');
    return '<section class="mx-card"><div class="mx-section-head"><span>'+esc(title)+'</span><strong>'+esc(mxMoney(sum(items)))+'</strong></div><div class="mx-list">'+rows+'</div></section>';
  };
  shell.innerHTML=mxHeader()
    +'<h1 class="mx-title">Compromisos</h1>'
    +'<section class="mx-card mx-hero"><div class="mx-kicker">Total por mes</div><div class="mx-hero-amount">'+esc(mxMoney(sum(allActive)))+'</div></section>'
    +section('Cuotas',cuotaItems)+section('Suscripciones',subsItems)+section('Gastos fijos',fixedItems);
}

// ── Tarjetas: ciclos de Visa y Amex ──
function mxCardFor(key){ return (state.ccCards||[]).find(c=>String(c.payMethodKey||'').toLowerCase()===key)||null; }
function mxCardCycles(key){
  const list=getTcCycles(key)||[];
  const rows=list.map((c,i)=>({cycle:c, open:getTcCycleOpen(list,i)||c.openDate||c.closeDate}));
  // Un ciclo cargado para más adelante todavía no figura en la lista de ciclos abiertos
  (state.tcCycles||[]).filter(c=>String(c.payMethodKey||'').toLowerCase()===key && c.openDate && !rows.some(r=>r.cycle.id===c.id))
    .forEach(c=>rows.push({cycle:c, open:c.openDate}));
  return rows.sort((a,b)=>b.cycle.closeDate.localeCompare(a.cycle.closeDate));
}
function renderMobileCards(){
  const shell=document.getElementById('mob-cc-shell');
  if(!shell || !mxIsMobile()) return;
  const today=dateToYMD(new Date());
  const block=key=>{
    const rows=mxCardCycles(key);
    const current=rows.find(r=>r.open<=today && today<=r.cycle.closeDate)||rows[0]||null;
    const name=MX_PAY_LABEL[key];
    if(!current) return '<section class="mx-card"><div class="mx-section-head"><span>'+name+'</span></div><div class="mx-none">Sin ciclos cargados</div></section>';
    const spent=getPeriodTotals({startStr:current.open, endStr:current.cycle.closeDate, card:key, todayRef:mxEndOfToday(), amountMode:'full'}).totalArs;
    const others=rows.filter(r=>r!==current).slice(0,6).map(r=>'<div class="mx-row">'
      +'<div class="mx-row-main"><div class="mx-row-title">'+esc(mxShortDate(r.open))+' al '+esc(mxShortDate(r.cycle.closeDate))+'</div>'
      +'<div class="mx-row-sub">'+(r.open>today?'Próximo · ':'')+'Vence '+esc(r.cycle.dueDate?mxShortDate(r.cycle.dueDate):'—')+'</div></div>'
      +'<button class="mx-link" onclick="mxOpenCycleEditor(\''+key+'\',\''+esc(r.cycle.id)+'\')">Editar</button>'
    +'</div>').join('');
    return '<section class="mx-card">'
      +'<div class="mx-section-head"><span>'+name+'</span><strong>'+esc(mxMoney(spent))+'</strong></div>'
      +'<div class="mx-dates">'
        +'<div><span>Abre</span><strong>'+esc(mxShortDate(current.open))+'</strong></div>'
        +'<div><span>Cierra</span><strong>'+esc(mxShortDate(current.cycle.closeDate))+'</strong></div>'
        +'<div><span>Vence</span><strong>'+esc(current.cycle.dueDate?mxShortDate(current.cycle.dueDate):'—')+'</strong></div>'
      +'</div>'
      +'<button class="mx-btn" onclick="mxOpenCycleEditor(\''+key+'\',\''+esc(current.cycle.id)+'\')">Editar este ciclo</button>'
      +(others?'<details class="mx-more"><summary>Otros ciclos</summary><div class="mx-list">'+others+'</div></details>':'')
    +'</section>';
  };
  shell.innerHTML=mxHeader()
    +'<h1 class="mx-title">Tarjetas</h1>'
    +block('visa')+block('amex')
    +'<button class="mx-import" onclick="mxOpenCycleEditor(\'visa\')">＋ Agregar un ciclo</button>';
}
function mxAddMonth(ymd, n){
  const d=new Date(ymd+'T12:00:00'); const day=d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+n);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return dateToYMD(d);
}
function mxAddDays(ymd, n){ const d=new Date(ymd+'T12:00:00'); d.setDate(d.getDate()+n); return dateToYMD(d); }
// Un ciclo nuevo arranca el día siguiente al último cierre de esa tarjeta
function mxNewCycleDefaults(key){
  const last=mxCardCycles(key)[0]?.cycle||null;
  if(!last) return {open:'',close:'',due:''};
  return {open:mxAddDays(last.closeDate,1), close:mxAddMonth(last.closeDate,1), due:last.dueDate?mxAddMonth(last.dueDate,1):''};
}
let _mxEditor=null;
function mxOpenCycleEditor(key, cycleId){
  mxCloseCycleEditor();
  const row=cycleId?mxCardCycles(key).find(r=>r.cycle.id===cycleId):null;
  const values=row?{open:row.open, close:row.cycle.closeDate, due:row.cycle.dueDate||''}:mxNewCycleDefaults(key);
  _mxEditor={key, cycleId:cycleId||''};
  const el=document.createElement('div');
  el.id='mx-sheet'; el.className='mx-sheet';
  el.innerHTML='<div class="mx-sheet-back" onclick="mxCloseCycleEditor()"></div>'
    +'<div class="mx-sheet-panel" role="dialog" aria-modal="true">'
      +'<div class="mx-sheet-title">'+(row?'Editar ciclo':'Agregar ciclo')+'</div>'
      +(row?'<div class="mx-subtitle">'+MX_PAY_LABEL[key]+'</div>'
        :'<div class="mx-seg">'+['visa','amex'].map(k=>'<button id="mx-seg-'+k+'" class="'+(k===key?'active':'')+'" onclick="mxPickEditorCard(\''+k+'\')">'+MX_PAY_LABEL[k]+'</button>').join('')+'</div>')
      +'<label class="mx-field">Abre<input type="date" id="mx-open" value="'+esc(values.open)+'"></label>'
      +'<label class="mx-field">Cierra<input type="date" id="mx-close" value="'+esc(values.close)+'"></label>'
      +'<label class="mx-field">Vence<input type="date" id="mx-due" value="'+esc(values.due)+'"></label>'
      +'<div class="mx-sheet-actions"><button class="mx-btn" onclick="mxCloseCycleEditor()">Cancelar</button><button class="mx-import" onclick="mxSaveCycle()">Guardar</button></div>'
    +'</div>';
  document.body.appendChild(el);
}
function mxPickEditorCard(key){
  if(!_mxEditor) return;
  _mxEditor.key=key;
  ['visa','amex'].forEach(k=>document.getElementById('mx-seg-'+k)?.classList.toggle('active',k===key));
  const v=mxNewCycleDefaults(key);
  document.getElementById('mx-open').value=v.open;
  document.getElementById('mx-close').value=v.close;
  document.getElementById('mx-due').value=v.due;
}
function mxCloseCycleEditor(){ document.getElementById('mx-sheet')?.remove(); _mxEditor=null; }
function mxSaveCycle(){
  if(!_mxEditor) return;
  const card=mxCardFor(_mxEditor.key);
  if(!card){ showToast('No encontré esa tarjeta','error'); return; }
  const saved=saveTcCycleData({
    cardId:card.id, editingId:_mxEditor.cycleId,
    openDate:document.getElementById('mx-open').value,
    closeDate:document.getElementById('mx-close').value,
    dueDate:document.getElementById('mx-due').value
  });
  if(!saved) return;
  mxCloseCycleEditor();
  renderMobileCards();
  if(typeof isGoogleConnected==='function' && !isGoogleConnected()) showToast('Guardado en este celular. Tocá "Traer gastos de Gmail" para que llegue a la compu.','info');
}

// Tema: la barra del teléfono acompaña al cambiar entre claro y oscuro
if(typeof MutationObserver!=='undefined' && document.body && document.body.addEventListener){
  try{ new MutationObserver(mxSyncThemeColor).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(_){}
}
