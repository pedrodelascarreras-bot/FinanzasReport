// ══ UTILS ══
function fmtN(n,dec){
  if(n==null||n===undefined||isNaN(n))return'—';
  const num=Number(n);
  if(isNaN(num))return'—';
  const d=dec!==undefined?dec:2;
  return num.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function fmtWeekLabel(k){const d=new Date(k+'T12:00:00');return d.getDate()+'/'+(d.getMonth()+1);}
function getWeekKey(d){const dt=new Date(d);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()-dt.getDay()+1);return dt.toISOString().split('T')[0];}
function getMonthKey(d){
  const dt=d instanceof Date?d:new Date(d);
  // Use local date parts to avoid UTC timezone shifting
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
}
function parseDate(raw){if(!raw)return null;const m=String(raw).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);if(m){const y=m[3].length===2?2000+parseInt(m[3]):parseInt(m[3]);return new Date(y,parseInt(m[2])-1,parseInt(m[1]));}const d=new Date(raw);return isNaN(d)?null:d;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function hasReachedEffectiveChargeDate(value,todayRef=new Date()){
  const ymd=dateToYMD(value);
  const todayYmd=dateToYMD(todayRef);
  return !!ymd && !!todayYmd && ymd<=todayYmd;
}
function hasRealCuotaChargeForInstallment(cuotaGroupId, cuotaNum, txns=state.transactions||[]){
  if(!cuotaGroupId || !cuotaNum) return false;
  return txns.some(txn=>
    !txn.isPendingCuota &&
    txn.cuotaGroupId===cuotaGroupId &&
    Number(txn.cuotaNum)===Number(cuotaNum)
  );
}
function hasRealCuotaChargeInMonth(cuotaGroupId, monthKey, txns=state.transactions||[]){
  if(!cuotaGroupId || !monthKey) return false;
  return txns.some(txn=>
    !txn.isPendingCuota &&
    txn.cuotaGroupId===cuotaGroupId &&
    getMonthKey(txn.date)===monthKey
  );
}
function getRecurringDatesInRange(day,start,end){
  if(!day||!start||!end) return [];
  const dates=[];
  const cursor=new Date(start.getFullYear(), start.getMonth(), 1);
  const limit=new Date(end.getFullYear(), end.getMonth(), 1);
  while(cursor<=limit){
    const maxDay=new Date(cursor.getFullYear(), cursor.getMonth()+1, 0).getDate();
    const date=new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, maxDay));
    if(date>=start&&date<=end) dates.push(date);
    cursor.setMonth(cursor.getMonth()+1);
  }
  return dates;
}
function getProjectedCommitmentEntriesForRange(opts={}){
  const startStr=opts.startStr||'';
  const endStr=opts.endStr||'';
  if(!startStr||!endStr) return [];
  const todayRef=opts.todayRef instanceof Date?opts.todayRef:new Date();
  const sourceTxns=Array.isArray(opts.txns)?opts.txns:(state.transactions||[]);
  const start=new Date(startStr+'T00:00:00');
  const end=new Date(endStr+'T23:59:59');
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end) return [];
  const entries=[];
  const entryKeys=new Set();
  const dismissedEntries=new Set(state.dismissedCommitmentEntries||[]);
  const addEntry=(key,obj)=>{
    if(!key||entryKeys.has(key)||dismissedEntries.has(key)) return;
    entryKeys.add(key);
    entries.push({_key:key,...obj});
  };
  const addAmountTone=settled=>settled ? '#34c759' : '#ff9500';
  const inRange=d=>{
    const dt=d instanceof Date?new Date(d):new Date(String(d).includes('T')?d:(String(d)+'T12:00:00'));
    return !Number.isNaN(dt.getTime())&&dt>=start&&dt<=end;
  };

  sourceTxns.filter(t=>(t.isPendingCuota||t.isPendingSubscription)&&inRange(t.date)).forEach(t=>{
    if(t.isPendingCuota){
      const monthKey=getMonthKey(t.date);
      if(
        hasRealCuotaChargeForInstallment(t.cuotaGroupId, t.cuotaNum, sourceTxns) ||
        hasRealCuotaChargeInMonth(t.cuotaGroupId, monthKey, sourceTxns)
      ) return;
    }
    if(t.isPendingSubscription && t.sourceSubscriptionId){
      const sub=(state.subscriptions||[]).find(s=>s.id===t.sourceSubscriptionId);
      const monthKey=getMonthKey(t.date);
      if(sub && typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[])) return;
    }
    const matured=hasReachedEffectiveChargeDate(t.date,todayRef);
    const key=t.isPendingCuota?`cuota-${t.cuotaGroupId}-${t.cuotaNum}`:`sub-${t.sourceSubscriptionId||t.id}`;
    addEntry(key,{
      date:t.date,
      title:t._baseDesc||t.description,
      amount:Number(t.amount)||0,
      personalAmount:typeof getTxnPersonalAmount==='function'?getTxnPersonalAmount(t):(Number(t.amount)||0),
      currency:t.currency||'ARS',
      payMethod:t.payMethod||'',
      sourceTxnId:t.id||null,
      sourceSubscriptionId:t.sourceSubscriptionId||null,
      cuotaGroupId:t.cuotaGroupId||null,
      cuotaNum:t.cuotaNum||null,
      group:t.isPendingCuota?'cuotas':'suscripciones',
      kind:t.isPendingCuota?'Cuota proyectada':'Suscripción proyectada',
      meta:t.isPendingCuota?`Cuota ${t.cuotaNum}/${t.cuotaTotal}`:'Próximo cobro',
      includeInTotal:matured,
      synthetic:false,
      isSettled:matured,
      tone:addAmountTone(matured)
    });
  });

  if(typeof detectAutoCuotas==='function' && typeof getAutoCuotaSnapshot==='function'){
    detectAutoCuotas().forEach(group=>{
      const snap=getAutoCuotaSnapshot(group, new Date(Math.min(todayRef.getTime(), end.getTime())));
      if(!snap || snap.rem<=0) return;
      const dueDay=snap.cfg?.day||snap.scheduleDay||null;
      if(!dueDay) return;
      getRecurringDatesInRange(dueDay,start,end).forEach(dueDate=>{
        const monthKey=getMonthKey(dueDate);
        const groupId=group.transactions[0]?.cuotaGroupId||null;
        if(groupId && hasRealCuotaChargeInMonth(groupId, monthKey, sourceTxns)) return;
        const matured=hasReachedEffectiveChargeDate(dueDate,todayRef);
        const cuotaIndex=Math.min(snap.total, Math.max(1, matured ? snap.paid : snap.paid+1));
        addEntry(`auto-${group.key}-${dateToYMD(dueDate)}`,{
          date:dueDate,
          title:group.displayName||group.name,
          amount:Number(snap.amountPerCuota)||0,
          currency:group.currency||'ARS',
          payMethod:group.payMethod||'',
          sourceAutoCuotaKey:group.key,
          cuotaGroupId:group.transactions[0]?.cuotaGroupId||null,
          group:'cuotas',
          kind:'Cuota del ciclo',
          meta:`Cuota ${cuotaIndex}/${snap.total}`,
          includeInTotal:matured,
          synthetic:true,
          isSettled:matured,
          tone:addAmountTone(matured)
        });
      });
    });
  }

  (state.cuotas||[]).forEach(c=>{
    const remaining = Math.max(0, (Number(c.total)||0) - (Number(c.paid)||0));
    if(remaining <= 0 || !c.day) return;
    // CAP: never emit more dates than there are unpaid cuotas left.
    const allDates = getRecurringDatesInRange(c.day, start, end);
    const cappedDates = allDates.slice(0, remaining);
    // Helper: skip if a real (non-pending) txn already covers this cuota for the month.
    // 3 strategies tried in order — first to match wins:
    //   1) cuotaGroupId (most reliable — auto-import linked the manual cuota to the txn)
    //   2) sourceTxnId (explicit link in the manual cuota record)
    //   3) name + amount (fuzzy fallback for legacy cases)
    const cuotaNameNorm = String(c.name||'').toLowerCase().trim();
    const cuotaAmt = Number(c.amount)||0;
    const matchingRealInMonth = (monthKey)=>{
      // Strategy 1: cuotaGroupId match
      if (c.cuotaGroupId) {
        const groupMatch = sourceTxns.some(t=>{
          if(t.isPendingCuota || t.isPendingSubscription) return false;
          const tMonth = t.month || getMonthKey(t.date);
          if(tMonth !== monthKey) return false;
          return t.cuotaGroupId === c.cuotaGroupId;
        });
        if (groupMatch) return true;
      }
      // Strategy 2: explicit sourceTxnId on manual cuota
      if (c.sourceTxnId) {
        const idMatch = sourceTxns.some(t=>{
          if(t.isPendingCuota || t.isPendingSubscription) return false;
          if (t.id !== c.sourceTxnId) return false;
          const tMonth = t.month || getMonthKey(t.date);
          return tMonth === monthKey;
        });
        if (idMatch) return true;
      }
      // Strategy 3: name + amount fuzzy match (fallback)
      if(!cuotaNameNorm) return false;
      return sourceTxns.some(t=>{
        if(t.isPendingCuota || t.isPendingSubscription) return false;
        const tMonth = t.month || getMonthKey(t.date);
        if(tMonth !== monthKey) return false;
        const desc = String(t.description||t._baseDesc||t.comercio_detectado||'').toLowerCase();
        if(!desc.includes(cuotaNameNorm) && !cuotaNameNorm.includes(desc.split(' ')[0]||'__')) return false;
        const amt = Math.abs(Number(t.amount)||0);
        return cuotaAmt>0 && Math.abs(amt - cuotaAmt) / cuotaAmt < 0.05;
      });
    };
    cappedDates.forEach((dueDate, dateIdx)=>{
      const monthKey = getMonthKey(dueDate);
      if(matchingRealInMonth(monthKey)) return;
      const matured=hasReachedEffectiveChargeDate(dueDate,todayRef);
      const cuotaIndex = Math.min(c.total, (Number(c.paid)||0) + dateIdx + 1);
      addEntry(`manual-${c.id}-${dateToYMD(dueDate)}`,{
        date:dueDate,
        title:c.name,
        amount:cuotaAmt,
        currency:c.currency||'ARS',
        payMethod:c.payMethod||'',
        sourceManualCuotaId:c.id,
        cuotaGroupId:c.cuotaGroupId||null,   // expose for downstream dedup
        group:'cuotas',
        kind:'Cuota manual',
        meta:`Cuota ${cuotaIndex}/${c.total}`,
        includeInTotal:matured,
        synthetic:true,
        isSettled:matured,
        tone:addAmountTone(matured)
      });
    });
  });

  (state.subscriptions||[]).filter(s=>s.active!==false&&s.freq==='monthly'&&s.day).forEach(s=>{
    getRecurringDatesInRange(s.day,start,end).forEach(dueDate=>{
      if(s.startDate){
        const startDate=new Date(s.startDate+'T00:00:00');
        if(dueDate<startDate) return;
      }
      const matured=hasReachedEffectiveChargeDate(dueDate,todayRef);
      const monthKey=getMonthKey(dueDate);
      if(typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(s, monthKey, state.transactions||[])) return;
      addEntry(`sub-cycle-${s.id}-${dateToYMD(dueDate)}`,{
        date:dueDate,
        title:s.name,
        amount:Number(s.price)||0,
        currency:s.currency||'ARS',
        payMethod:s.payMethod||'',
        sourceSubscriptionId:s.id,
        group:'suscripciones',
        kind:'Suscripción',
        meta:`Cobro mensual · día ${s.day}`,
        includeInTotal:matured,
        synthetic:true,
        isSettled:matured,
        tone:addAmountTone(matured)
      });
    });
  });

  (state.fixedExpenses||[]).filter(f=>f.day).forEach(f=>{
    getRecurringDatesInRange(f.day,start,end).forEach(dueDate=>{
      const matured=hasReachedEffectiveChargeDate(dueDate,todayRef);
      addEntry(`fixed-cycle-${f.id||f.name}-${dateToYMD(dueDate)}`,{
        date:dueDate,
        title:f.name,
        amount:Number(f.amount)||0,
        currency:f.currency||'ARS',
        payMethod:f.payMethod||'',
        group:'fijos',
        kind:'Gasto fijo',
        meta:`Débito mensual · día ${f.day}`,
        includeInTotal:matured,
        synthetic:true,
        isSettled:matured,
        tone:addAmountTone(matured)
      });
    });
  });

  return entries.sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function sumProjectedCommitmentTotals(entries=[]){
  // Uses personalAmount if available (so shared expenses don't double-count),
  // falls back to full amount for synthetic entries (subs/cuotas projected w/o source txn)
  return entries.reduce((acc,entry)=>{
    if(!entry?.includeInTotal) return acc;
    const amt = (entry.personalAmount != null) ? Number(entry.personalAmount) : (Number(entry.amount)||0);
    if((entry.currency||'ARS')==='USD') acc.usd+=amt;
    else acc.ars+=amt;
    acc.count++;
    return acc;
  },{ars:0,usd:0,count:0});
}
function updateSidebarStats(){/* sidebar stats removed */}
let _toastHideTimer=null;
function hideToast(immediate=false){
  const t=document.getElementById('toast');
  if(!t) return;
  if(_toastHideTimer){
    clearTimeout(_toastHideTimer);
    _toastHideTimer=null;
  }
  const finish=()=>{
    t.classList.remove('show');
    t.style.opacity='';
    t.style.transform='';
    t.style.pointerEvents='none';
  };
  if(immediate){
    if(typeof gsap!=='undefined') gsap.killTweensOf(t);
    finish();
    return;
  }
  if(typeof gsap!=='undefined'){
    gsap.killTweensOf(t);
    gsap.to(t,{
      opacity:0,
      y:18,
      duration:0.22,
      ease:'power2.in',
      overwrite:'auto',
      onComplete:finish
    });
    return;
  }
  finish();
}
function showToast(msg,type='info'){
  const t=document.getElementById('toast');
  if(!t) return;
  hideToast(true);
  t.textContent=msg;
  t.className='toast '+type;
  t.style.pointerEvents='none';
  requestAnimationFrame(()=>{
    t.classList.add('show');
    if(typeof gsap!=='undefined'){
      gsap.killTweensOf(t);
      gsap.fromTo(t,{opacity:0,y:14},{opacity:1,y:0,duration:0.28,ease:'power2.out',overwrite:'auto'});
    }
  });
  _toastHideTimer=setTimeout(()=>hideToast(false),2600);
}
const _animFrameMap=new WeakMap();
function prefersReducedMotion(){
  return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function animateNumberText(el,value,opts={}){
  if(!el)return;
  const num=Number(value);
  const formatter=typeof opts.formatter==='function'?opts.formatter:(n=>`${opts.prefix||''}${fmtN(n,opts.decimals)}${opts.suffix||''}`);
  if(!isFinite(num)){el.textContent=opts.fallback??'—';return;}
  if(prefersReducedMotion()){el.textContent=formatter(num);return;}
  const prev=_animFrameMap.get(el);
  if(prev)cancelAnimationFrame(prev);
  const duration=opts.duration||820;
  const easing=opts.easing||((t)=>1-Math.pow(1-t,4));
  const start=performance.now();
  const from=Number.isFinite(opts.from)?Number(opts.from):0;
  const tick=(now)=>{
    const progress=Math.min(1,(now-start)/duration);
    const eased=easing(progress);
    const current=from+((num-from)*eased);
    el.textContent=formatter(current);
    if(progress<1){
      _animFrameMap.set(el,requestAnimationFrame(tick));
    }else{
      el.textContent=formatter(num);
      _animFrameMap.delete(el);
    }
  };
  _animFrameMap.set(el,requestAnimationFrame(tick));
}
function cancelNumberTextAnimation(el){
  if(!el)return;
  const prev=_animFrameMap.get(el);
  if(prev)cancelAnimationFrame(prev);
  _animFrameMap.delete(el);
}
function animateProgressBar(el,targetPct){
  if(!el)return;
  const pct=Math.max(0,Math.min(100,Number(targetPct)||0));
  if(prefersReducedMotion()){el.style.width=pct+'%';return;}
  el.style.transition='width 760ms var(--ease-premium)';
  el.style.width='0%';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.width=pct+'%';}));
}
function animateDonutStroke(el,targetPct,radius=38){
  if(!el)return;
  const pct=Math.max(0,Math.min(100,Number(targetPct)||0));
  const circumference=2*Math.PI*radius;
  if(prefersReducedMotion()){
    el.style.strokeDasharray=`${circumference}`;
    el.style.strokeDashoffset=`${circumference-(pct/100)*circumference}`;
    return;
  }
  el.style.transition='stroke-dashoffset 820ms var(--ease-premium), stroke var(--dur-med) var(--ease-premium)';
  el.style.strokeDasharray=`${circumference}`;
  el.style.strokeDashoffset=`${circumference}`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.strokeDashoffset=`${circumference-(pct/100)*circumference}`;
  }));
}
function getFadeDelay(el,idx){
  if(el.classList.contains('d1'))return 70;
  if(el.classList.contains('d2'))return 130;
  if(el.classList.contains('d3'))return 190;
  if(el.classList.contains('d4'))return 250;
  return idx*68;
}
function replayFadeUp(scope){
  const root=typeof scope==='string'?document.querySelector(scope):scope;
  if(!root)return;
  const nodes=[...root.querySelectorAll('.fade-up')];
  nodes.forEach((el,idx)=>{
    el.style.animation='none';
    el.style.opacity='1';
    el.style.transform='none';
    el.style.setProperty('--stagger-delay',`${getFadeDelay(el,idx)}ms`);
  });
}
function animatePageEnter(pageEl){
  if(!pageEl)return;
  pageEl.classList.remove('page-enter');
  replayFadeUp(pageEl);
}
/* iOS scroll-lock helpers */
let _iosOvCnt=0,_iosSY=0;
function _iosLock(){if(++_iosOvCnt===1){_iosSY=window.scrollY;document.body.style.overflow='hidden';document.body.style.position='fixed';document.body.style.top=(-_iosSY)+'px';document.body.style.width='100%';}}
function _iosUnlock(){if(--_iosOvCnt<=0){_iosOvCnt=0;document.body.style.overflow='';document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo(0,_iosSY);}}
function openModal(id){document.getElementById(id).classList.add('open');_iosLock();}
function closeModal(id){document.getElementById(id).classList.remove('open');_iosUnlock();}
function chartOpts(prefix,legend){const _tt=typeof _chartTooltip==='function'?_chartTooltip():{};const _tc=typeof _chartTickColor==='function'?_chartTickColor():(_isL()?'#748096':'#566172');const _tf=typeof _chartTickFont==='function'?_chartTickFont():{size:10,weight:'500',family:'-apple-system,SF Pro Display,sans-serif'};const _gy=typeof _chartGridY==='function'?_chartGridY():{color:_isL()?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.03)',drawBorder:false};return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:legend,labels:{color:'#8e8e93',font:{size:11},boxWidth:12}},tooltip:{..._tt,callbacks:{label:ctx=>' '+prefix+fmtN(ctx.parsed.y!=null?ctx.parsed.y:ctx.parsed)+' ARS'}}},scales:{x:{grid:{display:false},ticks:{color:_tc,font:_tf}},y:{grid:_gy,ticks:{color:_tc,font:_tf,callback:v=>'$'+fmtN(v)}}}};}

// ══ SHARED EXPENSE HELPERS ══
// Returns the personal (user's own) portion of a transaction amount.
// For shared expenses, this is sharedExpense.myAmount.
// For all others, this is the full t.amount.
function getTxnPersonalAmount(t) {
  if (t && t.sharedExpense && t.sharedExpense.enabled && typeof t.sharedExpense.myAmount === 'number') {
    return t.sharedExpense.myAmount;
  }
  return Number(t && t.amount) || 0;
}

// Returns summary of who owes the user money across given transactions.
// Groups splits by person name.
function getSharedExpenseSummary(txns) {
  const byPerson = {};
  (txns || []).forEach(t => {
    if (!t.sharedExpense || !t.sharedExpense.enabled) return;
    (t.sharedExpense.splits || []).forEach(s => {
      const name = s.name || 'Persona';
      if (!byPerson[name]) byPerson[name] = { name, pendingArs: 0, cobradoArs: 0, count: 0, cobradoCount: 0 };
      const amt = Number(s.amount) || 0;
      if (s.status === 'cobrado') {
        byPerson[name].cobradoArs += amt;
        byPerson[name].cobradoCount++;
      } else {
        byPerson[name].pendingArs += amt;
        byPerson[name].count++;
      }
    });
  });
  return Object.values(byPerson).sort((a, b) => b.pendingArs - a.pendingArs);
}

// ══ SIDEBAR TOGGLE ══
function toggleMobMore(){
  const m=document.getElementById('mob-more-menu');
  if(m)m.style.display=m.style.display==='none'?'block':'none';
}
function closeMobMore(){
  const m=document.getElementById('mob-more-menu');
  if(m)m.style.display='none';
}
function syncSidebarControls(){
  const app=document.querySelector('.app');
  const collapsed=!!app?.classList.contains('sidebar-collapsed');
  const btn=document.querySelector('.sidebar-toggle');
  if(btn){
    btn.textContent=collapsed?'›':'‹';
    btn.title=collapsed?'Expandir menú':'Ocultar menú';
    btn.setAttribute('aria-label',collapsed?'Expandir menú':'Ocultar menú');
  }
  const openBtn=document.getElementById('sidebar-open-btn');
  if(openBtn)openBtn.style.display='none';
}
function toggleSidebar(){
  const app=document.querySelector('.app');
  const collapsed=app.classList.toggle('sidebar-collapsed');
  localStorage.setItem('fin_sidebar',collapsed?'collapsed':'open');
  syncSidebarControls();
}
window.addEventListener('load',()=>{
  const active=document.querySelector('.page.active');
  if(active)animatePageEnter(active);
});
function loadSidebar(){
  const app=document.querySelector('.app');
  // Compacto por defecto (rail con hover-to-peek); solo queda abierto si el usuario lo fijó así a mano.
  const pinnedOpen=localStorage.getItem('fin_sidebar')==='open';
  if(app)app.classList.toggle('sidebar-collapsed',!pinnedOpen);
  syncSidebarControls();
}

// ══ COLOR THEMES ══
const COLOR_THEMES = [
  { id:'blue',    label:'Azul',    color:'#2997ff', colorLight:'#0071e3' },
  { id:'purple',  label:'Violeta', color:'#bf5af2', colorLight:'#7d3aec' },
  { id:'emerald', label:'Verde',   color:'#30d158', colorLight:'#1c8c3b' },
  { id:'rose',    label:'Rosa',    color:'#ff375f', colorLight:'#c9193b' },
  { id:'amber',   label:'Ámbar',   color:'#ff9f0a', colorLight:'#c96a00' },
  { id:'indigo',  label:'Índigo',  color:'#5e5ce6', colorLight:'#3634a3' },
];

function applyColorTheme(themeId) {
  // Remove all theme classes
  COLOR_THEMES.forEach(t => document.body.classList.remove('theme-' + t.id));
  if(themeId && themeId !== 'blue') document.body.classList.add('theme-' + themeId);
  localStorage.setItem('fin_color_theme', themeId || 'blue');
  // Update dot color in button
  const isLight = document.body.classList.contains('light-mode');
  const theme = COLOR_THEMES.find(t => t.id === themeId) || COLOR_THEMES[0];
  const dot = document.getElementById('color-theme-dot');
  if(dot) dot.style.background = isLight ? theme.colorLight : theme.color;
  // Refresh active swatches if panel is open
  document.querySelectorAll('.ctp-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === themeId);
  });
}

function loadColorTheme() {
  const saved = localStorage.getItem('fin_color_theme') || 'blue';
  applyColorTheme(saved);
}

function toggleColorThemePanel() {
  const existing = document.getElementById('color-theme-panel');
  if(existing) { existing.remove(); return; }

  const currentTheme = localStorage.getItem('fin_color_theme') || 'blue';
  const isLight = document.body.classList.contains('light-mode');

  const panel = document.createElement('div');
  panel.id = 'color-theme-panel';
  panel.innerHTML = `
    <div class="ctp-title">Color de la app</div>
    <div class="ctp-grid">
      ${COLOR_THEMES.map(t => `
        <div class="ctp-swatch ${t.id === currentTheme ? 'active' : ''}" data-theme="${t.id}" onclick="applyColorTheme('${t.id}')">
          <div class="ctp-swatch-dot" style="background:${isLight ? t.colorLight : t.color};"></div>
          <span>${t.label}</span>
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(panel);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if(!panel.contains(e.target) && e.target.id !== 'color-theme-btn') {
        panel.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 50);
}

// ══ THEME TOGGLE ══
function toggleTheme(){
  const isLight=document.body.classList.toggle('light-mode');
  state.theme=isLight?'light':'dark';
  localStorage.setItem('fin_theme',state.theme);
  if(state.userPrefs) state.userPrefs.theme=state.theme;
  const themeIcon=document.getElementById('theme-icon');
  const themeLabel=document.getElementById('theme-label');
  if(themeIcon) themeIcon.textContent=isLight?'🌙':'☀️';
  if(themeLabel) themeLabel.textContent=isLight?'Oscuro':'Claro';
  syncThemeModeButtons();
  // Rebuild charts with new colors
  if(state.transactions.length){
    Chart.defaults.plugins.tooltip.backgroundColor = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(44,44,46,0.95)';
    renderDashboard();
    if(document.getElementById('page-tendencia').classList.contains('active'))renderTendencia();
    if(document.getElementById('page-compare').classList.contains('active'))renderCompare();
    if(document.getElementById('page-balance')?.classList.contains('active') && typeof renderBalancePage==='function')renderBalancePage();
    if(document.getElementById('page-cuotas').classList.contains('active')){renderCuotas();renderSubs();renderFixed();renderCompromisosSummary();}
    if(document.getElementById('page-income').classList.contains('active'))renderIncomePage();
    if(document.getElementById('page-savings').classList.contains('active'))renderSavingsPage();
  }
}
function syncThemeModeButtons(){
  const isLight=document.body.classList.contains('light-mode');
  const lightBtn=document.getElementById('theme-mode-light');
  const darkBtn=document.getElementById('theme-mode-dark');
  const railLightBtn=document.getElementById('rail-theme-light');
  const railDarkBtn=document.getElementById('rail-theme-dark');
  if(lightBtn) lightBtn.classList.toggle('active', isLight);
  if(darkBtn) darkBtn.classList.toggle('active', !isLight);
  if(railLightBtn) railLightBtn.classList.toggle('active', isLight);
  if(railDarkBtn) railDarkBtn.classList.toggle('active', !isLight);
}
function syncRailSidebarState(opts={}){
  const gmailBtn=document.getElementById('rail-gmail-btn');
  if(gmailBtn){
    const status=opts.gmailStatus || 'idle';
    gmailBtn.classList.toggle('connected', status==='connected' || status==='done');
    gmailBtn.classList.toggle('syncing', status==='syncing');
    gmailBtn.title=status==='connected' || status==='done'
      ? 'Gmail conectado'
      : status==='syncing'
        ? 'Gmail sincronizando'
        : 'Conectar o sincronizar Gmail';
  }
  syncThemeModeButtons();
}
function setThemeMode(mode){
  const wantLight=mode==='light';
  const isLight=document.body.classList.contains('light-mode');
  if(wantLight!==isLight) toggleTheme();
  else syncThemeModeButtons();
}
function loadTheme(){
  const saved=localStorage.getItem('fin_theme')||'light';
  if(saved==='light'){
    document.body.classList.add('light-mode');
    const themeIcon=document.getElementById('theme-icon');
    const themeLabel=document.getElementById('theme-label');
    if(themeIcon) themeIcon.textContent='🌙';
    if(themeLabel) themeLabel.textContent='Oscuro';
    if(typeof Chart!=='undefined')Chart.defaults.plugins.tooltip.backgroundColor='rgba(255,255,255,0.95)';
  }
  syncRailSidebarState();
}
