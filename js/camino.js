// ══ CAMINO A CERO ══
// Plan para salir de las deudas: compromisos con su calendario de pagos, fecha de libertad,
// calendario mes a mes (ingresos − compromisos − gasto de vida = ahorro), escenarios de gasto,
// tope semanal calculado con los gastos reales y un asesor con reglas (sin IA: todos los
// números salen de tus datos). Los datos viven en state.caminoPlan; nada personal está en el código.
//
// Ítems del plan (state.caminoPlan.items):
//   kind: 'prestamo' | 'personal' | 'fijo' | 'puntual'
//   Calendario generado: amount, currency, count (cuotas; vacío = sin fin), firstDate, everyMonths,
//     autoDebit (se da por pagado al pasar la fecha) o paidCount (cuotas marcadas a mano).
//   Calendario explícito: schedule:[{date, amount, paid}] (deudas personales, pagos puntuales).
//   status: 'activo' | 'esperando' (depende de otra cosa, ver waitingFor) | 'pagado'.
//   cuotaGroupId / fixedId: vínculo con la cuota o el gasto fijo de la app (para no contarlo dos
//     veces en el gasto de vida). registerAsExpense: al marcar un pago se crea el movimiento.

const CZ_KINDS={
  prestamo:{label:'Préstamo', icon:'🏦'},
  personal:{label:'Deuda personal', icon:'🤝'},
  fijo:{label:'Gasto fijo', icon:'🔁'},
  puntual:{label:'Pago puntual', icon:'📌'}
};
const CZ_HORIZON_MIN=8, CZ_HORIZON_MAX=24;

// ── Estado ──
function czPlan(){
  if(!state.caminoPlan || typeof state.caminoPlan!=='object'){
    state.caminoPlan={version:1, salaryUsd:0, usdRate:null, livingCapArs:1800000, startSavingsUsd:0,
      aguinaldo:{month:'', netUsd:0}, emergencyMonths:1, startMonth:getMonthKey(new Date()), items:[]};
  }
  const p=state.caminoPlan;
  if(!Array.isArray(p.items)) p.items=[];
  if(!p.aguinaldo) p.aguinaldo={month:'', netUsd:0};
  if(!p.startMonth) p.startMonth=getMonthKey(new Date());
  return p;
}
function czRate(){ const p=czPlan(); return Number(p.usdRate)||Number(state.usdRate)||(typeof USD_TO_ARS!=='undefined'?USD_TO_ARS:1500)||1500; }
function czToArs(amount, currency){ return (currency||'ARS')==='USD' ? (Number(amount)||0)*czRate() : (Number(amount)||0); }
function czYmd(d){ return dateToYMD(d); }
function czParse(ymd){ if(!ymd) return null; const d=new Date(String(ymd).slice(0,10)+'T12:00:00'); return Number.isNaN(d.getTime())?null:d; }
function czAddMonths(date, n, day){
  const y=date.getFullYear(), m=date.getMonth()+n;
  const max=new Date(y, m+1, 0).getDate();
  return new Date(y, m, Math.min(day||date.getDate(), max), 12, 0, 0, 0);
}
function czMonthKeyAdd(mk, n){ const [y,m]=mk.split('-').map(Number); return getMonthKey(new Date(y, m-1+n, 1, 12)); }
function czMonthLabel(mk, long){
  const [y,m]=mk.split('-').map(Number);
  const s=new Date(y,m-1,1).toLocaleDateString('es-AR',{month:long?'long':'short', year:'numeric'}).replace('.','').replace(' de ',' ');
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function czFmtArs(n){ return '$'+fmtN(Math.round(Number(n)||0),0); }
function czFmtUsd(n){ return 'USD '+fmtN(Math.round(Number(n)||0),0); }
function czFmt(amount, currency){ return (currency||'ARS')==='USD'?czFmtUsd(amount):czFmtArs(amount); }
function czToday(){ const d=new Date(); d.setHours(12,0,0,0); return d; }

// ── Calendario de cada ítem ──
function czSchedule(item, opts={}){
  if(!item) return [];
  const today=opts.today||czToday();
  if(Array.isArray(item.schedule)){
    return item.schedule.map((s,i)=>({date:czParse(s.date), amount:Number(s.amount)||0, currency:item.currency||'ARS',
      num:i+1, total:item.schedule.length, paid:!!s.paid, idx:i})).filter(s=>s.date).sort((a,b)=>a.date-b.date);
  }
  const first=czParse(item.firstDate);
  if(!first) return [];
  const every=Math.max(1, parseInt(item.everyMonths,10)||1);
  const count=parseInt(item.count,10)||0;
  const horizonEnd=opts.horizonEnd||czAddMonths(today, CZ_HORIZON_MAX, 28);
  const out=[];
  const n=count||1000;
  for(let k=1;k<=n;k++){
    const date=czAddMonths(first, (k-1)*every, first.getDate());
    if(!count && date>horizonEnd) break;
    const paid=item.autoDebit ? date<=today : k<=(parseInt(item.paidCount,10)||0);
    out.push({date, amount:Number(item.amount)||0, currency:item.currency||'ARS', num:k, total:count||null, paid, idx:k-1});
  }
  return out;
}
function czItemIsDebt(item){ return item.kind==='prestamo' || item.kind==='personal'; }
function czItemActive(item){ return item.status!=='pagado'; }
// Pagos que entran en el calendario (los "esperando" no tienen fecha: se muestran aparte)
function czItemCountsInCalendar(item){ return czItemActive(item) && item.status!=='esperando'; }

function czItemSummary(item, today){
  const sch=czSchedule(item,{today});
  const finite=Array.isArray(item.schedule) || parseInt(item.count,10)>0;
  const pending=sch.filter(s=>!s.paid);
  const paid=sch.filter(s=>s.paid);
  const totalArs=finite ? sch.reduce((a,s)=>a+czToArs(s.amount,s.currency),0) : null;
  const paidArs=paid.reduce((a,s)=>a+czToArs(s.amount,s.currency),0);
  const remainingArs=finite ? pending.reduce((a,s)=>a+czToArs(s.amount,s.currency),0) : null;
  const remainingOrig=finite ? pending.reduce((a,s)=>a+s.amount,0) : null;
  return {sch, finite, next:pending[0]||null, last:finite?sch[sch.length-1]:null, paidCount:paid.length, total:finite?sch.length:null,
    totalArs, paidArs, remainingArs, remainingOrig, pct: finite&&totalArs?Math.round(paidArs/totalArs*100):null};
}

// ── Fecha de libertad: último pago pendiente de préstamos y deudas personales con fecha ──
function czFreedom(today){
  const p=czPlan();
  let last=null, totalArs=0, paidArs=0;
  const undated=[];
  p.items.filter(czItemIsDebt).forEach(item=>{
    if(item.status==='esperando'){ undated.push(item); return; }
    if(!czItemActive(item)) return;
    const s=czItemSummary(item, today);
    if(!s.finite){ undated.push(item); return; }
    totalArs+=s.totalArs; paidArs+=s.paidArs;
    const lastPending=s.sch.filter(x=>!x.paid).pop();
    if(lastPending && (!last || lastPending.date>last)) last=lastPending.date;
  });
  return {date:last, totalArs, paidArs, remainingArs:totalArs-paidArs, pct:totalArs?Math.round(paidArs/totalArs*100):100, undated};
}

// ── Gasto de vida real de un período: todo lo gastado menos los compromisos del plan ──
function czLinkedSets(){
  const p=czPlan();
  return {
    groups:new Set(p.items.map(i=>i.cuotaGroupId).filter(Boolean)),
    fixed:new Set(p.items.map(i=>i.fixedId).filter(Boolean)),
    items:new Set(p.items.map(i=>i.id))
  };
}
function czIsPlanEntry(e, links){
  const t=e.txn||{}, c=e.commitment||{};
  if(t.caminoItemId && links.items.has(t.caminoItemId)) return true;
  if(t.cuotaGroupId && links.groups.has(t.cuotaGroupId)) return true;
  if(c.cuotaGroupId && links.groups.has(c.cuotaGroupId)) return true;
  if(c.sourceFixedId && links.fixed.has(c.sourceFixedId)) return true;
  return false;
}
// Los gastos marcados como extraordinarios (un viaje, un regalo grande) no cuentan contra el tope
// de gasto de vida, pero sí salen del ahorro: la plata se fue igual.
function czExtraSet(){ return new Set(czPlan().extraordinary||[]); }
function czRealLiving(startStr, endStr, today){
  if(typeof getPeriodTotals!=='function') return {ars:0, extraArs:0, byCat:{}, entries:[]};
  const r=getPeriodTotals({startStr, endStr, todayRef:today||czToday()});
  const links=czLinkedSets(); const extra=czExtraSet();
  let ars=0, extraArs=0; const byCat={}; const entries=[];
  r.entries.forEach(e=>{
    if(czIsPlanEntry(e, links)) return;
    const v=czToArs(e.amount, e.currency);
    entries.push(e);
    if(extra.has(e.id)){ extraArs+=v; return; }
    ars+=v; byCat[e.category||'Otros']=(byCat[e.category||'Otros']||0)+v;
  });
  return {ars, extraArs, byCat, entries};
}
function czMonthBounds(mk){ const r=getMonthRange(mk); return r; }

// ── Calendario mes a mes ──
function czHorizonMonths(today){
  const p=czPlan();
  let lastMk=getMonthKey(today);
  p.items.filter(czItemCountsInCalendar).forEach(item=>{
    const s=czItemSummary(item, today);
    if(s.finite && s.last) { const mk=getMonthKey(s.last.date); if(mk>lastMk) lastMk=mk; }
  });
  const months=[]; let mk=p.startMonth<=getMonthKey(today)?p.startMonth:getMonthKey(today);
  const end=czMonthKeyAdd(lastMk,1);
  while(months.length<CZ_HORIZON_MAX && (mk<=end || months.length<CZ_HORIZON_MIN)){ months.push(mk); mk=czMonthKeyAdd(mk,1); }
  return months;
}
function czCalendar(opts={}){
  const p=czPlan();
  const today=opts.today||czToday();
  const cap=opts.livingCapArs!=null?opts.livingCapArs:(Number(p.livingCapArs)||0);
  const rate=czRate();
  const curMk=getMonthKey(today);
  const months=czHorizonMonths(today);
  const sched=p.items.filter(czItemCountsInCalendar).map(item=>({item, sch:czSchedule(item,{today})}));
  let acc=Number(p.startSavingsUsd)||0;
  return months.map(mk=>{
    const lines=[];
    sched.forEach(({item,sch})=>sch.forEach(s=>{ if(getMonthKey(s.date)===mk) lines.push({item, s, ars:czToArs(s.amount,s.currency)}); }));
    const commitments=lines.reduce((a,l)=>a+l.ars,0);
    const aguinaldo=(p.aguinaldo?.month===mk)?(Number(p.aguinaldo.netUsd)||0)*rate:0;
    const income=(Number(p.salaryUsd)||0)*rate+aguinaldo;
    let realLiving=null, extra=0;
    if(mk<=curMk){ const b=czMonthBounds(mk); const rl=czRealLiving(b.startStr, b.endStr, today); realLiving=rl.ars; extra=rl.extraArs; }
    // Meses cerrados: lo que gastaste de verdad. Mes actual: el tope, o lo real si ya lo pasaste.
    // Futuros: el tope. Los extraordinarios se descuentan aparte.
    const living=mk<curMk ? realLiving : mk===curMk ? Math.max(cap, realLiving||0) : cap;
    const savings=income-commitments-living-extra;
    acc+=savings/rate;
    return {mk, lines, commitments, income, aguinaldo, living, realLiving, extra, savings, savingsUsd:savings/rate, accUsd:acc, isPast:mk<curMk, isCurrent:mk===curMk};
  });
}
// Lo que se libera por mes cuando terminan las cuotas
function czMonthlyAfterDebts(cal){
  const p=czPlan(); const rate=czRate();
  const fixedForever=p.items.filter(i=>czItemCountsInCalendar(i) && !(parseInt(i.count,10)>0) && !Array.isArray(i.schedule) && (parseInt(i.everyMonths,10)||1)===1)
    .reduce((a,i)=>a+czToArs(i.amount,i.currency),0);
  return ((Number(p.salaryUsd)||0)*rate - fixedForever - (Number(p.livingCapArs)||0))/rate;
}

// ── Tope semanal: cuánto podés gastar esta semana para no pasarte del tope del mes ──
function czWeekly(today){
  today=today||czToday();
  const p=czPlan();
  const cap=Number(p.livingCapArs)||0;
  const mk=getMonthKey(today);
  const b=czMonthBounds(mk);
  const spentMonth=czRealLiving(b.startStr, czYmd(today), today).ars;
  const daysInMonth=new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const day=today.getDate();
  const daysLeft=daysInMonth-day+1;
  const monday=new Date(today); monday.setDate(today.getDate()-((today.getDay()+6)%7));
  const weekStart=monday<czParse(b.startStr)?czParse(b.startStr):monday;
  const spentBeforeWeek=czYmd(weekStart)>b.startStr ? czRealLiving(b.startStr, czYmd(new Date(weekStart.getTime()-86400000)), today).ars : 0;
  const spentWeek=spentMonth-spentBeforeWeek;
  // Lo que quedaba al empezar la semana, repartido por día hasta fin de mes
  const daysLeftAtWeekStart=daysInMonth-weekStart.getDate()+1;
  const perDayAtStart=Math.max(0, cap-spentBeforeWeek)/Math.max(1,daysLeftAtWeekStart);
  const weekDays=Math.min(7-((weekStart.getDay()+6)%7), daysLeftAtWeekStart);
  const weekBudget=perDayAtStart*weekDays;
  const pace=day>0?spentMonth/day*daysInMonth:spentMonth;
  return {cap, spentMonth, remainingMonth:cap-spentMonth, perDay:Math.max(0,cap-spentMonth)/Math.max(1,daysLeft), daysLeft,
    weekBudget, spentWeek, weekLeft:weekBudget-spentWeek, pctMonth:cap?spentMonth/cap*100:0, pace, overPace:pace>cap};
}

// ── Asesor: consejos con tus números (reglas, sin IA) ──
function czInsights(today){
  today=today||czToday();
  const p=czPlan(); const out=[]; const rate=czRate();
  // 1) Débitos de los próximos 10 días
  const soon=[];
  p.items.filter(czItemCountsInCalendar).forEach(item=>czSchedule(item,{today}).forEach(s=>{
    const days=Math.round((s.date-today)/86400000);
    if(!s.paid && days>=0 && days<=10) soon.push({item,s,days});
  }));
  soon.sort((a,b)=>a.s.date-b.s.date).forEach(({item,s,days})=>{
    const when=days===0?'hoy':days===1?'mañana':'en '+days+' días';
    const how=item.autoDebit?'Se debita solo: dejá la plata en la cuenta antes de esa fecha.':'Acordate de pagarlo y marcarlo como pagado.';
    out.push({tone:days<=3?'warn':'info', icon:'⏰', title:`${item.name}: ${czFmt(s.amount,s.currency)} ${when}`,
      body:`${how}${item.viaCard?` Viene en el resumen de ${item.viaCard}: si falta saldo el día del débito, lo que no se cubre se financia a tasas de 80–140% anual.`:''}`});
  });
  // 1b) El plan queda en rojo algún mes: sugerir mover los pagos a personas (los únicos flexibles)
  const calNeg=czCalendar({today});
  const neg=calNeg.find(c=>!c.isPast && c.accUsd<0);
  if(neg){
    const personal=[];
    p.items.filter(i=>i.kind==='personal' && czItemCountsInCalendar(i)).forEach(item=>czSchedule(item,{today}).forEach(s=>{
      if(!s.paid && getMonthKey(s.date)<=neg.mk) personal.push({item,s,usd:czToArs(s.amount,s.currency)/rate});
    }));
    if(personal.length){
      // Ahorro acumulado sin esos pagos: primer mes que alcanza para cubrirlos
      const totalUsd=personal.reduce((a,x)=>a+x.usd,0);
      let accNo=Number(p.startSavingsUsd)||0, when=null;
      calNeg.forEach(c=>{
        const personalHere=c.lines.filter(l=>l.item.kind==='personal').reduce((a,l)=>a+l.ars,0)/rate;
        accNo+=c.savingsUsd+personalHere;
        if(!when && !c.isPast && accNo>=totalUsd) when=c.mk;
      });
      out.push({tone:'bad', icon:'🧮', title:`Con lo gastado hasta hoy, tu ahorro queda en rojo en ${czMonthLabel(neg.mk)} (${czFmtUsd(neg.accUsd)})`,
        body:`Los pagos a personas son los únicos que podés mover. ${when?`Si ${personal.length===1?'lo pasás':'los pasás'} a ${czMonthLabel(when)}, no quedás en rojo`:'Hablá para estirar los plazos'}: ${personal.map(x=>`${x.item.name} ${czFmt(x.s.amount,x.s.currency)}`).join(', ')}. Avisales antes y con una fecha concreta.`});
    } else {
      out.push({tone:'bad', icon:'🧮', title:`Tu ahorro queda en rojo en ${czMonthLabel(neg.mk)} (${czFmtUsd(neg.accUsd)})`,
        body:'Para no endeudarte de nuevo, bajá el gasto de vida de los próximos meses o marcá qué gastos fueron extraordinarios.'});
    }
  }
  // 2) Ritmo de gasto del mes
  const w=czWeekly(today);
  if(w.cap>0){
    if(w.spentMonth>w.cap) out.push({tone:'bad', icon:'🛑', title:`Te pasaste del tope del mes por ${czFmtArs(w.spentMonth-w.cap)}`,
      body:'No pasa nada: lo que importa es lo que hacés ahora. Lo que gastes de más sale del ahorro del plan; mirá abajo qué categoría creció.'});
    else if(w.overPace) out.push({tone:'warn', icon:'📈', title:`A este ritmo terminás el mes en ${czFmtArs(w.pace)}`,
      body:`Tu tope es ${czFmtArs(w.cap)}. Para llegar bien, el resto del mes podés gastar ${czFmtArs(w.perDay)} por día.`});
    else out.push({tone:'good', icon:'✅', title:'Vas en ritmo con tu tope del mes',
      body:`Llevás ${czFmtArs(w.spentMonth)} de ${czFmtArs(w.cap)}. Te quedan ${czFmtArs(w.remainingMonth)} para ${w.daysLeft} días.`});
  }
  // 3) Categoría que más creció contra el promedio de los 3 meses anteriores
  const mk=getMonthKey(today);
  const b=czMonthBounds(mk);
  const cur=czRealLiving(b.startStr, czYmd(today), today).byCat;
  const prevAvg={};
  for(let i=1;i<=3;i++){ const pb=czMonthBounds(czMonthKeyAdd(mk,-i)); const pc=czRealLiving(pb.startStr,pb.endStr,today).byCat; Object.entries(pc).forEach(([k,v])=>prevAvg[k]=(prevAvg[k]||0)+v/3); }
  const frac=today.getDate()/new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const growth=Object.entries(cur).map(([k,v])=>({k, proj:v/Math.max(frac,0.15), avg:prevAvg[k]||0}))
    .filter(g=>g.avg>0 && g.proj>g.avg*1.3 && g.proj-g.avg>50000).sort((a,b)=>(b.proj-b.avg)-(a.proj-a.avg))[0];
  if(growth) out.push({tone:'warn', icon:'🔎', title:`${growth.k} viene ${Math.round((growth.proj/growth.avg-1)*100)}% arriba de tu promedio`,
    body:`Promedio de los últimos 3 meses: ${czFmtArs(growth.avg)}. A este ritmo, este mes: ${czFmtArs(growth.proj)}.`});
  // 4) Delivery: cuánto ahorrarías bajándolo 30%
  const deliveryAvg=prevAvg['Delivery']||0;
  if(deliveryAvg>100000) out.push({tone:'info', icon:'🛵', title:`Bajar el delivery 30% son ${czFmtUsd(deliveryAvg*0.3/rate)} más de ahorro por mes`,
    body:`En promedio gastás ${czFmtArs(deliveryAvg)} por mes en Delivery. Cocinar 2 o 3 noches por semana alcanza.`});
  // 5) Compras en dólares con tarjeta: percepción del 30% si se pagan en pesos
  const usdCard=(state.transactions||[]).filter(t=>!t.isPendingSubscription && t.currency==='USD' && (t.payMethod==='visa'||t.payMethod==='amex') && getMonthKey(t.date)===mk)
    .reduce((a,t)=>a+(Number(t.amount)||0),0);
  if(usdCard>0) out.push({tone:'info', icon:'💵', title:`Tenés ${czFmtUsd(usdCard)} de consumos en dólares este mes`,
    body:`Si el resumen los cobra en pesos se suma la percepción del 30% (≈ ${czFmtArs(usdCard*0.3*rate)}). Pagando esa parte con tus dólares no la pagás: pedí "stop debit" del saldo en USD.`});
  // 6) Deudas personales con pago este mes sin marcar
  p.items.filter(i=>i.kind==='personal' && czItemCountsInCalendar(i)).forEach(item=>{
    czSchedule(item,{today}).filter(s=>!s.paid && getMonthKey(s.date)===mk).forEach(s=>{
      out.push({tone:'info', icon:'🤝', title:`Este mes toca ${czFmt(s.amount,s.currency)} a ${item.name}`,
        body:'Avisá antes si se atrasa: en las deudas con gente cercana lo que más cuida la relación es hablar a tiempo.'});
    });
  });
  // 7) Deudas que esperan algo
  p.items.filter(i=>czItemIsDebt(i) && i.status==='esperando').forEach(item=>{
    out.push({tone:'info', icon:'⏳', title:`${item.name}: ${czFmt(item.amount,item.currency)} esperando`,
      body:`${item.waitingFor?item.waitingFor+'. ':''}Cuando se destrabe, pagalo el mismo día y marcá el ítem como activo.`});
  });
  // 8) Fondo de emergencia
  const cal=czCalendar({today});
  // Un mes "normal": cuotas y gastos fijos (sin deudas personales ni pagos puntuales) + tope de vida
  const regular=cal.map(c=>c.lines.filter(l=>l.item.kind==='prestamo'||l.item.kind==='fijo').reduce((a,l)=>a+l.ars,0));
  const fixedMonth=Math.max(0,...regular)+(Number(p.livingCapArs)||0);
  const goalUsd=(Number(p.emergencyMonths)||1)*fixedMonth/rate;
  const accNow=cal.find(c=>c.mk===mk)?.accUsd||Number(p.startSavingsUsd)||0;
  if(goalUsd>0) out.push({tone:accNow>=goalUsd?'good':'info', icon:'🛟', title:accNow>=goalUsd?'Tu fondo de emergencia ya está cubierto':`Fondo de emergencia: meta ${czFmtUsd(goalUsd)}`,
    body:accNow>=goalUsd?'Lo que sigas ahorrando ya es para tus metas.':`Es ${p.emergencyMonths||1} mes de gastos (cuotas + tope de vida). Guardalo en dólares o en una cuenta remunerada, separado de lo que gastás.`});
  return out;
}

// ══ RENDER ══
function renderCaminoPage(){
  const page=document.getElementById('page-camino'); if(!page) return;
  const p=czPlan(); const today=czToday(); const rate=czRate();
  if(!p.items.length && !(p.salaryUsd>0)){ page.innerHTML=czEmptyHtml(); return; }
  const fr=czFreedom(today);
  const cal=czCalendar({today});
  const w=czWeekly(today);
  const insights=czInsights(today);
  const heaviest=cal.reduce((m,c)=>c.commitments>(m?.commitments||0)?c:m,null);
  const lastDebtMk=fr.date?getMonthKey(fr.date):null;
  const endRow=lastDebtMk?cal.find(c=>c.mk===lastDebtMk):null;
  const afterUsd=czMonthlyAfterDebts(cal);
  const monthsLeft=fr.date?Math.max(0,(fr.date.getFullYear()-today.getFullYear())*12+fr.date.getMonth()-today.getMonth()):0;

  const items=p.items.slice().sort((a,b)=>{
    const order={prestamo:0,personal:1,fijo:2,puntual:3};
    return (order[a.kind]??9)-(order[b.kind]??9) || String(a.name).localeCompare(String(b.name));
  });

  page.innerHTML=`
  <div class="cz-shell">
    <header class="cz-header">
      <div>
        <h1>Camino a cero</h1>
        <p>Tu plan para quedar sin deudas, gastando con un tope claro y ahorrando todos los meses.</p>
      </div>
      <div class="cz-header-actions">
        <button class="btn btn-ghost btn-sm" onclick="openCaminoSettings()">⚙ Ajustes del plan</button>
        <button class="btn btn-ghost btn-sm" onclick="czAskClaude()">💬 Preguntale a Claude</button>
        <button class="btn btn-primary btn-sm" onclick="openCaminoItem()">＋ Compromiso</button>
      </div>
    </header>

    <section class="cz-hero">
      <div class="cz-hero-main">
        <div class="cz-kicker">${fr.date?'Fecha de libertad':'Sin deudas con fecha'}</div>
        <div class="cz-hero-date">${fr.date?czMonthLabel(getMonthKey(fr.date),true):'¡Libre!'}</div>
        <div class="cz-hero-sub">${fr.date?`Faltan ${monthsLeft} ${monthsLeft===1?'mes':'meses'} · te quedan ${czFmtArs(fr.remainingArs)} por pagar`:'No hay cuotas ni deudas pendientes con fecha.'}</div>
        ${fr.undated.length?`<div class="cz-hero-undated">Sin fecha: ${fr.undated.map(i=>esc(i.name)+' '+czFmt(i.amount,i.currency)).join(' · ')}</div>`:''}
      </div>
      <div class="cz-ring" style="--pct:${fr.pct}">
        <div class="cz-ring-inner"><strong>${fr.pct}%</strong><span>pagado</span></div>
      </div>
      <div class="cz-hero-stats">
        <div><span>Ahorro al terminar</span><strong>${endRow?czFmtUsd(endRow.accUsd):'—'}</strong></div>
        <div><span>Después ahorrás</span><strong>${czFmtUsd(afterUsd)}/mes</strong></div>
        <div><span>Mes más pesado</span><strong>${heaviest&&heaviest.commitments?czMonthLabel(heaviest.mk):'—'}</strong></div>
      </div>
    </section>

    <div class="cz-grid">
      <section class="cz-card cz-week">
        <div class="cz-card-head"><h2>Esta semana podés gastar</h2><span class="cz-muted">Tope del mes ${czFmtArs(w.cap)}</span></div>
        <div class="cz-week-amount ${w.weekLeft<0?'is-over':''}">${czFmtArs(Math.max(0,w.weekLeft))}</div>
        <div class="cz-muted">${w.weekLeft<0?`Te pasaste ${czFmtArs(-w.weekLeft)} esta semana`:`Llevás ${czFmtArs(w.spentWeek)} de ${czFmtArs(w.weekBudget)} esta semana`}</div>
        <div class="cz-bar"><div style="width:${Math.min(100,w.pctMonth)}%" class="${w.pctMonth>=100?'is-over':w.pctMonth>=80?'is-warn':''}"></div></div>
        <div class="cz-muted">Mes: ${czFmtArs(w.spentMonth)} de ${czFmtArs(w.cap)} · ${czFmtArs(w.perDay)} por día los próximos ${w.daysLeft} días</div>
        <div class="cz-note">Cuenta todos tus gastos (tarjetas, débito y manuales) menos las cuotas y fijos de este plan.</div>
        ${czBigExpensesHtml(today)}
      </section>

      <section class="cz-card cz-advisor">
        <div class="cz-card-head"><h2>Tu asesor</h2><span class="cz-muted">Calculado con tus datos</span></div>
        <div class="cz-insights">${insights.map(i=>`
          <div class="cz-insight cz-tone-${i.tone}"><span class="cz-insight-icon">${i.icon}</span>
            <div><strong>${esc(i.title)}</strong><p>${esc(i.body)}</p></div></div>`).join('')||'<div class="cz-muted">Todo en orden por ahora.</div>'}
        </div>
      </section>
    </div>

    <section class="cz-card">
      <div class="cz-card-head"><h2>Tus compromisos</h2><span class="cz-muted">${items.length} en el plan</span></div>
      <div class="cz-items">${items.map(it=>czItemCardHtml(it, today)).join('')||'<div class="cz-muted">Agregá tu primer compromiso.</div>'}</div>
    </section>

    <section class="cz-card">
      <div class="cz-card-head"><h2>Calendario mes a mes</h2><span class="cz-muted">Sueldo − compromisos − gasto de vida = ahorro · dólar ${czFmtArs(rate)}</span></div>
      <div class="cz-table-wrap"><table class="cz-table">
        <thead><tr><th>Mes</th><th>Qué pagás</th><th class="num">Compromisos</th><th class="num">Gasto de vida</th><th class="num">Ahorro</th><th class="num">Acumulado</th></tr></thead>
        <tbody>${cal.map(c=>`
          <tr class="${c===heaviest&&c.commitments?'is-heavy':''} ${c.isCurrent?'is-current':''}">
            <td><strong>${czMonthLabel(c.mk)}</strong>${c.isCurrent?'<span class="cz-chip cz-chip-now">hoy</span>':''}</td>
            <td>${c.lines.map(l=>`<span class="cz-chip ${l.s.paid?'is-paid':''}">${esc(l.item.name)} ${czFmt(l.s.amount,l.s.currency)}${l.s.paid?' ✓':''}</span>`).join('')}${c.aguinaldo?`<span class="cz-chip cz-chip-in">+ Aguinaldo ${czFmtArs(c.aguinaldo)}</span>`:''}${c.extra?`<span class="cz-chip cz-chip-extra">Extraordinarios ${czFmtArs(c.extra)}</span>`:''}${!c.lines.length&&!c.aguinaldo?'<span class="cz-muted">Sin pagos del plan</span>':''}</td>
            <td class="num">${czFmtArs(c.commitments)}</td>
            <td class="num">${czFmtArs(c.living)}${c.isCurrent&&c.realLiving!=null?`<small>real hasta hoy ${czFmtArs(c.realLiving)}</small>`:''}${c.isPast?'<small>real</small>':''}</td>
            <td class="num ${c.savings<0?'is-neg':'is-pos'}">${c.savings<0?'−':'+'}${czFmtUsd(Math.abs(c.savingsUsd))}</td>
            <td class="num"><strong>${czFmtUsd(c.accUsd)}</strong></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </section>

    <section class="cz-card">
      <div class="cz-card-head"><h2>¿Y si gasto más o menos?</h2><span class="cz-muted">Movés el tope de gasto de vida y ves cómo cambia tu ahorro</span></div>
      <div class="cz-scenario">
        <input type="range" id="cz-scn-range" min="800000" max="4000000" step="100000" value="${Number(p.livingCapArs)||1800000}" oninput="czUpdateScenario(this.value)">
        <div id="cz-scn-out"></div>
        <div class="cz-scn-presets">${[0.8,1,1.2].map(f=>{const v=Math.round((Number(p.livingCapArs)||1800000)*f/100000)*100000;return `<button class="cz-chip-btn" onclick="document.getElementById('cz-scn-range').value=${v};czUpdateScenario(${v})">${czFmtArs(v)}</button>`;}).join('')}
          <button class="cz-chip-btn" onclick="czApplyScenario()">Usar este tope</button></div>
      </div>
    </section>

    <section class="cz-card">
      <div class="cz-card-head"><h2>Aprendé tu tarjeta</h2><span class="cz-muted">Lo básico para que la tarjeta trabaje para vos</span></div>
      <div class="cz-learn">${czLearnHtml(today)}</div>
    </section>

    <p class="cz-disclaimer">Guía orientativa calculada con tus datos; no reemplaza el asesoramiento de un profesional. Los montos en dólares usan ${czFmtArs(rate)} por dólar (lo cambiás en Ajustes del plan).</p>
  </div>`;
  czUpdateScenario(Number(p.livingCapArs)||1800000);
}

function czItemCardHtml(item, today){
  const s=czItemSummary(item, today);
  const k=CZ_KINDS[item.kind]||CZ_KINDS.puntual;
  const status=item.status==='esperando'?'<span class="cz-badge cz-badge-wait">Esperando</span>'
    : item.status==='pagado' || (s.finite && !s.next) ? '<span class="cz-badge cz-badge-done">Pagado</span>'
    : '<span class="cz-badge cz-badge-on">En curso</span>';
  const next=s.next?`Próximo: <strong>${czFmt(s.next.amount,s.next.currency)}</strong> el ${s.next.date.toLocaleDateString('es-AR',{day:'numeric',month:'short'})}`:'';
  const progress=s.finite?`<div class="cz-bar cz-bar-thin"><div style="width:${s.pct||0}%"></div></div><div class="cz-muted">${s.paidCount} de ${s.total} pagos · quedan ${czFmt(s.remainingOrig,item.currency)}</div>`
    : `<div class="cz-muted">${czFmt(item.amount,item.currency)} ${parseInt(item.everyMonths,10)>1?'cada '+item.everyMonths+' meses':'por mes'}${item.autoDebit?' · débito automático':''}</div>`;
  const manualPay=s.next && !item.autoDebit && item.status!=='esperando'
    ? `<button class="cz-chip-btn" onclick="czMarkNextPaid('${item.id}')">✓ Marcar pagado</button>`:'';
  return `<article class="cz-item cz-kind-${item.kind}">
    <div class="cz-item-top"><span class="cz-item-icon">${k.icon}</span>
      <div class="cz-item-name"><strong>${esc(item.name)}</strong><span class="cz-muted">${k.label}${item.viaCard?' · en el resumen de '+esc(item.viaCard):''}</span></div>${status}</div>
    ${item.status==='esperando'?`<div class="cz-muted">${czFmt(item.amount,item.currency)}${item.waitingFor?' · '+esc(item.waitingFor):''}</div>`:''}
    ${item.status!=='esperando'?`<div class="cz-item-next">${next}</div>${progress}`:''}
    ${item.note?`<div class="cz-note">${esc(item.note)}</div>`:''}
    <div class="cz-item-actions">${manualPay}<button class="cz-chip-btn" onclick="openCaminoItem('${item.id}')">Editar</button></div>
  </article>`;
}

// Gastos grandes del mes, para marcar los extraordinarios
function czBigExpensesHtml(today){
  const b=czMonthBounds(getMonthKey(today));
  const rl=czRealLiving(b.startStr, czYmd(today), today);
  const extra=czExtraSet();
  const big=rl.entries.map(e=>({e, ars:czToArs(e.amount,e.currency)})).filter(x=>x.ars>=50000).sort((a,b)=>b.ars-a.ars).slice(0,8);
  if(!big.length) return '';
  return `<details class="cz-big"${rl.extraArs?'':' open'}><summary>Gastos grandes del mes${rl.extraArs?` · extraordinarios ${czFmtArs(rl.extraArs)}`:''}</summary>
    <div class="cz-muted" style="margin:6px 0 8px;">Marcá como extraordinario lo que no se repite (un viaje, un regalo grande): no cuenta para tu tope, pero sí sale del ahorro.</div>
    ${big.map(x=>{ const on=extra.has(x.e.id); return `<div class="cz-big-row ${on?'is-extra':''}"><span>${esc(x.e.description||'')}<small>${esc(x.e.category||'')}</small></span><strong>${czFmtArs(x.ars)}</strong>
      <button class="cz-chip-btn" onclick="czToggleExtra('${String(x.e.id).replace(/'/g,"\\'")}')">${on?'Extraordinario ✓':'Marcar extraordinario'}</button></div>`; }).join('')}
  </details>`;
}
function czToggleExtra(id){
  const p=czPlan(); if(!Array.isArray(p.extraordinary)) p.extraordinary=[];
  p.extraordinary=p.extraordinary.includes(id)?p.extraordinary.filter(x=>x!==id):[...p.extraordinary,id];
  saveState(); renderCaminoPage();
}

function czUpdateScenario(value){
  const out=document.getElementById('cz-scn-out'); if(!out) return;
  const v=Number(value)||0; const today=czToday();
  const cal=czCalendar({today, livingCapArs:v});
  const fr=czFreedom(today);
  const lastMk=fr.date?getMonthKey(fr.date):cal[cal.length-1].mk;
  const end=cal.find(c=>c.mk===lastMk)||cal[cal.length-1];
  const p=czPlan(); const rate=czRate();
  const fixedForever=p.items.filter(i=>czItemCountsInCalendar(i) && !(parseInt(i.count,10)>0) && !Array.isArray(i.schedule) && (parseInt(i.everyMonths,10)||1)===1).reduce((a,i)=>a+czToArs(i.amount,i.currency),0);
  const after=((Number(p.salaryUsd)||0)*rate-fixedForever-v)/rate;
  const negMonths=cal.filter(c=>!c.isPast && c.savings<0).length;
  out.innerHTML=`<div class="cz-scn-row">
    <div><span>Tope de gasto de vida</span><strong>${czFmtArs(v)}/mes</strong></div>
    <div><span>Ahorro al ${czMonthLabel(lastMk)}</span><strong class="${end.accUsd<0?'is-neg':''}">${czFmtUsd(end.accUsd)}</strong></div>
    <div><span>Después, por mes</span><strong>${czFmtUsd(after)}</strong></div>
  </div>${negMonths?`<div class="cz-warn-line">Con este tope hay ${negMonths} ${negMonths===1?'mes':'meses'} donde no te alcanza: sale del ahorro.</div>`:''}`;
}
function czApplyScenario(){
  const v=Number(document.getElementById('cz-scn-range')?.value)||0;
  if(!v) return;
  czPlan().livingCapArs=v; saveState(); renderCaminoPage();
  showToast('Tope de gasto de vida: '+czFmtArs(v)+' por mes','success');
}

function czLearnHtml(today){
  const cards=[];
  try{
    ['visa','amex'].forEach(mode=>{
      const cycles=getTcCycles(mode); const ymd=czYmd(today);
      const cur=cycles.find((c,i)=>{const o=getTcCycleOpen(cycles,i); return o && o<=ymd && ymd<=c.closeDate;});
      if(cur) cards.push(`<b>${mode==='visa'?'Visa':'Amex'}</b>: lo que compres hasta el <b>${czParse(cur.closeDate).toLocaleDateString('es-AR',{day:'numeric',month:'short'})}</b> (cierre) lo pagás el <b>${cur.dueDate?czParse(cur.dueDate).toLocaleDateString('es-AR',{day:'numeric',month:'short'}):'vencimiento'}</b>. Comprar el día después del cierre te da casi 2 meses hasta pagarlo.`);
    });
  }catch(e){}
  const lessons=[
    {t:'Cierre y vencimiento', b:(cards.length?cards.join('<br>'):'Lo que comprás hasta el cierre entra en el resumen que vence unos 10 días después.')+'<br>Tené la plata en la cuenta antes del vencimiento: el débito automático cobra lo que haya.'},
    {t:'Pagá siempre el total', b:'El pago mínimo evita la multa, pero el resto se financia con intereses (hoy 80–140% anual) más IVA. Tu débito automático del total es la configuración correcta: no la cambies.'},
    {t:'Cuotas: ¿sí o no?', b:'Cuotas sin interés: convienen si no hay descuento por pagar al contado (con inflación de ~2% por mes, la última cuota "vale" menos). Cuotas con interés: casi nunca convienen para consumo. Y ojo: una compra en cuotas te ocupa el límite por el total, no por la cuota.'},
    {t:'Compras en dólares', b:'Si pagás en pesos un consumo en dólares (Netflix, Apple, viajes) se suma la percepción del 30%. Si tenés dólares, pedile al banco "stop debit" y pagá esa parte en dólares: te ahorrás ese 30%.'},
    {t:'Nunca financies plata con la tarjeta', b:'Sacar efectivo o un préstamo "en cuotas con la tarjeta" es de lo más caro que hay. Si algún día necesitás plata, compará el CFT (costo financiero total) y preguntá si se puede cancelar antes: los préstamos bancarios suelen permitirlo y te ahorra intereses.'},
    {t:'Una regla simple', b:'Usá una sola tarjeta para el día a día y mirá este tope semanal. Si una semana te pasás, la siguiente gastás un poco menos: lo importante es el mes.'}
  ];
  return lessons.map((l,i)=>`<details class="cz-lesson"${i===0?' open':''}><summary>${l.t}</summary><div>${l.b}</div></details>`).join('');
}

function czEmptyHtml(){
  return `<div class="cz-shell"><header class="cz-header"><div><h1>Camino a cero</h1>
    <p>Armá tu plan para quedar sin deudas: tus compromisos, cuándo terminás de pagar, cuánto podés gastar por semana y cuánto vas a ahorrar.</p></div></header>
    <section class="cz-card cz-empty">
      <div class="cz-empty-icon">🧭</div>
      <h2>Empezá tu plan</h2>
      <p>Cargá tu sueldo y tu tope de gasto en <b>Ajustes del plan</b>, y después tus préstamos, deudas y gastos fijos. Si ya tenés el archivo de tu plan, importalo.</p>
      <div class="cz-empty-actions">
        <button class="btn btn-primary" onclick="openCaminoSettings()">Ajustes del plan</button>
        <button class="btn btn-ghost" onclick="openCaminoItem()">＋ Compromiso</button>
        <button class="btn btn-ghost" onclick="document.getElementById('cz-import-input').click()">Importar plan (.json)</button>
        <input type="file" id="cz-import-input" accept="application/json,.json" style="display:none" onchange="czImportPlanFile(event)">
      </div>
    </section></div>`;
}

// ══ ACCIONES ══
function czFindItem(id){ return czPlan().items.find(i=>i.id===id)||null; }
function czMarkNextPaid(id){
  const item=czFindItem(id); if(!item) return;
  const today=czToday();
  const next=czSchedule(item,{today}).find(s=>!s.paid); if(!next) return;
  if(Array.isArray(item.schedule)) item.schedule[next.idx].paid=true;
  else item.paidCount=(parseInt(item.paidCount,10)||0)+1;
  if(item.registerAsExpense){
    const date=next.date<=today?next.date:today;
    const id2='cz_'+item.id+'_'+next.num;
    if(!(state.transactions||[]).some(t=>t.id===id2)){
      state.transactions.push({id:id2, date:new Date(date), description:item.name, _baseDesc:item.name, amount:next.amount, currency:next.currency,
        category:item.category||'Otros', payMethod:item.payMethod||'deb', week:getWeekKey(date), month:getMonthKey(date), manual:true,
        caminoItemId:item.id, origen_del_movimiento:'pegado_manualmente', estado_revision:'confirmado_por_usuario'});
    }
  }
  if(czSchedule(item,{today}).every(s=>s.paid) && (Array.isArray(item.schedule)||parseInt(item.count,10)>0)) item.status='pagado';
  saveState(); renderCaminoPage();
  showToast('✓ '+item.name+': pago registrado','success');
}

// ── Editor de compromisos ──
function openCaminoItem(id){
  const item=id?czFindItem(id):null;
  const it=item||{kind:'prestamo', currency:'ARS', status:'activo', everyMonths:1, autoDebit:true};
  const explicit=Array.isArray(it.schedule);
  const cuotaOpts=(state.cuotas||[]).map(c=>`<option value="${esc(c.cuotaGroupId||'')}" ${it.cuotaGroupId===c.cuotaGroupId?'selected':''}>${esc(c.name)} · ${czFmt(c.amount,c.currency)} × ${c.total}</option>`).join('');
  const fixedOpts=(state.fixedExpenses||[]).map(f=>`<option value="${esc(f.id||'')}" ${it.fixedId===f.id?'selected':''}>${esc(f.name)} · ${czFmt(f.amount,f.currency)}</option>`).join('');
  const rows=(explicit?it.schedule:[]).map(s=>czScheduleRowHtml(s)).join('');
  const m=document.createElement('div');
  m.className='modal-overlay open'; m.id='cz-item-modal';
  m.onclick=e=>{ if(e.target===m) m.remove(); };
  m.innerHTML=`<div class="modal cz-modal" onclick="event.stopPropagation()">
    <div class="modal-title">${item?'Editar compromiso':'Nuevo compromiso'}</div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Tipo</label>
        <select class="input-field" id="cz-f-kind" onchange="czToggleItemFields()">${Object.entries(CZ_KINDS).map(([k,v])=>`<option value="${k}" ${it.kind===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select></div>
      <div class="input-group"><label class="input-label">Nombre</label><input class="input-field" id="cz-f-name" value="${esc(it.name||'')}" placeholder="ej: Préstamo Brubank"></div>
    </div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Moneda</label><select class="input-field" id="cz-f-currency"><option value="ARS" ${it.currency!=='USD'?'selected':''}>ARS</option><option value="USD" ${it.currency==='USD'?'selected':''}>USD</option></select></div>
      <div class="input-group"><label class="input-label">Estado</label><select class="input-field" id="cz-f-status" onchange="czToggleItemFields()">
        <option value="activo" ${it.status==='activo'?'selected':''}>En curso</option><option value="esperando" ${it.status==='esperando'?'selected':''}>Esperando (sin fecha)</option><option value="pagado" ${it.status==='pagado'?'selected':''}>Pagado</option></select></div>
    </div>
    <div class="input-group" id="cz-f-wait-wrap"><label class="input-label">¿De qué depende?</label><input class="input-field" id="cz-f-wait" value="${esc(it.waitingFor||'')}" placeholder="ej: se paga cuando me devuelvan 500 USD"></div>
    <div class="input-group"><label class="input-label">Calendario</label>
      <select class="input-field" id="cz-f-mode" onchange="czToggleItemFields()"><option value="gen" ${!explicit?'selected':''}>Cuotas o pago periódico</option><option value="list" ${explicit?'selected':''}>Pagos con fecha (lista)</option></select></div>
    <div id="cz-f-gen">
      <div class="grid-2">
        <div class="input-group"><label class="input-label">Monto de cada pago</label><input type="number" class="input-field" id="cz-f-amount" value="${it.amount??''}" step="0.01"></div>
        <div class="input-group"><label class="input-label">Cantidad de pagos (vacío = sin fin)</label><input type="number" class="input-field" id="cz-f-count" value="${it.count??''}"></div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label class="input-label">Primer pago</label><input type="date" class="input-field" id="cz-f-first" value="${esc(it.firstDate||'')}"></div>
        <div class="input-group"><label class="input-label">Cada cuántos meses</label><input type="number" class="input-field" id="cz-f-every" value="${it.everyMonths||1}" min="1"></div>
      </div>
      <label class="cz-check"><input type="checkbox" id="cz-f-auto" ${it.autoDebit?'checked':''}> Se debita solo (se da por pagado al llegar la fecha)</label>
    </div>
    <div id="cz-f-list"><div id="cz-f-rows">${rows}</div><button class="cz-chip-btn" onclick="czAddScheduleRow()">＋ Agregar pago</button></div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Vincular con una cuota de la app</label><select class="input-field" id="cz-f-cuota"><option value="">—</option>${cuotaOpts}</select></div>
      <div class="input-group"><label class="input-label">Vincular con un gasto fijo</label><select class="input-field" id="cz-f-fixed"><option value="">—</option>${fixedOpts}</select></div>
    </div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Se paga con el resumen de</label><input class="input-field" id="cz-f-card" value="${esc(it.viaCard||'')}" placeholder="ej: Amex (opcional)"></div>
      <div class="input-group"><label class="input-label">Nota</label><input class="input-field" id="cz-f-note" value="${esc(it.note||'')}"></div>
    </div>
    <label class="cz-check"><input type="checkbox" id="cz-f-expense" ${it.registerAsExpense?'checked':''}> Al marcarlo pagado, registrarlo como gasto</label>
    <div class="modal-actions">
      ${item?`<button class="btn btn-danger btn-sm" onclick="czDeleteItem('${item.id}')">Eliminar</button>`:''}
      <button class="btn btn-ghost" onclick="document.getElementById('cz-item-modal').remove()">Cancelar</button>
      <button class="btn btn-primary" onclick="czSaveItem('${item?item.id:''}')">Guardar</button>
    </div></div>`;
  document.body.appendChild(m);
  czToggleItemFields();
}
function czScheduleRowHtml(s={}){
  return `<div class="cz-row"><input type="date" class="input-field cz-r-date" value="${esc(s.date||'')}"><input type="number" class="input-field cz-r-amount" step="0.01" value="${s.amount??''}" placeholder="Monto">
    <label class="cz-check"><input type="checkbox" class="cz-r-paid" ${s.paid?'checked':''}> pagado</label><button class="cz-chip-btn" onclick="this.parentElement.remove()">✕</button></div>`;
}
function czAddScheduleRow(){ document.getElementById('cz-f-rows')?.insertAdjacentHTML('beforeend', czScheduleRowHtml()); }
function czToggleItemFields(){
  const mode=document.getElementById('cz-f-mode')?.value;
  const status=document.getElementById('cz-f-status')?.value;
  const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.style.display=on?'':'none'; };
  show('cz-f-gen', mode==='gen'); show('cz-f-list', mode==='list'); show('cz-f-wait-wrap', status==='esperando');
}
function czSaveItem(id){
  const p=czPlan();
  const val=x=>document.getElementById(x)?.value;
  const name=(val('cz-f-name')||'').trim();
  if(!name){ showToast('Poné un nombre','error'); return; }
  const item=id?czFindItem(id):{id:'cz'+Date.now().toString(36)};
  const prevPaid=item.paidCount;
  Object.assign(item,{kind:val('cz-f-kind'), name, currency:val('cz-f-currency'), status:val('cz-f-status'),
    waitingFor:(val('cz-f-wait')||'').trim(), cuotaGroupId:val('cz-f-cuota')||null, fixedId:val('cz-f-fixed')||null,
    viaCard:(val('cz-f-card')||'').trim(), note:(val('cz-f-note')||'').trim(), registerAsExpense:!!document.getElementById('cz-f-expense')?.checked});
  if(val('cz-f-mode')==='list'){
    item.schedule=[...document.querySelectorAll('#cz-f-rows .cz-row')].map(r=>({date:r.querySelector('.cz-r-date').value, amount:Number(r.querySelector('.cz-r-amount').value)||0, paid:r.querySelector('.cz-r-paid').checked}))
      .filter(s=>s.date && s.amount>0);
    item.amount=item.schedule.reduce((a,s)=>a+s.amount,0)||Number(val('cz-f-amount'))||0;
    delete item.firstDate; delete item.count; delete item.everyMonths; delete item.autoDebit;
  } else {
    delete item.schedule;
    item.amount=Number(val('cz-f-amount'))||0;
    item.count=parseInt(val('cz-f-count'),10)||null;
    item.firstDate=val('cz-f-first')||'';
    item.everyMonths=Math.max(1,parseInt(val('cz-f-every'),10)||1);
    item.autoDebit=!!document.getElementById('cz-f-auto')?.checked;
    item.paidCount=prevPaid||0;
    if(item.status!=='esperando' && (!item.firstDate || !(item.amount>0))){ showToast('Completá el monto y la fecha del primer pago','error'); return; }
  }
  if(!id) p.items.push(item);
  saveState();
  document.getElementById('cz-item-modal')?.remove();
  renderCaminoPage();
  showToast('✓ Compromiso guardado','success');
}
function czDeleteItem(id){
  if(!confirm('¿Sacar este compromiso del plan? No borra la cuota ni el gasto fijo vinculado.')) return;
  const p=czPlan(); p.items=p.items.filter(i=>i.id!==id);
  saveState(); document.getElementById('cz-item-modal')?.remove(); renderCaminoPage();
}

// ── Ajustes del plan ──
function openCaminoSettings(){
  const p=czPlan();
  const m=document.createElement('div');
  m.className='modal-overlay open'; m.id='cz-settings-modal';
  m.onclick=e=>{ if(e.target===m) m.remove(); };
  m.innerHTML=`<div class="modal cz-modal" onclick="event.stopPropagation()">
    <div class="modal-title">Ajustes del plan</div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Sueldo por mes (USD)</label><input type="number" class="input-field" id="cz-s-salary" value="${p.salaryUsd||''}"></div>
      <div class="input-group"><label class="input-label">Dólar para el plan ($)</label><input type="number" class="input-field" id="cz-s-rate" value="${p.usdRate||''}" placeholder="vacío = el de la app (${fmtN(czRate(),0)})"></div>
    </div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Tope de gasto de vida por mes ($)</label><input type="number" class="input-field" id="cz-s-cap" value="${p.livingCapArs||''}" step="50000"></div>
      <div class="input-group"><label class="input-label">Ahorro con el que arrancás (USD)</label><input type="number" class="input-field" id="cz-s-start" value="${p.startSavingsUsd||0}"></div>
    </div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Aguinaldo: mes</label><input type="month" class="input-field" id="cz-s-ag-month" value="${esc(p.aguinaldo?.month||'')}"></div>
      <div class="input-group"><label class="input-label">Aguinaldo neto (USD)</label><input type="number" class="input-field" id="cz-s-ag-usd" value="${p.aguinaldo?.netUsd||''}"></div>
    </div>
    <div class="grid-2">
      <div class="input-group"><label class="input-label">Fondo de emergencia (meses de gastos)</label><input type="number" class="input-field" id="cz-s-emerg" value="${p.emergencyMonths||1}" min="1" max="12"></div>
      <div class="input-group"><label class="input-label">El plan arranca en</label><input type="month" class="input-field" id="cz-s-start-month" value="${esc(p.startMonth||'')}"></div>
    </div>
    <div class="cz-note">El tope de gasto de vida es todo lo que gastás en el mes (súper, delivery, salidas, suscripciones…) sin contar las cuotas y fijos de este plan.</div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('cz-import-input2').click()">Importar plan (.json)</button>
      <input type="file" id="cz-import-input2" accept="application/json,.json" style="display:none" onchange="czImportPlanFile(event)">
      <button class="btn btn-ghost" onclick="document.getElementById('cz-settings-modal').remove()">Cancelar</button>
      <button class="btn btn-primary" onclick="czSaveSettings()">Guardar</button>
    </div></div>`;
  document.body.appendChild(m);
}
function czSaveSettings(){
  const p=czPlan(); const v=id=>document.getElementById(id)?.value;
  p.salaryUsd=Number(v('cz-s-salary'))||0;
  p.usdRate=Number(v('cz-s-rate'))||null;
  p.livingCapArs=Number(v('cz-s-cap'))||0;
  p.startSavingsUsd=Number(v('cz-s-start'))||0;
  p.aguinaldo={month:v('cz-s-ag-month')||'', netUsd:Number(v('cz-s-ag-usd'))||0};
  p.emergencyMonths=Math.max(1,parseInt(v('cz-s-emerg'),10)||1);
  p.startMonth=v('cz-s-start-month')||getMonthKey(new Date());
  saveState(); document.getElementById('cz-settings-modal')?.remove(); renderCaminoPage();
  showToast('✓ Plan actualizado','success');
}

// ── Importar un plan desde un archivo (tus datos no viven en el código) ──
// Formato: {"camino": {...ajustes, items:[...]}, "createCuotas":[...], "createFixed":[...], "linkCuotas":[{itemId, match}], "categories":[...], "recategorize":[...]}
function czImportPlanFile(event){
  const file=event.target.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      const res=czApplyPlanData(data);
      saveState(); renderCaminoPage();
      if(typeof refreshAll==='function') refreshAll();
      showToast(`✓ Plan importado: ${res.items} compromisos${res.cuotas?`, ${res.cuotas} cuota nueva`:''}${res.fixed?`, ${res.fixed} gasto fijo`:''}`,'success');
    }catch(err){ console.error(err); showToast('No se pudo leer el archivo del plan','error'); }
  };
  reader.readAsText(file);
  event.target.value='';
}
function czApplyPlanData(data){
  if(!data || !data.camino || !Array.isArray(data.camino.items)) throw new Error('formato inválido');
  const res={items:0, cuotas:0, fixed:0};
  // Categorías nuevas (p. ej. "Préstamos")
  (data.categories||[]).forEach(c=>{
    if(!c?.name || (state.categories||[]).some(k=>k.name===c.name)) return;
    const base=(state.categories||[]).find(k=>k.group===c.group)||{};
    state.categories.push({...base, ...c, id:c.id||('cat-'+String(c.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')), active:true, order:(state.categories||[]).length});
  });
  // Cuotas que la app todavía no tiene (préstamos que se pagan fuera de la tarjeta)
  if(!Array.isArray(state.cuotas)) state.cuotas=[];
  (data.createCuotas||[]).forEach(c=>{
    if(state.cuotas.some(x=>x.cuotaGroupId===c.cuotaGroupId)) return;
    state.cuotas.push({emoji:'🏦', color:'#5e5ce6', source:'manual', createdAt:new Date().toISOString(), ...c}); res.cuotas++;
  });
  if(!Array.isArray(state.fixedExpenses)) state.fixedExpenses=[];
  (data.createFixed||[]).forEach(f=>{
    if(state.fixedExpenses.some(x=>x.id===f.id)) return;
    state.fixedExpenses.push({...f}); res.fixed++;
  });
  const p=czPlan();
  const {items, ...settings}=data.camino;
  Object.assign(p, settings);
  items.forEach(it=>{
    const i=p.items.findIndex(x=>x.id===it.id);
    if(i>=0) p.items[i]={...p.items[i], ...it}; else p.items.push({...it});
    res.items++;
  });
  // Vincular ítems con cuotas que ya existen (por ejemplo, un préstamo financiado con la tarjeta)
  (data.linkCuotas||[]).forEach(l=>{
    const item=p.items.find(x=>x.id===l.itemId); if(!item) return;
    const m=String(l.match||'').toLowerCase();
    const c=state.cuotas.find(x=>String(x.name||'').toLowerCase().includes(m) || String(x.cuotaGroupId||'').toLowerCase().includes(m));
    if(c){ if(!c.cuotaGroupId) c.cuotaGroupId=getCuotaGroupId(c); item.cuotaGroupId=c.cuotaGroupId; if(l.renameCuota) c.name=l.renameCuota; }
  });
  // Recategorizar movimientos (p. ej. la cuota del préstamo como "Préstamos")
  (data.recategorize||[]).forEach(r=>{
    const m=String(r.match||'').toLowerCase();
    (state.transactions||[]).forEach(t=>{
      const k=String(t.gmailMerchantRaw||t._baseDesc||t.description||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(m && k.includes(m)) { t.category=r.category; t.estado_revision='confirmado_por_usuario'; }
    });
  });
  return res;
}

// ── "Preguntale a Claude": arma un resumen con tus números para pegar en claude.ai ──
function czBuildClaudePrompt(){
  const p=czPlan(); const today=czToday(); const rate=czRate();
  const fr=czFreedom(today); const cal=czCalendar({today}); const w=czWeekly(today);
  const lines=[];
  lines.push('Sos mi asesor financiero personal. Vivo en Argentina. Hablame en castellano rioplatense, con empatía y sin juzgarme, y dame consejos concretos y accionables. Usá solo los números que te paso; si te falta un dato, preguntame.');
  lines.push('');
  lines.push(`Fecha: ${today.toLocaleDateString('es-AR')}. Dólar del plan: $${fmtN(rate,0)}.`);
  lines.push(`Sueldo: USD ${fmtN(p.salaryUsd,0)} por mes.${p.aguinaldo?.netUsd?` Aguinaldo neto estimado USD ${fmtN(p.aguinaldo.netUsd,0)} en ${p.aguinaldo.month}.`:''}`);
  lines.push(`Tope de gasto de vida: $${fmtN(p.livingCapArs,0)} por mes. Este mes llevo gastados $${fmtN(w.spentMonth,0)} (a este ritmo terminaría en $${fmtN(w.pace,0)}).`);
  lines.push(`Ahorro inicial: USD ${fmtN(p.startSavingsUsd||0,0)}.`);
  lines.push('');
  lines.push('Mis compromisos:');
  p.items.forEach(it=>{
    const s=czItemSummary(it,today);
    lines.push(`- ${it.name} (${(CZ_KINDS[it.kind]||{}).label||it.kind}, ${it.status}): ${czFmt(it.amount,it.currency)}${s.finite?`, ${s.paidCount}/${s.total} pagos, quedan ${czFmt(s.remainingOrig,it.currency)}`:''}${s.next?`, próximo ${czYmd(s.next.date)}`:''}${it.waitingFor?`, depende de: ${it.waitingFor}`:''}${it.note?` (${it.note})`:''}`);
  });
  lines.push('');
  lines.push(`Fecha de libertad: ${fr.date?czYmd(fr.date):'sin deudas con fecha'}. Por pagar: $${fmtN(fr.remainingArs,0)}.`);
  lines.push('Calendario (mes: compromisos / gasto de vida / ahorro / acumulado):');
  cal.forEach(c=>lines.push(`- ${c.mk}: $${fmtN(c.commitments,0)} / $${fmtN(c.living,0)} / USD ${fmtN(c.savingsUsd,0)} / USD ${fmtN(c.accUsd,0)}`));
  // Gasto por categoría del último mes cerrado y del actual
  const prev=czMonthBounds(czMonthKeyAdd(getMonthKey(today),-1));
  const byCat=czRealLiving(prev.startStr, prev.endStr, today).byCat;
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(top.length){ lines.push(''); lines.push(`Gasto por categoría del mes pasado: ${top.map(([k,v])=>`${k} $${fmtN(v,0)}`).join(', ')}.`); }
  lines.push('');
  lines.push('Ayudame a: (1) revisar si el plan es realista, (2) decirme dónde recortar sin pasarla mal, (3) qué hacer si me sobra o me falta plata algún mes.');
  return lines.join('\n');
}
function czAskClaude(){
  const text=czBuildClaudePrompt();
  const m=document.createElement('div');
  m.className='modal-overlay open'; m.id='cz-claude-modal';
  m.onclick=e=>{ if(e.target===m) m.remove(); };
  m.innerHTML=`<div class="modal cz-modal" onclick="event.stopPropagation()">
    <div class="modal-title">💬 Preguntale a Claude</div>
    <div class="modal-sub">Copiá este resumen con tus números y pegalo en claude.ai para charlar tu plan. No se manda nada solo: vos decidís qué compartir.</div>
    <textarea class="input-field cz-prompt" readonly>${esc(text)}</textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="document.getElementById('cz-claude-modal').remove()">Cerrar</button>
      <button class="btn btn-primary" onclick="czCopyClaudePrompt()">Copiar resumen</button>
    </div></div>`;
  document.body.appendChild(m);
}
function czCopyClaudePrompt(){
  const ta=document.querySelector('#cz-claude-modal textarea'); if(!ta) return;
  const done=()=>showToast('✓ Copiado: pegalo en claude.ai','success');
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).then(done,()=>{ ta.select(); document.execCommand('copy'); done(); });
  else { ta.select(); document.execCommand('copy'); done(); }
}
