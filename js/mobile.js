// ══ APP DEL CELULAR ══
// Diseño "Widgets": franja de color arriba y bloques como los widgets del iPhone. Siempre en la
// vista Tarjetas (Visa + Amex): Inicio, Movimientos, Compromisos y Tarjetas, cada una con su
// color (--mx-c / --mx-soft en styles.css). El celular sirve para mirar y para traer gastos de
// Gmail. Desde acá se editan los ciclos de las tarjetas, los movimientos (nombre, categoría o
// borrar) y se borran compromisos. Google y los avisos viven en una hoja que se abre tocando
// el estado de Google arriba a la derecha (en el Inicio solo se ve si está conectado).

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
// Conectado "para siempre" (Vercel guarda la llave): cuenta aunque el permiso de una hora haya vencido
function mxGoogleLinked(){
  return mxGoogleConnected() || (typeof gsIsServerMode==='function' && gsIsServerMode() && typeof gsConnected!=='undefined' && gsConnected===true);
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
// Franja de color con el título y, a la derecha, el estado de Google. Tocándolo se abre la hoja
// de Google y avisos. En el Inicio dice si está conectado; en el resto, cuándo se actualizó.
function mxBand(title, home){
  const g=mxLastGoogle();
  const linked=mxGoogleLinked();
  const ok=home?linked:(linked && !g.stale);
  // En el Inicio: logo de Google + "Conectado" / "Desconectado", en una pastilla blanca
  const pill=home
    ?'<button class="mx-dot mx-dot-g" onclick="mxOpenSettings()" aria-label="Google '+(linked?'conectado':'desconectado')+'">'
      +'<span class="mx-dot-logo">'+MX_GOOGLE.replace(/width="20" height="20"/,'width="16" height="16"')+'</span>'
      +(linked?'Conectado':'Desconectado')+'<i class="'+(ok?'ok':'')+'"></i></button>'
    :'<button class="mx-dot" onclick="mxOpenSettings()" aria-label="Google: '+esc(g.text)+'"><i class="'+(ok?'ok':'')+'"></i>'+esc(g.short)+'</button>';
  return '<div class="mx-band"></div><div class="mx-status-strip"></div>'
    +'<header class="mx-hd"><h2>'+esc(title)+'</h2>'+pill+'</header>';
}
function mxSeg(parts){
  return '<div class="mx-seg">'+parts.filter(p=>p.value>0).map(p=>'<i style="flex:'+p.value+';background:'+p.color+'"></i>').join('')+'</div>';
}
function mxGauge(pct){
  const p=Math.max(0, Math.min(1, pct||0)), C=Math.PI*56;
  return '<svg class="mx-gauge" viewBox="0 0 140 76" width="100%" height="70"><path d="M14 70a56 56 0 0 1 112 0" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="12" stroke-linecap="round"/>'
    +'<path d="M14 70a56 56 0 0 1 112 0" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+(C*p).toFixed(1)+' '+C.toFixed(1)+'"/></svg>';
}
// tap: atributos ya armados (onclick y data-*) para que la fila se pueda tocar
function mxItem(lead, title, sub, right, rightSmall, smallClass, tap){
  return '<div class="mx-it'+(tap?' tap" role="button" '+tap:'"')+'><div class="mx-ib">'+lead+'</div>'
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
  // Se suma lo que todavía falta cobrar en el resumen de cada tarjeta. Lo que cae después del
  // cierre de su tarjeta ya quedó afuera (va al próximo resumen) y el débito no va a ninguno.
  const pendingCard=commitments.filter(e=>e.inView!==false && e.isSettled!==true);
  const notInSpent=pendingCard.reduce((s,e)=>s+toArs(e),0);
  const spentWithCommitments=all.totalArs+notInSpent;
  const left=period.daysLeft!=null&&period.daysLeft>=0?' · faltan '+period.daysLeft+' día'+(period.daysLeft===1?'':'s'):'';
  const totalDays=projection.daysElapsed+projection.daysLeft;
  const pendingCount=pendingCard.length;
  const closeTxt=period.cycle?'Cierra el '+mxShortDate(period.end):'Fin de mes: '+mxShortDate(period.end);

  shell.innerHTML=mxBand('Este ciclo', true)
    +'<div class="mx-grid">'
      +'<div class="mx-w full"><div class="mx-lb">Gastado con tus tarjetas'+esc(left)+'</div><div class="mx-big">'+esc(mxMoney(all.totalArs))+'</div>'
        +mxSeg([{value:visa.totalArs,color:MX_VISA},{value:amex.totalArs,color:MX_AMEX}])
        +'<div class="mx-leg"><span><i style="background:'+MX_VISA+'"></i>Visa <b>'+esc(mxMoney(visa.totalArs))+'</b></span><span><i style="background:'+MX_AMEX+'"></i>Amex <b>'+esc(mxMoney(amex.totalArs))+'</b></span></div></div>'
      +'<div class="mx-w tint"><div class="mx-lb">Proyección al cierre</div>'+mxGauge(projection.projected>0?all.totalArs/projection.projected:0)
        +'<div class="mx-md under">'+esc(mxMoney(projection.projected))+'</div></div>'
      +'<div class="mx-w soft"><div class="mx-lb">Promedio diario</div><div class="mx-md spaced">'+esc(mxMoney(projection.dailyVariable))+'</div>'
        +'<div class="mx-sub">'+projection.daysElapsed+' de '+totalDays+' días</div></div>'
      // Total con compromisos: lo gastado + lo que todavía falta cobrar en el ciclo
      +'<div class="mx-w full mx-total">'
        +'<div class="mx-lb">Total del ciclo con compromisos</div>'
        +'<div class="mx-big">'+esc(mxMoney(spentWithCommitments))+'</div>'
        +'<div class="mx-sub">'+esc(closeTxt)+'</div>'
        +mxSeg([{value:all.totalArs,color:'var(--mx-c)'},{value:notInSpent,color:'#F5A35C'}])
        +'<div class="mx-trow"><span><i style="background:var(--mx-c)"></i>Ya gastado</span><b>'+esc(mxMoney(all.totalArs))+'</b></div>'
        +'<div class="mx-trow"><span><i style="background:#F5A35C"></i>Compromisos por cobrar'+(pendingCount?' ('+pendingCount+')':'')+'</span><b>'+esc(mxMoney(notInSpent))+'</b></div>'
      +'</div>'
    +'</div>'
    +mxCategoriesHtml(all.entries);
  // Con datos nuevos se recalculan los avisos (js/avisos.js)
  if(typeof avisosQueue==='function') avisosQueue();
  mxRefreshSettings();
}

// En qué se fue la plata del ciclo: las 5 categorías más grandes y el resto en "Otras"
function mxCategoriesHtml(entries){
  const rate=window.USD_TO_ARS||(typeof USD_TO_ARS!=='undefined'?USD_TO_ARS:1)||1;
  const by=new Map();
  (entries||[]).forEach(e=>{
    const ars=(Number(e.amount)||0)*((e.currency||'ARS')==='USD'?rate:1);
    if(!(ars>0)) return;
    const cat=e.isProjected?(MX_GROUP_LABEL[e.group]?MX_GROUP_LABEL[e.group]==='Cuota'?'Cuotas':MX_GROUP_LABEL[e.group]==='Suscripción'?'Suscripciones':'Gastos fijos':'Compromisos'):(mxPendingCat(e.category)?'Sin categoría':e.category);
    by.set(cat,(by.get(cat)||0)+ars);
  });
  const total=[...by.values()].reduce((a,b)=>a+b,0);
  if(!total) return mxSh('En qué gastaste','',false)+'<div class="mx-list"><div class="mx-none">Todavía no hay gastos en este ciclo</div></div>';
  const sorted=[...by.entries()].sort((a,b)=>b[1]-a[1]);
  const top=sorted.slice(0,5);
  const rest=sorted.slice(5).reduce((a,[,v])=>a+v,0);
  const PALETTE_FALLBACK={ 'Sin categoría':'#A0A4AE', 'Otras':'#C3C6CE', 'Cuotas':'#8C5CFF', 'Suscripciones':'#F5A35C', 'Gastos fijos':'#3A3D46' };
  const rows=top.map(([cat,v])=>{ const m=mxCatMeta(cat); return {cat, v, color:PALETTE_FALLBACK[cat]||m.color, emoji:m.emoji}; });
  if(rest>0) rows.push({cat:'Otras', v:rest, color:PALETTE_FALLBACK['Otras'], emoji:'⋯'});
  const max=rows[0].v;
  return mxSh('En qué gastaste', sorted.length+' categoría'+(sorted.length===1?'':'s'))
    +'<div class="mx-w mx-cats-w">'
      +mxSeg(rows.map(r=>({value:r.v, color:r.color})))
      +rows.map(r=>{
        const pct=Math.round(r.v/total*100);
        return '<div class="mx-crow2">'
          +'<span class="mx-cic2" style="background:'+esc(mxTint(r.color,20))+';color:'+esc(r.color)+'">'+esc(r.emoji||r.cat.charAt(0))+'</span>'
          +'<div class="mx-cbody"><div class="mx-ctop"><b>'+esc(r.cat)+'</b><span>'+esc(mxMoney(r.v))+'</span></div>'
          +'<div class="mx-cbar"><i style="width:'+Math.max(3,Math.round(r.v/max*100))+'%;background:'+esc(r.color)+'"></i><em>'+pct+'%</em></div></div></div>';
      }).join('')
    +'</div>';
}

// ── Movimientos: tocando uno se cambia el nombre, la categoría o se borra ──
function mxPendingCat(cat){ return !cat || cat==='Procesando...' || cat==='Uncategorized' || cat==='Sin categoría'; }
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
  // Total de cada día al lado de la fecha (pesos y, si hubo, dólares aparte)
  const dayTotal=rows=>{
    const ars=rows.filter(e=>(e.currency||'ARS')!=='USD').reduce((a,e)=>a+(Number(e.amount)||0),0);
    const usd=rows.filter(e=>e.currency==='USD').reduce((a,e)=>a+(Number(e.amount)||0),0);
    return [ars||!usd?mxMoney(ars):'', usd?mxMoney(usd,'USD'):''].filter(Boolean).join(' + ');
  };
  const list=[...byDay.entries()].map(([day,rows])=>'<div class="mx-sh mx-day"><h3 class="small">'+esc(mxDayLabel(day))
      +'<small>'+rows.length+' movimiento'+(rows.length===1?'':'s')+'</small></h3><b>'+esc(dayTotal(rows))+'</b></div>'
    +'<div class="mx-list">'+rows.map(e=>{
      const pay=String(e.payMethod||'').toLowerCase();
      const name=e.description||'Movimiento';
      const fresh=!e.isProjected && isNewTxn(e.txn);
      const tap=!e.isProjected && e.txn && e.txn.id!=null?'onclick="mxOpenTxn(this.dataset.id)" data-id="'+esc(String(e.txn.id))+'"':'';
      const payLabel=MX_PAY_LABEL[pay]||'';
      if(e.isProjected) return mxItem(mxInitial(name), name, [payLabel, MX_GROUP_LABEL[e.group]||''].filter(Boolean).join(' · '), mxMoney(e.amount,e.currency), '', '', tap);
      // Con categoría: ícono y etiqueta con su color. Sin categoría: si es nuevo lo dice
      // el cartel "Nuevo"; si no, "Sin categoría" en gris
      const has=!mxPendingCat(e.category);
      const m=has?mxCatMeta(e.category):null;
      const lead=has?'<div class="mx-ib" style="background:'+esc(mxTint(m.color,22))+';color:'+esc(m.color)+'">'+esc(m.emoji||mxInitial(e.category))+'</div>'
        :'<div class="mx-ib none">'+mxInitial(name)+'</div>';
      const catTag=has?'<span class="mx-tag" style="background:'+esc(mxTint(m.color,18))+';color:'+esc(m.color)+'">'+esc(e.category)+'</span>'
        :(fresh?'':'<span class="mx-tag none">Sin categoría</span>');
      return '<div class="mx-it'+(tap?' tap" role="button" '+tap:'"')+'>'+lead
        +'<div class="mx-tx"><div class="mx-t">'+esc(name)+'</div><div class="mx-s mx-s-tags">'+(payLabel?'<span>'+esc(payLabel)+'</span>':'')+catTag+'</div></div>'
        +'<div class="mx-r">'+esc(mxMoney(e.amount,e.currency))+(fresh?'<small class="new">Nuevo</small>':'')+'</div></div>';
    }).join('')+'</div>').join('');
  shell.innerHTML=mxBand('Movimientos')
    +'<div class="mx-grid">'
      +'<div class="mx-w full"><div class="mx-lb">Total del período · Visa + Amex</div><div class="mx-big">'+esc(mxMoney(totals.totalArs))+'</div><div class="mx-sub">'+esc(mxPeriodLabel(period))+'</div></div>'
      +'<div class="mx-w tint"><div class="mx-lb">En pesos</div><div class="mx-md">'+esc(mxMoney(totals.ars))+'</div></div>'
      +'<div class="mx-w soft"><div class="mx-lb">En dólares</div><div class="mx-md">'+esc(mxMoney(totals.usd,'USD'))+'</div></div>'
    +'</div>'
    +(list||mxSh('Hoy','',true)+'<div class="mx-list"><div class="mx-none">Todavía no hay gastos en este período</div></div>');
}

// ── Compromisos: con cada cobro del mes marcado ──
function mxDaysUntil(date, today){
  return Math.round((new Date(dateToYMD(date)+'T12:00:00')-new Date(dateToYMD(today)+'T12:00:00'))/86400000);
}
function mxWhen(date, today){
  const n=mxDaysUntil(date, today);
  if(n===0) return 'hoy';
  if(n===1) return 'mañana';
  return 'el '+mxShortDate(date)+(n>1&&n<=7?' (en '+n+' días)':'');
}
// Estado del cobro de este mes: misma regla que el resto de la app. Cuenta como cobrado si ya
// llegó el cargo real (Gmail / resumen) o si ya pasó su fecha.
function mxCommitStatus(item, today){
  today=today||new Date();
  const monthStart=new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd=new Date(today.getFullYear(), today.getMonth()+1, 0, 23, 59, 59);
  const mk=getMonthKey(today);
  const txns=state.transactions||[];
  let thisDate=null, real=false, next=null;
  if(item.type==='quota'){
    const c=(state.cuotas||[]).find(x=>x.id===item.id);
    if(!c) return null;
    const inst=getCuotaInstallmentsInRange(c, monthStart, monthEnd)[0]||null;
    if(inst){
      thisDate=inst.date;
      real=hasRealCuotaChargeForInstallment(getCuotaGroupId(c), inst.num, txns);
      const after=getCuotaInstallmentsInRange(c, new Date(today.getFullYear(), today.getMonth()+1, 1), new Date(today.getFullYear()+5, 0, 1))[0];
      next=after?after.date:null;
    } else {
      next=getCuotaStatus(c, today).nextDate||null;
    }
  } else {
    const src=item.type==='subscription'?(state.subscriptions||[]).find(x=>x.id===item.id):(state.fixedExpenses||[]).find(x=>x.id===item.id);
    const day=parseInt(src&&src.day,10);
    if(!src || !day) return null;
    thisDate=getRecurringDatesInRange(day, monthStart, monthEnd)[0]||null;
    real=typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(item.type==='subscription'?src:{id:src.id||'',name:src.name,merchantKey:src.merchantKey}, mk, txns);
    next=getRecurringDatesInRange(day, new Date(today.getFullYear(), today.getMonth()+1, 1), new Date(today.getFullYear(), today.getMonth()+2, 0))[0]||null;
  }
  if(!thisDate) return {charged:false, upcoming:true, date:next, label:next?'Arranca '+mxWhen(next,today):'Sin fecha'};
  const charged=real || hasReachedEffectiveChargeDate(thisDate, today);
  return charged
    ? {charged:true, date:next, label:next?'Próximo cobro: '+mxShortDate(next):'Era el último'}
    : {charged:false, date:thisDate, label:'Se cobra '+mxWhen(thisDate,today)};
}
const MX_TICK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const MX_CLOCK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
function renderMobileCompromisos(){
  const shell=document.getElementById('mob-comp-shell');
  if(!shell || !mxIsMobile()) return;
  if(!mxHasData()){ shell.innerHTML=mxEmptyHtml('Compromisos'); return; }
  const {fixedItems,subsItems,cuotaItems,allActive}=commitmentsBuildData();
  const today=new Date();
  const sum=list=>list.reduce((s,i)=>s+(Number(i.amountArs)||0),0);
  const withStatus=list=>list.map(item=>({item, st:mxCommitStatus(item, today)||{charged:false, date:null, label:''}}));
  const all=withStatus(allActive);
  const paidArs=all.filter(x=>x.st.charged).reduce((s,x)=>s+(Number(x.item.amountArs)||0),0);
  const totalArs=sum(allActive);
  const pct=totalArs>0?Math.round(paidArs/totalArs*100):0;
  const section=(title,items)=>{
    if(!items.length) return '';
    const rows=withStatus(items)
      // Primero lo que falta cobrar (lo más cercano arriba), después lo ya cobrado
      .sort((a,b)=>(a.st.charged-b.st.charged) || ((a.st.date?+new Date(a.st.date):9e15)-(b.st.date?+new Date(b.st.date):9e15)))
      .map(({item, st})=>{
        const tap='onclick="mxOpenCommitment(this.dataset.type,this.dataset.id)" data-type="'+esc(item.type)+'" data-id="'+esc(String(item.id))+'"';
        const quota=item.type==='quota'&&item.total?'Cuota '+Math.min(item.total, item.paid+(st.charged?0:1))+' de '+item.total+' · ':'';
        const pill=st.charged?'<span class="mx-st ok">'+MX_TICK+'Cobrado</span>':'<span class="mx-st wait">'+MX_CLOCK+'No cobrado</span>';
        return '<div class="mx-it tap'+(st.charged?' done':'')+'" role="button" '+tap+'><div class="mx-ib">'+mxInitial(item.name)+'</div>'
          +'<div class="mx-tx"><div class="mx-t">'+esc(item.name)+'</div><div class="mx-s">'+esc(quota+st.label)+'</div></div>'
          +'<div class="mx-r">'+esc(mxMoney(item.amount,item.currency))+pill+'</div></div>';
      }).join('');
    const done=withStatus(items).filter(x=>x.st.charged).length;
    const count=done+' de '+items.length+' cobrad'+(title==='Cuotas'||title==='Suscripciones'?'as':'os');
    return '<div class="mx-sh"><h3>'+esc(title)+'</h3><b class="'+(done===items.length?'all':'')+'">'+esc(count)+'</b></div><div class="mx-list">'+rows+'</div>';
  };
  shell.innerHTML=mxBand('Compromisos')
    +'<div class="mx-grid"><div class="mx-w full"><div class="mx-lb">Total por mes</div><div class="mx-big">'+esc(mxMoney(totalArs))+'</div>'
      +mxSeg([{value:sum(cuotaItems),color:'var(--mx-c)'},{value:sum(subsItems),color:'#F5B26B'},{value:sum(fixedItems),color:'#1A1B20'}])
      +'<div class="mx-leg"><span><i style="background:var(--mx-c)"></i>Cuotas</span><span><i style="background:#F5B26B"></i>Suscrip.</span><span><i style="background:#1A1B20"></i>Fijos</span></div></div>'
      +'<div class="mx-w full mx-paid"><div class="mx-paid-top"><div><div class="mx-lb">Cobrado este mes</div><div class="mx-md">'+esc(mxMoney(paidArs))+'</div></div>'
        +'<div class="mx-paid-r"><div class="mx-lb">Falta cobrar</div><div class="mx-md">'+esc(mxMoney(totalArs-paidArs))+'</div></div></div>'
        +'<div class="mx-paid-bar"><i style="width:'+pct+'%"></i></div></div>'
    +'</div>'
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

// ── Hojas que suben desde abajo (comparten #mx-sheet con el editor de ciclos) ──
// Sube con un deslizamiento suave (clase "open") y baja igual al cerrar con Cancelar o el fondo
function mxOpenSheet(inner, extraClass){
  // Al agregar la hoja al final de la página el navegador la bajaba hasta abajo de todo:
  // se guarda dónde estabas y se te deja ahí mientras la hoja está abierta y al cerrarla.
  const se=document.scrollingElement||document.documentElement;
  const keepY=se && typeof se.scrollTop==='number' ? se.scrollTop : null;
  mxCloseSheet();
  const el=document.createElement('div');
  el.id='mx-sheet'; el.className='mx-sheet mx-anim'+(extraClass?' '+extraClass:'');
  el.innerHTML='<div class="mx-sheet-back" onclick="mxDismissSheet()"></div>'
    +'<div class="mx-sheet-panel" role="dialog" aria-modal="true"><div class="mx-grab"></div>'+inner+'</div>';
  document.body.appendChild(el);
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList&&el.classList.add('open')));
  mxSwipeToClose(el);
  if(keepY!=null){
    _mxKeepY=keepY;
    const back=()=>{ if(_mxKeepY!=null && Math.abs(se.scrollTop-_mxKeepY)>1) se.scrollTop=_mxKeepY; };
    back();
    if(typeof requestAnimationFrame==='function') requestAnimationFrame(back);
    setTimeout(back, 60); setTimeout(back, 300);
  }
  return el;
}
let _mxKeepY=null;
// Deslizar hacia abajo cierra la hoja, como en el iPhone. Desde la lista solo arranca si
// ya está arriba de todo (si no, el dedo hace scroll normal).
function mxSwipeToClose(el){
  const panel=el && el.querySelector && el.querySelector('.mx-sheet-panel');
  if(!panel || !panel.addEventListener) return;
  let y0=0, t0=0, dy=0, drag=false, armed=false;
  panel.addEventListener('touchstart', e=>{
    if(e.touches.length!==1 || e.target.closest('input')) { armed=false; return; }
    const sc=e.target.closest('.mx-sheet-scroll');
    armed=!sc || sc.scrollTop<=0;
    y0=e.touches[0].clientY; t0=Date.now(); dy=0; drag=false;
  }, {passive:true});
  panel.addEventListener('touchmove', e=>{
    if(!armed) return;
    dy=e.touches[0].clientY-y0;
    if(!drag){
      if(dy>8){ drag=true; panel.style.transition='none'; }
      else if(dy<-4){ armed=false; return; }
      else return;
    }
    if(e.cancelable) e.preventDefault();
    panel.style.transform='translateY('+Math.max(0,dy)+'px)';
    const back=el.querySelector('.mx-sheet-back');
    if(back) back.style.opacity=String(Math.max(0, 1-dy/(panel.offsetHeight||600)));
  }, {passive:false});
  panel.addEventListener('touchend', ()=>{
    if(!drag) return;
    drag=false; armed=false;
    const fast=dy/(Math.max(1, Date.now()-t0))>0.6;
    panel.style.transition=''; panel.style.transform='';
    const back=el.querySelector('.mx-sheet-back'); if(back) back.style.opacity='';
    if(dy>Math.min(140, (panel.offsetHeight||600)*0.25) || (fast && dy>40)){
      panel.style.transform='translateY('+dy+'px)';
      requestAnimationFrame(()=>{ panel.style.transform=''; mxDismissSheet(); });
    }
  });
}
function mxCloseSheet(){ document.getElementById('mx-sheet')?.remove(); _mxEditor=null; _mxTxn=null; _mxCommit=null; }
function mxDismissSheet(){
  const el=document.getElementById('mx-sheet');
  if(!el || !el.classList || !el.classList.contains('open')){ mxCloseSheet(); return; }
  el.classList.remove('open');
  el.id='mx-sheet-closing';
  setTimeout(()=>el.remove(), 320);
  _mxEditor=null; _mxTxn=null; _mxCommit=null;
}
function mxSheetTop(title, left, right){
  return '<div class="mx-sheet-top">'+(left||'<span></span>')+'<strong>'+esc(title)+'</strong>'+(right||'<span></span>')+'</div>';
}

// Google y avisos: fuera del Inicio, en una hoja que se abre desde el estado de Google
function mxSettingsInner(){
  const g=mxLastGoogle();
  const linked=mxGoogleLinked();
  return mxSheetTop('Google y avisos', '', '<button class="strong" onclick="mxDismissSheet()">Listo</button>')
    +'<div class="mx-sheet-stack">'
      +'<div class="mx-w full"><div class="mx-goo">'
        +'<button class="mx-goo-l" onclick="mxConnectGoogle()"><span class="mx-g">'+MX_GOOGLE+'</span><span><span class="mx-goo-t">'+(linked?'Conectado':'Sin conectar')+'</span>'
        +'<span class="mx-goo-s'+(linked&&!g.stale?' fresh':'')+'">'+esc(g.text)+'</span></span></button>'
        +'<button class="mx-go" onclick="mxImportGmail()">'+mxIcon('down',17,2.6)+'Traer</button></div></div>'
      +(typeof avisosWidgetHtml==='function'?avisosWidgetHtml():'')
    +'</div>';
}
function mxOpenSettings(){ mxOpenSheet(mxSettingsInner(), 'mx-settings'); }
// Si la hoja está abierta y cambia algo (se conectó, trajo gastos), se actualiza sola
function mxRefreshSettings(){
  const sheet=document.getElementById('mx-sheet');
  if(!sheet || !sheet.classList || !sheet.classList.contains('mx-settings')) return;
  const panel=sheet.querySelector('.mx-sheet-panel');
  if(panel) panel.innerHTML=mxSettingsInner();
}

// Movimiento: nombre, categoría y borrar
let _mxTxn=null;
function mxFindTxn(id){ return (state.transactions||[]).find(x=>String(x.id)===String(id))||null; }
// Color y emoji de una categoría (los mismos de la compu)
function mxCatMeta(name){
  const c=name && typeof getCategoryByName==='function' ? getCategoryByName(name) : null;
  return { color:(c && c.color) || '#9AA0AC', emoji:(c && (c.emoji||c.icon)) || '', group:(c && c.group) || '' };
}
function mxTint(color, pct){ return 'color-mix(in srgb, '+color+' '+(pct||16)+'%, white)'; }
function mxNorm(v){ return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim(); }
function mxCatList(){
  if(typeof normalizeCategoryState!=='function') return [];
  const {categoryGroups, categories}=normalizeCategoryState(state);
  const order=new Map(categoryGroups.map((g,i)=>[g.name,i]));
  // En el mismo orden que la compu: por grupo y, dentro del grupo, como estén ordenadas
  return categories.filter(c=>c.active!==false && c.group!=='Sin clasificar' && !mxPendingCat(c.name))
    .map((c,i)=>({c,i})).sort((a,b)=>(order.get(a.c.group)??99)-(order.get(b.c.group)??99) || a.i-b.i).map(x=>x.c);
}
const MX_CHECK='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const MX_TRASH='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>';
const MX_SEARCH='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>';
function mxCatRow(c, current, showGroup){
  return '<button class="mx-crow'+(c.name===current?' on':'')+'" data-cat="'+esc(c.name)+'" onclick="mxPickCat(this)">'
    +'<span class="mx-cic" style="background:'+esc(mxTint(c.color,22))+';color:'+esc(c.color)+'">'+esc(c.emoji||'•')+'</span>'
    +'<span class="mx-ctx"><b>'+esc(c.name)+'</b>'+(showGroup?'<small>'+esc(c.group)+'</small>':'')+'</span>'
    +'<span class="mx-ck" style="color:'+esc(c.color)+'">'+MX_CHECK+'</span></button>';
}
// Sin texto: todas, por grupo. Escribiendo: las que coinciden por nombre o grupo
function mxCategoryRows(query, current, showAll){
  const q=mxNorm(query);
  const cats=mxCatList();
  if(q){
    const hits=cats.filter(c=>mxNorm(c.name).includes(q) || mxNorm(c.group).includes(q))
      .sort((a,b)=>(mxNorm(b.name).startsWith(q)?1:0)-(mxNorm(a.name).startsWith(q)?1:0));
    return hits.length ? '<div class="mx-cgroup">'+hits.map(c=>mxCatRow(c,current,true)).join('')+'</div>'
      : '<div class="mx-cempty">No hay categorías con “'+esc(query)+'”</div>';
  }
  const toggle='<button class="mx-more" onclick="mxToggleAllCats()">'+(showAll?'Ocultar categorías':'Ver todas las categorías')
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate('+(showAll?180:0)+'deg)"><path d="M6 9l6 6 6-6"/></svg></button>';
  if(!showAll) return toggle;
  const groups=new Map();
  cats.forEach(c=>{ if(!groups.has(c.group)) groups.set(c.group,[]); groups.get(c.group).push(c); });
  return toggle+[...groups.entries()].map(([g,list])=>'<div class="mx-ch">'+esc((list[0].emoji||'')+' '+g)+'</div><div class="mx-cgroup">'+list.map(c=>mxCatRow(c,current)).join('')+'</div>').join('');
}
function mxHeroIcon(t, cat){
  if(cat){ const m=mxCatMeta(cat); return '<div class="mx-hero-ic" id="mx-hero-ic" style="background:'+esc(mxTint(m.color,22))+';color:'+esc(m.color)+'">'+esc(m.emoji||mxInitial(cat))+'</div>'; }
  return '<div class="mx-hero-ic" id="mx-hero-ic">'+mxInitial(t.description)+'</div>';
}
function mxHeroCat(cat){
  if(!cat) return '<span class="mx-hero-cat none">Sin categoría</span>';
  const m=mxCatMeta(cat);
  return '<span class="mx-hero-cat" style="background:'+esc(mxTint(m.color,18))+';color:'+esc(m.color)+'">'+esc(cat)+'</span>';
}
function mxOpenTxn(id){
  const t=mxFindTxn(id);
  if(!t) return;
  const current=mxPendingCat(t.category)?'':t.category;
  const pay=MX_PAY_LABEL[String(t.payMethod||'').toLowerCase()]||'';
  const when=new Date(t.date instanceof Date?t.date:String(t.date).length===10?t.date+'T12:00:00':t.date)
    .toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  mxOpenSheet(
    '<div class="mx-nav"><button onclick="mxDismissSheet()">Cancelar</button>'
      +'<span class="mx-nav-r"><button class="mx-trash" onclick="mxConfirmDeleteTxn()" aria-label="Borrar movimiento">'+MX_TRASH+'</button>'
      +'<button class="strong" onclick="mxSaveTxn()">Guardar</button></span></div>'
    +'<div class="mx-sheet-scroll" id="mx-txn-scroll">'
      +'<div class="mx-hero">'+mxHeroIcon(t,current)
        +'<div class="mx-hero-amt">'+esc(mxMoney(t.amount,t.currency))+'</div>'
        +'<div class="mx-hero-sub">'+esc([when, pay].filter(Boolean).join(' · '))+'</div>'
        +'<div id="mx-hero-cat">'+mxHeroCat(current)+'</div></div>'
      +'<div class="mx-cap">Nombre</div>'
      +'<div class="mx-card"><input class="mx-name" type="text" id="mx-txn-name" value="'+esc(t.description||'')+'" autocomplete="off" enterkeyhint="done" placeholder="Nombre del movimiento"></div>'
      +'<div class="mx-cap">Categoría</div>'
      +'<label class="mx-search">'+MX_SEARCH+'<input type="search" id="mx-cat-q" placeholder="Buscar categoría" autocomplete="off" oninput="mxFilterCats(this.value)"></label>'
      +'<div id="mx-cats">'+mxCategoryRows('',current,false)+'</div>'
    +'</div>', 'mx-tall mx-txn');
  _mxTxn={id:t.id, cat:current, all:false}; // después de abrir: abrir una hoja limpia lo anterior
}
function mxFilterCats(q){
  const box=document.getElementById('mx-cats');
  if(box && _mxTxn) box.innerHTML=mxCategoryRows(q,_mxTxn.cat,_mxTxn.all);
}
function mxToggleAllCats(){
  if(!_mxTxn) return;
  _mxTxn.all=!_mxTxn.all;
  mxFilterCats(document.getElementById('mx-cat-q')?.value||'');
}
// Confirmación estilo iPhone dentro de la hoja
function mxConfirmDeleteTxn(){
  const panel=document.querySelector('#mx-sheet .mx-sheet-panel');
  if(!panel || document.getElementById('mx-confirm')) return;
  const box=document.createElement('div');
  box.id='mx-confirm'; box.className='mx-confirm';
  box.innerHTML='<div class="mx-confirm-back" onclick="mxCloseConfirm()"></div>'
    +'<div class="mx-confirm-card"><div class="mx-confirm-msg"><b>¿Borrar este movimiento?</b><span>No se puede deshacer.</span></div>'
      +'<button class="mx-confirm-del" onclick="mxDeleteTxn()">Borrar movimiento</button></div>'
    +'<button class="mx-confirm-cancel" onclick="mxCloseConfirm()">Cancelar</button>';
  panel.appendChild(box);
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>requestAnimationFrame(()=>box.classList.add('open')));
}
function mxCloseConfirm(){
  const box=document.getElementById('mx-confirm');
  if(!box) return;
  box.classList.remove('open');
  setTimeout(()=>box.remove(), 250);
}
function mxPickCat(el){
  if(!_mxTxn || !el) return;
  const cat=el.dataset.cat;
  _mxTxn.cat=_mxTxn.cat===cat?'':cat;
  document.querySelectorAll('.mx-crow').forEach(b=>b.classList.toggle('on', b.dataset.cat===_mxTxn.cat));
  const t=mxFindTxn(_mxTxn.id);
  const ic=document.getElementById('mx-hero-ic'); if(ic && t) ic.outerHTML=mxHeroIcon(t,_mxTxn.cat);
  const hc=document.getElementById('mx-hero-cat'); if(hc) hc.innerHTML=mxHeroCat(_mxTxn.cat);
  if(navigator.vibrate) try{ navigator.vibrate(8); }catch(_){}
}
// Al guardar, la lista se vuelve a dibujar (y el teclado se cierra): sin esto la pantalla
// saltaba. Se mide dónde estaba la fila en pantalla y se la vuelve a dejar en el mismo lugar.
function mxScroller(el){
  let n=el && el.parentElement;
  for(let i=0; i<25 && n && n!==document.body; i++, n=n.parentElement){
    const oy=getComputedStyle(n).overflowY;
    if((oy==='auto'||oy==='scroll') && n.scrollHeight>n.clientHeight) return n;
  }
  return document.scrollingElement||document.documentElement;
}
function mxKeepRowInPlace(id, render){
  const sel='.mx-it[data-id="'+String(id).replace(/"/g,'\\"')+'"]';
  const before=document.querySelector && document.querySelector(sel);
  const rect=before && typeof before.getBoundingClientRect==='function' ? before.getBoundingClientRect() : null;
  const top=rect && typeof rect.top==='number' ? rect.top : null;
  const scroller=top!=null?mxScroller(before):null;
  const savedScroll=scroller?scroller.scrollTop:null;
  render();
  if(top==null) return;
  const fix=()=>{
    if(scroller && savedScroll!=null) scroller.scrollTop=savedScroll;
    const after=document.querySelector(sel);
    if(!after) return;
    const diff=after.getBoundingClientRect().top-top;
    if(Math.abs(diff)>1) mxScroller(after).scrollTop+=diff;
  };
  fix();
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(fix);
  setTimeout(fix, 120); setTimeout(fix, 400); // cuando termina de cerrarse el teclado
}
function mxSaveTxn(){
  if(!_mxTxn) return;
  const t=mxFindTxn(_mxTxn.id);
  if(!t){ mxCloseSheet(); return; }
  const name=String(document.getElementById('mx-txn-name')?.value||'').trim();
  if(!name){ showToast('Poné un nombre','error'); return; }
  let changed=false;
  if(name!==String(t.description||'').trim()){
    t.description=name;
    // Igual que en la compu: el nombre que le pusiste no se pisa con el del mail al recargar
    t._descEditedByUser=true; t._baseDesc=name;
    changed=true;
  }
  const prevCat=mxPendingCat(t.category)?'':t.category;
  if(_mxTxn.cat!==prevCat){
    if(_mxTxn.cat){
      t.category=_mxTxn.cat;
      if(typeof learnFromConfirmation==='function') learnFromConfirmation(t, _mxTxn.cat);
    } else {
      t.category='Procesando...';
    }
    changed=true;
  }
  mxDismissSheet();
  if(!changed) return;
  t.estado_revision=mxPendingCat(t.category)?'pendiente_de_revision':'confirmado_por_usuario';
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
  mxKeepRowInPlace(t.id, ()=>{ saveState(); refreshAll(); renderMobileTransactions(); });
  showToast('✓ Movimiento guardado','success');
}

// Compromiso: se puede borrar
let _mxCommit=null;
const MX_COMMIT_LABEL={quota:'Cuota',subscription:'Suscripción',fixed:'Gasto fijo'};
function mxFindCommitment(type, id){
  const list=type==='quota'?state.cuotas:type==='subscription'?state.subscriptions:type==='fixed'?state.fixedExpenses:null;
  return (list||[]).find(x=>String(x.id)===String(id))||null;
}
function mxOpenCommitment(type, id){
  const c=mxFindCommitment(type, id);
  if(!c) return;
  const amount=type==='subscription'?c.price:c.amount;
  mxOpenSheet(
    mxSheetTop(MX_COMMIT_LABEL[type]||'Compromiso', '<button onclick="mxDismissSheet()">Cancelar</button>', '')
    +'<div class="mx-list sheet"><div class="mx-it"><div class="mx-ib">'+mxInitial(c.name)+'</div><div class="mx-tx"><div class="mx-t">'+esc(c.name||'')+'</div>'
      +'<div class="mx-s">'+esc(mxMoney(amount,c.currency))+(c.day?' · día '+esc(c.day):'')+'</div></div></div></div>'
    +'<div id="mx-del-zone" class="mx-del-zone"><button class="mx-del" onclick="mxAskDelete(\'commit\')">Borrar '+esc((MX_COMMIT_LABEL[type]||'compromiso').toLowerCase())+'</button></div>');
  _mxCommit={type, id:c.id};
}

// Borrar pide confirmar en la misma hoja: un toque de más no borra nada
function mxAskDelete(kind){
  const zone=document.getElementById('mx-del-zone');
  if(!zone) return;
  zone.innerHTML='<div class="mx-del-q">¿Seguro? No se puede deshacer.</div>'
    +'<div class="mx-del-row"><button class="mx-del ghost" onclick="mxCancelDelete(\''+kind+'\')">No</button>'
    +'<button class="mx-del strong" onclick="'+(kind==='txn'?'mxDeleteTxn()':'mxDeleteCommitment()')+'">Sí, borrar</button></div>';
}
function mxCancelDelete(kind){
  const zone=document.getElementById('mx-del-zone');
  if(zone) zone.innerHTML='<button class="mx-del" onclick="mxAskDelete(\''+kind+'\')">'+(kind==='txn'?'Borrar movimiento':'Borrar '+esc((MX_COMMIT_LABEL[_mxCommit?.type]||'compromiso').toLowerCase()))+'</button>';
}
function mxDeleteTxn(){
  if(!_mxTxn) return;
  const id=_mxTxn.id;
  mxDismissSheet();
  confirmDeleteTxn(id); // la misma de la compu: también evita que Gmail lo vuelva a traer
  renderMobileTransactions();
}
function mxDeleteCommitment(){
  if(!_mxCommit) return;
  const {type, id}=_mxCommit;
  mxDismissSheet();
  const done=ok=>{ if(!ok) return; renderMobileCompromisos(); showToast(MX_COMMIT_LABEL[type]+(type==='fixed'?' borrado':' borrada'),'info'); };
  // Cuotas y suscripciones con cobros pasados preguntan si conservarlos como gastos
  if(type==='quota') requestDeleteCuota(id, done);
  else if(type==='subscription') requestDeleteSubscription(id, done);
  else if(type==='fixed'){
    state.fixedExpenses=(state.fixedExpenses||[]).filter(f=>String(f.id)!==String(id));
    saveState();
    refreshAll();
    done(true);
  }
}

// Cambia la barra del teléfono al pasar de pantalla
if(typeof MutationObserver!=='undefined' && document.body && document.body.addEventListener){
  try{ new MutationObserver(mxSyncThemeColor).observe(document.body,{attributes:true,attributeFilter:['class','data-active-page']}); }catch(_){}
}
