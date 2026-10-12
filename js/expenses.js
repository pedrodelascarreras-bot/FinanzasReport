// ══ CUOTAS ══
// Fuente única de verdad: state.cuotas.
// Cada cuota tiene un calendario fijo: la cuota número `paid` vence en `lastPaidDate`
// (o la cuota 1 en `startDate`), y cada cuota siguiente vence un mes después, el día `day`.
// Así las cuotas pagas avanzan solas con el tiempo y nunca se proyectan más allá de `total`.
// Los movimientos importados con info de cuota (cuotaNum/cuotaTotal/cuotaGroupId) solo
// actualizan ese calendario; las pantallas siempre leen de state.cuotas.

function normalizeAutoCuotaSlug(value=''){
  return String(value||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function getLegacyAutoCuotaKey(baseName=''){
  return normalizeAutoCuotaSlug(baseName).substring(0,30);
}
function getAutoCuotaKey(txn, baseName=''){
  if(txn?.cuotaGroupId){
    const groupKey=normalizeAutoCuotaSlug(String(txn.cuotaGroupId));
    if(groupKey) return 'grp-'+groupKey;
  }
  const normalized=normalizeAutoCuotaSlug(baseName);
  return normalized||getLegacyAutoCuotaKey(baseName)||('cuota-'+Date.now());
}
function getCuotaTxnBaseName(t){
  return String(t?._baseDesc||t?.description||'Cuota')
    .replace(/\s*\(?Cuota\s+\d+\s*(?:\/|de)\s*\d+\)?\s*$/i,'')
    .replace(/\s*\(?\d+\/\d+\)?\s*$/,'')
    .trim()||'Cuota';
}
// Grupos de cuotas borrados por el usuario: no se vuelven a crear al reimportar.
function isCuotaGroupDismissed(cuotaGroupId, baseName=''){
  const dismissed=state.dismissedAutoCuotas||[];
  if(!dismissed.length) return false;
  const keys=[getAutoCuotaKey({cuotaGroupId},baseName), getLegacyAutoCuotaKey(baseName)].filter(Boolean);
  return keys.some(k=>dismissed.includes(k));
}
function dismissCuotaGroup(cuotaGroupId){
  if(!cuotaGroupId) return;
  if(!state.dismissedAutoCuotas) state.dismissedAutoCuotas=[];
  const key=getAutoCuotaKey({cuotaGroupId});
  if(!state.dismissedAutoCuotas.includes(key)) state.dismissedAutoCuotas.push(key);
}

function buildCommitmentMaterializedTxn(base={}){
  const dateValue=base.date instanceof Date?new Date(base.date):new Date(String(base.date).includes('T')?base.date:(String(base.date)+'T12:00:00'));
  if(Number.isNaN(dateValue.getTime())) return null;
  dateValue.setHours(12,0,0,0);
  return {
    ...base,
    date:dateValue,
    week:getWeekKey(dateValue),
    month:getMonthKey(dateValue),
    isMaterializedCommitment:true,
    estado_revision:base.estado_revision||'detectado_automaticamente',
    origen_del_movimiento:base.origen_del_movimiento||'compromiso_materializado'
  };
}

function appendMaterializedCommitmentTxn(txn){
  if(!txn||!txn.id) return false;
  if((state.transactions||[]).some(existing=>existing.id===txn.id)) return false;
  state.transactions=[...(state.transactions||[]),txn];
  return true;
}

// ── Calendario de una cuota ──
function _cuotaParseDate(value){
  if(!value) return null;
  const d=value instanceof Date?new Date(value):new Date(String(value).includes('T')?value:(String(value)+'T12:00:00'));
  return Number.isNaN(d.getTime())?null:d;
}
function _cuotaDateInMonth(year, monthIdx, day){
  const first=new Date(year, monthIdx, 1, 12, 0, 0, 0);
  const maxDay=new Date(first.getFullYear(), first.getMonth()+1, 0).getDate();
  first.setDate(Math.min(Math.max(1, day), maxDay));
  return first;
}
function getCuotaTotal(c){
  return Math.max(1, parseInt(c?.total,10)||1);
}
function getCuotaGroupId(c){
  return c?.cuotaGroupId||('manual_'+c?.id);
}
// Punto de referencia del calendario: la cuota número `num` vence en `date`.
function getCuotaAnchor(c){
  const total=getCuotaTotal(c);
  const paid=Math.min(total, Math.max(0, parseInt(c?.paid,10)||0));
  const last=_cuotaParseDate(c?.lastPaidDate);
  const start=_cuotaParseDate(c?.startDate);
  const day=parseInt(c?.day,10)||(last?last.getDate():null)||(start?start.getDate():null)||1;
  if(last && paid>0) return {num:paid, date:_cuotaDateInMonth(last.getFullYear(), last.getMonth(), day), day};
  if(start) return {num:1, date:_cuotaDateInMonth(start.getFullYear(), start.getMonth(), day), day};
  // Sin fechas guardadas (no debería pasar después de migrateCuotasToSingleSource):
  // la cuota `paid` es el vencimiento más reciente a hoy.
  const today=new Date();
  let recent=_cuotaDateInMonth(today.getFullYear(), today.getMonth(), day);
  if(recent>today) recent=_cuotaDateInMonth(today.getFullYear(), today.getMonth()-1, day);
  if(paid>0) return {num:paid, date:recent, day};
  return {num:1, date:_cuotaDateInMonth(recent.getFullYear(), recent.getMonth()+1, day), day};
}
function getCuotaInstallmentDate(c, num){
  const a=getCuotaAnchor(c);
  return _cuotaDateInMonth(a.date.getFullYear(), a.date.getMonth()+(Number(num)-a.num), a.day);
}
// Cuotas (número + fecha) que vencen dentro de [start, end].
function getCuotaInstallmentsInRange(c, start, end){
  if(!(start instanceof Date)||!(end instanceof Date)||start>end) return [];
  const a=getCuotaAnchor(c);
  const total=getCuotaTotal(c);
  const out=[];
  const cursor=new Date(start.getFullYear(), start.getMonth(), 1);
  const limit=new Date(end.getFullYear(), end.getMonth(), 1);
  while(cursor<=limit){
    const monthOffset=(cursor.getFullYear()-a.date.getFullYear())*12+(cursor.getMonth()-a.date.getMonth());
    const num=a.num+monthOffset;
    if(num>=1 && num<=total){
      const date=_cuotaDateInMonth(cursor.getFullYear(), cursor.getMonth(), a.day);
      if(date>=start && date<=end) out.push({num, date});
    }
    cursor.setMonth(cursor.getMonth()+1);
  }
  return out;
}
// Estado de la cuota a una fecha: cuántas vencieron, cuántas faltan, próxima fecha.
function getCuotaStatus(c, refDate=new Date()){
  const total=getCuotaTotal(c);
  const a=getCuotaAnchor(c);
  const ref=refDate instanceof Date?refDate:new Date(refDate);
  let paid=a.num+(ref.getFullYear()-a.date.getFullYear())*12+(ref.getMonth()-a.date.getMonth());
  if(getCuotaInstallmentDate(c, paid)>ref) paid--;
  paid=Math.min(total, Math.max(0, paid));
  const rem=total-paid;
  const amount=Number(c?.amount)||0;
  return {
    total,
    paid,
    rem,
    pct:Math.round((paid/total)*100),
    amount,
    remainingTotal:rem*amount,
    nextNum:rem>0?paid+1:null,
    nextDate:rem>0?getCuotaInstallmentDate(c, paid+1):null,
    endDate:getCuotaInstallmentDate(c, total)
  };
}
function getActiveCuotas(refDate=new Date()){
  return (state.cuotas||[]).filter(c=>getCuotaStatus(c, refDate).rem>0);
}

// ── Alta / actualización de cuotas a partir de movimientos importados ──
// Para cada plan (cuotaGroupId) toma la cuota de número más alto y deja el calendario
// anclado ahí. Nunca retrocede `paid`. Respeta los planes que el usuario borró.
function upsertCuotasFromTxns(txns){
  if(!Array.isArray(state.cuotas)) state.cuotas=[];
  const cfgs=state.autoCuotaConfig||{};
  const latestByGroup=new Map();
  (txns||[]).forEach(t=>{
    if(!t || t.isPendingCuota || t.isAnulacion) return;
    if(!t.cuotaGroupId || !(Number(t.cuotaTotal)>=2)) return;
    const prev=latestByGroup.get(t.cuotaGroupId);
    const num=Number(t.cuotaNum)||1;
    if(!prev || num>(Number(prev.cuotaNum)||1) || (num===(Number(prev.cuotaNum)||1) && new Date(t.date)>new Date(prev.date))){
      latestByGroup.set(t.cuotaGroupId, t);
    }
  });
  let created=0, updated=0;
  latestByGroup.forEach((t, groupId)=>{
    const baseName=getCuotaTxnBaseName(t);
    const txDate=_cuotaParseDate(t.date);
    const cuotaTotal=Math.max(2, Number(t.cuotaTotal)||2);
    const cuotaNum=Math.min(cuotaTotal, Math.max(1, Number(t.cuotaNum)||1));
    const existing=state.cuotas.find(c=>c.cuotaGroupId===groupId);
    if(existing){
      // El dato real del resumen manda: re-ancla el calendario si es igual o más nuevo
      if(cuotaNum>=(parseInt(existing.paid,10)||0) && txDate){
        if(existing.paid!==cuotaNum || existing.lastPaidDate!==dateToYMD(txDate)) updated++;
        existing.paid=cuotaNum;
        existing.lastPaidDate=dateToYMD(txDate);
      }
      if(!existing.day && txDate) existing.day=txDate.getDate();
      if(!existing.amount) existing.amount=Number(t.amount)||0;
      if(!existing.name || existing.name==='Cuota') existing.name=baseName;
      return;
    }
    if(isCuotaGroupDismissed(groupId, baseName)) return;
    // Configuración que el usuario le había puesto a la cuota "automática" (alias, total, día…)
    const cfg=cfgs[getAutoCuotaKey({cuotaGroupId:groupId},baseName)]||cfgs[getLegacyAutoCuotaKey(baseName)]||{};
    state.cuotas.push({
      id:'auto_'+groupId,
      cuotaGroupId:groupId,
      name:(cfg.alias||'').trim()||baseName,
      amount:Number(t.amount)||0,
      total:parseInt(cfg.total,10)||cuotaTotal,
      paid:cuotaNum,
      day:parseInt(cfg.day,10)||(txDate?txDate.getDate():new Date().getDate()),
      lastPaidDate:txDate?dateToYMD(txDate):null,
      emoji:cfg.emoji||'🛒',
      color:cfg.color||'#8c5cff',
      currency:t.currency||'ARS',
      payMethod:t.payMethod||null,
      source:'auto-import',
      createdAt:new Date().toISOString()
    });
    created++;
  });
  if(created||updated) console.info('[cuotas] desde movimientos — creadas:', created, 'actualizadas:', updated);
  return {created, updated};
}

// ── Migración: todo a state.cuotas ──
// Idempotente; corre en cada carga. Convierte las cuotas que antes se "detectaban"
// desde los movimientos en entradas de state.cuotas, borra las proyecciones viejas
// guardadas como movimientos (isPendingCuota) y fija la fecha de referencia de las
// cuotas cargadas a mano.
function migrateCuotasToSingleSource(){
  if(!Array.isArray(state.cuotas)) state.cuotas=[];
  const txns=state.transactions||[];
  let changed=false;
  // 1) Movimientos con info de cuota pero sin cuotaGroupId: les asigno uno estable
  txns.forEach(t=>{
    if(t.isPendingCuota || t.cuotaGroupId || !t.cuotaNum || !(Number(t.cuotaTotal)>=2)) return;
    t.cuotaGroupId='cg_legacy_'+getAutoCuotaKey(null, getCuotaTxnBaseName(t));
    changed=true;
  });
  // 2) Planes con movimientos reales que todavía no están en state.cuotas
  const tracked=new Set(state.cuotas.map(c=>c.cuotaGroupId).filter(Boolean));
  const untracked=txns.filter(t=>!t.isPendingCuota && t.cuotaGroupId && !tracked.has(t.cuotaGroupId) && Number(t.cuotaTotal)>=2);
  if(untracked.length && upsertCuotasFromTxns(untracked).created) changed=true;
  // 3) Proyecciones viejas guardadas como movimientos
  const before=txns.length;
  state.transactions=txns.filter(t=>!t.isPendingCuota);
  if(state.transactions.length!==before) changed=true;
  // 4) Cuotas cargadas a mano sin fecha de referencia: `paid` se interpreta "a hoy"
  const today=new Date();
  state.cuotas.forEach(c=>{
    if(c.lastPaidDate || c.startDate) return;
    const paid=parseInt(c.paid,10)||0;
    const day=parseInt(c.day,10)||today.getDate();
    if(!c.day) c.day=day;
    let recent=_cuotaDateInMonth(today.getFullYear(), today.getMonth(), day);
    if(recent>today) recent=_cuotaDateInMonth(today.getFullYear(), today.getMonth()-1, day);
    if(paid>0) c.lastPaidDate=dateToYMD(recent);
    else c.startDate=dateToYMD(_cuotaDateInMonth(recent.getFullYear(), recent.getMonth()+1, day));
    changed=true;
  });
  if(changed) console.info('[cuotas] migración a fuente única aplicada');
  return changed;
}

function materializeManualCuotaHistory(cuota, opts={}){
  if(!cuota) return 0;
  const todayRef=opts.todayRef instanceof Date?opts.todayRef:new Date();
  const status=getCuotaStatus(cuota, todayRef);
  if(!status.paid) return 0;
  const groupId=getCuotaGroupId(cuota);
  let created=0;
  for(let installmentNum=1;installmentNum<=status.paid;installmentNum++){
    if(hasRealCuotaChargeForInstallment(groupId, installmentNum, state.transactions||[])) continue;
    const materializedId=`mat_manual_cuota_${cuota.id}_${installmentNum}`;
    if((state.transactions||[]).some(txn=>txn.id===materializedId)) continue;
    const chargeDate=getCuotaInstallmentDate(cuota, installmentNum);
    if(!chargeDate || !hasReachedEffectiveChargeDate(chargeDate, todayRef)) continue;
    if(hasRealCuotaChargeInMonth(groupId, getMonthKey(chargeDate), state.transactions||[])) continue;
    const materialized=buildCommitmentMaterializedTxn({
      id:materializedId,
      description:`${cuota.name} (Cuota ${installmentNum}/${status.total})`,
      _baseDesc:cuota.name,
      amount:Number(cuota.amount)||0,
      currency:cuota.currency||'ARS',
      category:'Cuotas',
      source:'commitment',
      cuotaNum:installmentNum,
      cuotaTotal:status.total,
      cuotaGroupId:groupId,
      payMethod:cuota.payMethod||null,
      date:chargeDate
    });
    if(appendMaterializedCommitmentTxn(materialized)) created++;
  }
  return created;
}

function getSubscriptionMaterializationDates(sub, todayRef=new Date()){
  if(!sub||sub.freq!=='monthly'||!sub.day) return [];
  const dates=[];
  const startRef=sub.startDate||sub.lastChargeDate||'';
  if(startRef){
    const start=new Date(String(startRef).includes('T')?startRef:(startRef+'T12:00:00'));
    if(Number.isNaN(start.getTime())) return dates;
    const cursor=new Date(start.getFullYear(),start.getMonth(),1,12,0,0,0);
    const limit=new Date(todayRef.getFullYear(),todayRef.getMonth(),1,12,0,0,0);
    while(cursor<=limit){
      const maxDay=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();
      const chargeDate=new Date(cursor.getFullYear(),cursor.getMonth(),Math.min(parseInt(sub.day,10)||1,maxDay),12,0,0,0);
      if(hasReachedEffectiveChargeDate(chargeDate,todayRef)) dates.push(chargeDate);
      cursor.setMonth(cursor.getMonth()+1);
    }
    return dates;
  }
  const dueDay=parseInt(sub.day,10)||todayRef.getDate();
  const anchor=new Date(todayRef.getFullYear(),todayRef.getMonth(),Math.min(dueDay,new Date(todayRef.getFullYear(),todayRef.getMonth()+1,0).getDate()),12,0,0,0);
  dates.push(anchor<=todayRef?anchor:new Date(todayRef.getFullYear(),todayRef.getMonth()-1,Math.min(dueDay,new Date(todayRef.getFullYear(),todayRef.getMonth(),0).getDate()),12,0,0,0));
  return dates;
}

function materializeSubscriptionHistory(sub, opts={}){
  if(!sub) return 0;
  const todayRef=opts.todayRef instanceof Date?opts.todayRef:new Date();
  const dates=getSubscriptionMaterializationDates(sub,todayRef);
  if(!dates.length) return 0;
  let created=0;
  const monthlyAmount=commitmentsMonthlyAmount(sub);
  dates.forEach(chargeDate=>{
    const monthKey=getMonthKey(chargeDate);
    if(typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[])) return;
    const materialized=buildCommitmentMaterializedTxn({
      id:`mat_sub_${sub.id}_${monthKey}`,
      description:`${sub.name} (suscripción)`,
      _baseDesc:sub.name,
      amount:Number(monthlyAmount)||0,
      currency:sub.currency||'ARS',
      category:sub.cat||'Suscripciones',
      source:'subscription',
      sourceSubscriptionId:sub.id,
      merchantKey:sub.merchantKey||getSubscriptionMerchantKey(sub.name),
      payMethod:sub.payMethod||null,
      date:chargeDate
    });
    state.transactions=(state.transactions||[]).filter(txn=>
      !(txn.isPendingSubscription && txn.sourceSubscriptionId===sub.id && getMonthKey(txn.date)===monthKey)
    );
    if(appendMaterializedCommitmentTxn(materialized)) created++;
  });
  return created;
}

function deleteSubscriptionById(id, opts={}){
  const sub=(state.subscriptions||[]).find(s=>s.id===id);
  if(!sub) return false;
  materializeSubscriptionHistory(sub, opts);
  state.subscriptions=(state.subscriptions||[]).filter(s=>s.id!==id);
  syncProjectedSubscriptionTransactions();
  saveState();
  renderSubs();
  refreshAll();
  if(opts.silent!==true) showToast('Suscripción eliminada','info');
  return true;
}

function deleteManualCuotaById(id, opts={}){
  const cuota=(state.cuotas||[]).find(c=>c.id===id);
  if(!cuota) return false;
  materializeManualCuotaHistory(cuota, opts);
  // Si vino de un import, que no se vuelva a crear al reimportar el resumen
  if(cuota.cuotaGroupId) dismissCuotaGroup(cuota.cuotaGroupId);
  state.cuotas=(state.cuotas||[]).filter(c=>c.id!==id);
  saveState();
  renderCuotas();
  refreshAll();
  if(opts.silent!==true) showToast('Cuota eliminada','info');
  return true;
}
// Próxima fecha (hoy excluido) en que cae el día `day` del mes — para suscripciones y fijos
function getNextCuotaDate(day){
  if(!day)return null;
  const today=new Date();
  const next=new Date(today.getFullYear(),today.getMonth(),day);
  if(next<=today)next.setMonth(next.getMonth()+1);
  return next;
}
function isFixedSectionHidden(){
  return localStorage.getItem('fin_commitments_hide_fixed')==='1';
}
function toggleFixedSectionVisibility(){
  const next=isFixedSectionHidden()?'0':'1';
  localStorage.setItem('fin_commitments_hide_fixed',next);
  renderCommitmentsPage();
  showToast(next==='1'?'Gastos fijos ocultos':'Gastos fijos visibles','info');
}
function getSubscriptionMerchantKey(name=''){
  return String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function getTxnSubscriptionMatchKeys(txn){
  if(!txn) return [];
  const keys = [
    txn.merchantKey,
    txn.subscriptionName,
    txn._baseDesc,
    txn.comercio_detectado,
    txn.description
  ].map(getSubscriptionMerchantKey).filter(Boolean);
  return [...new Set(keys)];
}
function subscriptionKeysMatch(a='', b=''){
  if(!a || !b) return false;
  if(a===b) return true;
  if(a.length>=6 && b.length>=6){
    if(a.includes(b) || b.includes(a)) return true;
    if(a.slice(0,8)===b.slice(0,8)) return true;
  }
  return false;
}
function txnMatchesSubscription(txn, sub){
  if(!txn || !sub || txn.isPendingSubscription) return false;
  if(txn.sourceSubscriptionId && txn.sourceSubscriptionId===sub.id) return true;
  const subKeys = [
    sub.merchantKey,
    sub.name
  ].map(getSubscriptionMerchantKey).filter(Boolean);
  const txnKeys = getTxnSubscriptionMatchKeys(txn);
  return txnKeys.some(txnKey => subKeys.some(subKey => subscriptionKeysMatch(txnKey, subKey)));
}
function hasRealSubscriptionChargeInMonth(sub, monthKey, txns=state.transactions||[]){
  if(!sub || !monthKey) return false;
  return txns.some(txn=>
    !txn.isPendingSubscription &&
    getMonthKey(txn.date)===monthKey &&
    txnMatchesSubscription(txn, sub)
  );
}
function getImportedSubscriptionByKey(key, ruleId){
  const normalizedKey=getSubscriptionMerchantKey(key);
  return (state.subscriptions||[]).find(s=>
    (s.autoManaged&&s.merchantKey&&s.merchantKey===normalizedKey)||
    (ruleId&&s.autoManaged&&s.sourceRuleId===ruleId&&getSubscriptionMerchantKey(s.name)===normalizedKey)
  )||null;
}
function upsertImportedSubscriptionFromTxn(txn){
  if(!txn||!txn.isAutoDebit||!txn.subscriptionName)return null;
  // Skip credit card payment debits — they're not real "subscriptions",
  // they're the recurring TC payment itself (which is tracked by the TC cycle system).
  // Avoids fake "Pago Visa Santander" / "Pago AMEX" entries showing up as overdue commitments.
  const _sname = String(txn.subscriptionName || '').toLowerCase();
  const _looksLikeCcPayment = /\bvisa\b|\bamex\b|\bmastercard\b|\bmaestro\b|\btarjeta\b|pago.*tarjeta|tarjeta.*cr[eé]dito|santander\s*(visa|amex|r[íi]o)/i.test(_sname);
  if (_looksLikeCcPayment) return null;
  if(!state.subscriptions)state.subscriptions=[];
  const txnMonthKey=getMonthKey(txn.date);
  state.transactions=(state.transactions||[]).filter(existing=>
    !(
      existing.isMaterializedCommitment &&
      getMonthKey(existing.date)===txnMonthKey &&
      txnMatchesSubscription(existing,{
        id:txn.sourceSubscriptionId||existing.sourceSubscriptionId||'',
        merchantKey:txn.merchantKey||getSubscriptionMerchantKey(txn.subscriptionName),
        name:txn.subscriptionName
      })
    )
  );
  const merchantKey=txn.merchantKey||getSubscriptionMerchantKey(txn.subscriptionName);
  const existing=getImportedSubscriptionByKey(merchantKey,txn.importRuleId);
  const nextObj={
    id:existing?.id||('sub_auto_'+merchantKey+'_'+(txn.importRuleId||'gmail')),
    name:txn.subscriptionName,
    emoji:existing?.emoji||'🔁',
    price:txn.amount,
    currency:txn.currency||'ARS',
    freq:'monthly',
    day:txn.subscriptionDay||new Date(txn.date).getDate(),
    cat:existing?.cat||'Suscripciones',
    color:existing?.color||'#5ac8fa',
    active:true,
    autoManaged:true,
    merchantKey,
    sourceRuleId:txn.importRuleId||null,
    sourceBank:txn.sourceBank||'Gmail',
    startDate:existing?.startDate||dateToYMD(txn.date),
    lastChargeDate:dateToYMD(txn.date),
    payMethod:txn.payMethod||existing?.payMethod||null,
    ownerProfileId:txn.ownerProfileId||state.activeUserProfileId||existing?.ownerProfileId||'default-profile'
  };
  const idx=state.subscriptions.findIndex(s=>s.id===nextObj.id);
  if(idx>=0)state.subscriptions[idx]={...state.subscriptions[idx],...nextObj};
  else state.subscriptions.unshift(nextObj);
  return nextObj;
}
function syncProjectedSubscriptionTransactions(){
  const today=new Date();
  today.setHours(0,0,0,0);
  const activeSubs=(state.subscriptions||[]).filter(s=>s.active!==false&&s.freq==='monthly'&&s.day);
  state.transactions=(state.transactions||[]).filter(t=>!t.isPendingSubscription);
  const projections=[];
  activeSubs.forEach(sub=>{
    const merchantKey=sub.merchantKey||getSubscriptionMerchantKey(sub.name);
    const startRef=sub.startDate||sub.lastChargeDate||null;
    const start=startRef?new Date(startRef+'T12:00:00'):today;
    for(let offset=0;offset<6;offset++){
      const candidate=new Date(start.getFullYear(),start.getMonth()+offset,1);
      const maxDay=new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate();
      const chargeDay=Math.min(parseInt(sub.day,10)||1,maxDay);
      const chargeDate=new Date(candidate.getFullYear(),candidate.getMonth(),chargeDay);
      if(sub.startDate){
        const subStart=new Date(sub.startDate+'T00:00:00');
        if(chargeDate<subStart) continue;
      }
      if(chargeDate<today)continue;
      const monthKey=getMonthKey(chargeDate);
      const realExists=hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[]);
      if(realExists)continue;
      projections.push({
        id:`proj_sub_${sub.id}_${monthKey}`,
        date:chargeDate,
        description:`${sub.name} (suscripción)`,
        _baseDesc:sub.name,
        amount:sub.price,
        currency:sub.currency||'ARS',
        category:'Suscripciones',
        week:getWeekKey(chargeDate),
        month:monthKey,
        source:'subscription',
        sourceSubscriptionId:sub.id,
        merchantKey,
        isPendingSubscription:true,
        origen_del_movimiento:'suscripcion_proyectada',
        estado_revision:'detectado_automaticamente',
        payMethod:sub.payMethod||null,
        ownerProfileId:sub.ownerProfileId||state.activeUserProfileId||'default-profile'
      });
    }
  });
  if(projections.length)state.transactions=[...state.transactions,...projections];
}

if(state.commitmentsFilter===undefined) state.commitmentsFilter='all';
if(state.commitmentsSearch===undefined) state.commitmentsSearch='';
if(state.commitmentsInsightsCollapsed===undefined) state.commitmentsInsightsCollapsed=false;
if(state._commitmentsMenu===undefined) state._commitmentsMenu='';

function commitmentsToArs(amount,currency){
  return (currency||'ARS')==='USD' ? (Number(amount)||0)*(USD_TO_ARS||state.usdRate||1420) : (Number(amount)||0);
}
function commitmentsMonthlyAmount(item){
  if(!item) return 0;
  if(item.type==='subscription' || item.freq || item.price!==undefined){
    if(item.freq==='annual') return Number(item.price||0)/12;
    if(item.freq==='weekly') return Number(item.price||0)*4.3;
    return Number(item.price||0);
  }
  return Number(item.amount||0);
}
function commitmentsFmtMonthDay(date){
  if(!date) return 'Sin fecha';
  return new Date(date).toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
}
function commitmentsGetIncomeSnapshot(monthKey=getMonthKey(new Date())){
  let ars=(state.income?.ars||0)+(state.income?.varArs||0);
  let usd=(state.income?.usd||0)+(state.income?.varUsd||0);
  const exact=(state.incomeMonths||[]).find(m=>m.month===monthKey);
  if(exact && typeof getMonthTotalARS==='function' && typeof getMonthTotalUSD==='function'){
    ars=getMonthTotalARS(exact);
    usd=getMonthTotalUSD(exact);
  } else if((state.incomeSources||[]).some(s=>(s.base||0)>0)){
    ars=(state.incomeSources||[]).filter(s=>s.currency==='ARS').reduce((a,s)=>a+(Number(s.base)||0),0);
    usd=(state.incomeSources||[]).filter(s=>s.currency==='USD').reduce((a,s)=>a+(Number(s.base)||0),0);
  } else if((state.incomeMonths||[]).length && typeof getMonthTotalARS==='function' && typeof getMonthTotalUSD==='function'){
    const last=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];
    if(last){
      ars=getMonthTotalARS(last);
      usd=getMonthTotalUSD(last);
    }
  }
  return {ars,usd,total:ars+(usd*(USD_TO_ARS||state.usdRate||1420))};
}
function commitmentsSyncStatus(){
  const candidates=[];
  if(state.lastGmailSync) candidates.push({label:'Última sincronización Gmail', raw:state.lastGmailSync});
  const lastImport=(state.imports||[])[0];
  if(lastImport){
    const raw=lastImport.createdAt||lastImport.date||lastImport.importedAt||lastImport.updatedAt;
    if(raw) candidates.push({label:'Última importación', raw});
  }
  if(state.lastTransactionsRefresh) candidates.push({label:'Última actualización', raw:state.lastTransactionsRefresh});
  if(!candidates.length) return 'Sin actividad reciente';
  const best=candidates
    .map(item=>({label:item.label,date:new Date(item.raw)}))
    .filter(item=>!Number.isNaN(item.date.getTime()))
    .sort((a,b)=>b.date-a.date)[0];
  if(!best) return 'Sin actividad reciente';
  return best.label+' · '+best.date.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' '+best.date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false});
}
// Próximo vencimiento de una cuota según su calendario (nunca "vencida": las cuotas
// de tarjeta se debitan solas, así que la cuota del mes que ya pasó cuenta como paga).
function commitmentsDueMetaForCuota(c){
  const status=getCuotaStatus(c);
  const day=getCuotaAnchor(c).day;
  const nextDate=status.nextDate;
  if(!nextDate) return {status:'active', label:'Finalizada', nextDate:null, currentDate:null, sortDays:999, daysOverdue:0};
  const now=new Date();
  const today=new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDay=new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  const diff=Math.round((nextDay-today)/86400000);
  if(diff===0) return {status:'soon', label:'Vence hoy', nextDate, currentDate:nextDate, sortDays:0, daysOverdue:0, day};
  if(diff===1) return {status:'soon', label:'Vence mañana', nextDate, currentDate:nextDate, sortDays:1, daysOverdue:0, day};
  if(diff<=7) return {status:'soon', label:'Vence en '+diff+' días', nextDate, currentDate:nextDate, sortDays:diff, daysOverdue:0, day};
  return {status:'active', label:'Próximo '+commitmentsFmtMonthDay(nextDate), nextDate, currentDate:nextDate, sortDays:diff, daysOverdue:0, day};
}

function commitmentsDueMeta(day){
  if(!day) return {status:'active',label:'Sin vencimiento',nextDate:null,currentDate:null,sortDays:999,daysOverdue:0};
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const maxDay=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const dueDay=Math.min(day,maxDay);
  const currentDate=new Date(today.getFullYear(),today.getMonth(),dueDay);
  const nextDate=currentDate<today?new Date(today.getFullYear(),today.getMonth()+1,Math.min(day,new Date(today.getFullYear(),today.getMonth()+2,0).getDate())):currentDate;
  const diffCurrent=Math.round((currentDate-today)/86400000);
  const diffNext=Math.round((nextDate-today)/86400000);
  // For overdue items, sortDays now reflects time until the NEXT charge (positive)
  // instead of how-overdue (negative). This prevents widgets from showing "Hoy"
  // for overdue items and keeps the "next" sorting consistent.
  if(diffCurrent<0) return {status:'overdue',label:'Vencido · día '+day,nextDate,currentDate,sortDays:diffNext,daysOverdue:Math.abs(diffCurrent)};
  if(diffCurrent===0) return {status:'soon',label:'Vence hoy',nextDate,currentDate,sortDays:0,daysOverdue:0};
  if(diffCurrent===1) return {status:'soon',label:'Vence mañana',nextDate,currentDate,sortDays:1,daysOverdue:0};
  if(diffCurrent<=7) return {status:'soon',label:'Vence en '+diffCurrent+' días',nextDate,currentDate,sortDays:diffCurrent,daysOverdue:0};
  return {status:'active',label:'Próximo '+commitmentsFmtMonthDay(nextDate),nextDate,currentDate,sortDays:diffNext,daysOverdue:0};
}
function commitmentsKnownLogo(name=''){
  const key=String(name||'').toLowerCase();
  const map=[
    {match:['netflix'],bg:'#111111',color:'#E50914',label:'N'},
    {match:['spotify'],bg:'#1ed760',color:'#111111',label:'S'},
    {match:['figma'],bg:'#1f2937',color:'#ffffff',label:'F'},
    {match:['youtube'],bg:'#ff0033',color:'#ffffff',label:'Y'},
    {match:['apple','icloud'],bg:'#111111',color:'#ffffff',label:'A'},
    {match:['chatgpt','openai'],bg:'#111111',color:'#ffffff',label:'O'},
    {match:['uca'],bg:'#eef2ff',color:'#4f46e5',label:'U'},
    {match:['macbook','iphone'],bg:'#f3f4f6',color:'#111111',label:''}
  ];
  return map.find(item=>item.match.some(term=>key.includes(term)))||null;
}
function commitmentsAvatar(item){
  const custom=item.customLogoUrl||item.logoUrl||item.merchantLogoUrl||'';
  if(custom) return '<span class="cp-avatar cp-avatar-img"><img src="'+esc(custom)+'" alt=""></span>';
  const known=commitmentsKnownLogo(item.name||item.provider||'');
  if(known) return '<span class="cp-avatar" style="background:'+known.bg+';color:'+known.color+';">'+esc(known.label)+'</span>';
  if(item.emoji) return '<span class="cp-avatar cp-avatar-emoji">'+esc(item.emoji)+'</span>';
  const initials=String(item.name||'C').split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
  return '<span class="cp-avatar cp-avatar-fallback">'+esc(initials||'C')+'</span>';
}
function commitmentsCurrencyClass(currency){
  return (currency||'ARS')==='USD' ? 'usd' : 'ars';
}
function commitmentsMoneyHtml(amount,currency,suffix=''){
  const cls=commitmentsCurrencyClass(currency);
  const prefix=(currency||'ARS')==='USD'?'USD ':'$';
  return '<span class="cp-money '+cls+'">'+prefix+fmtN(Number(amount)||0)+(suffix||'')+'</span>';
}
function commitmentsBuildData(){
  const fixedItems=(state.fixedExpenses||[]).map(f=>{
    const due=commitmentsDueMeta(parseInt(f.day,10)||null);
    return {
      type:'fixed',
      id:f.id,
      name:f.name,
      subtitle:'Gasto fijo',
      category:'Gastos fijos',
      amount:Number(f.amount)||0,
      currency:f.currency||'ARS',
      amountArs:commitmentsToArs(f.amount,f.currency),
      day:parseInt(f.day,10)||null,
      due,
      emoji:f.emoji||'🏠',
      color:f.color||'#ff8f3d',
      customLogoUrl:f.customLogoUrl||f.logoUrl||'',
      editAction:'editFixed'
    };
  });
  const subsItems=(state.subscriptions||[]).filter(s=>s.active!==false).map(s=>{
    const monthly=commitmentsMonthlyAmount(s);
    const due=commitmentsDueMeta(parseInt(s.day,10)||null);
    return {
      type:'subscription',
      id:s.id,
      name:s.name,
      subtitle:s.cat||'Suscripción',
      category:'Suscripciones',
      amount:monthly,
      rawAmount:Number(s.price)||0,
      currency:s.currency||'ARS',
      amountArs:commitmentsToArs(monthly,s.currency),
      day:parseInt(s.day,10)||null,
      due,
      emoji:s.emoji||'🔁',
      color:s.color||'#6a4cff',
      customLogoUrl:s.customLogoUrl||s.logoUrl||'',
      freq:s.freq||'monthly',
      editAction:'editSub'
    };
  });
  const cuotaItems=(state.cuotas||[]).map(c=>{
    const status=getCuotaStatus(c);
    return {
      type:'quota',
      id:c.id,
      name:c.name,
      subtitle:status.total+' cuotas',
      category:'Cuotas',
      amount:status.amount,
      currency:c.currency||'ARS',
      amountArs:commitmentsToArs(status.amount,c.currency||'ARS'),
      due:commitmentsDueMetaForCuota(c),
      emoji:c.emoji||'🛒',
      color:c.color||'#8c5cff',
      customLogoUrl:c.customLogoUrl||c.logoUrl||'',
      paid:status.paid,
      total:status.total,
      pct:status.pct,
      remaining:status.rem,
      remainingTotal:status.remainingTotal,
      endDate:status.endDate,
      editAction:'editCuota',
      source:'manual'
    };
  }).filter(item=>item.remaining>0);
  const expiredCuotaItems=cuotaItems.filter(item=>item.due?.status==='overdue');
  const activeCuotaItems=cuotaItems.filter(item=>item.due?.status!=='overdue');
  const allActive=[...fixedItems,...subsItems,...activeCuotaItems];
  return {fixedItems,subsItems,cuotaItems:activeCuotaItems,expiredCuotaItems,allActive};
}
function commitmentsFilterMatches(item, filter){
  if(!item) return false;
  if(filter==='all') return true;
  if(filter==='fixed') return item.type==='fixed';
  if(filter==='subscriptions') return item.type==='subscription';
  if(filter==='quotas') return item.type==='quota';
  if(filter==='active') return item.type==='fixed'||item.type==='subscription'||(item.type==='quota'&&item.remaining>0);
  if(filter==='soon') return item.due?.status==='soon';
  if(filter==='overdue') return item.due?.status==='overdue';
  return true;
}
function commitmentsSearchMatches(item, term){
  if(!term) return true;
  const q=String(term||'').toLowerCase();
  return [item.name,item.subtitle,item.category].some(value=>String(value||'').toLowerCase().includes(q));
}
function commitmentsSetFilter(filter){
  state.commitmentsFilter=filter||'all';
  renderCommitmentsPage();
}
function commitmentsSetSearch(value){
  state.commitmentsSearch=value||'';
  renderCommitmentsPage();
  const inp=document.querySelector('.cp-search input');
  if(inp){
    inp.focus();
    const len=inp.value.length;
    inp.setSelectionRange(len,len);
  }
}
function commitmentsToggleMenu(key){
  state._commitmentsMenu=state._commitmentsMenu===key?'':key;
  renderCommitmentsPage();
}
function commitmentsInvokeEdit(action,id){
  state._commitmentsMenu='';
  if(typeof window[action]==='function') window[action](id);
}
function commitmentsDeleteExpiredCuota(source,id){
  if(!confirm('¿Borrar esta cuota vencida definitivamente? Los movimientos ya registrados no se borran.')) return;
  deleteManualCuotaById(id,{silent:true});
  renderCommitmentsPage();
  showToast('Cuota vencida eliminada','info');
}
function renderCommitmentsPage(){
  const root=document.getElementById('commitments-native-root');
  if(!root) return;
  const monthKey=getMonthKey(new Date());
  const income=commitmentsGetIncomeSnapshot(monthKey);
  const syncLabel=commitmentsSyncStatus();
  const {fixedItems,subsItems,cuotaItems,expiredCuotaItems,allActive}=commitmentsBuildData();
  const filter=state.commitmentsFilter||'all';
  const search=(state.commitmentsSearch||'').trim().toLowerCase();
  const filteredActive=allActive.filter(item=>commitmentsFilterMatches(item,filter)&&commitmentsSearchMatches(item,search));
  const filterFn=item=>commitmentsFilterMatches(item,filter)&&commitmentsSearchMatches(item,search);
  const filteredFixed=fixedItems.filter(filterFn);
  const filteredSubs=subsItems.filter(filterFn);
  const filteredCuotas=cuotaItems.filter(filterFn);
  const filteredExpiredCuotas=(expiredCuotaItems||[]).filter(item=>commitmentsSearchMatches(item,search)&&(filter==='all'||filter==='quotas'||filter==='overdue'));
  const totalCommittedArs=allActive.reduce((sum,item)=>sum+item.amountArs,0);
  const pctIncome=income.total>0?Math.round((totalCommittedArs/income.total)*100):0;
  const freeArs=Math.max(0, income.total-totalCommittedArs);
  const nextDueItems=allActive
    .filter(item=>item.due && item.due.nextDate)
    .sort((a,b)=>a.due.sortDays-b.due.sortDays || b.amountArs-a.amountArs);
  const nextDue=nextDueItems[0]||null;
  const upcomingWeek=nextDueItems.filter(item=>item.due.status==='soon'||item.due.status==='overdue').slice(0,4);
  const biggest=allActive.slice().sort((a,b)=>b.amountArs-a.amountArs)[0]||null;
  const subsTotalArs=subsItems.reduce((sum,item)=>sum+item.amountArs,0);
  const fixedTotalArs=fixedItems.reduce((sum,item)=>sum+item.amountArs,0);
  const cuotasTotalArs=cuotaItems.reduce((sum,item)=>sum+item.amountArs,0);
  const liberableArs=subsTotalArs;
  const distribution=[
    {label:'Cuotas',value:cuotasTotalArs,color:'#7c3aed'},
    {label:'Suscripciones',value:subsTotalArs,color:'#06b6d4'},
    {label:'Gastos fijos',value:fixedTotalArs,color:'#f59e0b'}
  ].filter(item=>item.value>0);
  const monthlyAverageArs=totalCommittedArs;
  let donutCursor=0;
  const donutGradient=(distribution.length?distribution.map(item=>{
    const start=donutCursor;
    const pct=totalCommittedArs>0?Math.round((item.value/totalCommittedArs)*100):0;
    donutCursor+=pct;
    return item.color+' '+start+'% '+donutCursor+'%';
  }).join(', '):'#ece9fb 0 100%');
  const summaryTone=pctIncome>=60?'limit':pctIncome>=35?'warn':'calm';
  const summaryTitle=summaryTone==='limit'?'Estás al límite':summaryTone==='warn'?'Carga alta de compromisos':'Bajo control';
  const summaryBody=summaryTone==='limit'
    ?'Tus compromisos ya consumen una parte muy alta de tu ingreso mensual.'
    :summaryTone==='warn'
      ?'La estructura mensual está bastante cargada. Conviene monitorear próximos vencimientos.'
      :'Tu base comprometida todavía deja margen para gastos variables.';
  const tipText=summaryTone==='limit'
    ?'Priorizá revisar suscripciones y mover gastos no esenciales fuera de este mes.'
    :summaryTone==='warn'
      ?'Si reducís una o dos suscripciones, recuperás aire sin tocar compromisos grandes.'
      :'Mantené tus compromisos por debajo del 35% de tu ingreso para sostener flexibilidad.';
  const pageClass='cp-page expanded';
  const menuHtml=(item,key)=>state._commitmentsMenu===key
    ?'<div class="cp-menu">'
      +'<button onclick="commitmentsInvokeEdit(\''+item.editAction+'\',\''+item.id+'\');event.stopPropagation();">Editar</button>'
      +'</div>'
    :'';
  const rowMoney=(item,meta='')=>commitmentsMoneyHtml(item.amount,item.currency,meta);
  const dueBadge=item=>'<span class="cp-due '+(item.due?.status||'active')+'">'+esc(item.due?.label||'Sin fecha')+'</span>';
  const showFixedSection=filter!=='subscriptions'&&filter!=='quotas';
  const showSubsSection=filter!=='fixed'&&filter!=='quotas';
  const showQuotasSection=filter!=='fixed'&&filter!=='subscriptions';
  const renderFixedBlock=()=>{
    const hidden=isFixedSectionHidden();
    if(hidden){
      return '<section class="cp-card cp-section cp-empty-block">'
        +'<div class="cp-section-head"><div class="cp-section-title"><span class="cp-dot fixed"></span>Gastos fijos</div><button class="cp-link-btn" onclick="toggleFixedSectionVisibility()">Mostrar gastos fijos</button></div>'
        +'<div class="cp-empty-state"><div class="cp-empty-copy"><strong>Gastos fijos ocultos</strong><span>Podés volver a mostrarlos cuando quieras sin perder información.</span></div></div>'
      +'</section>';
    }
    if(!fixedItems.length){
      return '<section class="cp-card cp-section">'
        +'<div class="cp-section-head"><div class="cp-section-title"><span class="cp-dot fixed"></span>Gastos fijos</div><button class="cp-link-btn" onclick="toggleFixedSectionVisibility()">Ocultar gastos fijos</button></div>'
        +'<div class="cp-empty-state">'
          +'<div class="cp-empty-icon">□</div>'
          +'<div class="cp-empty-copy"><strong>Aún no registrás gastos fijos</strong><span>Agregalos para tener una visión completa de tus compromisos mensuales.</span></div>'
          +'<button class="cp-inline-action" onclick="openNewFixedModal()">+ Agregar gasto fijo</button>'
        +'</div>'
      +'</section>';
    }
    return '<section class="cp-card cp-section">'
      +'<div class="cp-section-head"><div class="cp-section-title"><span class="cp-dot fixed"></span>Gastos fijos</div><div class="cp-head-actions"><span class="cp-head-meta">'+fixedItems.length+' activos</span><button class="cp-link-btn" onclick="toggleFixedSectionVisibility()">Ocultar gastos fijos</button></div></div>'
      +'<div class="cp-list">'+filteredFixed.map(item=>{
        const menuKey='fixed-'+item.id;
        return '<article class="cp-row">'
          +'<div class="cp-row-main">'+commitmentsAvatar(item)+'<div class="cp-row-copy"><div class="cp-row-title">'+esc(item.name)+'</div><div class="cp-row-sub">'+esc(item.subtitle)+'</div></div></div>'
          +'<div class="cp-row-meta"><div class="cp-row-amount">'+rowMoney(item)+'</div>'+dueBadge(item)+'</div>'
          +'<div class="cp-menu-wrap"><button class="cp-menu-btn" onclick="commitmentsToggleMenu(\''+menuKey+'\');event.stopPropagation();">⋯</button>'+menuHtml(item,menuKey)+'</div>'
        +'</article>';
      }).join('')+'</div>'
    +'</section>';
  };
  const renderSubsBlock=()=>{
    const totalSub=filteredSubs.reduce((sum,item)=>sum+item.amountArs,0);
    return '<section class="cp-card cp-section">'
      +'<div class="cp-section-head"><div class="cp-section-title"><span class="cp-dot subs"></span>Suscripciones</div><div class="cp-head-actions"><button class="cp-link-btn">Ver todas</button></div></div>'
      +(filteredSubs.length?'<div class="cp-list">'+filteredSubs.map(item=>{
        const menuKey='sub-'+item.id;
        return '<article class="cp-row">'
          +'<div class="cp-row-main">'+commitmentsAvatar(item)+'<div class="cp-row-copy"><div class="cp-row-title">'+esc(item.name)+'</div><div class="cp-row-sub">'+esc(item.subtitle)+'</div></div></div>'
          +'<div class="cp-row-meta"><div class="cp-row-amount">'+rowMoney(item,' / mes')+'</div></div>'
          +'<div class="cp-row-date">'+dueBadge({due:{status:'soon',label:commitmentsFmtMonthDay(item.due?.nextDate)}})+'</div>'
          +'<div class="cp-menu-wrap"><button class="cp-menu-btn" onclick="commitmentsToggleMenu(\''+menuKey+'\');event.stopPropagation();">⋯</button>'+menuHtml(item,menuKey)+'</div>'
        +'</article>';
      }).join('')+'</div><div class="cp-section-footer"><span class="cp-section-footer-label">Total suscripciones</span><span class="cp-section-footer-value">$'+fmtN(Math.round(totalSub))+'<span style="font:600 12px var(--font);color:#8b86a1;margin-left:5px;">/ mes</span></span></div>':'<div class="cp-empty-inline">No hay suscripciones para este filtro.</div>')
    +'</section>';
  };
  const renderCuotasBlock=()=>{
    const totalCuotas=filteredCuotas.reduce((sum,item)=>sum+item.amountArs,0);
    return '<section class="cp-card cp-section">'
      +'<div class="cp-section-head"><div class="cp-section-title"><span class="cp-dot cuotas"></span>Cuotas</div><div class="cp-head-actions"><button class="cp-link-btn">Ver todas</button></div></div>'
      +(filteredCuotas.length?'<div class="cp-quota-list">'+filteredCuotas.map(item=>{
        const menuKey='quota-'+item.id;
        return '<article class="cp-quota-row">'
          +'<div class="cp-quota-main">'+commitmentsAvatar(item)+'<div class="cp-row-copy"><div class="cp-row-title">'+esc(item.name)+'</div><div class="cp-row-sub">'+esc(item.subtitle)+(item.endDate?' · termina '+commitmentsFmtMonthDay(item.endDate):'')+'</div></div></div>'
          +'<div class="cp-quota-metric"><span class="cp-metric-label">Cuota mensual</span><strong>'+rowMoney(item)+'</strong></div>'
          +'<div class="cp-quota-progress"><span class="cp-metric-label">Progreso</span><div class="cp-progress-bar"><span style="width:'+Math.max(6,item.pct||0)+'%;background:'+esc(item.color||'#8c5cff')+';"></span></div><div class="cp-progress-meta"><span>'+item.paid+'/'+item.total+' cuotas</span><span>'+item.pct+'%</span></div></div>'
          +'<div class="cp-quota-end"><span class="cp-metric-label">Termina</span><strong>'+(item.endDate?commitmentsFmtMonthDay(item.endDate):'—')+'</strong>'+dueBadge(item)+'</div>'
          +'<div class="cp-menu-wrap"><button class="cp-menu-btn" onclick="commitmentsToggleMenu(\''+menuKey+'\');event.stopPropagation();">⋯</button>'+menuHtml(item,menuKey)+'</div>'
        +'</article>';
      }).join('')+'</div><div class="cp-section-footer"><span class="cp-section-footer-label">Total cuotas</span><span class="cp-section-footer-value">$'+fmtN(Math.round(totalCuotas))+'<span style="font:600 12px var(--font);color:#8b86a1;margin-left:5px;">/ mes</span></span></div>':'<div class="cp-empty-inline">No hay cuotas activas para este filtro.</div>')
    +'</section>';
  };
  const renderExpiredCuotasBlock=()=>{
    if(!filteredExpiredCuotas.length) return '';
    return '<section class="cp-card cp-section cp-expired-section">'
      +'<div class="cp-section-head"><div class="cp-section-title"><span class="cp-dot cuotas"></span>Cuotas vencidas</div><div class="cp-head-actions"><span class="cp-head-meta">'+filteredExpiredCuotas.length+' para revisar</span></div></div>'
      +'<div class="cp-expired-list">'+filteredExpiredCuotas.map(item=>{
        return '<article class="cp-expired-row">'
          +'<div class="cp-row-main">'+commitmentsAvatar(item)+'<div class="cp-row-copy"><div class="cp-row-title">'+esc(item.name)+'</div><div class="cp-row-sub">'+esc(item.subtitle)+(item.endDate?' · terminaba '+commitmentsFmtMonthDay(item.endDate):'')+'</div></div></div>'
          +'<div class="cp-row-meta"><div class="cp-row-amount">'+rowMoney(item)+'</div>'+dueBadge(item)+'</div>'
          +'<button class="cp-expired-delete" onclick="commitmentsDeleteExpiredCuota(\''+esc(item.source||'manual')+'\',\''+esc(item.id)+'\')">Borrar definitivamente</button>'
        +'</article>';
      }).join('')+'</div>'
    +'</section>';
  };
  root.innerHTML=
    '<style>'
      +'#page-cuotas{padding:0 18px 22px 22px;overflow:auto;background:transparent;}'
      +'#commitments-native-root{padding:16px 0 0;}'
      +'.cp-page{display:grid;grid-template-columns:minmax(0,1fr) 334px;gap:20px;align-items:start;}'
      +'.cp-page.expanded{grid-template-columns:minmax(0,1fr);}'
      +'.cp-card{background:#fff;border:1px solid rgba(96,89,138,.1);border-radius:20px;box-shadow:0 4px 14px rgba(43,37,68,.04);}'
      +'.cp-main{min-width:0;}'
      +'.cp-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px;}'
      +'.cp-title h1{font:800 38px/1.02 var(--font);letter-spacing:-.04em;color:#1f1a33;margin:0 0 7px;}'
      +'.cp-title p{margin:0;font:600 13.5px/1.45 var(--font);color:#7c7791;}'
      +'.cp-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;max-width:620px;}'
      +'.cp-btn,.cp-btn-primary,.cp-status-pill{height:42px;border-radius:999px;border:1px solid rgba(95,88,126,.12);background:#fff;padding:0 16px;font:700 12.8px var(--font);color:#403a5b;display:inline-flex;align-items:center;gap:8px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset;cursor:pointer;}'
      +'.cp-btn-primary{background:linear-gradient(135deg,#5d35f3,#8c5cff 58%,#ff7ab6);color:#fff;border:none;box-shadow:0 10px 24px rgba(93,53,243,.22);}'
      +'.cp-status-pill{font-size:11.4px;color:#5f5975;padding:0 14px;background:#fff;}'
      +'.cp-status-pill .cp-dot-mini{width:7px;height:7px;border-radius:50%;background:#34c759;display:inline-block;}'
      +'.cp-search{height:46px;border-radius:22px;background:#f4f4fa;border:1px solid rgba(113,106,144,.09);display:flex;align-items:center;gap:11px;padding:0 16px;color:#7a7590;margin-bottom:12px;}'
      +'.cp-search input{flex:1;border:none;outline:none;background:transparent;font:600 13.2px var(--font);color:#231d39;}'
      +'.cp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}'
      +'.cp-chip{height:32px;border-radius:999px;border:1px solid rgba(113,106,144,.11);background:#fff;padding:0 14px;font:700 11.8px var(--font);color:#5c5675;display:inline-flex;align-items:center;cursor:pointer;}'
      +'.cp-chip.active{background:#5732f3;color:#fff;border-color:transparent;box-shadow:0 8px 16px rgba(87,50,243,.18);}'
      +'.cp-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px;}'
      +'.cp-summary-card{padding:22px 24px 22px;min-height:138px;position:relative;overflow:hidden;background:linear-gradient(145deg,#fff 0%,#fbfbff 100%);transition:transform .18s ease,box-shadow .18s ease;}'
      +'.cp-summary-card:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(43,37,68,.085);}'
      +'.cp-summary-card::before{content:"";position:absolute;right:-36px;bottom:-42px;width:136px;height:136px;border-radius:50%;background:var(--cp-soft);}'
      +'.cp-summary-card::after{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,var(--cp-tone),var(--cp-tone-2));}'
      +'.cp-summary-card .k{font-size:10.5px;font-weight:800;letter-spacing:.07em;color:#7d7894;margin-bottom:13px;font-family:var(--font);position:relative;z-index:1;}'
      +'.cp-summary-card .v{font-size:26px;font-weight:850;letter-spacing:-.035em;color:#1f1a33;font-family:var(--font);position:relative;z-index:1;}'
      +'.cp-summary-card .s{margin-top:10px;font:650 12.5px/1.4 var(--font);color:#7a7590;position:relative;z-index:1;}'
      +'.cp-breakdown{display:flex;flex-direction:column;gap:10px;position:relative;z-index:1;}'
      +'.cp-breakdown-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}'
      +'.cp-breakdown-label{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#5e5876;font-family:var(--font);}'
      +'.cp-bd-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}'
      +'.cp-breakdown-val{font-size:17px;font-weight:850;letter-spacing:-.02em;color:#1f1a33;font-family:var(--font);font-variant-numeric:tabular-nums;}'
      +'.cp-summary-card.total{--cp-tone:#5d35f3;--cp-tone-2:#a855f7;--cp-soft:rgba(93,53,243,.11);border-color:rgba(93,53,243,.16);}'
      +'.cp-summary-card.income{--cp-tone:#10b981;--cp-tone-2:#84cc16;--cp-soft:rgba(16,185,129,.12);border-color:rgba(16,185,129,.16);}'
      +'.cp-summary-card.free{--cp-tone:#0ea5e9;--cp-tone-2:#38bdf8;--cp-soft:rgba(14,165,233,.12);border-color:rgba(14,165,233,.16);}'
      +'.cp-summary-card.due{--cp-tone:#f97316;--cp-tone-2:#facc15;--cp-soft:rgba(249,115,22,.13);border-color:rgba(249,115,22,.18);}'
      +'.cp-summary-card .bar{margin-top:13px;height:8px;border-radius:999px;background:#ece8fa;overflow:hidden;}'
      +'.cp-summary-card .bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#5d35f3,#8c5cff);}'
      +'.cp-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;}'
      +'.cp-section{padding:16px 16px 14px;background:linear-gradient(180deg,#fff 0%,#fcfbff 100%);}'
      +'.cp-section-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:14px;}'
      +'.cp-section-title{display:flex;align-items:center;gap:8px;font:700 15px var(--font);color:#221c37;}'
      +'.cp-section-sub{margin-top:4px;font:600 12.5px var(--font);color:#8b86a1;}'
      +'.cp-section-footer{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:18px 14px 6px;margin-top:14px;border-top:1px solid rgba(98,91,140,.08);}'
      +'.cp-section-footer-label{font:700 13px var(--font);color:#8b86a1;}'
      +'.cp-section-footer-value{font:800 19px var(--font);letter-spacing:-.02em;color:#1f1a33;}'
      +'.cp-dot{width:9px;height:9px;border-radius:50%;display:inline-block;}'
      +'.cp-dot.fixed{background:#ffb347;box-shadow:0 0 0 5px rgba(255,179,71,.16);}.cp-dot.subs{background:#6a4cff;box-shadow:0 0 0 5px rgba(106,76,255,.14);}.cp-dot.cuotas{background:#ff7ab6;box-shadow:0 0 0 5px rgba(255,122,182,.14);}'
      +'.cp-head-actions{display:flex;align-items:center;gap:10px;}'
      +'.cp-head-meta{font:600 11.5px var(--font);color:#8b86a1;}'
      +'.cp-link-btn{border:none;background:transparent;padding:0;font:700 11.5px var(--font);color:#5d35f3;cursor:pointer;}'
      +'.cp-list,.cp-quota-list{display:flex;flex-direction:column;gap:10px;}'
      +'.cp-row,.cp-quota-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:14px;padding:14px 14px;border:1px solid rgba(98,91,140,.08);border-radius:16px;background:linear-gradient(145deg,#fff 0%,#fbfbff 100%);box-shadow:0 6px 16px rgba(43,37,68,.025);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;}'
      +'.cp-row:hover,.cp-quota-row:hover{transform:translateY(-1px);border-color:rgba(93,53,243,.16);box-shadow:0 12px 24px rgba(43,37,68,.06);}'
      +'.cp-quota-row{grid-template-columns:minmax(0,1.2fr) minmax(140px,.52fr) minmax(180px,.82fr) minmax(170px,.7fr) auto;}'
      +'.cp-row-main,.cp-quota-main{display:flex;align-items:center;gap:12px;min-width:0;}'
      +'.cp-row-copy{min-width:0;}'
      +'.cp-row-title{font:700 14.3px var(--font);color:#201a34;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      +'.cp-row-sub{margin-top:3px;font:600 11.8px var(--font);color:#8a849f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      +'.cp-row-meta{display:flex;align-items:flex-end;flex-direction:column;gap:6px;}'
      +'.cp-row-amount{font:800 15.3px var(--font);letter-spacing:-.02em;}'
      +'.cp-row-date{display:flex;justify-content:flex-end;}'
      +'.cp-money.ars{color:#1f1a33;}.cp-money.usd{color:#1ead68;}'
      +'.cp-due{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font:700 11px var(--font);border:1px solid rgba(113,106,144,.11);background:#faf9fe;color:#59536d;}'
      +'.cp-due.soon{background:#f2ebff;color:#5d35f3;border-color:rgba(93,53,243,.16);}'
      +'.cp-due.overdue{background:#fff0ef;color:#ff6b57;border-color:rgba(255,107,87,.18);}'
      +'.cp-avatar{width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,#f3f2fb,#e9e4ff);display:inline-flex;align-items:center;justify-content:center;font:800 14px var(--font);color:#483f6f;flex-shrink:0;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.82),0 6px 14px rgba(93,53,243,.09);}'
      +'.cp-avatar-img img{width:100%;height:100%;object-fit:cover;display:block;}'
      +'.cp-avatar-emoji{font-size:19px;background:#f5f4fb;}'
      +'.cp-progress-bar{height:7px;border-radius:999px;background:#ece8fa;overflow:hidden;margin:8px 0 7px;}'
      +'.cp-progress-bar span{display:block;height:100%;border-radius:999px;}'
      +'.cp-progress-meta{display:flex;justify-content:space-between;font:700 11.2px var(--font);color:#817a99;}'
      +'.cp-metric-label{display:block;font:800 10px var(--font);letter-spacing:.05em;color:#8b86a1;text-transform:uppercase;margin-bottom:7px;}'
      +'.cp-quota-metric strong,.cp-quota-end strong{font:800 15px var(--font);color:#221c37;letter-spacing:-.02em;}'
      +'.cp-quota-end{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0;}'
      +'.cp-quota-end .cp-due{margin-top:0;white-space:nowrap;}'
      +'.cp-empty-state{display:flex;align-items:center;gap:14px;padding:14px 6px 8px;}'
      +'.cp-empty-icon{width:44px;height:44px;border-radius:14px;border:1px solid rgba(98,91,140,.1);background:#f6f5fb;display:flex;align-items:center;justify-content:center;color:#8d88a2;font-size:20px;flex-shrink:0;}'
      +'.cp-empty-copy{display:flex;flex-direction:column;gap:4px;min-width:0;}'
      +'.cp-empty-copy strong{font:700 14px var(--font);color:#261f3c;}'
      +'.cp-empty-copy span,.cp-empty-inline{font:600 12px/1.45 var(--font);color:#8a849f;}'
      +'.cp-inline-action{margin-left:auto;height:38px;border:none;border-radius:999px;padding:0 16px;background:linear-gradient(135deg,#5d35f3,#8c5cff);color:#fff;font:700 12px var(--font);cursor:pointer;box-shadow:0 10px 24px rgba(93,53,243,.18);}'
      +'.cp-right{display:flex;flex-direction:column;gap:12px;}'
      +'.cp-panel-head{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 0 2px;font:700 12px var(--font);color:#726d86;}'
      +'.cp-panel-toggle{width:44px;height:26px;border-radius:999px;border:none;background:'+(state.commitmentsInsightsCollapsed?'#d9d7e7':'#5732f3')+';position:relative;cursor:pointer;}'
      +'.cp-panel-toggle span{position:absolute;top:3px;left:'+(state.commitmentsInsightsCollapsed?'3px':'21px')+';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .18s ease;}'
      +'.cp-ins-show-bar{margin:0 0 12px;display:flex;justify-content:flex-end;}'
      +'.cp-ins-show-btn{height:34px;border:none;border-radius:999px;background:#f0ecff;color:#5732f3;padding:0 14px;font:800 11.8px var(--font);letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 18px rgba(87,50,243,.12);}'
      +'.cp-expired-section{background:linear-gradient(180deg,#fff 0%,#fff8f8 100%);border-color:rgba(255,107,87,.14);}'
      +'.cp-expired-list{display:flex;flex-direction:column;gap:9px;}'
      +'.cp-expired-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:14px;padding:12px 14px;border:1px solid rgba(255,107,87,.11);border-radius:15px;background:#fff;}'
      +'.cp-expired-delete{height:32px;border-radius:999px;border:1px solid rgba(255,107,87,.18);background:#fff0ef;color:#ff5a45;padding:0 12px;font:800 11.4px var(--font);cursor:pointer;}'
      +'.cp-insight-hero{padding:18px 18px 16px;background:linear-gradient(160deg,#2f1b8f,#4027b4 65%,#4d34cb);color:#fff;border:none;box-shadow:0 18px 34px rgba(63,42,183,.24);}'
      +'.cp-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}'
      +'.cp-hero-kicker{font:800 10px var(--font);letter-spacing:.06em;color:rgba(255,255,255,.72);text-transform:uppercase;}'
      +'.cp-hero-title{margin-top:10px;font:800 28px/1 var(--font);letter-spacing:-.035em;}'
      +'.cp-hero-copy{margin-top:8px;font:600 12.4px/1.45 var(--font);color:rgba(255,255,255,.78);max-width:210px;}'
      +'.cp-ring{width:86px;height:86px;border-radius:50%;background:conic-gradient(#f97316 0 '+Math.max(8,Math.min(pctIncome,100))+'%, rgba(255,255,255,.18) '+Math.max(8,Math.min(pctIncome,100))+'% 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;}'
      +'.cp-ring::before{content:"";width:58px;height:58px;border-radius:50%;background:#3a239f;display:block;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}'
      +'.cp-ring-label{position:absolute;font:800 20px var(--font);}'
      +'.cp-hero-bar{margin-top:14px;height:8px;border-radius:999px;background:rgba(255,255,255,.16);overflow:hidden;}'
      +'.cp-hero-bar span{display:block;height:100%;width:'+Math.max(8,Math.min(pctIncome,100))+'%;background:#f97316;border-radius:999px;}'
      +'.cp-hero-meta{display:flex;justify-content:space-between;margin-top:10px;font:700 11.5px var(--font);color:rgba(255,255,255,.82);}'
      +'.cp-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}'
      +'.cp-mini-card{padding:14px 15px;}'
      +'.cp-mini-card .t{font:800 10px var(--font);letter-spacing:.05em;color:#8a849f;text-transform:uppercase;margin-bottom:8px;}'
      +'.cp-mini-card .v{font:800 15px var(--font);letter-spacing:-.02em;color:#1f1a33;}'
      +'.cp-mini-card .s{margin-top:6px;font:600 11.5px/1.4 var(--font);color:#8a849f;}'
      +'.cp-upcoming-list{position:relative;margin-top:8px;display:flex;flex-direction:column;gap:14px;padding-left:14px;}'
      +'.cp-upcoming-list::before{content:"";position:absolute;top:4px;bottom:0;left:4px;width:2px;background:#e2e8f0;border-radius:1px;}'
      +'.cp-upcoming-row{position:relative;padding-left:20px;font-family:var(--font);}'
      +'.cp-tline-dot{position:absolute;top:4px;left:-14px;width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid #fff;z-index:2;box-shadow:0 0 0 1px #e2e8f0;}'
      +'.cp-upcoming-date{display:block;font-size:10.5px;font-weight:800;color:#f97316;text-transform:uppercase;margin-bottom:2px;letter-spacing:0.04em;}'
      +'.cp-upcoming-name{display:block;font-size:13px;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      +'.cp-upcoming-amount{display:inline-block;margin-top:2px;font-size:12px;font-weight:700;color:#64748b;}'
      +'.cp-breakdown-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}'
      +'.cp-breakdown-head .t{font:800 10px var(--font);letter-spacing:.05em;color:#8a849f;text-transform:uppercase;}'
      +'.cp-breakdown-list{display:flex;flex-direction:column;gap:8px;margin-top:12px;}'
      +'.cp-breakdown-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:8px;align-items:center;font:700 11.8px var(--font);color:#5b566e;}'
      +'.cp-tip{padding:14px 15px;background:#fff7eb;border-color:rgba(255,186,104,.2);}'
      +'.cp-tip strong{display:block;font:800 11px var(--font);letter-spacing:.05em;color:#ff8f3d;text-transform:uppercase;margin-bottom:8px;}'
      +'.cp-tip p{margin:0;font:600 12px/1.45 var(--font);color:#7f6c54;}'
      +'.cp-menu-wrap{position:relative;}'
      +'.cp-menu-btn{width:30px;height:30px;border:none;border-radius:10px;background:transparent;color:#8b86a1;font:700 18px var(--font);cursor:pointer;}'
      +'.cp-menu-btn:hover{background:#f5f3fb;color:#342d4d;}'
      +'.cp-menu{position:absolute;top:34px;right:0;min-width:132px;background:#fff;border:1px solid rgba(96,89,138,.12);border-radius:14px;padding:6px;box-shadow:0 18px 36px rgba(35,28,67,.12);z-index:12;}'
      +'.cp-menu button{width:100%;height:34px;border:none;border-radius:10px;background:transparent;text-align:left;padding:0 10px;font:700 12px var(--font);color:#352e4d;cursor:pointer;}'
      +'.cp-menu button:hover{background:#f6f4fd;}'
      +'#modal-fixed .modal,#modal-sub .modal,#modal-cuota .modal,#modal-cuota-auto .modal{border-radius:24px;border:1px solid rgba(98,91,140,.11);box-shadow:0 28px 68px rgba(34,27,62,.22);padding:24px 24px 22px;background:linear-gradient(180deg,#ffffff 0%,#fbfbff 100%);}'
      +'#modal-fixed .modal-title,#modal-sub .modal-title,#modal-cuota .modal-title,#modal-cuota-auto .modal-title{font:800 24px/1.05 var(--font);letter-spacing:-.03em;color:#1f1a33;}'
      +'#modal-fixed .modal-sub,#modal-sub .modal-sub,#modal-cuota .modal-sub,#modal-cuota-auto .modal-sub{font:600 12.5px/1.45 var(--font);color:#8a849f;margin-top:6px;margin-bottom:16px;}'
      +'#modal-fixed .input-label,#modal-sub .input-label,#modal-cuota .input-label,#modal-cuota-auto .input-label{font:800 10px var(--font);letter-spacing:.05em;color:#8a849f;text-transform:uppercase;}'
      +'#modal-fixed .input-field,#modal-sub .input-field,#modal-cuota .input-field,#modal-cuota-auto .input-field{height:44px;border-radius:14px;border:1px solid rgba(98,91,140,.1);background:#f7f6fc;font:700 13px var(--font);color:#231d39;}'
      +'#modal-fixed .modal-actions .btn,#modal-sub .modal-actions .btn,#modal-cuota .modal-actions .btn,#modal-cuota-auto .modal-actions .btn{height:40px;border-radius:999px;font:700 12.5px var(--font);}'
      +'@media (max-width:1180px){.cp-page{grid-template-columns:minmax(0,1fr);}.cp-summary{grid-template-columns:repeat(2,minmax(0,1fr));}.cp-quota-row{grid-template-columns:minmax(0,1fr) minmax(120px,.5fr) minmax(160px,.8fr) auto;}.cp-quota-end{display:none;}.cp-row{grid-template-columns:minmax(0,1fr) auto auto;}.cp-row-date{display:none;}}'
      +'@media (max-width:820px){.cp-header{flex-direction:column;}.cp-actions{justify-content:flex-start;}.cp-summary{grid-template-columns:1fr;}.cp-row,.cp-quota-row{grid-template-columns:minmax(0,1fr);}.cp-row-meta{align-items:flex-start;}.cp-menu-wrap{justify-self:end;}}'
    +'</style>'
    +'<div class="'+pageClass+'">'
      +'<div class="cp-main">'
        +'<div class="cp-header">'
          +'<div class="cp-title"><h1>Compromisos</h1><p>Tus gastos fijos, cuotas y suscripciones en un solo lugar.</p></div>'
          +'<div class="cp-actions"><button class="cp-btn" onclick="openNewFixedModal()">＋ Gasto fijo</button><button class="cp-btn" onclick="openNewSubModal()">＋ Suscripción</button><button class="cp-btn-primary" onclick="openNewCuotaModal()">＋ Nueva cuota</button></div>'
        +'</div>'
        +'<div class="cp-search"><span style="font-size:14px;">⌕</span><input placeholder="Buscar compromiso, servicio o proveedor..." value="'+esc(state.commitmentsSearch||'')+'" oninput="commitmentsSetSearch(this.value)"></div>'
        +'<div class="cp-chips">'
          +[
            ['all','Todos'],
            ['fixed','Gastos fijos'],
            ['subscriptions','Suscripciones'],
            ['quotas','Cuotas'],
            ['active','Activos'],
            ['soon','Por vencer'],
            ['overdue','Vencidos']
          ].map(chip=>'<button class="cp-chip'+(filter===chip[0]?' active':'')+'" onclick="commitmentsSetFilter(\''+chip[0]+'\')">'+chip[1]+'</button>').join('')
        +'</div>'
        +'<div class="cp-summary">'
          +'<div class="cp-card cp-summary-card total"><div class="k">TOTAL COMPROMETIDO</div><div class="v">$'+fmtN(Math.round(totalCommittedArs))+'</div><div class="s">'+allActive.length+' compromisos activos</div></div>'
          +'<div class="cp-card cp-summary-card income"><div class="k">VS. INGRESOS MENSUALES</div><div class="v">'+pctIncome+'% <span style="font-size:12px;color:'+(summaryTone==='limit'?'#ff8f3d':'#34c759')+';">'+(summaryTone==='limit'?'⚠ Al límite':'● Controlado')+'</span></div><div class="s">Ingresos: $'+fmtN(Math.round(income.total))+'</div><div class="bar"><span style="width:'+Math.max(6,Math.min(pctIncome,100))+'%;"></span></div></div>'
          +'<div class="cp-card cp-summary-card free">'
            +'<div class="k">DESGLOSE</div>'
            +'<div class="cp-breakdown">'
              +'<div class="cp-breakdown-row">'
                +'<div class="cp-breakdown-label"><span class="cp-bd-dot" style="background:#06b6d4;"></span>Suscripciones</div>'
                +'<div class="cp-breakdown-val">$'+fmtN(Math.round(subsTotalArs))+'</div>'
              +'</div>'
              +'<div class="cp-breakdown-row">'
                +'<div class="cp-breakdown-label"><span class="cp-bd-dot" style="background:#7c3aed;"></span>Compromisos</div>'
                +'<div class="cp-breakdown-val">$'+fmtN(Math.round(cuotasTotalArs+fixedTotalArs))+'</div>'
              +'</div>'
            +'</div>'
            +'<div class="s">Cuotas + gastos fijos · ARS</div>'
          +'</div>'
          +'<div class="cp-card cp-summary-card due"><div class="k">PRÓXIMO VENCIMIENTO</div><div class="v">'+(nextDue?(nextDue.due.sortDays<=1?(nextDue.due.sortDays<1?'Hoy':'Mañana'):commitmentsFmtMonthDay(nextDue.due.nextDate)):'—')+'</div><div class="s">'+(nextDue?esc(nextDue.name)+' · '+((nextDue.currency||'ARS')==='USD'?'USD ':'$')+fmtN(nextDue.amount):'Sin pagos próximos')+'</div></div>'
        +'</div>'
        +'<div class="cp-layout">'
          +(showFixedSection?renderFixedBlock():'')
          +(showSubsSection?renderSubsBlock():'')
          +(showQuotasSection?renderCuotasBlock():'')
          +(showQuotasSection?renderExpiredCuotasBlock():'')
        +'</div>'
      +'</div>'
    +'</div>';
}
// ══ MOBILE COMPROMISOS RENDER ══
function renderMobileCompromisos() {
  const shell = document.getElementById('mob-comp-shell');
  if (!shell || window.innerWidth > 768) return;

  // Gather data using existing helpers
  const monthKey = getMonthKey(new Date());
  const income = commitmentsGetIncomeSnapshot(monthKey);
  const { fixedItems, subsItems, cuotaItems, allActive } = commitmentsBuildData();
  const filter = state.commitmentsFilter || 'all';

  const totalArs = allActive.reduce((s, i) => s + i.amountArs, 0);
  const pctIncome = income.total > 0 ? Math.round((totalArs / income.total) * 100) : 0;
  const subsTotalArs = subsItems.reduce((s, i) => s + i.amountArs, 0);

  const _esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const _fmt = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Filter tabs ──
  const tabs = [
    ['all', 'Todos'],
    ['fixed', 'Gastos fijos'],
    ['subscriptions', 'Suscripciones'],
    ['quotas', 'Cuotas'],
  ];
  const tabsHtml = tabs.map(([key, label]) =>
    `<button class="mob-comp-tab${filter === key ? ' active' : ''}"
      onclick="commitmentsSetFilter('${key}')">${_esc(label)}</button>`
  ).join('');

  // ── Total donut (% of income) ──
  const r = 28, cx = 35, cy = 35, circ = 2 * Math.PI * r;
  const filled = Math.min(pctIncome, 100);
  const dashOffset = circ * (1 - filled / 100);
  const donutColor = pctIncome >= 60 ? '#FF4D6A' : pctIncome >= 35 ? '#F7B731' : '#27E47A';

  // ── Upcoming 7 days ──
  const MES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const upcoming = allActive
    .filter(i => i.due && i.due.nextDate && (i.due.status === 'soon' || i.due.status === 'overdue' || i.due.sortDays <= 7))
    .sort((a, b) => a.due.sortDays - b.due.sortDays)
    .slice(0, 5);

  let upcomingHtml;
  if (upcoming.length === 0) {
    upcomingHtml = '<div style="padding:12px 0;text-align:center;color:#9EA6C7;font-size:13px;">Sin vencimientos próximos</div>';
  } else {
    upcomingHtml = upcoming.map(item => {
      const d = item.due.nextDate;
      const day = d.getDate();
      const mon = MES_CORTO[d.getMonth()];
      const isUSD = (item.currency || 'ARS') === 'USD';
      const prefix = isUSD ? 'USD ' : '$';
      const amt = isUSD ? _fmt(Number(item.rawAmount || item.amount)) : _fmt(Math.round(item.amountArs));
      return `
        <div class="mob-comp-upcoming-row">
          <div class="mob-comp-date-badge">
            <div class="mob-comp-date-day">${day}</div>
            <div class="mob-comp-date-mon">${mon}</div>
          </div>
          <div class="mob-comp-upcoming-name">${_esc(item.name)}</div>
          <div class="mob-comp-upcoming-amt${isUSD ? ' usd' : ''}">${_esc(prefix + amt)}</div>
        </div>`;
    }).join('');
  }

  // ── All commitments filtered list ──
  const filtered = allActive.filter(item => {
    if (filter === 'fixed') return item.type === 'fixed';
    if (filter === 'subscriptions') return item.type === 'subscription';
    if (filter === 'quotas') return item.type === 'quota';
    return true;
  });

  let listHtml;
  if (filtered.length === 0) {
    listHtml = '<div style="padding:20px;text-align:center;color:#9EA6C7;font-size:13px;">Sin compromisos en esta categoría</div>';
  } else {
    listHtml = filtered.map(item => {
      const isUSD = (item.currency || 'ARS') === 'USD';
      const prefix = isUSD ? 'USD ' : '$';
      const displayAmt = isUSD ? _fmt(Number(item.rawAmount || item.amount)) : _fmt(Math.round(item.amountArs));
      const typeLabel = item.type === 'subscription' ? 'Suscripción' : item.type === 'fixed' ? 'Gasto fijo' : 'Cuota';
      const badgeClass = item.due?.status === 'soon' ? 'soon' : item.due?.status === 'overdue' ? 'overdue' : '';

      // Avatar
      const known = commitmentsKnownLogo(item.name || '');
      let avatarHtml;
      if (known) {
        avatarHtml = `<div class="mob-comp-item-avatar" style="background:${known.bg};color:${known.color};">${_esc(known.label)}</div>`;
      } else if (item.emoji) {
        avatarHtml = `<div class="mob-comp-item-avatar" style="background:rgba(124,77,255,0.1);font-size:18px;">${_esc(item.emoji)}</div>`;
      } else {
        const initials = String(item.name || 'C').split(/\s+/).slice(0,2).map(p => p[0] || '').join('').toUpperCase();
        const hue = [...initials].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
        avatarHtml = `<div class="mob-comp-item-avatar" style="background:hsl(${hue},40%,18%);color:hsl(${hue},55%,65%);">${_esc(initials)}</div>`;
      }

      return `
        <div class="mob-comp-item-row">
          ${avatarHtml}
          <div class="mob-comp-item-info">
            <div class="mob-comp-item-name">${_esc(item.name)}</div>
            <div class="mob-comp-item-sub">${typeLabel} · ${_esc(prefix + displayAmt)}/mes</div>
          </div>
          <div class="mob-comp-item-right">
            <div class="mob-comp-item-amt${isUSD ? ' usd' : ''}">${_esc(prefix + displayAmt)}</div>
            ${item.due?.label ? `<div class="mob-comp-item-badge ${badgeClass}">${_esc(item.due.label.replace('Próximo ',''))}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ── Assemble ──
  shell.innerHTML = `
    <div class="mob-comp-page">

      <div class="mob-comp-header">
        <button class="mob-comp-ham" onclick="openMobDrawer()" aria-label="Menú">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <img class="mob-brand-logo-img" src="brand/fluxen-logo.png" alt="Fluxen" onclick="nav('dashboard')" style="cursor:pointer">
        <div class="mob-comp-hdr-right"></div>
      </div>

      <div class="mob-comp-title-block">
        <h1 class="mob-comp-title">Compromisos</h1>
        <p class="mob-comp-subtitle">Tus gastos fijos, cuotas y suscripciones en un solo lugar.</p>
      </div>

      <div class="mob-comp-tabs">${tabsHtml}</div>

      <div class="mob-comp-total-card">
        <div class="mob-comp-total-top">
          <div class="mob-comp-total-left">
            <div class="mob-comp-total-label">Total comprometido</div>
            <div class="mob-comp-total-amount">$${_fmt(Math.round(totalArs))}</div>
            <div class="mob-comp-total-sub">${allActive.length} compromisos activos</div>
          </div>
          <div class="mob-comp-donut-wrap">
            <svg class="mob-comp-donut" viewBox="0 0 70 70">
              <circle class="mob-comp-donut-bg" cx="${cx}" cy="${cy}" r="${r}"/>
              <circle class="mob-comp-donut-fill" cx="${cx}" cy="${cy}" r="${r}"
                stroke="${donutColor}"
                stroke-dasharray="${circ.toFixed(1)}"
                stroke-dashoffset="${dashOffset.toFixed(1)}"/>
              <text x="35" y="35" text-anchor="middle" dominant-baseline="central"
                transform="rotate(90,35,35)"
                style="font-size:12px;font-weight:800;fill:#F4F6FF;">${pctIncome}%</text>
            </svg>
          </div>
        </div>
        <div class="mob-comp-income-bar-wrap">
          <div class="mob-comp-income-bar-label">vs. ingresos mensuales</div>
          <div class="mob-comp-income-bar-track">
            <div class="mob-comp-income-bar-fill" style="width:${Math.min(pctIncome, 100)}%"></div>
          </div>
        </div>
      </div>

      ${upcoming.length > 0 ? `
      <div>
        <div class="mob-comp-section-hd">
          <div class="mob-comp-section-title">Próximos 7 días</div>
          <button class="mob-comp-section-link" onclick="nav('calendar')">Ver calendario</button>
        </div>
        <div class="mob-comp-upcoming-list">${upcomingHtml}</div>
      </div>` : ''}

      <div class="mob-comp-list-card">
        <div class="mob-comp-section-hd">
          <div class="mob-comp-section-title">Todos los compromisos</div>
        </div>
        ${listHtml}
      </div>

      ${subsTotalArs > 0 ? `
      <div class="mob-comp-savings-card">
        <div class="mob-comp-savings-left">
          <div class="mob-comp-savings-label">Podrías liberar</div>
          <div class="mob-comp-savings-amount">$${_fmt(Math.round(subsTotalArs))}</div>
          <div class="mob-comp-savings-sub">Si cancelás todas tus suscripciones variables</div>
          <button class="mob-comp-savings-cta" onclick="commitmentsSetFilter('subscriptions')">Ver detalle →</button>
        </div>
        <div class="mob-comp-savings-icon">📊</div>
      </div>` : ''}

    </div>`;
}

// ── External wrapper: call renderMobileCompromisos after every desktop render ──
(function() {
  const _orig = window.renderCommitmentsPage;
  if (typeof _orig !== 'function') return;
  window.renderCommitmentsPage = function() {
    _orig.apply(this, arguments);
    if (window.innerWidth <= 768) {
      try { renderMobileCompromisos(); } catch(e) { console.error('renderMobileCompromisos error', e); }
    }
  };
})();

function renderCuotas(){
  renderCommitmentsPage();
}
function openNewCuotaModal(){
  document.getElementById('modal-cuota-title').textContent='Agregar cuota manual';
  document.getElementById('modal-cuota-editing').value='';
  document.getElementById('cuota-name').value='';document.getElementById('cuota-amount').value='';
  document.getElementById('cuota-total').value='';document.getElementById('cuota-paid').value='0';
  document.getElementById('cuota-day').value='';
  initEmojiPicker('cuota','🛒');
  renderGenericColorPicker('cuota-color-picker','');
  document.getElementById('btn-del-cuota').style.display='none';
  openModal('modal-cuota');
}
function editCuota(id){
  const c=state.cuotas.find(x=>x.id===id);if(!c)return;
  document.getElementById('modal-cuota-title').textContent='Editar cuota';
  document.getElementById('modal-cuota-editing').value=id;
  document.getElementById('cuota-name').value=c.name;document.getElementById('cuota-amount').value=c.amount;
  document.getElementById('cuota-total').value=c.total;document.getElementById('cuota-paid').value=getCuotaStatus(c).paid;
  document.getElementById('cuota-day').value=c.day||'';
  initEmojiPicker('cuota',c.emoji||'🛒');
  renderGenericColorPicker('cuota-color-picker',c.color||'');
  document.getElementById('btn-del-cuota').style.display='inline-flex';
  openModal('modal-cuota');
}
function saveCuota(){
  const name=document.getElementById('cuota-name').value.trim();const amount=parseFloat(document.getElementById('cuota-amount').value)||0;
  const total=parseInt(document.getElementById('cuota-total').value)||1;const paid=parseInt(document.getElementById('cuota-paid').value)||0;
  const day=parseInt(document.getElementById('cuota-day').value)||null;const emoji=document.getElementById('cuota-emoji').value||'🛒';
  if(!name||amount<=0){showToast('⚠️ Completá nombre y monto','error');return;}
  const sw=document.querySelector('#cuota-color-picker .color-swatch.selected');const rawC=sw?sw.style.backgroundColor:'#888888';const cuotaColor=rawC.startsWith('#')?rawC:rgbToHex(rawC);
  const editing=document.getElementById('modal-cuota-editing').value;
  // "Pagadas" se carga a hoy: la cuota N° `paid` es el vencimiento más reciente (o, si
  // no hay ninguna paga, la primera vence en el próximo `day`). Eso ancla el calendario.
  const _today=new Date();
  const _dueDay=day||_today.getDate();
  let _recent=_cuotaDateInMonth(_today.getFullYear(),_today.getMonth(),_dueDay);
  if(_recent>_today) _recent=_cuotaDateInMonth(_today.getFullYear(),_today.getMonth()-1,_dueDay);
  const anchor=paid>0
    ? {lastPaidDate:dateToYMD(_recent),startDate:null}
    : {lastPaidDate:null,startDate:dateToYMD(_cuotaDateInMonth(_recent.getFullYear(),_recent.getMonth()+1,_dueDay))};
  if(editing){const c=state.cuotas.find(x=>x.id===editing);if(c){
    const scheduleChanged=getCuotaStatus(c).paid!==paid||(parseInt(c.day,10)||null)!==day;
    c.name=name;c.amount=amount;c.total=total;c.day=day;c.emoji=emoji;c.color=cuotaColor;
    if(scheduleChanged){c.paid=paid;Object.assign(c,anchor);}
  }}
  else{state.cuotas.push({id:Date.now().toString(36),name,amount,total,paid,day:_dueDay,emoji,color:cuotaColor,currency:'ARS',createdAt:new Date().toISOString(),...anchor});}
  saveState();closeModal('modal-cuota');renderCuotas();refreshAll();showToast('✓ Cuota guardada','success');
}
function deleteCuota(){
  const id=document.getElementById('modal-cuota-editing').value;
  deleteManualCuotaById(id,{silent:true});
  closeModal('modal-cuota');
  showToast('Cuota eliminada','info');
}
// ══ GASTOS FIJOS ══
function renderFixed(){
  renderCommitmentsPage();
}
function openNewFixedModal(){
  document.getElementById('modal-fixed-title').textContent='Nuevo gasto fijo';
  document.getElementById('modal-fixed-editing').value='';
  document.getElementById('fixed-name').value='';
  document.getElementById('fixed-amount').value='';
  document.getElementById('fixed-currency').value='ARS';
  document.getElementById('fixed-day').value='';
  initEmojiPicker('fixed','🏠');
  renderGenericColorPicker('fixed-color-picker','');
  document.getElementById('btn-del-fixed').style.display='none';
  openModal('modal-fixed');
}
function editFixed(id){
  const f=(state.fixedExpenses||[]).find(x=>x.id===id);if(!f)return;
  document.getElementById('modal-fixed-title').textContent='Editar gasto fijo';
  document.getElementById('modal-fixed-editing').value=id;
  document.getElementById('fixed-name').value=f.name;
  document.getElementById('fixed-amount').value=f.amount;
  document.getElementById('fixed-currency').value=f.currency||'ARS';
  document.getElementById('fixed-day').value=f.day||'';
  initEmojiPicker('fixed',f.emoji||'🏠');
  renderGenericColorPicker('fixed-color-picker',f.color||'');
  document.getElementById('btn-del-fixed').style.display='inline-flex';
  openModal('modal-fixed');
}
function saveFixed(){
  const name=document.getElementById('fixed-name').value.trim();
  const amount=parseFloat(document.getElementById('fixed-amount').value)||0;
  if(!name||amount<=0){showToast('⚠️ Completá nombre y monto');return;}
  const sw=document.querySelector('#fixed-color-picker .color-swatch.selected');const rawC=sw?sw.style.backgroundColor:'#888888';const fixedColor=rawC.startsWith('#')?rawC:rgbToHex(rawC);
  const obj={
    id:document.getElementById('modal-fixed-editing').value||Date.now().toString(36),
    name,amount,
    currency:document.getElementById('fixed-currency').value,
    day:parseInt(document.getElementById('fixed-day').value)||null,
    emoji:document.getElementById('fixed-emoji').value||'🏠',
    color:fixedColor
  };
  if(!state.fixedExpenses)state.fixedExpenses=[];
  const editing=document.getElementById('modal-fixed-editing').value;
  if(editing){const i=state.fixedExpenses.findIndex(x=>x.id===editing);if(i>=0)state.fixedExpenses[i]=obj;}
  else state.fixedExpenses.push(obj);
  saveState();closeModal('modal-fixed');
  renderFixed();renderCompromisosSummary();refreshAll();
  showToast('✓ Gasto fijo guardado');
}
function deleteFixed(){
  const id=document.getElementById('modal-fixed-editing').value;
  state.fixedExpenses=(state.fixedExpenses||[]).filter(f=>f.id!==id);
  saveState();closeModal('modal-fixed');
  renderFixed();renderCompromisosSummary();refreshAll();
  showToast('Gasto fijo eliminado');
}
function renderCompromisosSummary(){
  renderCommitmentsPage();
}

// ══ SUSCRIPCIONES ══
function renderSubs(){
  renderCommitmentsPage();
}
function openNewSubModal(){
  document.getElementById('modal-sub-title').textContent='Nueva suscripción';
  document.getElementById('modal-sub-editing').value='';
  document.getElementById('sub-name').value='';
  document.getElementById('sub-price').value='';document.getElementById('sub-day').value='';
  document.getElementById('sub-start-date').value='';
  document.getElementById('sub-currency').value='ARS';document.getElementById('sub-freq').value='monthly';
  document.getElementById('btn-del-sub').style.display='none';
  initEmojiPicker('sub','🔔');
  // Populate category dropdown
  let scOpts='';CATEGORY_GROUPS.forEach(g=>{scOpts+='<optgroup label="'+g.emoji+' '+g.group+'">';g.subs.forEach(s=>{scOpts+='<option value="'+s+'">'+s+'</option>';});scOpts+='</optgroup>';});
  document.getElementById('sub-cat').innerHTML=scOpts;
  renderSubColorPicker('');openModal('modal-sub');
}
function editSub(id){
  const s=state.subscriptions.find(x=>x.id===id);if(!s)return;
  document.getElementById('modal-sub-title').textContent='Editar suscripción';
  document.getElementById('modal-sub-editing').value=id;
  document.getElementById('sub-name').value=s.name;
  document.getElementById('sub-price').value=s.price;document.getElementById('sub-day').value=s.day||'';
  document.getElementById('sub-start-date').value=s.startDate||s.lastChargeDate||'';
  document.getElementById('sub-currency').value=s.currency||'ARS';document.getElementById('sub-freq').value=s.freq||'monthly';
  document.getElementById('sub-cat').value=s.cat||'Plataformas';
  document.getElementById('btn-del-sub').style.display='inline-flex';
  initEmojiPicker('sub',s.emoji||'●');
  renderSubColorPicker(s.color||'');openModal('modal-sub');
}
function renderSubColorPicker(sel){document.getElementById('sub-color-picker').innerHTML=PALETTE.map(c=>'<div class="color-swatch '+(c===sel?'selected':'')+'" style="background:'+c+'" onclick="selectSwatch(\''+c+'\',this,\'sub-color-picker\')"></div>').join('');}
function saveSub(){
  const name=document.getElementById('sub-name').value.trim();const price=parseFloat(document.getElementById('sub-price').value)||0;
  if(!name||price<=0){showToast('⚠️ Completá nombre y precio','error');return;}
  const sw=document.querySelector('#sub-color-picker .color-swatch.selected');const rawC=sw?sw.style.backgroundColor:'#888888';const color=rawC.startsWith('#')?rawC:rgbToHex(rawC);
  const obj={id:Date.now().toString(36),name,emoji:document.getElementById('sub-emoji').value||'🔔',price,currency:document.getElementById('sub-currency').value,freq:document.getElementById('sub-freq').value,day:parseInt(document.getElementById('sub-day').value)||null,startDate:document.getElementById('sub-start-date').value||null,cat:document.getElementById('sub-cat').value,color};
  const editing=document.getElementById('modal-sub-editing').value;
  if(editing){const i=state.subscriptions.findIndex(x=>x.id===editing);if(i>=0)state.subscriptions[i]={...state.subscriptions[i],...obj,id:editing};}
  else state.subscriptions.push(obj);
  syncProjectedSubscriptionTransactions();
  saveState();closeModal('modal-sub');renderSubs();refreshAll();showToast('✓ Suscripción guardada','success');
}
function deleteSub(){
  const id=document.getElementById('modal-sub-editing').value;
  deleteSubscriptionById(id,{silent:true});
  closeModal('modal-sub');
  showToast('Suscripción eliminada','info');
}

// ══ RENDER SUBS ANNUAL BREAKDOWN ══
