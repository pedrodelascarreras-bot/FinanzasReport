// ══ TENDENCIA (REDESIGNED) ══
function toggleBreakdown(id){
  const el=document.getElementById(id);
  const chev=document.getElementById(id+'-chevron');
  if(!el)return;
  const open=el.style.display!=='none';
  el.style.display=open?'none':'block';
  if(chev)chev.style.transform=open?'rotate(0deg)':'rotate(90deg)';
}
function tendChartAnim(){
  return {
    duration: 520,
    easing: 'easeOutQuart'
  };
}
function animateTendCanvas(canvas){
  if(!canvas || typeof gsap==='undefined') return;
  gsap.killTweensOf(canvas);
  gsap.fromTo(canvas,
    { opacity: 0.72, scaleY: 0.92, y: 8, transformOrigin: '50% 100%' },
    { opacity: 1, scaleY: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform,opacity' }
  );
}
function setTendMode(m){
  state.tendMode=normalizeViewMode(m);
  document.getElementById('tend-tog-mes')?.classList.toggle('active',state.tendMode==='mes');
  document.getElementById('tend-tog-visa')?.classList.toggle('active',state.tendMode==='visa');
  renderTendencia();
}
function getTendPeriodKeys(){
  const mode=normalizeViewMode(state.tendMode||'visa');
  if(mode!=='mes'){
    const cycles=getTcCycles(mode).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
    return cycles.map(c=>c.id);
  }
  const range=typeof getViewWindowRange==='function'
    ? getViewWindowRange()
    : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
  return[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))]
    .filter(m=>m>=range.startMonthKey&&m<=range.currentMonthKey)
    .sort();
}
function getTendPeriodLabel(k){
  const mode=normalizeViewMode(state.tendMode||'visa');
  if(mode!=='mes'){
    const cycle=getTcCycles(mode).find(c=>c.id===k);
    return cycle?cycle.label||cycle.closeDate:k;
  }
  const[y,m]=k.split('-');return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'});
}
function getTcCycleTrendTxns(cycle, cycles){
  if(!cycle) return [];
  const baseTxns=getTcCycleTxns(cycle,cycles);
  const todayRef=new Date();
  todayRef.setHours(23,59,59,999);
  const todayYmd=dateToYMD(todayRef);
  const hasReachedChargeDate=value=>{
    const ymd=dateToYMD(value);
    return !!ymd && ymd<=todayYmd;
  };
  const getRecurringDatesInRange=(day,start,end)=>{
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
  };
  const openDate=new Date((getTcCycleOpen(cycles, cycles.findIndex(c=>c.id===cycle.id))||cycle.closeDate)+'T00:00:00');
  const closeDate=new Date(cycle.closeDate+'T23:59:59');
  const extras=[];
  const extraKeys=new Set();
  const pushExtra=(key,obj)=>{
    if(!key||extraKeys.has(key)) return;
    extraKeys.add(key);
    extras.push(obj);
  };

  (state.transactions||[]).filter(t=>(t.isPendingCuota||t.isPendingSubscription)).forEach(t=>{
    if(!hasReachedChargeDate(t.date)) return;
    const d=new Date(String(t.date).includes('T')?t.date:(String(t.date)+'T12:00:00'));
    if(d<openDate||d>closeDate) return;
    if(t.isPendingSubscription && t.sourceSubscriptionId){
      const sub=(state.subscriptions||[]).find(s=>s.id===t.sourceSubscriptionId);
      const monthKey=getMonthKey(t.date);
      if(sub && typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[])) return;
    }
    const key=t.isPendingCuota?`cuota-${t.cuotaGroupId}-${t.cuotaNum}`:`sub-${t.sourceSubscriptionId||t.id}`;
    pushExtra(key,{
      id:`trend-pending-${key}`,
      date:t.date,
      amount:t.amount,
      currency:t.currency||'ARS',
      category:t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'?t.category:'Finanzas',
      isSyntheticCommitment:true
    });
  });

  if(typeof detectAutoCuotas==='function' && typeof getAutoCuotaSnapshot==='function'){
    detectAutoCuotas().forEach(g=>{
      const snap=getAutoCuotaSnapshot(g, new Date(Math.min(todayRef.getTime(), closeDate.getTime())));
      if(!snap || snap.rem<=0) return;
      const dueDay=snap.cfg?.day||snap.scheduleDay||null;
      if(!dueDay) return;
      const fallbackCategory=g.transactions?.find(t=>t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized')?.category||'Finanzas';
      getRecurringDatesInRange(dueDay, openDate, closeDate).forEach(dueDate=>{
        if(!hasReachedChargeDate(dueDate)) return;
        pushExtra(`auto-${g.key}-${dateToYMD(dueDate)}`,{
          id:`trend-auto-${g.key}-${dateToYMD(dueDate)}`,
          date:dueDate,
          amount:snap.amountPerCuota,
          currency:g.currency||'ARS',
          category:fallbackCategory,
          isSyntheticCommitment:true
        });
      });
    });
  }

  (state.cuotas||[]).forEach(c=>{
    if(c.paid>=c.total || !c.day) return;
    getRecurringDatesInRange(c.day, openDate, closeDate).forEach(dueDate=>{
      if(!hasReachedChargeDate(dueDate)) return;
      pushExtra(`manual-${c.id}-${dateToYMD(dueDate)}`,{
        id:`trend-manual-${c.id}-${dateToYMD(dueDate)}`,
        date:dueDate,
        amount:c.amount,
        currency:'ARS',
        category:'Finanzas',
        isSyntheticCommitment:true
      });
    });
  });

  (state.subscriptions||[]).filter(s=>s.active!==false&&s.freq==='monthly'&&s.day).forEach(s=>{
    getRecurringDatesInRange(s.day, openDate, closeDate).forEach(dueDate=>{
      if(!hasReachedChargeDate(dueDate)) return;
      const monthKey=getMonthKey(dueDate);
      if(typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(s, monthKey, state.transactions||[])) return;
      pushExtra(`sub-${s.id}-${dateToYMD(dueDate)}`,{
        id:`trend-sub-${s.id}-${dateToYMD(dueDate)}`,
        date:dueDate,
        amount:s.price,
        currency:s.currency||'ARS',
        category:'Finanzas',
        isSyntheticCommitment:true
      });
    });
  });

  (state.fixedExpenses||[]).filter(f=>f.day).forEach(f=>{
    getRecurringDatesInRange(f.day, openDate, closeDate).forEach(dueDate=>{
      if(!hasReachedChargeDate(dueDate)) return;
      pushExtra(`fixed-${f.id||f.name}-${dateToYMD(dueDate)}`,{
        id:`trend-fixed-${f.id||f.name}-${dateToYMD(dueDate)}`,
        date:dueDate,
        amount:f.amount,
        currency:f.currency||'ARS',
        category:'Finanzas',
        isSyntheticCommitment:true
      });
    });
  });

  return [...baseTxns, ...extras];
}
function getTxnsForTendPeriod(k){
  const mode=normalizeViewMode(state.tendMode||'visa');
  if(mode!=='mes'){
    const cycles=getTcCycles(mode);
    const cycle=cycles.find(c=>c.id===k);
    return cycle?getTcCycleTrendTxns(cycle,cycles):[];
  }
  return state.transactions.filter(t=>(t.month||getMonthKey(t.date))===k);
}
function toggleTendCat(cat){
  if(state.activeTendCats.has(cat))state.activeTendCats.delete(cat);
  else state.activeTendCats.add(cat);
  renderTendencia();
}
// ─ In-memory UI state (not persisted)
if(!state.tendChartToggle) state.tendChartToggle='acumulado';
if(!state.tendRankingTab)  state.tendRankingTab='monto';

function _normTendChartMode(m){
  if(m==='evo'||m==='ranking'||m==='compare') return m;
  if(m==='line') return 'evo';
  if(m==='bar'||m==='treemap') return 'ranking';
  return 'evo';
}

// Stored refs for partial re-renders
let _tendChartState=null;
let _tendRankingState=null;

// ─ Toggle daily/cumulative
function setTendChartToggle(t){
  state.tendChartToggle=t;
  document.getElementById('tend-tog-dia')?.classList.toggle('active',t==='dia');
  document.getElementById('tend-tog-acum')?.classList.toggle('active',t==='acumulado');
  if(_tendChartState) _tend_drawChart();
}

// ─ Ranking tab
function setTendRankingTab(t){
  state.tendRankingTab=t;
  ['monto','anterior','participacion'].forEach(x=>{
    const id=x==='participacion'?'rank-tab-pct':'rank-tab-'+x;
    document.getElementById(id)?.classList.toggle('active',x===t);
  });
  _tend_drawRanking();
}

// ─ Chart view (evo / ranking / compare)
function setTendChartMode(m){
  if(m==='evo'&&normalizeViewMode(state.tendMode||'visa')!=='mes'){
    state.tendMode='mes';
  }
  state.tendChartMode=_normTendChartMode(m);
  saveState();
  renderTendencia();
}

// ─ Build daily array for a cycle (by relative day)
function _tend_cycleDailyData(txns,openStr,closeStr){
  const openD=new Date(openStr+'T00:00:00');
  const closeD=new Date(closeStr+'T23:59:59');
  const days=Math.max(Math.round((closeD-openD)/(864e5))+1,1);
  const byDay={};
  txns.forEach(t=>{
    const td=t.date instanceof Date?t.date:new Date(t.date);
    const rel=Math.round((td-openD)/864e5);
    if(rel>=0&&rel<days) byDay[rel]=(byDay[rel]||0)+t.amount;
  });
  return Array.from({length:days},(_,i)=>byDay[i]||0);
}

// ─ Build daily array for a month (by calendar day)
function _tend_monthDailyData(txns,monthKey){
  const[y,m]=monthKey.split('-').map(Number);
  const days=new Date(y,m,0).getDate();
  const byDay={};
  txns.forEach(t=>{
    const td=t.date instanceof Date?t.date:new Date(t.date);
    byDay[td.getDate()]=(byDay[td.getDate()]||0)+t.amount;
  });
  return Array.from({length:days},(_,i)=>byDay[i+1]||0);
}

function _tend_cumulative(arr){let s=0;return arr.map(v=>s+=v);}

function _tend_pctLabel(value){
  const pct=Number(value)||0;
  if(pct>=10) return Math.round(pct)+'%';
  if(pct>=1) return pct.toFixed(1)+'%';
  return pct>0?pct.toFixed(2)+'%':'0%';
}

function _tend_pctWidth(value){
  const pct=Number(value)||0;
  if(pct<=0) return 0;
  return Math.max(Math.min(pct,100),2);
}

function _tend_shareGradient(items){
  if(!items.length) return 'rgba(148,163,184,0.18)';
  let cursor=0;
  const stops=items.map(item=>{
    const start=cursor;
    cursor=Math.min(cursor+item.pct,100);
    return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  if(cursor<100) stops.push(`rgba(148,163,184,0.18) ${cursor.toFixed(2)}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

function _tend_renderMonthlyShare(customEl,currentLabel,grandTotal,sortedParents,parentSubTotals){
  if(!customEl) return;
  const categories=sortedParents.map(([parent,amount])=>{
    const grp=CATEGORY_GROUPS.find(g=>g.group===parent);
    const subEntries=Object.entries(parentSubTotals?.[parent]||{})
      .filter(([,value])=>value>0)
      .sort((a,b)=>b[1]-a[1])
      .map(([name,value])=>({
        name,
        amount:value,
        pctOfCategory:amount>0?(value/amount)*100:0,
        pctOfTotal:grandTotal>0?(value/grandTotal)*100:0
      }));
    return {
      parent,
      amount,
      pct:grandTotal>0?(amount/grandTotal)*100:0,
      color:grp?.color||'#888888',
      emoji:grp?.emoji||'•',
      subEntries
    };
  }).filter(item=>item.amount>0);

  if(!categories.length){
    customEl.innerHTML='<div class="tend-share-empty">No hay gasto suficiente para mostrar participaciones este mes.</div>';
    return;
  }

  const topCategory=categories[0];
  const topSub=topCategory.subEntries[0]||null;
  const topThreePct=categories.slice(0,3).reduce((sum,item)=>sum+item.pct,0);
  const gradient=_tend_shareGradient(categories);
  const pills=categories.slice(0,6).map(item=>`
    <div class="tend-share-pill">
      <span class="tend-share-pill-dot" style="background:${item.color};"></span>
      <span class="tend-share-pill-name">${item.emoji} ${esc(item.parent)}</span>
      <strong>${_tend_pctLabel(item.pct)}</strong>
    </div>
  `).join('');

  const cards=categories.map(item=>{
    const subRows=item.subEntries.map(sub=>`
      <div class="tend-share-subrow">
        <div class="tend-share-subcopy">
          <span class="tend-share-subbullet" style="background:${item.color};"></span>
          <span class="tend-share-subname">${esc(sub.name)}</span>
        </div>
        <div class="tend-share-subtrack">
          <div class="tend-share-subfill" style="width:${_tend_pctWidth(sub.pctOfTotal)}%;background:${item.color};"></div>
        </div>
        <div class="tend-share-substats">
          <strong>${_tend_pctLabel(sub.pctOfTotal)}</strong>
          <span>${_tend_pctLabel(sub.pctOfCategory)} de ${esc(item.parent)}</span>
        </div>
      </div>
    `).join('');

    return `
      <article class="tend-share-cat-card">
        <div class="tend-share-cat-head">
          <div class="tend-share-cat-main">
            <span class="tend-share-cat-emoji">${item.emoji}</span>
            <div class="tend-share-cat-copy">
              <div class="tend-share-cat-name">${esc(item.parent)}</div>
              <div class="tend-share-cat-meta">${item.subEntries.length} subcategoría${item.subEntries.length!==1?'s':''} · $${fmtN(item.amount)}</div>
            </div>
          </div>
          <div class="tend-share-cat-side">
            <strong style="color:${item.color};">${_tend_pctLabel(item.pct)}</strong>
            <span>del mes</span>
          </div>
        </div>
        <div class="tend-share-cat-track">
          <div class="tend-share-cat-fill" style="width:${_tend_pctWidth(item.pct)}%;background:${item.color};"></div>
        </div>
        <div class="tend-share-sublist">${subRows}</div>
      </article>
    `;
  }).join('');

  customEl.innerHTML=`
    <div class="tend-share-shell">
      <div class="tend-share-hero">
        <div class="tend-share-donut-panel">
          <div class="tend-share-donut" style="background:${gradient};">
            <div class="tend-share-donut-hole">
              <span class="tend-share-donut-label">${esc(currentLabel)}</span>
              <strong>$${fmtN(grandTotal)}</strong>
              <span>${categories.length} categorías activas</span>
            </div>
          </div>
          <div class="tend-share-stat-grid">
            <div class="tend-share-stat-card">
              <span class="tend-share-stat-kicker">Mayor peso</span>
              <strong style="color:${topCategory.color};">${topCategory.emoji} ${esc(topCategory.parent)}</strong>
              <span>${_tend_pctLabel(topCategory.pct)} del gasto mensual</span>
            </div>
            <div class="tend-share-stat-card">
              <span class="tend-share-stat-kicker">Top 3</span>
              <strong>${_tend_pctLabel(topThreePct)}</strong>
              <span>concentran el gasto del mes</span>
            </div>
          </div>
        </div>
        <div class="tend-share-focus">
          <div class="tend-share-focus-card">
            <span class="tend-share-focus-kicker">Lectura rápida</span>
            <div class="tend-share-focus-title">${topCategory.emoji} ${esc(topCategory.parent)} lidera el mes</div>
            <div class="tend-share-focus-sub">$${fmtN(topCategory.amount)} · ${_tend_pctLabel(topCategory.pct)} del total</div>
            ${topSub?`<div class="tend-share-focus-chip" style="--share-chip:${topCategory.color};">Subcategoría dominante: <strong>${esc(topSub.name)}</strong> · ${_tend_pctLabel(topSub.pctOfTotal)}</div>`:''}
          </div>
          <div class="tend-share-pill-grid">${pills}</div>
        </div>
      </div>
      <div class="tend-share-cards">${cards}</div>
    </div>
  `;

  if(typeof gsap!=='undefined'){
    gsap.killTweensOf(customEl);
    gsap.fromTo(customEl,{ opacity:0.7, y:10 },{ opacity:1, y:0, duration:0.42, ease:'power3.out', clearProps:'opacity,transform' });
  }
}

// ─ Draw the chart (reads _tendChartState)
function _tend_drawChart(){
  if(!_tendChartState) return;
  const{currentTxns,prevTxns,lastKey,prevKey,mode,currentLabel,prevLabel,grandTotal,sortedParents,parentDeltas,parentSubTotals}=_tendChartState;

  if(state.charts.tendMain){state.charts.tendMain.destroy();state.charts.tendMain=null;}
  const ctx=document.getElementById('chart-tend-main');
  const customEl=document.getElementById('tend-chart-custom');
  const chartMode=_normTendChartMode(state.tendChartMode||'evo');
  const toggle=state.tendChartToggle||'acumulado';
  const titleEl=document.getElementById('tend-chart-title');
  const subEl=document.getElementById('tend-chart-sub');
  const legendEl=document.getElementById('tend-chart-legend');
  const evoToggle=document.getElementById('tend-evo-toggle');
  const ctxBar=document.getElementById('tend-context-insight');

  // Sync toggle buttons
  document.getElementById('tend-tog-dia')?.classList.toggle('active',toggle==='dia');
  document.getElementById('tend-tog-acum')?.classList.toggle('active',toggle==='acumulado');
  if(evoToggle) evoToggle.style.display=chartMode==='evo'?'none':'flex';
  if(ctxBar)    ctxBar.style.display='none';
  if(ctx)       ctx.closest('.chart-wrap').style.display=chartMode==='evo'||chartMode==='treemap_off'?'none':'block';
  if(customEl)  customEl.style.display=chartMode==='evo'?'block':'none';
  ['evo','ranking','compare'].forEach(x=>document.getElementById('tv2-'+x)?.classList.toggle('active',x===chartMode));

  // ── VISTA 1: Participación mensual por categoría y subcategoría ──
  if(chartMode==='evo'&&customEl){
    if(titleEl) titleEl.textContent='Distribución mensual del gasto';
    if(subEl)   subEl.textContent=currentLabel+' · porcentajes por categoría y subcategoría';
    if(legendEl) legendEl.innerHTML='';
    _tend_renderMonthlyShare(customEl,currentLabel,grandTotal,sortedParents,parentSubTotals);

  // ── VISTA 2: Ranking por categoría (barras horizontales) ──
  } else if(chartMode==='ranking'&&ctx){
    if(customEl) customEl.innerHTML='';
    if(titleEl) titleEl.textContent='Ranking de categorías';
    if(subEl)   subEl.textContent=sortedParents.length+' categorías con gasto · '+currentLabel;
    if(legendEl) legendEl.innerHTML='';
    const names=sortedParents.map(([p])=>p);
    const totals=sortedParents.map(([,v])=>v);
    const colors=names.map(p=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.color:'#888';});
    const emojis=names.map(p=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.emoji:'';});
    const avg=totals.reduce((s,v)=>s+v,0)/Math.max(totals.length,1);
    state.charts.tendMain=new Chart(ctx,{
      type:'bar',
      data:{labels:names.map((p,i)=>emojis[i]+' '+p),datasets:[
        {label:'Gasto',data:totals,
          backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,
          borderWidth:1.5,borderRadius:9,maxBarThickness:44,borderSkipped:false,order:2},
        {label:'Promedio',data:names.map(()=>avg),type:'line',
          borderColor:'rgba(160,154,148,0.55)',borderWidth:1.5,borderDash:[5,4],
          pointRadius:0,fill:false,order:1}
      ]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:tendChartAnim(),
        plugins:{legend:{display:false},
          tooltip:{..._chartTooltip(),callbacks:{label:ctx2=>ctx2.datasetIndex===1?' Promedio: $'+fmtN(ctx2.parsed.x):' $'+fmtN(ctx2.parsed.x)}}},
        scales:{
          x:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.03)',drawBorder:false}},
          y:{ticks:{color:_chartTickColor(),font:{..._chartTickFont(),size:11,weight:'600'}},grid:{display:false}}
        }}
    });
    animateTendCanvas(ctx);

  // ── VISTA 3: Comparación vs período anterior ──
  } else if(chartMode==='compare'&&ctx){
    if(customEl) customEl.innerHTML='';
    if(titleEl) titleEl.textContent='Comparación vs período anterior';
    if(subEl)   subEl.textContent=(prevKey?prevLabel:'—')+' vs '+currentLabel;
    if(legendEl) legendEl.innerHTML='';
    const compCats=Object.entries(parentDeltas)
      .filter(([,d])=>d.last>0||d.prev>0)
      .sort((a,b)=>(b[1].last+b[1].prev)-(a[1].last+a[1].prev))
      .slice(0,10);
    const compColors=compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.color:'#888';});
    const compEmojis=compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.emoji:'';});
    state.charts.tendMain=new Chart(ctx,{
      type:'bar',
      data:{labels:compCats.map(([p],i)=>compEmojis[i]+' '+p),datasets:[
        {label:prevLabel,data:compCats.map(([p])=>parentDeltas[p].prev),
          backgroundColor:'rgba(160,154,148,0.22)',borderColor:'rgba(160,154,148,0.45)',
          borderWidth:1,borderRadius:7,maxBarThickness:38},
        {label:currentLabel,data:compCats.map(([p])=>parentDeltas[p].last),
          backgroundColor:compColors.map(c=>c+'cc'),borderColor:compColors,
          borderWidth:1.5,borderRadius:7,maxBarThickness:38}
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:tendChartAnim(),
        plugins:{
          legend:{display:true,position:'bottom',labels:{color:_isL()?'#748096':'#9ca3af',font:{size:10},boxWidth:10,padding:12,usePointStyle:true}},
          tooltip:{..._chartTooltip(),callbacks:{label:ctx2=>' '+ctx2.dataset.label+': $'+fmtN(ctx2.parsed.y)}}},
        scales:{
          x:{ticks:{color:_chartTickColor(),font:_chartTickFont(),maxRotation:40},grid:{display:false}},
          y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:_chartGridY()}
        }}
    });
    animateTendCanvas(ctx);
  }
}

// ─ Draw ranking list (reads _tendRankingState)
// ─ Accordion toggle for ranking rows
function toggleTendRankRow(id){
  const sub=document.getElementById('trs-'+id);
  const chev=document.getElementById('trc-'+id);
  if(!sub) return;
  const open=sub.style.display!=='none'&&sub.style.display!=='';
  sub.style.display=open?'none':'block';
  if(chev) chev.style.transform=open?'rotate(0deg)':'rotate(90deg)';
}

// ─ Show/hide insights panel
function setTendInsightsVisible(v){
  state.tendInsightsOpen=v!==false;
  _tend_applyInsightsVisibility();
  // Re-render insights so toggle button reflects state
  if(state.tendInsightsOpen&&_tendInsightsArgs) _tend_drawInsights(..._tendInsightsArgs);
}

function _tend_applyInsightsVisibility(){
  const open=state.tendInsightsOpen!==false;
  const panel=document.getElementById('tend-insights-panel');
  const showBar=document.getElementById('tend-ins-show-bar');
  const dualCol=document.querySelector('.tend-dual-col');
  if(panel) panel.style.display=open?'flex':'none';
  if(showBar) showBar.style.display=open?'none':'flex';
  if(dualCol) dualCol.classList.toggle('tend-insights-hidden',!open);
}

let _tendInsightsArgs=null;

function _tend_drawRanking(){
  if(!_tendRankingState) return;
  const{sortedParents,parentDeltas,grandTotal,prevLabel,parentSubTotals}=_tendRankingState;
  const tab=state.tendRankingTab||'monto';
  const el=document.getElementById('tend-ranking-list');
  const subEl=document.getElementById('tend-ranking-sub');
  if(!el) return;

  let rows=[...sortedParents];
  if(tab==='anterior'){
    rows=Object.entries(parentDeltas)
      .filter(([,d])=>d.last>0||d.prev>0)
      .sort((a,b)=>Math.abs(b[1].diff)-Math.abs(a[1].diff));
    if(subEl) subEl.textContent='Por cambio absoluto vs. período anterior';
  } else if(tab==='participacion'){
    rows=[...sortedParents];
    if(subEl) subEl.textContent='Porcentaje del total del período';
  } else {
    if(subEl) subEl.textContent='Por monto total · toca una categoría para desglosar';
  }

  const maxAmt=sortedParents.length?sortedParents[0][1]:1;

  el.innerHTML=rows.map(([parent])=>{
    const grp=CATEGORY_GROUPS.find(g=>g.group===parent);
    const c=grp?grp.color:'#888';
    const emoji=grp?grp.emoji:'';
    const d=parentDeltas[parent]||{last:0,prev:0,diff:0,pct:0};
    const amount=d.last;
    const pct=grandTotal>0?Math.round(amount/grandTotal*100):0;
    const barW=maxAmt>0?Math.max(Math.round(amount/maxAmt*100),2):0;
    const safeId=parent.replace(/[^a-zA-Z0-9]/g,'_');

    // Subcategories
    const subData=parentSubTotals?parentSubTotals[parent]||{}:{};
    const subArr=Object.entries(subData).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const hasChildren=subArr.length>0;

    let right='';
    if(tab==='anterior'){
      const dColor=d.diff>0?'#ef4444':d.diff<0?'#10b981':'var(--text3)';
      const dSign=d.diff>0?'+':'';
      const dPct=Math.round(d.pct);
      right=`<div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${c};font-family:var(--font);">$${fmtN(amount)}</div>
        <div style="font-size:11px;font-weight:700;color:${dColor};margin-top:2px;">${dSign}${dPct}%</div>
      </div>`;
    } else if(tab==='participacion'){
      right=`<div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${c};font-family:var(--font);">$${fmtN(amount)}</div>
        <div style="font-size:20px;font-weight:800;color:${c};opacity:0.65;line-height:1;margin-top:1px;">${pct}%</div>
      </div>`;
    } else {
      right=`<div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${c};font-family:var(--font);">$${fmtN(amount)}</div>
        <div style="display:inline-block;font-size:10px;font-weight:600;color:${c};background:${c}22;padding:2px 8px;border-radius:99px;margin-top:3px;">${pct}%</div>
      </div>`;
    }

    // Subcategory rows
    const subHtml=hasChildren?`<div id="trs-${safeId}" class="tend-rank-subs" style="display:none;">
      ${subArr.map(([sub,amt])=>{
        const subPct=amount>0?Math.round(amt/amount*100):0;
        const subW=amount>0?Math.max(Math.round(amt/amount*100),2):0;
        return `<div class="tend-rank-subrow">
          <span class="tend-rank-subdot" style="background:${c};"></span>
          <div class="tend-rank-subinfo">
            <div class="tend-rank-subname">${sub}</div>
            <div class="tend-rank-bar-wrap"><div class="tend-rank-bar" style="width:${subW}%;background:${c};opacity:0.45;"></div></div>
          </div>
          <div style="text-align:right;flex-shrink:0;min-width:72px;">
            <div style="font-size:12px;font-weight:600;color:${c};font-family:var(--font);">$${fmtN(amt)}</div>
            <div style="font-size:10px;color:var(--text3);">${subPct}%</div>
          </div>
        </div>`;
      }).join('')}
    </div>`:'';

    return `<div class="tend-rank-group">
      <div class="tend-rank-row${hasChildren?' tend-rank-clickable':''}" ${hasChildren?`onclick="toggleTendRankRow('${safeId}')"`:''}>
        <span class="tend-rank-emoji">${emoji}</span>
        <div class="tend-rank-info">
          <div class="tend-rank-name">${parent}</div>
          <div class="tend-rank-bar-wrap"><div class="tend-rank-bar" style="width:${barW}%;background:${c};"></div></div>
        </div>
        ${right}
        ${hasChildren?`<span id="trc-${safeId}" class="tend-rank-chev">›</span>`:`<span class="tend-rank-chev-ph"></span>`}
      </div>
      ${subHtml}
    </div>`;
  }).join('');
}

// ─ Draw top 3 summary cards
function _tend_drawTopCards(currentTotal,totalDeltaPct,prevLabel,topUp,topDown,closeDateStr,daysRemaining){
  const el=document.getElementById('tend-top-cards');
  if(!el) return;
  const dColor=totalDeltaPct===null?'var(--text3)':totalDeltaPct>5?'#ef4444':totalDeltaPct<-5?'#10b981':'var(--text3)';
  const dIcon=totalDeltaPct===null?'':totalDeltaPct>0?'↑ ':'↓ ';
  const dStr=totalDeltaPct!==null?(totalDeltaPct>0?'+':'')+Math.round(totalDeltaPct)+'%':'—';

  let closeHtml='';
  if(closeDateStr){
    const cd=new Date(closeDateStr+'T00:00:00');
    const cdStr=cd.toLocaleDateString('es-AR',{day:'numeric',month:'short'});
    closeHtml=`<div style="display:flex;gap:18px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);">
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,0.4);">Cierre</div>
           <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:3px;">${cdStr}</div></div>
      ${daysRemaining!==null?`<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,0.4);">Días restantes</div>
           <div style="font-size:14px;font-weight:700;color:${daysRemaining<=3?'#ef4444':'var(--text)'};margin-top:3px;">${daysRemaining} días</div></div>`:''}
    </div>`;
  }

  const card1=`<div class="tend-top-card" style="background:linear-gradient(135deg,rgba(124,58,237,0.14) 0%,rgba(124,58,237,0.04) 100%);border-color:rgba(124,58,237,0.25);">
    <div class="tend-top-card-label" style="color:rgba(167,139,250,0.9);">💳 GASTO DEL CICLO</div>
    <div class="tend-top-card-value">$${fmtN(currentTotal)}</div>
    <div class="tend-top-card-delta" style="color:${dColor};">${dIcon}${dStr}${prevLabel!=='—'?' vs. '+prevLabel:''}</div>
    ${closeHtml}
  </div>`;

  const card2=topUp?`<div class="tend-top-card" style="background:linear-gradient(135deg,rgba(239,68,68,0.12) 0%,rgba(239,68,68,0.03) 100%);border-color:rgba(239,68,68,0.22);">
    <div class="tend-top-card-label" style="color:rgba(252,165,165,0.9);">📈 SUBIÓ MÁS</div>
    <div class="tend-top-card-cat">${catGroupEmoji(topUp[0])} ${topUp[0]}</div>
    <div class="tend-top-card-value" style="font-size:22px;color:#ef4444;">+$${fmtN(Math.abs(topUp[1].diff))}</div>
    <div class="tend-top-card-delta" style="color:#ef4444;">+${Math.round(topUp[1].pct)}% vs. ${prevLabel}</div>
  </div>`:`<div class="tend-top-card" style="opacity:0.5;"><div class="tend-top-card-label">📈 SUBIÓ MÁS</div><div style="color:var(--text3);font-size:13px;margin-top:8px;">Sin cambios</div></div>`;

  const card3=topDown?`<div class="tend-top-card" style="background:linear-gradient(135deg,rgba(16,185,129,0.12) 0%,rgba(16,185,129,0.03) 100%);border-color:rgba(16,185,129,0.22);">
    <div class="tend-top-card-label" style="color:rgba(110,231,183,0.9);">📉 BAJÓ MÁS</div>
    <div class="tend-top-card-cat">${catGroupEmoji(topDown[0])} ${topDown[0]}</div>
    <div class="tend-top-card-value" style="font-size:22px;color:#10b981;">-$${fmtN(Math.abs(topDown[1].diff))}</div>
    <div class="tend-top-card-delta" style="color:#10b981;">${Math.round(topDown[1].pct)}% vs. ${prevLabel}</div>
  </div>`:`<div class="tend-top-card" style="opacity:0.5;"><div class="tend-top-card-label">📉 BAJÓ MÁS</div><div style="color:var(--text3);font-size:13px;margin-top:8px;">Sin cambios</div></div>`;

  el.innerHTML=card1+card2+card3;
}

// ─ Draw insights panel
function _tend_drawInsights(currentTxns,prevTxns,sortedParents,parentDeltas,grandTotal,totalDeltaPct,currentLabel,prevLabel,lastKey,mode){
  _tendInsightsArgs=[currentTxns,prevTxns,sortedParents,parentDeltas,grandTotal,totalDeltaPct,currentLabel,prevLabel,lastKey,mode];
  const el=document.getElementById('tend-insights-panel');
  if(!el) return;
  const curTotal=currentTxns.reduce((s,t)=>s+t.amount,0);
  const prevTotal=prevTxns.reduce((s,t)=>s+t.amount,0);

  // Days elapsed in current period
  let daysElapsed=1;
  if(mode!=='mes'){
    const cycles=getTcCycles(mode).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
    const cycle=cycles.find(c=>c.id===lastKey);
    if(cycle){
      const ci=cycles.findIndex(c=>c.id===lastKey);
      const openStr=getTcCycleOpen(cycles,ci)||cycle.closeDate;
      const openD=new Date(openStr+'T00:00:00');
      const today=new Date();today.setHours(0,0,0,0);
      const close=new Date(cycle.closeDate+'T00:00:00');
      const end=today<close?today:close;
      daysElapsed=Math.max(Math.round((end-openD)/864e5)+1,1);
    }
  } else {
    const today=new Date();
    const[y,m2]=lastKey.split('-').map(Number);
    const curMK=getMonthKey(today);
    daysElapsed=lastKey===curMK?today.getDate():new Date(y,m2,0).getDate();
  }

  const dailyAvg=curTotal/daysElapsed;
  const prevDaysApprox=prevTotal>0?30:1;
  const prevDailyAvg=prevTotal/prevDaysApprox;
  const dailyDeltaPct=prevDailyAvg>0?((dailyAvg-prevDailyAvg)/prevDailyAvg*100):null;

  // Peak day
  const dayMap={};
  currentTxns.forEach(t=>{
    const td=t.date instanceof Date?t.date:new Date(t.date);
    const k=td.toLocaleDateString('es-AR',{day:'numeric',month:'short'});
    dayMap[k]=(dayMap[k]||0)+t.amount;
  });
  const[peakDay,peakAmt]=Object.entries(dayMap).sort((a,b)=>b[1]-a[1])[0]||['—',0];

  const topCat=sortedParents[0];
  const topCatPct=topCat&&grandTotal>0?Math.round(topCat[1]/grandTotal*100):0;
  const top3Total=sortedParents.slice(0,3).reduce((s,[,v])=>s+v,0);
  const top3Pct=grandTotal>0?Math.round(top3Total/grandTotal*100):0;
  const top3Names=sortedParents.slice(0,3).map(([p])=>p);

  // Status card
  const sDelta=totalDeltaPct;
  const sColor=sDelta===null?'#7c3aed':sDelta>20?'#ef4444':sDelta>5?'#f97316':'#10b981';
  const sBg=sDelta===null?'rgba(124,58,237,0.12)':sDelta>20?'rgba(239,68,68,0.10)':sDelta>5?'rgba(249,115,22,0.10)':'rgba(16,185,129,0.10)';
  const sEmoji=sDelta===null?'📊':sDelta>20?'🚨':sDelta>5?'⚠️':'✅';
  const sLabel=sDelta===null?'Sin referencia':sDelta>20?'¡Atención!':sDelta>5?'Algo elevado':'Bajo control';
  const sPct=sDelta!==null?(sDelta>0?'+':'')+Math.round(sDelta)+'%':'—';
  const sProgress=prevTotal>0?Math.min(Math.round(curTotal/prevTotal*100),200):100;
  const sSub=sDelta!==null?(sDelta>0?`Llevás $${fmtN(Math.abs(curTotal-prevTotal))} más que ${prevLabel}.`:`Ahorrás $${fmtN(Math.abs(curTotal-prevTotal))} vs. ${prevLabel}.`):`Primer período sin comparación.`;

  let html=`<div class="tend-ins-kicker-row">
    <span class="tend-ins-kicker">INSIGHTS</span>
    <button class="tend-ins-hide-btn" onclick="setTendInsightsVisible(false)" title="Ocultar panel">‹</button>
  </div>
  <div class="tend-ins-status-card" style="background:${sBg};border-color:${sColor}44;">
    <div class="tend-ins-status-row">
      <span style="font-size:24px;">${sEmoji}</span>
      <div class="tend-ins-status-info">
        <div class="tend-ins-status-label">${sLabel}</div>
        <div class="tend-ins-status-pct" style="color:${sColor};">${sPct}</div>
      </div>
    </div>
    <div class="tend-ins-progress-track">
      <div class="tend-ins-progress-fill" style="width:${Math.min(sProgress,100)}%;background:${sColor};"></div>
    </div>
    <div class="tend-ins-status-sub">${sSub}</div>
  </div>`;

  // Dynamic insight cards
  const cards=[];

  if(sDelta!==null){
    const up=sDelta>0;
    cards.push({icon:up?'📈':'📉',color:up?'#ef4444':'#10b981',bg:up?'rgba(239,68,68,0.08)':'rgba(16,185,129,0.08)',
      title:`Tu gasto está <strong style="color:${up?'#ef4444':'#10b981'};">${Math.abs(Math.round(sDelta))}%</strong> ${up?'por encima':'por debajo'} del ritmo anterior`,
      sub:`vs. ${prevLabel}`});
  }
  if(dailyAvg>0){
    const dSign=dailyDeltaPct!==null?(dailyDeltaPct>0?' ↑ +':' ↓ ')+Math.abs(Math.round(dailyDeltaPct||0))+'%':'';
    cards.push({icon:'📅',color:'#6366f1',bg:'rgba(99,102,241,0.08)',
      title:`Promedio diario: <strong style="color:#6366f1;">$${fmtN(Math.round(dailyAvg))}</strong>${dSign}`,
      sub:`En ${daysElapsed} días transcurridos`});
  }
  if(peakDay&&peakAmt>0){
    cards.push({icon:'🔥',color:'#f97316',bg:'rgba(249,115,22,0.08)',
      title:`Pico el <strong style="color:#f97316;">${peakDay}</strong>: $${fmtN(peakAmt)}`,
      sub:'El día de mayor gasto del período.'});
  }
  if(topCat&&topCatPct>=20){
    const grp=CATEGORY_GROUPS.find(g=>g.group===topCat[0]);
    cards.push({icon:grp?.emoji||'📌',color:grp?.color||'#888',bg:(grp?.color||'#888')+'18',
      title:`<strong style="color:${grp?.color||'#888'};">${topCat[0]}</strong> representa el ${topCatPct}% del total`,
      sub:`$${fmtN(topCat[1])} este período.`});
  }
  if(sortedParents.length>=3){
    cards.push({icon:'🎯',color:'#8b5cf6',bg:'rgba(139,92,246,0.08)',
      title:`Concentrás el <strong style="color:#8b5cf6;">${top3Pct}%</strong> del gasto en ${Math.min(3,sortedParents.length)} categorías`,
      sub:top3Names.slice(0,3).join(', ')});
  }
  // Biggest spike
  const spike=Object.entries(parentDeltas).filter(([,d])=>d.pct>50&&d.prev>1000).sort((a,b)=>b[1].pct-a[1].pct)[0];
  if(spike){
    const grp=CATEGORY_GROUPS.find(g=>g.group===spike[0]);
    cards.push({icon:'⚡',color:'#ef4444',bg:'rgba(239,68,68,0.08)',
      title:`<strong style="color:${grp?.color||'#ef4444'};">${spike[0]}</strong> subió <strong style="color:#ef4444;">${Math.round(spike[1].pct)}%</strong>`,
      sub:`$${fmtN(spike[1].prev)} → $${fmtN(spike[1].last)}`});
  }
  // Biggest drop
  const drop=Object.entries(parentDeltas).filter(([,d])=>d.pct<-30&&d.prev>1000).sort((a,b)=>a[1].pct-b[1].pct)[0];
  if(drop){
    const grp=CATEGORY_GROUPS.find(g=>g.group===drop[0]);
    cards.push({icon:'💚',color:'#10b981',bg:'rgba(16,185,129,0.08)',
      title:`<strong style="color:${grp?.color||'#10b981'};">${drop[0]}</strong> bajó <strong style="color:#10b981;">${Math.abs(Math.round(drop[1].pct))}%</strong>`,
      sub:`Ahorrás $${fmtN(Math.abs(drop[1].diff))} vs. ${prevLabel}.`});
  }

  cards.slice(0,6).forEach(ins=>{
    html+=`<div class="tend-ins-card" style="background:${ins.bg};border-left:3px solid ${ins.color};">
      <div class="tend-ins-card-icon" style="background:${ins.color}22;color:${ins.color};">${ins.icon}</div>
      <div class="tend-ins-card-body">
        <div class="tend-ins-card-title">${ins.title}</div>
        <div class="tend-ins-card-sub">${ins.sub}</div>
      </div>
    </div>`;
  });

  html+=`<div class="tend-ins-tip">
    <div class="tend-ins-tip-icon">✨</div>
    <div>
      <div class="tend-ins-tip-label">TIP</div>
      <div class="tend-ins-tip-text">Probá cambiar a <strong>"Meses"</strong> para ver tendencias de más largo plazo.</div>
    </div>
  </div>`;

  el.innerHTML=html;
  _tend_applyInsightsVisibility();
}

function renderTendencia(){
  state.tendMode=normalizeViewMode(state.tendMode||'visa');
  // Migrate legacy chart modes
  const legacyMap={bar:'ranking',treemap:'ranking',line:'evo'};
  if(legacyMap[state.tendChartMode]) state.tendChartMode=legacyMap[state.tendChartMode];

  document.getElementById('tend-tog-mes')?.classList.toggle('active',state.tendMode==='mes');
  document.getElementById('tend-tog-visa')?.classList.toggle('active',state.tendMode==='visa');

  const allKeys=getTendPeriodKeys();
  if(allKeys.length<1){
    document.getElementById('tendencia-empty').style.display='block';
    document.getElementById('tendencia-content').style.display='none';
    return;
  }
  document.getElementById('tendencia-empty').style.display='none';
  document.getElementById('tendencia-content').style.display='flex';

  // Period selector
  const pSel=document.getElementById('tend-period-select');
  if(pSel){
    const cv=pSel.value;
    let opts='<option value="">Todos los períodos</option>';
    allKeys.slice().reverse().forEach(k=>{opts+='<option value="'+k+'" '+(k===cv?'selected':'')+'>'+getTendPeriodLabel(k)+'</option>';});
    pSel.innerHTML=opts;
  }
  let selPeriod=pSel?.value||'';
  if(!selPeriod&&allKeys.length){selPeriod=allKeys[allKeys.length-1];if(pSel)pSel.value=selPeriod;}

  const mode=normalizeViewMode(state.tendMode||'visa');
  const lastKey=selPeriod||allKeys[allKeys.length-1];
  const lastIdx=allKeys.indexOf(lastKey);
  const prevKey=lastIdx>0?allKeys[lastIdx-1]:null;

  const currentTxns=getTxnsForTendPeriod(lastKey).filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized');
  const prevTxns=prevKey?getTxnsForTendPeriod(prevKey).filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'):[];
  const currentLabel=getTendPeriodLabel(lastKey);
  const prevLabel=prevKey?getTendPeriodLabel(prevKey):'—';
  const curTotal=currentTxns.reduce((s,t)=>s+t.amount,0);
  const prevTotal=prevTxns.reduce((s,t)=>s+t.amount,0);
  const totalDeltaPct=prevTotal>0?((curTotal-prevTotal)/prevTotal*100):null;

  // Category aggregations
  const parentTotals={},parentPrevTotals={};
  CATEGORY_GROUPS.forEach(g=>{parentTotals[g.group]=0;parentPrevTotals[g.group]=0;});
  currentTxns.forEach(t=>{const p=catGroup(t.category);parentTotals[p]=(parentTotals[p]||0)+t.amount;});
  prevTxns.forEach(t=>{const p=catGroup(t.category);parentPrevTotals[p]=(parentPrevTotals[p]||0)+t.amount;});
  const grandTotal=Object.values(parentTotals).reduce((s,v)=>s+v,0);
  const sortedParents=Object.entries(parentTotals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);

  const parentDeltas={};
  CATEGORY_GROUPS.forEach(g=>{
    const last=parentTotals[g.group]||0,prev=parentPrevTotals[g.group]||0;
    parentDeltas[g.group]={last,prev,diff:last-prev,pct:prev>0?(last-prev)/prev*100:last>0?100:0};
  });

  const movers=Object.entries(parentDeltas).filter(([,d])=>d.prev>0||d.last>0).sort((a,b)=>Math.abs(b[1].diff)-Math.abs(a[1].diff));
  const topUp=movers.find(([,d])=>d.diff>0);
  const topDown=movers.find(([,d])=>d.diff<0);

  // Cycle close date
  let closeDateStr=null,daysRemaining=null;
  if(mode!=='mes'){
    const cycles=getTcCycles(mode).slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
    const cycle=cycles.find(c=>c.id===lastKey);
    if(cycle){
      closeDateStr=cycle.closeDate;
      const today=new Date();today.setHours(0,0,0,0);
      const close=new Date(cycle.closeDate+'T00:00:00');
      daysRemaining=Math.max(Math.round((close-today)/864e5),0);
    }
  }

  // Render chart view tabs
  const tabsEl=document.getElementById('tend-view-tabs');
  if(tabsEl){
    const cm=_normTendChartMode(state.tendChartMode||'evo');
    tabsEl.innerHTML=[
      {id:'evo',label:'◔ Distribución'},
      {id:'ranking',label:'▊ Ranking'},
      {id:'compare',label:'⇄ Vs. Anterior'}
    ].map(t=>`<button class="tend-view-btn${t.id===cm?' active':''}" id="tv2-${t.id}" onclick="setTendChartMode('${t.id}')">${t.label}</button>`).join('');
  }

  // Subcategory totals for accordion
  const parentSubTotals={};
  currentTxns.forEach(t=>{
    const p=catGroup(t.category);
    if(!parentSubTotals[p]) parentSubTotals[p]={};
    parentSubTotals[p][t.category]=(parentSubTotals[p][t.category]||0)+t.amount;
  });

  // Store state refs
  _tendChartState={currentTxns,prevTxns,lastKey,prevKey,mode,currentLabel,prevLabel,grandTotal,sortedParents,parentDeltas,parentSubTotals};
  _tendRankingState={sortedParents,parentDeltas,grandTotal,prevLabel,parentSubTotals};

  // Render all sections
  _tend_drawTopCards(curTotal,totalDeltaPct,prevLabel,topUp,topDown,closeDateStr,daysRemaining);
  _tend_drawChart();
  _tend_drawRanking();
  _tend_drawInsights(currentTxns,prevTxns,sortedParents,parentDeltas,grandTotal,totalDeltaPct,currentLabel,prevLabel,lastKey,mode);

  document.getElementById('tend-sub-title').textContent=(mode==='mes'?'Vista mes':'Vista VISA')+' · '+sortedParents.length+' categorías activas';
}

// ══ COMPARE ══
function setCompareMode(m){
  state.compareMode=m;
  const tmBtn=document.getElementById('tog-month');
  const tcBtn=document.getElementById('tog-tc');
  if(tmBtn)tmBtn.classList.toggle('active',m==='month');
  if(tcBtn)tcBtn.classList.toggle('active',m==='tc');
  renderCompareSelectors();renderCompare();
}
function getCompareMonthTxns(){
  const range=typeof getViewWindowRange==='function'
    ? getViewWindowRange()
    : {currentMonthKey:getMonthKey(new Date()), startMonthKey:getMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-6,1))};
  return (state.transactions||[]).filter(t=>{
    if(t.isPendingCuota || t.isPendingSubscription) return false;
    const monthKey=t.month||getMonthKey(t.date);
    return monthKey && monthKey<=range.currentMonthKey && monthKey>=range.startMonthKey;
  });
}
function getPeriodKeys(){
  if(state.compareMode==='tc'){
    return getTcCycles().slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate)).map(c=>c.id);
  }
  return [...new Set(getCompareMonthTxns().map(t=>t.month||getMonthKey(t.date)))].sort();
}
function periodLabel(key){
  if(state.compareMode==='tc'){
    const cycle=getTcCycles().find(c=>c.id===key);
    return cycle?cycle.label||cycle.closeDate:key;
  }
  const[y,m]=key.split('-');return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
}
function renderCompareSelectors(){
  const keys=getPeriodKeys();if(keys.length<2){document.getElementById('compare-empty').style.display='block';document.getElementById('compare-content').style.display='none';return;}
  document.getElementById('compare-empty').style.display='none';document.getElementById('compare-content').style.display='flex';
  const opts=keys.map(k=>'<option value="'+k+'">'+periodLabel(k)+'</option>').join('');
  const sa=document.getElementById('cmp-a'),sb=document.getElementById('cmp-b');
  const prevA=sa?.value||'';
  const prevB=sb?.value||'';
  sa.innerHTML=opts;
  sb.innerHTML=opts;
  if(keys.length>=2){
    const currentMonthKey=getMonthKey(new Date());
    const previousMonthDate=new Date();
    previousMonthDate.setMonth(previousMonthDate.getMonth()-1);
    const previousMonthKey=getMonthKey(previousMonthDate);
    const hasDefaultPair=state.compareMode==='month' && keys.includes(previousMonthKey) && keys.includes(currentMonthKey);
    if(hasDefaultPair){
      sa.value=previousMonthKey;
      sb.value=currentMonthKey;
    } else {
      sa.value=keys.includes(prevA)?prevA:keys[keys.length-2];
      sb.value=keys.includes(prevB)?prevB:keys[keys.length-1];
      if(sa.value===sb.value){
        sa.value=keys[keys.length-2];
        sb.value=keys[keys.length-1];
      }
    }
  }
}
function getTxnsFor(key){
  if(state.compareMode==='tc'){
    const cycles=getTcCycles();
    const cycle=cycles.find(c=>c.id===key);
    return cycle?getTcCycleTxns(cycle,cycles):[];
  }
  return getCompareMonthTxns().filter(t=>(t.month||getMonthKey(t.date))===key);
}
function renderCompare(){
  const ka=document.getElementById('cmp-a')?.value,kb=document.getElementById('cmp-b')?.value;
  if(!ka||!kb)return;
  const txA=getTxnsFor(ka),txB=getTxnsFor(kb);
  const la=periodLabel(ka),lb=periodLabel(kb);

  const totA=txA.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const totB=txB.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const diff=totB-totA;
  const pct=totA>0?((diff/totA)*100):null;
  const isDown=diff<0;

  // ── Hero ──
  const heroEl=document.getElementById('cmp-hero');
  if(heroEl){
    const diffColor=isDown?'var(--accent)':diff===0?'var(--text3)':'var(--danger)';
    const pctStr=pct!==null?(Math.abs(pct).toFixed(1)+'%'):'—';
    heroEl.innerHTML=`
      <div class="cmp-hero-period">
        <div class="cmp-hero-label">${la}</div>
        <div class="cmp-hero-amount">$${fmtN(totA)}</div>
        <div class="cmp-hero-sub">${txA.length} movimientos</div>
      </div>
      <div class="cmp-hero-delta">
        <div class="cmp-delta-num" style="color:${diffColor}">${diff===0?'=':((diff>0?'+':'')+' $'+fmtN(Math.abs(diff)))}</div>
        <div class="cmp-delta-label" style="color:${diffColor}">${diff===0?'igual':(isDown?'▼ menos':'▲ más')} ${pctStr}</div>
      </div>
      <div class="cmp-hero-period b">
        <div class="cmp-hero-label">${lb}</div>
        <div class="cmp-hero-amount" style="color:${diffColor}">$${fmtN(totB)}</div>
        <div class="cmp-hero-sub">${txB.length} movimientos</div>
      </div>`;
  }

  // ── Categorías con barras duales ──
  const catMapA={},catMapB={};
  txA.filter(t=>t.currency==='ARS').forEach(t=>{catMapA[t.category]=(catMapA[t.category]||0)+t.amount;});
  txB.filter(t=>t.currency==='ARS').forEach(t=>{catMapB[t.category]=(catMapB[t.category]||0)+t.amount;});
  const allCats=[...new Set([...Object.keys(catMapA),...Object.keys(catMapB)])]
    .sort((a,b)=>((catMapB[b]||0)+(catMapA[b]||0))-((catMapA[a]||0)+(catMapB[a]||0)));
  const maxVal=Math.max(...allCats.map(c=>Math.max(catMapA[c]||0,catMapB[c]||0)),1);

  const diffEl=document.getElementById('cmp-cat-diff');
  const subEl=document.getElementById('cmp-cat-sub');
  if(subEl)subEl.textContent=la+' vs '+lb;
  if(diffEl){
    diffEl.innerHTML=allCats.map(cat=>{
      const a=catMapA[cat]||0,b=catMapB[cat]||0,d=b-a;
      const col=catColor(cat);
      const wA=Math.round((a/maxVal)*100),wB=Math.round((b/maxVal)*100);
      const dColor=d>0?'var(--danger)':d<0?'var(--accent)':'var(--text3)';
      const dText=d===0?'igual':(d>0?'▲ +':'▼ ')+'$'+fmtN(Math.abs(d));
      return`<div class="cmp-cat-row">
        <div class="cmp-cat-dot" style="background:${col}"></div>
        <div class="cmp-cat-name">${esc(cat)}</div>
        <div class="cmp-cat-bars">
          <div class="cmp-bar-wrap">
            <div class="cmp-bar-track"><div class="cmp-bar-fill" style="width:${wA}%;background:${col}88;"></div></div>
            <div class="cmp-bar-val">$${fmtN(a)}</div>
          </div>
          <div class="cmp-bar-wrap">
            <div class="cmp-bar-track"><div class="cmp-bar-fill" style="width:${wB}%;background:${col};"></div></div>
            <div class="cmp-bar-val" style="color:var(--text)">$${fmtN(b)}</div>
          </div>
        </div>
        <div class="cmp-cat-diff-badge" style="color:${dColor}">${dText}</div>
      </div>`;
    }).join('');
  }
  renderCompareLineChart(ka,kb,la,lb);
}

// ══ INSIGHTS — delegado a js/insights.js ══

// ══ COMPARE LINE CHART (mes a mes, acumulado diario) ══
function renderCompareLineChart(ka,kb,la,lb){
  const isMonth=state.compareMode==='month';
  const subEl=document.getElementById('cmp-line-sub');
  if(!isMonth){if(subEl)subEl.textContent='Gráfico disponible para comparación de meses';if(state.charts.cmpLine){state.charts.cmpLine.destroy();state.charts.cmpLine=null;}return;}
  if(subEl)subEl.textContent='Gasto acumulado día a día';
  const txA=getTxnsFor(ka).filter(t=>t.currency==='ARS');
  const txB=getTxnsFor(kb).filter(t=>t.currency==='ARS');
  const [yA,mA]=ka.split('-').map(Number);
  const [yB,mB]=kb.split('-').map(Number);
  const daysA=new Date(yA,mA,0).getDate();
  const daysB=new Date(yB,mB,0).getDate();
  const maxDays=Math.max(daysA,daysB);
  // Build daily cumulative
  const buildCumulative=(txns,y,m)=>{
    const byDay={};txns.forEach(t=>{const d=new Date(t.date).getDate();byDay[d]=(byDay[d]||0)+t.amount;});
    const days=new Date(y,m,0).getDate();let acc=0;return Array.from({length:days},(_, i)=>{acc+=(byDay[i+1]||0);return Math.round(acc);});
  };
  const dataA=buildCumulative(txA,yA,mA);
  const dataB=buildCumulative(txB,yB,mB);
  // Pad shorter arrays
  const labelsArr=Array.from({length:maxDays},(_,i)=>'Día '+(i+1));
  while(dataA.length<maxDays)dataA.push(dataA[dataA.length-1]||0);
  while(dataB.length<maxDays)dataB.push(dataB[dataB.length-1]||0);
  const colA='#007aff';const colB='#34c759';
  // Legend
  const legendEl=document.getElementById('cmp-line-legend');
  if(legendEl)legendEl.innerHTML=`<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-family:var(--font);color:var(--text2);"><span style="width:16px;height:3px;background:${colA};display:inline-block;border-radius:2px;"></span>${la}</div><div style="display:flex;align-items:center;gap:6px;font-size:11px;font-family:var(--font);color:var(--text2);"><span style="width:16px;height:3px;background:${colB};display:inline-block;border-radius:2px;"></span>${lb}</div>`;
  if(state.charts.cmpLine)state.charts.cmpLine.destroy();
  const ctx=document.getElementById('chart-cmp-line');
  if(!ctx)return;
  state.charts.cmpLine=new Chart(ctx,{
    type:'line',
    data:{labels:labelsArr,datasets:[
      {label:la,data:dataA,borderColor:colA,backgroundColor:colA+'15',borderWidth:2,fill:true,tension:0.3,pointRadius:0,pointHoverRadius:4},
      {label:lb,data:dataB,borderColor:colB,backgroundColor:colB+'15',borderWidth:2,fill:true,tension:0.3,pointRadius:0,pointHoverRadius:4}
    ]},
    options:{...chartOpts('$',false),animation:tendChartAnim(),plugins:{...chartOpts('$',false).plugins,legend:{display:false}}}
  });
  animateTendCanvas(ctx);
}
