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
  state.tendMode=m;
  const weekBtn=document.getElementById('tend-tog-week');
  if(weekBtn)weekBtn.classList.toggle('active',m==='week');
  document.getElementById('tend-tog-month').classList.toggle('active',m==='month');
  const tcBtn=document.getElementById('tend-tog-tc');
  if(tcBtn){tcBtn.classList.toggle('active',m==='tc');tcBtn.style.display=getTcCycles().length?'':'none';}
  renderTendencia();
}
function getTendPeriodKeys(){
  if(state.tendMode==='week')return[...new Set(state.transactions.map(t=>t.week||getWeekKey(t.date)))].sort();
  if(state.tendMode==='tc'){
    const cycles=getTcCycles().slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
    return cycles.map(c=>c.id);
  }
  return[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort();
}
function getTendPeriodLabel(k){
  if(state.tendMode==='week'){
    const d=new Date(k+'T12:00:00');
    const e=new Date(d);
    e.setDate(e.getDate()+6);
    const ds=`${d.getDate()} ${d.toLocaleDateString('es-AR',{month:'short'}).replace('.','')}`;
    const de=`${e.getDate()} ${e.toLocaleDateString('es-AR',{month:'short'}).replace('.','')}`;
    return `${ds} → ${de}`;
  }
  if(state.tendMode==='tc'){
    const cycle=getTcCycles().find(c=>c.id===k);
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
  if(state.tendMode==='week')return state.transactions.filter(t=>(t.week||getWeekKey(t.date))===k);
  if(state.tendMode==='tc'){
    const cycles=getTcCycles();
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
function setTendChartMode(mode){
  state.tendChartMode=mode;
  saveState();
  renderTendencia();
}

function renderTendencia(){
  if(!state.tendMode) state.tendMode = 'tc';

  const weekBtn=document.getElementById('tend-tog-week');
  if(weekBtn)weekBtn.classList.toggle('active',state.tendMode==='week');
  const monthBtn=document.getElementById('tend-tog-month');
  if(monthBtn)monthBtn.classList.toggle('active',state.tendMode==='month');
  const tcBtn=document.getElementById('tend-tog-tc');
  if(tcBtn){
    tcBtn.classList.toggle('active',state.tendMode==='tc');
    tcBtn.style.display=getTcCycles().length?'':'none';
  }

  const keys=getTendPeriodKeys();
  if(keys.length<1){document.getElementById('tendencia-empty').style.display='block';document.getElementById('tendencia-content').style.display='none';return;}
  document.getElementById('tendencia-empty').style.display='none';document.getElementById('tendencia-content').style.display='flex';

  // ─ Populate period selector
  const pSel=document.getElementById('tend-period-select');
  if(pSel){
    const cv=pSel.value;
    let opts='<option value="">Todos los períodos</option>';
    keys.slice().reverse().forEach(k=>{opts+='<option value="'+k+'" '+(k===cv?'selected':'')+'>'+getTendPeriodLabel(k)+'</option>';});
    pSel.innerHTML=opts;
  }

  let selectedPeriod=pSel?.value||'';
  // Default to latest key if nothing is selected or if we just switched mode
  if(!selectedPeriod && keys.length) {
    selectedPeriod = keys[keys.length-1];
    if(pSel) pSel.value = selectedPeriod;
  }
  
  const activeKeys=selectedPeriod?[selectedPeriod]:keys;
  const labels=activeKeys.map(k=>getTendPeriodLabel(k));

  // ─ Aggregate by parent category
  const parentTotals={};const parentSubTotals={};
  CATEGORY_GROUPS.forEach(g=>{parentTotals[g.group]=0;parentSubTotals[g.group]={};g.subs.forEach(s=>{parentSubTotals[g.group][s]=0;});});
  activeKeys.forEach(k=>{
    getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized').forEach(t=>{
      const parent=catGroup(t.category);
      parentTotals[parent]=(parentTotals[parent]||0)+t.amount;
      if(!parentSubTotals[parent])parentSubTotals[parent]={};
      parentSubTotals[parent][t.category]=(parentSubTotals[parent][t.category]||0)+t.amount;
    });
  });
  const grandTotal=Object.values(parentTotals).reduce((s,v)=>s+v,0);
  const sortedParents=Object.entries(parentTotals).sort((a,b)=>b[1]-a[1]);
  const activeParents=sortedParents.filter(([,v])=>v>0);

  // Previous period data for comparisons
  const lastKey=keys[keys.length-1],prevKey=keys.length>=2?keys[keys.length-2]:null;
  const lastTxns=getTxnsForTendPeriod(lastKey).filter(t=>t.currency==='ARS');
  const prevTxns=prevKey?getTxnsForTendPeriod(prevKey).filter(t=>t.currency==='ARS'):[];
  const lastTotal=lastTxns.reduce((s,t)=>s+t.amount,0);
  const prevTotal=prevTxns.reduce((s,t)=>s+t.amount,0);
  const totalDelta=prevTotal>0?((lastTotal-prevTotal)/prevTotal*100):null;

  // Per-parent deltas (last vs prev)
  const parentDeltas={};
  CATEGORY_GROUPS.forEach(g=>{
    const lastV=lastTxns.filter(t=>g.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0);
    const prevV=prevTxns.filter(t=>g.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0);
    parentDeltas[g.group]={last:lastV,prev:prevV,diff:lastV-prevV,pct:prevV>0?((lastV-prevV)/prevV*100):lastV>0?100:0};
  });

  // ════════════════════════════════════════════
  // 1. RESUMEN EJECUTIVO
  // ════════════════════════════════════════════
  const execEl=document.getElementById('tend-exec-summary');
  if(execEl){
    const lastLabel=getTendPeriodLabel(lastKey);
    const prevLabel=prevKey?getTendPeriodLabel(prevKey):'—';
    const deltaColor=totalDelta===null?'var(--text3)':totalDelta>5?'var(--danger)':totalDelta<-5?'var(--accent)':'var(--text3)';
    const deltaIcon=totalDelta===null?'':'<span style="font-size:18px;">'+(totalDelta>0?'📈':'📉')+'</span> ';
    const deltaStr=totalDelta!==null?((totalDelta>0?'+':'')+Math.round(totalDelta)+'%'):'—';

    // Top movers
    const movers=Object.entries(parentDeltas).filter(([,d])=>d.prev>0||d.last>0).sort((a,b)=>Math.abs(b[1].diff)-Math.abs(a[1].diff));
    const topUp=movers.find(([,d])=>d.diff>0);
    const topDown=movers.find(([,d])=>d.diff<0);

    execEl.innerHTML=`
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;">RESUMEN · ${lastLabel}</div>
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
            <span style="font-size:24px;font-weight:800;letter-spacing:-.03em;font-family:var(--font);color:var(--text);">$${fmtN(lastTotal)}</span>
            <span style="font-size:14px;font-weight:700;color:${deltaColor};">${deltaIcon}${deltaStr} vs ${prevLabel}</span>
          </div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${topUp?`<div style="text-align:center;"><div style="font-size:9px;font-weight:700;color:var(--danger);letter-spacing:.05em;">▲ SUBIÓ MÁS</div><div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px;">${catGroupEmoji(topUp[0])} ${topUp[0]}</div><div style="font-size:11px;color:var(--danger);font-family:var(--font);">+$${fmtN(Math.abs(topUp[1].diff))} (+${Math.round(topUp[1].pct)}%)</div></div>`:''}
          ${topDown?`<div style="text-align:center;"><div style="font-size:9px;font-weight:700;color:var(--accent);letter-spacing:.05em;">▼ BAJÓ MÁS</div><div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px;">${catGroupEmoji(topDown[0])} ${topDown[0]}</div><div style="font-size:11px;color:var(--accent);font-family:var(--font);">-$${fmtN(Math.abs(topDown[1].diff))} (${Math.round(topDown[1].pct)}%)</div></div>`:''}
        </div>
      </div>`;
  }

  // ════════════════════════════════════════════
  // 2. GRÁFICO PRINCIPAL — 4 vistas
  // ════════════════════════════════════════════
  if(state.charts.tendMain)state.charts.tendMain.destroy();
  const ctx1=document.getElementById('chart-tend-main');
  const customEl=document.getElementById('tend-chart-custom');
  const tendMode=state.tendChartMode||'bar';

  // Sync buttons
  ['bar','line','compare','treemap'].forEach(m=>{
    const btn=document.getElementById('tv-'+m);
    if(btn){btn.classList.toggle('active',tendMode===m);}
  });

  const chartTitle=document.getElementById('tend-chart-title');
  const chartSub=document.getElementById('tend-chart-sub');

  // Only categories WITH spending for charts
  const activeCatNames=activeParents.map(([p])=>p);
  const activeCatTotals=activeParents.map(([,v])=>v);
  const activeCatColors=activeCatNames.map(p=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.color:'#888';});
  const activeCatEmojis=activeCatNames.map(p=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.emoji:'';});

  if(ctx1)ctx1.parentElement.style.display=tendMode==='treemap'?'none':'block';
  if(customEl)customEl.style.display=tendMode==='treemap'?'block':'none';

  if(tendMode==='bar'&&ctx1){
    // VISTA 1: Ranking (barras horizontales, solo cats con gasto)
    chartTitle.textContent='Ranking de gasto';
    chartSub.textContent=activeParents.length+' categorías · '+activeKeys.length+' '+(state.tendMode==='week'?'semanas':'períodos');
    const overallAvg=activeCatTotals.reduce((s,v)=>s+v,0)/Math.max(activeCatTotals.length,1);
    state.charts.tendMain=new Chart(ctx1,{
      type:'bar',
      data:{
        labels:activeCatNames.map((p,i)=>activeCatEmojis[i]+' '+p),
        datasets:[
          {label:'Gasto',data:activeCatTotals,backgroundColor:activeCatColors.map(c=>c+'bb'),borderColor:activeCatColors,borderWidth:1.5,borderRadius:8,maxBarThickness:42,borderSkipped:false,order:2},
          {label:'Promedio',data:activeCatNames.map(()=>overallAvg),type:'line',borderColor:'rgba(160,154,148,0.6)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:1}
        ]
      },
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:tendChartAnim(),plugins:{legend:{display:false},tooltip:{..._chartTooltip(),callbacks:{label:ctx=>ctx.datasetIndex===1?' Promedio: $'+fmtN(ctx.parsed.x):' $'+fmtN(ctx.parsed.x)}}},scales:{x:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.03)',drawBorder:false}},y:{ticks:{color:_chartTickColor(),font:{..._chartTickFont(),size:11,weight:'600'}},grid:{display:false}}}}
    });
    animateTendCanvas(ctx1);
  } else if(tendMode==='line'&&ctx1){
    // VISTA 2: Evolución temporal por categoría
    chartTitle.textContent='Evolución por categoría';
    chartSub.textContent='Top '+Math.min(activeParents.length,8)+' categorías · '+keys.length+' '+(state.tendMode==='week'?'semanas':'períodos');
    const lineLabels=keys.map(k=>getTendPeriodLabel(k));
    const lineCats=activeParents.slice(0,8);
    const datasets=lineCats.map(([parent])=>{
      const grp=CATEGORY_GROUPS.find(g=>g.group===parent);
      const c=grp?grp.color:'#888';
      return{label:grp?grp.emoji+' '+parent:parent,data:keys.map(k=>getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&grp?.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0)),borderColor:c,backgroundColor:c+'18',borderWidth:2,fill:false,tension:0.35,pointRadius:3,pointBackgroundColor:c,pointBorderColor:'#fff',pointBorderWidth:1.5};
    });
    state.charts.tendMain=new Chart(ctx1,{
      type:'line',data:{labels:lineLabels,datasets},
      options:{responsive:true,maintainAspectRatio:false,animation:tendChartAnim(),plugins:{legend:{display:true,position:'bottom',labels:{color:'#a09a94',font:{size:10},boxWidth:10,padding:10,usePointStyle:true}},tooltip:{..._chartTooltip(),callbacks:{label:ctx=>' '+ctx.dataset.label+': $'+fmtN(ctx.parsed.y)}}},scales:{x:{ticks:{color:_chartTickColor(),font:_chartTickFont()},grid:{display:false}},y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:_chartGridY()}}}
    });
    animateTendCanvas(ctx1);
  } else if(tendMode==='compare'&&ctx1){
    // VISTA 3: Comparación vs período anterior (barras agrupadas)
    chartTitle.textContent='Comparación vs período anterior';
    const lLabel=getTendPeriodLabel(lastKey),pLabel=prevKey?getTendPeriodLabel(prevKey):'—';
    chartSub.textContent=pLabel+' vs '+lLabel;
    const compCats=activeParents.filter(([p])=>parentDeltas[p].last>0||parentDeltas[p].prev>0).slice(0,10);
    state.charts.tendMain=new Chart(ctx1,{
      type:'bar',data:{
        labels:compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return(g?g.emoji+' ':'')+p;}),
        datasets:[
          {label:pLabel,data:compCats.map(([p])=>parentDeltas[p].prev),backgroundColor:'rgba(160,154,148,0.3)',borderColor:'rgba(160,154,148,0.5)',borderWidth:1,borderRadius:8,maxBarThickness:42},
          {label:lLabel,data:compCats.map(([p])=>parentDeltas[p].last),backgroundColor:compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return(g?g.color:'#888')+'bb';}),borderColor:compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.color:'#888';}),borderWidth:1.5,borderRadius:8,maxBarThickness:42}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,animation:tendChartAnim(),plugins:{legend:{display:true,position:'bottom',labels:{color:'#a09a94',font:{size:10},boxWidth:10,padding:12,usePointStyle:true}},tooltip:{..._chartTooltip(),callbacks:{label:ctx=>' '+ctx.dataset.label+': $'+fmtN(ctx.parsed.y)}}},scales:{x:{ticks:{color:_chartTickColor(),font:_chartTickFont(),maxRotation:45},grid:{display:false}},y:{ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)},grid:_chartGridY()}}}
    });
    animateTendCanvas(ctx1);
  } else if(tendMode==='treemap'&&customEl){
    // VISTA 4: Composición (treemap visual con divs)
    chartTitle.textContent='Composición del gasto';
    chartSub.textContent='Proporción visual por categoría';
    let tmHtml='<div style="display:flex;flex-wrap:wrap;gap:4px;height:260px;align-content:flex-start;">';
    activeParents.forEach(([parent,total])=>{
      const grp=CATEGORY_GROUPS.find(g=>g.group===parent);
      const c=grp?grp.color:'#888';
      const emoji=grp?grp.emoji:'';
      const pct=grandTotal>0?Math.round(total/grandTotal*100):0;
      if(pct<1)return;
      const h=Math.max(Math.round(pct*2.4),30);
      const w=pct>20?'100%':pct>10?'48%':'30%';
      tmHtml+='<div style="background:'+c+'22;border:1px solid '+c+'44;border-radius:10px;padding:10px 14px;flex:0 0 calc('+w+' - 4px);height:'+h+'px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;transition:all .3s;">';
      tmHtml+='<div style="font-size:14px;font-weight:700;color:'+c+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+emoji+' '+parent+'</div>';
      tmHtml+='<div style="font-size:11px;color:var(--text3);font-family:var(--font);margin-top:2px;">$'+fmtN(total)+' · '+pct+'%</div>';
      tmHtml+='</div>';
    });
    tmHtml+='</div>';
    customEl.innerHTML=tmHtml;
  }

  // ════════════════════════════════════════════
  // 3. SPARKLINES (solo categorías con gasto)
  // ════════════════════════════════════════════
  const sparksEl=document.getElementById('tend-sparklines');
  if(!state.charts._sparklines)state.charts._sparklines=[];
  state.charts._sparklines.forEach(c=>{try{c.destroy();}catch(e){}});
  state.charts._sparklines=[];
  sparksEl.innerHTML=activeParents.map(([parent])=>{
    const grp=CATEGORY_GROUPS.find(g=>g.group===parent);
    const c=grp?grp.color:'#888';const emoji=grp?grp.emoji:'';
    // Use full 'keys' array so the sparkline always shows history, but get stats for selected period
    const allVals=keys.map(k=>getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&grp?.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0));
    const activeVals=activeKeys.map(k=>getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&grp?.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0));
    
    // Total for the selected period(s)
    const totalVal=activeVals.reduce((s,v)=>s+v,0);
    
    // Delta should always compare the most recent selected period to the one immediately before it in the FULL history
    const lastActiveKey = activeKeys[activeKeys.length-1];
    const lastKeyIdx = keys.indexOf(lastActiveKey);
    const lastVal = allVals[lastKeyIdx] || 0;
    const prevVal = lastKeyIdx > 0 ? allVals[lastKeyIdx-1] : 0;
    
    const delta=prevVal>0?((lastVal-prevVal)/prevVal*100).toFixed(0):null;
    const deltaClass=delta===null?'neutral':+delta>0?'up':'down';
    const deltaText=delta===null?'\u2014':(+delta>0?'+':'')+delta+'%';
    const sparkId='spark-'+parent.replace(/[^a-zA-Z0-9]/g,'_');
    const singlePeriod=activeKeys.length===1;
    setTimeout(()=>{
      const ctx=document.getElementById(sparkId);if(!ctx)return;
      const ch=new Chart(ctx,{type:'line',data:{labels:keys.map(k=>getTendPeriodLabel(k)),datasets:[{data:allVals,borderColor:c,backgroundColor:c+'18',borderWidth:1.5,fill:true,tension:0.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,animation:tendChartAnim(),plugins:{legend:{display:false},tooltip:{..._chartTooltip(),enabled:false}},scales:{x:{display:false},y:{display:false}}}});
      state.charts._sparklines.push(ch);
      animateTendCanvas(ctx);
    },50);
    const subText=singlePeriod?'período seleccionado':'total \u00b7 prom $'+fmtN(totalVal/Math.max(activeVals.length,1))+'/per\u00edodo';
    return '<div class="tend-sparkline-card"><div class="tend-spark-header"><div class="tend-spark-cat" style="color:'+c+';">'+emoji+' '+parent+'</div><div class="tend-spark-delta '+deltaClass+'">'+deltaText+'</div></div><div class="tend-spark-amount" style="color:'+c+';">$'+fmtN(totalVal)+'</div><div class="tend-spark-sub">'+subText+'</div><div class="sparkline-wrap"><canvas id="'+sparkId+'"></canvas></div></div>';
  }).join('');

  // ════════════════════════════════════════════
  // 5. BREAKDOWN ACCORDION
  // ════════════════════════════════════════════
  const breakdownEl=document.getElementById('tend-breakdown');
  const breakdownSub=document.getElementById('tend-breakdown-sub');
  if(breakdownSub)breakdownSub.textContent=activeParents.length+' categorías con gasto · '+activeKeys.length+' '+(state.tendMode==='week'?'semanas':'períodos');
  if(breakdownEl){
    const maxParentVal=sortedParents.length?sortedParents[0][1]:1;
    let bHtml='';
    sortedParents.forEach(([parentName,total])=>{
      const grp=CATEGORY_GROUPS.find(g=>g.group===parentName);
      const c=grp?grp.color:'#888';const emoji=grp?grp.emoji:'';
      const pct=grandTotal>0?Math.round(total/grandTotal*100):0;
      const subsObj=parentSubTotals[parentName]||{};
      const subsArr=Object.entries(subsObj).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      const barW=maxParentVal>0?Math.max(Math.round(total/maxParentVal*100),2):0;
      const safeId='bd-'+parentName.replace(/[^a-zA-Z0-9]/g,'_');
      bHtml+='<div style="margin-bottom:2px;border-radius:10px;overflow:hidden;'+(total===0?'opacity:0.3;pointer-events:none;':'')+'">';
      bHtml+='<div onclick="toggleBreakdown(\''+safeId+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-radius:10px;transition:background .15s;" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'transparent\'">';
      bHtml+='<span style="font-size:16px;flex-shrink:0;width:22px;text-align:center;">'+emoji+'</span>';
      bHtml+='<div style="flex:1;min-width:0;">';
      bHtml+='<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">';
      bHtml+='<span style="font-size:13px;font-weight:700;color:var(--text);">'+parentName+'</span>';
      bHtml+='<div style="display:flex;align-items:baseline;gap:6px;">';
      bHtml+='<span style="font-size:13px;font-family:var(--font);font-weight:700;color:'+c+';">$'+fmtN(total)+'</span>';
      bHtml+='<span style="font-size:10px;font-family:var(--font);color:var(--text3);">'+pct+'%</span>';
      bHtml+='</div></div>';
      bHtml+='<div style="height:3px;background:var(--surface3);border-radius:2px;overflow:hidden;">';
      bHtml+='<div style="height:100%;width:'+barW+'%;background:'+c+';border-radius:2px;transition:width .5s;"></div></div>';
      bHtml+='</div>';
      bHtml+='<span id="'+safeId+'-chevron" style="font-size:10px;color:var(--text3);flex-shrink:0;transition:transform .2s;transform:rotate(0deg);">▶</span>';
      bHtml+='</div>';
      if(subsArr.length){
        const maxSubVal=subsArr[0][1];
        bHtml+='<div id="'+safeId+'" style="display:none;padding:4px 12px 12px 44px;">';
        subsArr.forEach(([sub,amt])=>{
          const subPct=total>0?Math.round(amt/total*100):0;
          const subBarW=maxSubVal>0?Math.round(amt/maxSubVal*100):0;
          bHtml+='<div style="padding:5px 0;"><div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:3px;">';
          bHtml+='<div style="display:flex;align-items:center;gap:6px;"><span style="width:6px;height:6px;border-radius:50%;background:'+c+';opacity:.6;flex-shrink:0;"></span><span style="font-size:12px;font-weight:600;color:var(--text);">'+sub+'</span></div>';
          bHtml+='<div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:12px;font-family:var(--font);font-weight:600;color:var(--text2);">$'+fmtN(amt)+'</span><span style="font-size:10px;font-family:var(--font);color:var(--text3);min-width:28px;text-align:right;">'+subPct+'%</span></div></div>';
          bHtml+='<div style="height:2px;background:var(--surface3);border-radius:2px;overflow:hidden;"><div style="height:100%;width:'+subBarW+'%;background:'+c+';opacity:.5;border-radius:2px;"></div></div></div>';
        });
        bHtml+='</div>';
      }
      bHtml+='</div>';
    });
    breakdownEl.innerHTML=bHtml;
  }

  document.getElementById('tend-sub-title').textContent=(state.tendMode==='week'?'Por semana':state.tendMode==='tc'?'Por ciclo de tarjeta':'Por mes')+' · '+activeParents.length+' categorías activas';
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
  const currentMonthKey=getMonthKey(new Date());
  return (state.transactions||[]).filter(t=>{
    if(t.isPendingCuota || t.isPendingSubscription) return false;
    const monthKey=t.month||getMonthKey(t.date);
    return monthKey && monthKey<=currentMonthKey;
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
