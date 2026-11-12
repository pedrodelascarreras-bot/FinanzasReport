// ══ APP DEL CELULAR ══
// Diseño "Widgets": franja de color arriba y bloques como los widgets del iPhone. Siempre en la
// vista Tarjetas (Visa + Amex): Inicio, Movimientos, Compromisos y Tarjetas, cada una con su
// color (--mx-c / --mx-soft en styles.css). El celular sirve para mirar y para traer gastos de
// Gmail; lo único que se edita desde acá son los ciclos de las tarjetas.

const MX_PAY_LABEL={visa:'Visa',amex:'Amex',deb:'Débito',ef:'Efectivo'};
const MX_GROUP_LABEL={cuotas:'Cuota',suscripciones:'Suscripción',fijos:'Gasto fijo'};
const MX_VISA='#3A63E8', MX_AMEX='#16B39A';

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
function mxInitial(name){ return esc(String(name||'?').trim().charAt(0).toUpperCase()||'?'); }

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
  return getPeriodTotals({startStr:period.start, endStr:period.end, card, todayRef:mxEndOfToday()});
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

const MX_ICON={
  down:'<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
};
function mxIcon(name, size, width){
  return '<svg width="'+(size||20)+'" height="'+(size||20)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(width||2)+'" stroke-linecap="round" stroke-linejoin="round">'+MX_ICON[name]+'</svg>';
}
const MX_GOOGLE='<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.1 5.5c4.2-3.9 7.2-9.6 7.2-17z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2.2 1.5-5 2.3-8.8 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

// ── Google ──
function mxLastImportText(){
  const last=state.lastGmailSync?new Date(state.lastGmailSync):null;
  return last&&!isNaN(last)?'Última vez: '+mxShortDate(last)+', '+last.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
}
// El acceso de Google dura una hora: pasado eso ya no está conectado de verdad
function mxGoogleConnected(){
  return typeof isGoogleConnected==='function' && isGoogleConnected() && Date.now()<(window._driveTokenExpiresAt||0);
}
// Última vez que este celular trajo datos de Google, en palabras ("hace 5 min", "ayer, 18:40")
function mxLastGoogle(now=new Date()){
  const raw=localStorage.getItem('fin_last_google_at');
  const d=raw?new Date(raw):null;
  if(!d || isNaN(d)) return {text:'Nunca se conectó en este celular', short:'Nunca', stale:true};
  const mins=Math.max(0, Math.round((now-d)/60000));
  const hour=d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const dayDiff=Math.round((new Date(dateToYMD(now)+'T12:00:00')-new Date(dateToYMD(d)+'T12:00:00'))/86400000);
  let when;
  if(mins<1) when='recién';
  else if(mins<60) when='hace '+mins+' min';
  else if(dayDiff===0) when='hoy, '+hour;
  else if(dayDiff===1) when='ayer, '+hour;
  else if(dayDiff<7) when='hace '+dayDiff+' días';
  else when='el '+mxShortDate(d);
  return {text:'Última vez: '+when, short:when.charAt(0).toUpperCase()+when.slice(1), stale:mins>=24*60};
}
// El navegador del teléfono solo abre la ventana de Google si sale directo del toque,
// así que la conexión se deja preparada al abrir la app
function mxPrepareGoogle(){
  if(typeof driveTokenClient==='undefined' || driveTokenClient) return;
  try{ initDriveClient(false,{prepareOnly:true}); }catch(e){ console.warn('[mobile] Google no disponible', e); }
}
// Trae lo último que subió la compu. Si ya está conectado, vuelve a pedir el acceso (dura una hora)
function mxConnectGoogle(){
  if(!driveTokenClient){
    mxPrepareGoogle();
    showToast('Preparando la conexión con Google… tocá de nuevo en un segundo','info');
    return;
  }
  driveTokenClient.requestAccessToken({prompt:''});
}
function mxImportGmail(){
  if(!gmailAccessToken && !driveTokenClient){
    mxPrepareGoogle();
    showToast('Preparando la conexión con Google… tocá de nuevo en un segundo','info');
    return;
  }
  gmailSync();
}

// La barra del teléfono toma el color de la pantalla que estás viendo
function mxSyncThemeColor(){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!meta || !mxIsMobile()) return;
  const color=getComputedStyle(document.body).getPropertyValue('--mx-c').trim();
  if(color) meta.setAttribute('content', color);
}

// ── Piezas del diseño ──
// Franja de color con el título y, a la derecha, cuándo se conectó con Google
function mxBand(title){
  const g=mxLastGoogle();
  const ok=mxGoogleConnected() && !g.stale;
  return '<div class="mx-band"></div><div class="mx-status-strip"></div>'
    +'<header class="mx-hd"><h2>'+esc(title)+'</h2>'
    +'<button class="mx-dot" onclick="mxConnectGoogle()" aria-label="Google: '+esc(g.text)+'"><i class="'+(ok?'ok':'')+'"></i>'+esc(g.short)+'</button></header>';
}
function mxSeg(parts){
  return '<div class="mx-seg">'+parts.filter(p=>p.value>0).map(p=>'<i style="flex:'+p.value+';background:'+p.color+'"></i>').join('')+'</div>';
}
function mxGauge(pct){
  const p=Math.max(0, Math.min(1, pct||0)), C=Math.PI*56;
  return '<svg class="mx-gauge" viewBox="0 0 140 76" width="100%" height="70"><path d="M14 70a56 56 0 0 1 112 0" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="12" stroke-linecap="round"/>'
    +'<path d="M14 70a56 56 0 0 1 112 0" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+(C*p).toFixed(1)+' '+C.toFixed(1)+'"/></svg>';
}
function mxItem(lead, title, sub, right, rightSmall, smallClass){
  return '<div class="mx-it"><div class="mx-ib">'+lead+'</div>'
    +'<div class="mx-tx"><div class="mx-t">'+esc(title)+'</div><div class="mx-s">'+esc(sub||'')+'</div></div>'
    +'<div class="mx-r">'+esc(right)+(rightSmall?'<small class="'+(smallClass||'')+'">'+esc(rightSmall)+'</small>':'')+'</div></div>';
}
function mxSh(title, pill, small){
  return '<div class="mx-sh"><h3'+(small?' class="small"':'')+'>'+esc(title)+'</h3>'+(pill?'<b>'+esc(pill)+'</b>':'')+'</div>';
}
function mxHasData(){
  return !!((state.transactions||[]).length || (state.cuotas||[]).length || (state.subscriptions||[]).length);
}
function mxEmptyHtml(title){
  return mxBand(title)
    +'<div class="mx-grid"><div class="mx-w full mx-empty">'
      +'<div class="mx-md">Todavía no hay datos en este celular</div>'
      +'<div class="mx-sub">Conectá tu cuenta de Google y traemos todo lo que tenés en la compu.</div>'
      +'<button class="mx-go wide" onclick="mxConnectGoogle()">Conectar con Google</button>'
    +'</div></div>';
}

// ── Inicio ──
function renderMobileDashboard(){
  const shell=document.getElementById('mob-dash-shell');
  if(!shell || !mxIsMobile()) return;
  mxSyncThemeColor();
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('Este ciclo'); return; }
  const period=mxPeriod();
  const all=mxPeriodTotals(period,'tarjetas');
  const visa=mxPeriodTotals(period,'visa');
  const amex=mxPeriodTotals(period,'amex');
  const projection=getPeriodProjection({startStr:period.start, endStr:period.end, card:'tarjetas', todayRef:mxEndOfToday()});

  const rate=window.USD_TO_ARS||USD_TO_ARS||1;
  const toArs=e=>(Number(e.amount)||0)*((e.currency||'ARS')==='USD'?rate:1);
  const commitments=mxPeriodCommitments(period);
  const committedTotal=commitments.reduce((s,e)=>s+toArs(e),0);
  // Lo ya cobrado en las tarjetas está en el gasto; se suma el resto (lo que falta y lo que va por débito)
  const notInSpent=commitments.filter(e=>!(e.inView!==false && e.isSettled===true)).reduce((s,e)=>s+toArs(e),0);
  const spentWithCommitments=all.totalArs+notInSpent;
  const left=period.daysLeft!=null&&period.daysLeft>=0?' · faltan '+period.daysLeft+' día'+(period.daysLeft===1?'':'s'):'';
  const totalDays=projection.daysElapsed+projection.daysLeft;
  const g=mxLastGoogle();
  const connected=mxGoogleConnected();
  const fresh=connected&&!g.stale;

  const rows=commitments.map(e=>{
    const settled=e.isSettled===true;
    const sub=[mxShortDate(e.date), e.payLabel==='Sin medio de pago'?'':e.payLabel].filter(Boolean).join(' · ');
    return mxItem(String(new Date(e.date).getDate()), e.title, sub, mxMoney(e.amount,e.currency), settled?'Cobrado':'Sin cobrar', settled?'ok':'wa');
  }).join('');

  shell.innerHTML=mxBand('Este ciclo')
    +'<div class="mx-grid">'
      +'<div class="mx-w full"><div class="mx-lb">Gastado con tus tarjetas'+esc(left)+'</div><div class="mx-big">'+esc(mxMoney(all.totalArs))+'</div>'
        +mxSeg([{value:visa.totalArs,color:MX_VISA},{value:amex.totalArs,color:MX_AMEX}])
        +'<div class="mx-leg"><span><i style="background:'+MX_VISA+'"></i>Visa <b>'+esc(mxMoney(visa.totalArs))+'</b></span><span><i style="background:'+MX_AMEX+'"></i>Amex <b>'+esc(mxMoney(amex.totalArs))+'</b></span></div></div>'
      +'<div class="mx-w tint"><div class="mx-lb">Proyección al cierre</div>'+mxGauge(projection.projected>0?all.totalArs/projection.projected:0)
        +'<div class="mx-md under">'+esc(mxMoney(projection.projected))+'</div></div>'
      +'<div class="mx-w soft"><div class="mx-lb">Promedio diario</div><div class="mx-md spaced">'+esc(mxMoney(projection.dailyVariable))+'</div>'
        +'<div class="mx-sub">'+projection.daysElapsed+' de '+totalDays+' días</div></div>'
      +'<div class="mx-w full"><div class="mx-goo">'
        +'<button class="mx-goo-l" onclick="mxConnectGoogle()"><span class="mx-g">'+MX_GOOGLE+'</span><span><span class="mx-goo-t">'+(connected?'Conectado':'Sin conectar')+'</span>'
        +'<span class="mx-goo-s'+(fresh?' fresh':'')+'">'+esc(g.text)+'</span></span></button>'
        +'<button class="mx-go" onclick="mxImportGmail()">'+mxIcon('down',17,2.6)+'Traer</button></div></div>'
      +(typeof avisosWidgetHtml==='function'?avisosWidgetHtml():'')
    +'</div>'
    +mxSh('Compromisos', mxMoney(committedTotal))
    +'<div class="mx-list">'+(rows||'<div class="mx-none">No hay compromisos en este período</div>')+'</div>'
    +'<div class="mx-with"><span>Con compromisos</span><b>'+esc(mxMoney(spentWithCommitments))+'</b></div>';
  // Con datos nuevos se recalculan los avisos (js/avisos.js)
  if(typeof avisosQueue==='function') avisosQueue();
}

// ── Movimientos: solo lectura ──
function mxDayLabel(ymd){
  const today=dateToYMD(new Date());
  const y=new Date(); y.setDate(y.getDate()-1);
  if(ymd===today) return 'Hoy';
  if(ymd===dateToYMD(y)) return 'Ayer';
  return mxShortDate(ymd);
}
function renderMobileTransactions(){
  const shell=document.getElementById('mob-txn-shell');
  if(!shell || !mxIsMobile()) return;
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('Movimientos'); return; }
  const period=mxPeriod();
  const totals=mxPeriodTotals(period,'tarjetas');
  const byDay=new Map();
  [...totals.entries].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{
    const day=dateToYMD(e.date);
    if(!byDay.has(day)) byDay.set(day,[]);
    byDay.get(day).push(e);
  });
  const list=[...byDay.entries()].map(([day,rows])=>mxSh(mxDayLabel(day),'',true)
    +'<div class="mx-list">'+rows.map(e=>{
      const pay=String(e.payMethod||'').toLowerCase();
      const tag=[MX_PAY_LABEL[pay]||'', e.isProjected?MX_GROUP_LABEL[e.group]||'':e.category||''].filter(Boolean).join(' · ');
      const name=e.description||'Movimiento';
      const fresh=!e.isProjected && isNewTxn(e.txn);
      return mxItem(mxInitial(name), name, tag, mxMoney(e.amount,e.currency), fresh?'Nuevo':'', fresh?'new':'');
    }).join('')+'</div>').join('');
  shell.innerHTML=mxBand('Movimientos')
    +'<div class="mx-grid">'
      +'<div class="mx-w full"><div class="mx-lb">Total del período · Visa + Amex</div><div class="mx-big">'+esc(mxMoney(totals.totalArs))+'</div><div class="mx-sub">'+esc(mxPeriodLabel(period))+'</div></div>'
      +'<div class="mx-w tint"><div class="mx-lb">En pesos</div><div class="mx-md">'+esc(mxMoney(totals.ars))+'</div></div>'
      +'<div class="mx-w soft"><div class="mx-lb">En dólares</div><div class="mx-md">'+esc(mxMoney(totals.usd,'USD'))+'</div></div>'
    +'</div>'
    +(list||mxSh('Hoy','',true)+'<div class="mx-list"><div class="mx-none">Todavía no hay gastos en este período</div></div>');
}

// ── Compromisos ──
function renderMobileCompromisos(){
  const shell=document.getElementById('mob-comp-shell');
  if(!shell || !mxIsMobile()) return;
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('Compromisos'); return; }
  const {fixedItems,subsItems,cuotaItems,allActive}=commitmentsBuildData();
  const sum=list=>list.reduce((s,i)=>s+(Number(i.amountArs)||0),0);
  const section=(title,items)=>{
    if(!items.length) return '';
    const rows=[...items].sort((a,b)=>(a.due?.sortDays??999)-(b.due?.sortDays??999)).map(item=>{
      const sub=item.type==='quota'&&item.total?item.paid+' de '+item.total:'Mensual';
      return mxItem(mxInitial(item.name), item.name, sub, mxMoney(item.amount,item.currency), item.due?.label||'', 'due');
    }).join('');
    return mxSh(title, mxMoney(sum(items)))+'<div class="mx-list">'+rows+'</div>';
  };
  shell.innerHTML=mxBand('Compromisos')
    +'<div class="mx-grid"><div class="mx-w full"><div class="mx-lb">Total por mes</div><div class="mx-big">'+esc(mxMoney(sum(allActive)))+'</div>'
      +mxSeg([{value:sum(cuotaItems),color:'var(--mx-c)'},{value:sum(subsItems),color:'#F5B26B'},{value:sum(fixedItems),color:'#1A1B20'}])
      +'<div class="mx-leg"><span><i style="background:var(--mx-c)"></i>Cuotas</span><span><i style="background:#F5B26B"></i>Suscrip.</span><span><i style="background:#1A1B20"></i>Fijos</span></div></div></div>'
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
    const name=MX_PAY_LABEL[key], color=key==='amex'?'#0E9F86':MX_VISA;
    if(!current) return '<div class="mx-w full"><div class="mx-lb card" style="color:'+color+'">'+name+'</div><div class="mx-sub">Sin ciclos cargados</div></div>';
    const spent=getPeriodTotals({startStr:current.open, endStr:current.cycle.closeDate, card:key, todayRef:mxEndOfToday()}).totalArs;
    const span=new Date(current.cycle.closeDate+'T12:00:00')-new Date(current.open+'T12:00:00');
    const done=Math.max(0, Math.min(1, span>0?(new Date(today+'T12:00:00')-new Date(current.open+'T12:00:00'))/span:0));
    return '<div class="mx-w full">'
      +'<div class="mx-card-top"><div class="mx-lb card" style="color:'+color+'">'+name+'</div><div class="mx-md flat">'+esc(mxMoney(spent))+'</div></div>'
      +'<div class="mx-cyc"><i style="width:'+Math.round(done*100)+'%"></i></div>'
      +'<div class="mx-dts"><div><span>Abre</span><b>'+esc(mxShortDate(current.open))+'</b></div>'
        +'<div><span>Cierra</span><b>'+esc(mxShortDate(current.cycle.closeDate))+'</b></div>'
        +'<div><span>Vence</span><b>'+esc(current.cycle.dueDate?mxShortDate(current.cycle.dueDate):'—')+'</b></div></div>'
      +'<button class="mx-edit" onclick="mxOpenCycleEditor(\''+key+'\',\''+esc(current.cycle.id)+'\')">Editar ciclo</button>'
    +'</div>';
  };
  shell.innerHTML=mxBand('Tarjetas')
    +'<div class="mx-grid">'+block('visa')+block('amex')
      +'<button class="mx-w full tint mx-add" onclick="mxOpenCycleEditor(\'visa\')">'+mxIcon('plus',19,2.6)+' Agregar un ciclo</button>'
    +'</div>';
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
  const field=(label,id,value)=>'<label class="mx-it mx-field"><span class="mx-t">'+label+'</span><input type="date" id="'+id+'" value="'+esc(value)+'"></label>';
  const el=document.createElement('div');
  el.id='mx-sheet'; el.className='mx-sheet';
  el.innerHTML='<div class="mx-sheet-back" onclick="mxCloseCycleEditor()"></div>'
    +'<div class="mx-sheet-panel" role="dialog" aria-modal="true">'
      +'<div class="mx-sheet-top"><button onclick="mxCloseCycleEditor()">Cancelar</button>'
        +'<strong>'+(row?'Editar ciclo':'Agregar ciclo')+'</strong>'
        +'<button class="strong" onclick="mxSaveCycle()">Guardar</button></div>'
      +(row?'<div class="mx-sheet-card">'+MX_PAY_LABEL[key]+'</div>'
        :'<div class="mx-segctl">'+['visa','amex'].map(k=>'<button id="mx-seg-'+k+'" class="'+(k===key?'active':'')+'" onclick="mxPickEditorCard(\''+k+'\')">'+MX_PAY_LABEL[k]+'</button>').join('')+'</div>')
      +'<div class="mx-list sheet">'+field('Abre','mx-open',values.open)+field('Cierra','mx-close',values.close)+field('Vence','mx-due',values.due)+'</div>'
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
  if(typeof isGoogleConnected==='function' && !isGoogleConnected()) showToast('Guardado en este celular. Tocá "Sin conectar" arriba para que llegue a la compu.','info');
}

// Cambia la barra del teléfono al pasar de pantalla
if(typeof MutationObserver!=='undefined' && document.body && document.body.addEventListener){
  try{ new MutationObserver(mxSyncThemeColor).observe(document.body,{attributes:true,attributeFilter:['class','data-active-page']}); }catch(_){}
}
