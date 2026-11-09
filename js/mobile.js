// ══ APP DEL CELULAR ══
// Cuatro pantallas estilo iPhone, siempre en la vista Tarjetas (Visa + Amex): Inicio,
// Movimientos, Compromisos y Tarjetas. Cada una tiene su color (ver --mx-accent en styles.css).
// El celular sirve para mirar y para traer gastos de Gmail; lo único que se edita
// desde acá son los ciclos de las tarjetas.

const MX_PAY_LABEL={visa:'Visa',amex:'Amex',deb:'Débito',ef:'Efectivo'};
const MX_GROUP_LABEL={cuotas:'Cuota',suscripciones:'Suscripción',fijos:'Gasto fijo'};

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
  menu:'<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  down:'<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  home:'<path d="M3 11l9-7.5L21 11v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z"/>',
  list:'<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/>',
  cal:'<rect x="3" y="4.5" width="18" height="17" rx="3"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/>',
  card:'<rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/>'
};
function mxIcon(name, size){
  return '<svg width="'+(size||20)+'" height="'+(size||20)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'+MX_ICON[name]+'</svg>';
}
const MX_GOOGLE='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.1 5.5c4.2-3.9 7.2-9.6 7.2-17z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2.2 1.5-5 2.3-8.8 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

// Título grande con el ícono de la pantalla (en su color) y el menú
function mxScreenHead(icon, title, sub, extraButton){
  return '<div class="mx-wash"></div>'
    +'<header class="mx-head">'
      +'<div class="mx-head-row">'
        +'<span class="mx-badge">'+mxIcon(icon,19)+'</span>'
        +'<h1 class="mx-lt">'+esc(title)+'</h1>'
        +(extraButton||'')
        +'<button class="mx-round" onclick="openMobDrawer()" aria-label="Menú">'+mxIcon('menu',19)+'</button>'
      +'</div>'
      +(sub?'<div class="mx-sub">'+esc(sub)+'</div>':'')
    +'</header>';
}
function mxLastImportText(){
  const last=state.lastGmailSync?new Date(state.lastGmailSync):null;
  return last&&!isNaN(last)?'Última vez: '+mxShortDate(last)+', '+last.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';
}
function mxGoogleGroup(){
  const connected=typeof isGoogleConnected==='function' && isGoogleConnected();
  const last=mxLastImportText();
  return '<div class="mx-group mx-section">'
    +'<button class="mx-li" onclick="mxConnectGoogle()"><span class="mx-ico mx-ico-g">'+MX_GOOGLE+'</span><span class="mx-tx"><span class="mx-act">'+(connected?'Conectado a Google · Actualizar':'Conectar con Google')+'</span></span></button>'
    +'<button class="mx-li" onclick="mxImportGmail()"><span class="mx-ico mx-ico-mail">'+mxIcon('down',18)+'</span><span class="mx-tx"><span class="mx-act">Traer gastos de Gmail</span>'+(last?'<span class="mx-s">'+esc(last)+'</span>':'')+'</span></button>'
  +'</div>';
}

// ── Google: el navegador del teléfono solo abre la ventana de Google si sale directo del toque,
// así que la conexión se deja preparada al abrir la app ──
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

// La barra del teléfono toma el tinte de la pantalla que estás viendo
function mxSyncThemeColor(){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!meta || !mxIsMobile()) return;
  const color=getComputedStyle(document.body).getPropertyValue('--mx-wash').trim();
  if(color) meta.setAttribute('content', color);
}

function mxHasData(){
  return !!((state.transactions||[]).length || (state.cuotas||[]).length || (state.subscriptions||[]).length);
}
function mxEmptyHtml(icon, title){
  return mxScreenHead(icon, title)
    +'<div class="mx-group mx-empty">'
      +'<div class="mx-empty-title">Todavía no hay datos en este celular</div>'
      +'<div class="mx-empty-sub">Conectá tu cuenta de Google y traemos todo lo que tenés en la compu.</div>'
      +'<button class="mx-primary" onclick="mxConnectGoogle()">Conectar con Google</button>'
    +'</div>';
}

// ── Inicio ──
function mxCommitmentRow(e){
  const settled=e.isSettled===true;
  const sub=[mxShortDate(e.date), e.payLabel==='Sin medio de pago'?'':e.payLabel].filter(Boolean).join(' · ');
  return '<div class="mx-li"><span class="mx-tx"><span class="mx-t">'+esc(e.title)+'</span><span class="mx-s">'+esc(sub)+'</span></span>'
    +'<span class="mx-r">'+esc(mxMoney(e.amount,e.currency))+'<small class="'+(settled?'ok':'wa')+'">'+(settled?'Cobrado':'Sin cobrar')+'</small></span></div>';
}
function renderMobileDashboard(){
  const shell=document.getElementById('mob-dash-shell');
  if(!shell || !mxIsMobile()) return;
  mxSyncThemeColor();
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('home','Este ciclo'); return; }
  const period=mxPeriod();
  const all=mxPeriodTotals(period,'tarjetas');
  const visa=mxPeriodTotals(period,'visa');
  const amex=mxPeriodTotals(period,'amex');
  const projection=getPeriodProjection({startStr:period.start, endStr:period.end, card:'tarjetas', todayRef:mxEndOfToday()});

  const rate=window.USD_TO_ARS||USD_TO_ARS||1;
  const toArs=e=>(Number(e.amount)||0)*((e.currency||'ARS')==='USD'?rate:1);
  const commitments=mxPeriodCommitments(period);
  const committedTotal=commitments.reduce((s,e)=>s+toArs(e),0);
  const paid=commitments.filter(e=>e.isSettled===true).reduce((s,e)=>s+toArs(e),0);
  // Lo ya cobrado en las tarjetas está en el gasto; se suma el resto (lo que falta y lo que va por débito)
  const notInSpent=commitments.filter(e=>!(e.inView!==false && e.isSettled===true)).reduce((s,e)=>s+toArs(e),0);
  const spentWithCommitments=all.totalArs+notInSpent;
  const paidPct=committedTotal>0?Math.round(paid/committedTotal*100):0;
  const left=period.daysLeft!=null&&period.daysLeft>=0?' · faltan '+period.daysLeft+' día'+(period.daysLeft===1?'':'s'):'';
  const amexPart=period.cycle?.parts?.amex;

  shell.innerHTML=mxScreenHead('home','Este ciclo',mxPeriodLabel(period)+left)
    +'<div class="mx-total"><span>Gastado con tus tarjetas</span><strong>'+esc(mxMoney(all.totalArs))+'</strong></div>'
    +'<div class="mx-wallet">'
      +'<div class="mx-cc visa"><div class="mx-cc-row"><span>Visa</span><strong>'+esc(mxMoney(visa.totalArs))+'</strong></div></div>'
      +'<div class="mx-cc amex"><div class="mx-cc-row"><span>Amex</span><strong>'+esc(mxMoney(amex.totalArs))+'</strong></div>'
        +(amexPart?'<small>Cierra el '+esc(mxShortDate(amexPart.close))+(amexPart.due?' · vence el '+esc(mxShortDate(amexPart.due)):'')+'</small>':'')+'</div>'
    +'</div>'
    +mxGoogleGroup()
    +'<div class="mx-section">'
      +'<div class="mx-sh"><span>Compromisos del período</span><b>'+esc(mxMoney(committedTotal))+'</b></div>'
      +'<div class="mx-group">'
        +(commitments.length?'<div class="mx-bar"><i style="width:'+paidPct+'%"></i></div>'+commitments.map(mxCommitmentRow).join(''):'<div class="mx-none">No hay compromisos en este período</div>')
        +'<div class="mx-li mx-li-total"><span class="mx-tx"><span class="mx-t">Gastado + compromisos</span></span><span class="mx-r">'+esc(mxMoney(spentWithCommitments))+'</span></div>'
      +'</div>'
    +'</div>'
    +'<div class="mx-twin">'
      +'<div class="mx-tile"><span>Proyección al cierre</span><b>'+esc(mxMoney(projection.projected))+'</b>'
        +(projection.tooEarly?'<small>Se afina a partir del día '+projection.minDays+'</small>':'')+'</div>'
      +'<div class="mx-tile"><span>Promedio diario</span><b>'+esc(mxMoney(projection.dailyVariable))+'</b></div>'
    +'</div>';
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
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('list','Movimientos'); return; }
  const period=mxPeriod();
  const totals=mxPeriodTotals(period,'tarjetas');
  const byDay=new Map();
  [...totals.entries].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(e=>{
    const day=dateToYMD(e.date);
    if(!byDay.has(day)) byDay.set(day,[]);
    byDay.get(day).push(e);
  });
  const list=[...byDay.entries()].map(([day,rows])=>'<div class="mx-section">'
    +'<div class="mx-day">'+esc(mxDayLabel(day))+'</div>'
    +'<div class="mx-group">'+rows.map(e=>{
      const pay=String(e.payMethod||'').toLowerCase();
      const tag=[MX_PAY_LABEL[pay]||'', e.isProjected?MX_GROUP_LABEL[e.group]||'':e.category||''].filter(Boolean).join(' · ');
      const name=e.description||'Movimiento';
      return '<div class="mx-li"><span class="mx-mono '+(pay==='amex'?'amex':'visa')+'">'+esc(name.trim().charAt(0).toUpperCase())+'</span>'
        +'<span class="mx-tx"><span class="mx-t">'+esc(name)+'</span><span class="mx-s">'+esc(tag)+'</span></span>'
        +'<span class="mx-r">'+esc(mxMoney(e.amount,e.currency))+'</span></div>';
    }).join('')+'</div></div>').join('');
  const importBtn='<button class="mx-round mx-round-accent" onclick="mxImportGmail()" aria-label="Traer gastos de Gmail">'+mxIcon('down',18)+'</button>';
  shell.innerHTML=mxScreenHead('list','Movimientos','Visa + Amex · '+mxPeriodLabel(period),importBtn)
    +'<div class="mx-tri">'
      +'<div><span>ARS</span><b>'+esc(mxMoney(totals.ars))+'</b></div>'
      +'<div><span>USD</span><b>'+esc(mxMoney(totals.usd,'USD'))+'</b></div>'
      +'<div><span>Total</span><b>'+esc(mxMoney(totals.totalArs))+'</b></div>'
    +'</div>'
    +(list||'<div class="mx-group mx-section"><div class="mx-none">Todavía no hay gastos en este período</div></div>');
}

// ── Compromisos ──
function renderMobileCompromisos(){
  const shell=document.getElementById('mob-comp-shell');
  if(!shell || !mxIsMobile()) return;
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('cal','Compromisos'); return; }
  const {fixedItems,subsItems,cuotaItems,allActive}=commitmentsBuildData();
  const sum=list=>list.reduce((s,i)=>s+(Number(i.amountArs)||0),0);
  const section=(title,items)=>{
    if(!items.length) return '';
    const rows=[...items].sort((a,b)=>(a.due?.sortDays??999)-(b.due?.sortDays??999)).map(item=>{
      const status=item.due?.status==='overdue'?'bad':item.due?.status==='soon'?'wa':'';
      const progress=item.type==='quota'&&item.total?item.paid+' de '+item.total+' cuotas':'';
      return '<div class="mx-li"><span class="mx-tx"><span class="mx-t">'+esc(item.name)+'</span>'+(progress?'<span class="mx-s">'+esc(progress)+'</span>':'')+'</span>'
        +'<span class="mx-r">'+esc(mxMoney(item.amount,item.currency))+(item.due?.label?'<small class="'+status+'">'+esc(item.due.label)+'</small>':'')+'</span></div>';
    }).join('');
    return '<div class="mx-section"><div class="mx-sh"><span>'+esc(title)+'</span><b>'+esc(mxMoney(sum(items)))+'</b></div><div class="mx-group">'+rows+'</div></div>';
  };
  shell.innerHTML=mxScreenHead('cal','Compromisos')
    +'<div class="mx-total"><span>Total por mes</span><strong>'+esc(mxMoney(sum(allActive)))+'</strong></div>'
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
    if(!current) return '<div class="mx-section"><div class="mx-group"><div class="mx-none">'+name+': sin ciclos cargados</div></div></div>';
    const spent=getPeriodTotals({startStr:current.open, endStr:current.cycle.closeDate, card:key, todayRef:mxEndOfToday()}).totalArs;
    const others=rows.filter(r=>r!==current).slice(0,6).map(r=>'<div class="mx-li">'
      +'<span class="mx-tx"><span class="mx-t">'+esc(mxShortDate(r.open))+' al '+esc(mxShortDate(r.cycle.closeDate))+'</span>'
      +'<span class="mx-s">'+(r.open>today?'Próximo · ':'')+'Vence '+esc(r.cycle.dueDate?mxShortDate(r.cycle.dueDate):'—')+'</span></span>'
      +'<button class="mx-act" onclick="mxOpenCycleEditor(\''+key+'\',\''+esc(r.cycle.id)+'\')">Editar</button>'
    +'</div>').join('');
    return '<div class="mx-section">'
      +'<div class="mx-cc solo '+key+'"><div class="mx-cc-row"><span>'+name+'</span><strong>'+esc(mxMoney(spent))+'</strong></div><small>Ciclo actual</small></div>'
      +'<div class="mx-group">'
        +'<div class="mx-dates">'
          +'<div><span>Abre</span><b>'+esc(mxShortDate(current.open))+'</b></div>'
          +'<div><span>Cierra</span><b>'+esc(mxShortDate(current.cycle.closeDate))+'</b></div>'
          +'<div><span>Vence</span><b>'+esc(current.cycle.dueDate?mxShortDate(current.cycle.dueDate):'—')+'</b></div>'
        +'</div>'
        +'<button class="mx-li" onclick="mxOpenCycleEditor(\''+key+'\',\''+esc(current.cycle.id)+'\')"><span class="mx-tx"><span class="mx-act">Editar este ciclo</span></span></button>'
        +(others?'<details class="mx-more"><summary class="mx-li"><span class="mx-tx"><span class="mx-t">Otros ciclos</span></span></summary>'+others+'</details>':'')
      +'</div>'
    +'</div>';
  };
  shell.innerHTML=mxScreenHead('card','Tarjetas')
    +block('visa')+block('amex')
    +'<div class="mx-group mx-section"><button class="mx-li" onclick="mxOpenCycleEditor(\'visa\')"><span class="mx-tx"><span class="mx-act">Agregar un ciclo</span></span></button></div>';
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
  const field=(label,id,value)=>'<label class="mx-li mx-field"><span class="mx-t">'+label+'</span><input type="date" id="'+id+'" value="'+esc(value)+'"></label>';
  const el=document.createElement('div');
  el.id='mx-sheet'; el.className='mx-sheet';
  el.innerHTML='<div class="mx-sheet-back" onclick="mxCloseCycleEditor()"></div>'
    +'<div class="mx-sheet-panel" role="dialog" aria-modal="true">'
      +'<div class="mx-sheet-top"><button class="mx-act" onclick="mxCloseCycleEditor()">Cancelar</button>'
        +'<strong>'+(row?'Editar ciclo':'Agregar ciclo')+'</strong>'
        +'<button class="mx-act mx-act-strong" onclick="mxSaveCycle()">Guardar</button></div>'
      +(row?'<div class="mx-sheet-card">'+MX_PAY_LABEL[key]+'</div>'
        :'<div class="mx-seg">'+['visa','amex'].map(k=>'<button id="mx-seg-'+k+'" class="'+(k===key?'active':'')+'" onclick="mxPickEditorCard(\''+k+'\')">'+MX_PAY_LABEL[k]+'</button>').join('')+'</div>')
      +'<div class="mx-group">'+field('Abre','mx-open',values.open)+field('Cierra','mx-close',values.close)+field('Vence','mx-due',values.due)+'</div>'
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
  if(typeof isGoogleConnected==='function' && !isGoogleConnected()) showToast('Guardado en este celular. Tocá "Conectar con Google" para que llegue a la compu.','info');
}

// Cambia la barra del teléfono al pasar de pantalla o de tema
if(typeof MutationObserver!=='undefined' && document.body && document.body.addEventListener){
  try{ new MutationObserver(mxSyncThemeColor).observe(document.body,{attributes:true,attributeFilter:['class','data-active-page']}); }catch(_){}
}
