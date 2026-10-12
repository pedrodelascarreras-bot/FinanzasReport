// ══ TOTALES DEL PERÍODO — receta única ══
// Todas las pantallas responden "¿cuánto gasté en este período?" con getPeriodTotals.
// Reglas:
//  · Movimientos reales con fecha dentro del rango (nunca proyecciones guardadas).
//  · + compromisos que ya vencieron y todavía no tienen su cargo real (cuotas,
//    suscripciones, gastos fijos) — ver getProjectedCommitmentEntriesForRange.
//  · card: null = todo · 'visa' = Visa, tarjeta genérica o sin medio de pago
//    (no débito, efectivo ni Amex) · 'amex' = solo Amex. Un gasto fijo proyectado
//    solo cuenta en una tarjeta si tiene ese medio de pago explícito.
//  · amountMode: 'personal' = tu parte de un gasto compartido (default) ·
//    'full' = lo que cobra el banco (pantalla Tarjetas).

const CARD_GENERIC_PAYMETHODS=['tc','tarjeta de crédito','tarjeta_credito'];
const PROJECTED_GROUP_CATEGORY={cuotas:'Cuotas',suscripciones:'Suscripciones',fijos:'Gastos fijos'};

function payMethodMatchesCard(payMethod, card, opts={}){
  if(!card) return true;
  const pm=String(payMethod||'').toLowerCase();
  if(card==='amex') return pm==='amex';
  if(card==='visa'){
    if(opts.requireExplicit) return pm==='visa'||CARD_GENERIC_PAYMETHODS.includes(pm);
    return pm!=='deb'&&pm!=='ef'&&pm!=='amex';
  }
  return pm===String(card).toLowerCase();
}

function getMonthRange(monthKey){
  const [year,month]=String(monthKey||'').split('-').map(Number);
  if(!year||!month) return null;
  const lastDay=new Date(year,month,0).getDate();
  const mm=String(month).padStart(2,'0');
  return {startStr:`${year}-${mm}-01`, endStr:`${year}-${mm}-${String(lastDay).padStart(2,'0')}`};
}

function _periodUsdRate(){
  if(typeof USD_TO_ARS!=='undefined' && USD_TO_ARS) return USD_TO_ARS;
  return state.usdRate||1420;
}

// Lista de gastos del período (reales + proyectados) en un formato común.
function getPeriodExpenseEntries(opts={}){
  const startStr=opts.startStr, endStr=opts.endStr;
  if(!startStr||!endStr) return [];
  const card=opts.card||null;
  const amountMode=opts.amountMode==='full'?'full':'personal';
  const todayRef=opts.todayRef instanceof Date?opts.todayRef:new Date();
  const txns=Array.isArray(opts.txns)?opts.txns:(state.transactions||[]);
  const entries=[];

  txns.forEach(t=>{
    if(!t || t.isPendingCuota || t.isPendingSubscription) return;
    const ymd=dateToYMD(t.date);
    if(!(ymd>=startStr && ymd<=endStr)) return;
    if(!payMethodMatchesCard(t.payMethod, card)) return;
    const fullAmount=Number(t.amount)||0;
    const personalAmount=getTxnPersonalAmount(t);
    entries.push({
      id:t.id,
      date:t.date,
      description:t.description||'',
      category:t.category||'Sin categoría',
      currency:t.currency||'ARS',
      payMethod:t.payMethod||'',
      fullAmount,
      personalAmount,
      amount:amountMode==='full'?fullAmount:personalAmount,
      isProjected:false,
      group:null,
      txn:t
    });
  });

  if(opts.includeProjected!==false){
    getProjectedCommitmentEntriesForRange({startStr, endStr, todayRef, txns}).forEach(e=>{
      if(!e.includeInTotal) return;
      if(!payMethodMatchesCard(e.payMethod, card, {requireExplicit:e.group==='fijos'})) return;
      const fullAmount=Number(e.amount)||0;
      const personalAmount=e.personalAmount!=null?Number(e.personalAmount)||0:fullAmount;
      entries.push({
        id:e._key,
        date:e.date,
        description:e.title||'',
        category:PROJECTED_GROUP_CATEGORY[e.group]||'Compromisos',
        currency:e.currency||'ARS',
        payMethod:e.payMethod||'',
        fullAmount,
        personalAmount,
        amount:amountMode==='full'?fullAmount:personalAmount,
        isProjected:true,
        group:e.group,
        meta:e.meta||'',
        commitment:e
      });
    });
  }
  return entries;
}

function sumPeriodEntries(entries){
  const acc={ars:0,usd:0,count:0};
  (entries||[]).forEach(e=>{
    if((e.currency||'ARS')==='USD') acc.usd+=e.amount;
    else acc.ars+=e.amount;
    acc.count++;
  });
  return acc;
}

// Totales del período. Devuelve también el detalle (entries) para gráficos y categorías.
function getPeriodTotals(opts={}){
  const entries=getPeriodExpenseEntries(opts);
  const real=sumPeriodEntries(entries.filter(e=>!e.isProjected));
  const projected=sumPeriodEntries(entries.filter(e=>e.isProjected));
  const ars=real.ars+projected.ars;
  const usd=real.usd+projected.usd;
  return {
    ars,
    usd,
    count:real.count+projected.count,
    totalArs:ars+usd*_periodUsdRate(),
    real,
    projected,
    entries
  };
}

// Mismo detalle que getPeriodExpenseEntries pero con forma de movimiento, para código que
// ya trabaja con transacciones (gráficos de Tendencias, Dashboard): los reales se devuelven
// tal cual y los proyectados como movimientos sintéticos con el monto ya elegido.
function getPeriodTxnList(opts={}){
  return getPeriodExpenseEntries(opts).map(e=>e.isProjected
    ? {id:e.id, date:e.date, description:e.description, amount:e.amount, currency:e.currency, category:e.category, payMethod:e.payMethod||opts.card||'', isSyntheticCommitment:true, commitmentGroup:e.group}
    : e.txn);
}

// Totales por categoría (en ARS, convirtiendo USD) a partir de getPeriodTotals().entries
function getPeriodCategoryTotals(entries, opts={}){
  const rate=_periodUsdRate();
  const out={};
  (entries||[]).forEach(e=>{
    if(opts.arsOnly && (e.currency||'ARS')==='USD') return;
    const amt=(e.currency||'ARS')==='USD'?e.amount*rate:e.amount;
    out[e.category]=(out[e.category]||0)+amt;
  });
  return out;
}

// ¿Este movimiento real es un compromiso (cuota, suscripción o gasto fijo) y no gasto variable?
function isCommitmentTxn(t){
  if(!t) return false;
  if(t.cuotaNum || t.cuotaGroupId || t.sourceSubscriptionId) return true;
  if(typeof txnMatchesSubscription!=='function') return false;
  return (state.subscriptions||[]).some(s=>s.active!==false && txnMatchesSubscription(t,s))
    || (state.fixedExpenses||[]).some(f=>txnMatchesSubscription(t,{id:f.id||'',name:f.name,merchantKey:f.merchantKey}));
}

// Proyección al cierre del período: solo el gasto VARIABLE se extrapola por día; los
// compromisos (cuotas, suscripciones, fijos) se suman una vez — los ya vencidos y los
// que faltan dentro del período. Todo en ARS.
function getPeriodProjection(opts={}){
  const todayRef=opts.todayRef instanceof Date?opts.todayRef:new Date();
  const rate=_periodUsdRate();
  const toArs=e=>(e.currency||'ARS')==='USD'?e.amount*rate:e.amount;
  const totals=getPeriodTotals(opts);
  const variableSpent=totals.entries.filter(e=>!e.isProjected && !isCommitmentTxn(e.txn)).reduce((s,e)=>s+toArs(e),0);
  const committedSpent=totals.totalArs-variableSpent;
  const futureCommitted=getProjectedCommitmentEntriesForRange({startStr:opts.startStr,endStr:opts.endStr,todayRef,txns:state.transactions||[]})
    .filter(e=>!e.includeInTotal && payMethodMatchesCard(e.payMethod, opts.card||null, {requireExplicit:e.group==='fijos'}))
    .reduce((s,e)=>s+((e.currency||'ARS')==='USD'?(Number(e.amount)||0)*rate:(Number(e.amount)||0)),0);
  const start=new Date(opts.startStr+'T00:00:00');
  const end=new Date(opts.endStr+'T23:59:59');
  const totalDays=Math.max(1, Math.round((end-start)/86400000));
  const isOpen=todayRef>=start && todayRef<=end;
  const daysElapsed=isOpen?Math.max(1, Math.min(totalDays, Math.floor((todayRef-start)/86400000)+1)):totalDays;
  const daysLeft=isOpen?Math.max(0, totalDays-daysElapsed):0;
  const dailyVariable=variableSpent/daysElapsed;
  return {
    spent:totals.totalArs,
    variableSpent,
    committedSpent,
    futureCommitted:isOpen?futureCommitted:0,
    dailyVariable,
    daysElapsed,
    daysLeft,
    projected:Math.round(totals.totalArs + dailyVariable*daysLeft + (isOpen?futureCommitted:0))
  };
}
