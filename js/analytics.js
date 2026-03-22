// ══ TENDENCIA (REDESIGNED) ══
function toggleBreakdown(id){
  const el=document.getElementById(id);
  const chev=document.getElementById(id+'-chevron');
  if(!el)return;
  const open=el.style.display!=='none';
  el.style.display=open?'none':'block';
  if(chev)chev.style.transform=open?'rotate(0deg)':'rotate(90deg)';
}
function setTendMode(m){
  state.tendMode=m;
  document.getElementById('tend-tog-week').classList.toggle('active',m==='week');
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
  if(state.tendMode==='week'){const d=new Date(k+'T12:00:00');const e=new Date(d);e.setDate(e.getDate()+6);return d.getDate()+'/'+(d.getMonth()+1);}
  if(state.tendMode==='tc'){
    const cycle=getTcCycles().find(c=>c.id===k);
    return cycle?cycle.label||cycle.closeDate:k;
  }
  const[y,m]=k.split('-');return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'});
}
function getTxnsForTendPeriod(k){
  if(state.tendMode==='week')return state.transactions.filter(t=>(t.week||getWeekKey(t.date))===k);
  if(state.tendMode==='tc'){
    const cycles=getTcCycles();
    const cycle=cycles.find(c=>c.id===k);
    return cycle?getTcCycleTxns(cycle,cycles):[];
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
  const keys=getTendPeriodKeys();
  if(keys.length<2){document.getElementById('tendencia-empty').style.display='block';document.getElementById('tendencia-content').style.display='none';return;}
  document.getElementById('tendencia-empty').style.display='none';document.getElementById('tendencia-content').style.display='flex';

  // ─ Populate period selector
  const pSel=document.getElementById('tend-period-select');
  if(pSel){
    const cv=pSel.value;
    let opts='<option value="">Todos los períodos</option>';
    keys.slice().reverse().forEach(k=>{opts+='<option value="'+k+'" '+(k===cv?'selected':'')+'>'+getTendPeriodLabel(k)+'</option>';});
    pSel.innerHTML=opts;
  }

  const selectedPeriod=pSel?.value||'';
  const activeKeys=selectedPeriod?[selectedPeriod]:keys;
  const labels=activeKeys.map(k=>getTendPeriodLabel(k));

  // ─ Aggregate by parent category
  const parentTotals={};const parentSubTotals={};
  CATEGORY_GROUPS.forEach(g=>{parentTotals[g.group]=0;parentSubTotals[g.group]={};g.subs.forEach(s=>{parentSubTotals[g.group][s]=0;});});
  activeKeys.forEach(k=>{
    getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&t.category&&t.category!=='Procesando...').forEach(t=>{
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
    chartSub.textContent=activeParents.length+' categorías · '+activeKeys.length+' períodos';
    const overallAvg=activeCatTotals.reduce((s,v)=>s+v,0)/Math.max(activeCatTotals.length,1);
    state.charts.tendMain=new Chart(ctx1,{
      type:'bar',
      data:{
        labels:activeCatNames.map((p,i)=>activeCatEmojis[i]+' '+p),
        datasets:[
          {label:'Gasto',data:activeCatTotals,backgroundColor:activeCatColors.map(c=>c+'bb'),borderColor:activeCatColors,borderWidth:1.5,borderRadius:5,borderSkipped:false,order:2},
          {label:'Promedio',data:activeCatNames.map(()=>overallAvg),type:'line',borderColor:'rgba(160,154,148,0.6)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:1}
        ]
      },
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:ctx=>ctx.datasetIndex===1?' Promedio: $'+fmtN(ctx.parsed.x):' $'+fmtN(ctx.parsed.x)}}},scales:{x:{ticks:{color:_isL()?'#86868b':'#7a7470',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}},y:{ticks:{color:_isL()?'#86868b':'#7a7470',font:{size:11,weight:'600'}},grid:{display:false}}}}
    });
  } else if(tendMode==='line'&&ctx1){
    // VISTA 2: Evolución temporal por categoría
    chartTitle.textContent='Evolución por categoría';
    chartSub.textContent='Top '+Math.min(activeParents.length,8)+' categorías · '+keys.length+' períodos';
    const lineLabels=keys.map(k=>getTendPeriodLabel(k));
    const lineCats=activeParents.slice(0,8);
    const datasets=lineCats.map(([parent])=>{
      const grp=CATEGORY_GROUPS.find(g=>g.group===parent);
      const c=grp?grp.color:'#888';
      return{label:grp?grp.emoji+' '+parent:parent,data:keys.map(k=>getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&grp?.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0)),borderColor:c,backgroundColor:c+'18',borderWidth:2,fill:false,tension:0.35,pointRadius:3,pointBackgroundColor:c,pointBorderColor:'#fff',pointBorderWidth:1.5};
    });
    state.charts.tendMain=new Chart(ctx1,{
      type:'line',data:{labels:lineLabels,datasets},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom',labels:{color:'#a09a94',font:{size:10},boxWidth:10,padding:10,usePointStyle:true}},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:ctx=>' '+ctx.dataset.label+': $'+fmtN(ctx.parsed.y)}}},scales:{x:{ticks:{color:_isL()?'#86868b':'#7a7470',font:{size:10}},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.03)'}},y:{ticks:{color:_isL()?'#86868b':'#7a7470',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}}}}
    });
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
          {label:pLabel,data:compCats.map(([p])=>parentDeltas[p].prev),backgroundColor:'rgba(160,154,148,0.3)',borderColor:'rgba(160,154,148,0.5)',borderWidth:1,borderRadius:4},
          {label:lLabel,data:compCats.map(([p])=>parentDeltas[p].last),backgroundColor:compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return(g?g.color:'#888')+'bb';}),borderColor:compCats.map(([p])=>{const g=CATEGORY_GROUPS.find(x=>x.group===p);return g?g.color:'#888';}),borderWidth:1.5,borderRadius:4}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom',labels:{color:'#a09a94',font:{size:10},boxWidth:10,padding:12,usePointStyle:true}},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:ctx=>' '+ctx.dataset.label+': $'+fmtN(ctx.parsed.y)}}},scales:{x:{ticks:{color:_isL()?'#86868b':'#7a7470',font:{size:9},maxRotation:45},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#7a7470',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'}}}}
    });
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
    const vals=keys.map(k=>getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS'&&grp?.subs.includes(t.category)).reduce((s,t)=>s+t.amount,0));
    const totalVal=vals.reduce((s,v)=>s+v,0);
    const lastVal=vals[vals.length-1]||0,prevVal=vals[vals.length-2]||0;
    const delta=prevVal>0?((lastVal-prevVal)/prevVal*100).toFixed(0):null;
    const deltaClass=delta===null?'neutral':+delta>0?'up':'down';
    const deltaText=delta===null?'\u2014':(+delta>0?'+':'')+delta+'%';
    const sparkId='spark-'+parent.replace(/[^a-zA-Z0-9]/g,'_');
    setTimeout(()=>{
      const ctx=document.getElementById(sparkId);if(!ctx)return;
      const ch=new Chart(ctx,{type:'line',data:{labels:keys.map(k=>getTendPeriodLabel(k)),datasets:[{data:vals,borderColor:c,backgroundColor:c+'18',borderWidth:1.5,fill:true,tension:0.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}});
      state.charts._sparklines.push(ch);
    },50);
    return '<div class="tend-sparkline-card"><div class="tend-spark-header"><div class="tend-spark-cat" style="color:'+c+';">'+emoji+' '+parent+'</div><div class="tend-spark-delta '+deltaClass+'">'+deltaText+'</div></div><div class="tend-spark-amount" style="color:'+c+';">$'+fmtN(totalVal)+'</div><div class="tend-spark-sub">total \u00b7 prom $'+fmtN(totalVal/Math.max(vals.length,1))+'/per\u00edodo</div><div class="sparkline-wrap"><canvas id="'+sparkId+'"></canvas></div></div>';
  }).join('');

  // ════════════════════════════════════════════
  // 5. BREAKDOWN ACCORDION
  // ════════════════════════════════════════════
  const breakdownEl=document.getElementById('tend-breakdown');
  const breakdownSub=document.getElementById('tend-breakdown-sub');
  if(breakdownSub)breakdownSub.textContent=activeParents.length+' categorías con gasto · '+activeKeys.length+' períodos';
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

  // ════════════════════════════════════════════
  // 6. INSIGHTS
  // ════════════════════════════════════════════
  const insEl=document.getElementById('tend-insights');
  if(insEl){
    const insights=[];
    if(activeParents.length&&grandTotal>0){
      const topP=activeParents[0];const topPct=Math.round(topP[1]/grandTotal*100);
      if(topPct>40)insights.push({icon:'⚠️',type:'warn',text:'<strong>'+topP[0]+'</strong> representa el '+topPct+'% del gasto total. Alta concentración en una sola categoría.'});
    }
    if(totalDelta!==null){
      if(totalDelta>15)insights.push({icon:'🔴',type:'alert',text:'Tu gasto total subió un <strong>+'+Math.round(totalDelta)+'%</strong> respecto al período anterior. Revisá qué categorías crecieron.'});
      else if(totalDelta<-10)insights.push({icon:'🟢',type:'good',text:'¡Bajaste un <strong>'+Math.abs(Math.round(totalDelta))+'%</strong> vs el período anterior! Excelente control.'});
    }
    // Fast growers
    const growers=Object.entries(parentDeltas).filter(([,d])=>d.pct>20&&d.prev>0).sort((a,b)=>b[1].pct-a[1].pct);
    if(growers.length)insights.push({icon:'📈',type:'warn',text:growers.map(([p,d])=>'<strong>'+p+'</strong> +'+Math.round(d.pct)+'%').join(', ')+' — las que más crecieron.'});
    // Declining
    const decliners=Object.entries(parentDeltas).filter(([,d])=>d.pct<-15&&d.prev>0).sort((a,b)=>a[1].pct-b[1].pct);
    if(decliners.length)insights.push({icon:'📉',type:'good',text:'Redujiste gasto en '+decliners.map(([p])=>p).join(', ')+'.'});
    // Subcategory concentration
    activeParents.slice(0,3).forEach(([parent,total])=>{
      const subs=Object.entries(parentSubTotals[parent]||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      if(subs.length>=2){const topSubPct=Math.round(subs[0][1]/total*100);
        if(topSubPct>75)insights.push({icon:'🔍',type:'info',text:'En <strong>'+parent+'</strong>, el '+topSubPct+'% se concentra en '+subs[0][0]+'.'});}
    });
    // Trend over time
    if(keys.length>=4){
      const half=Math.floor(keys.length/2);
      const firstAvg=keys.slice(0,half).reduce((s,k)=>s+getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS').reduce((ss,t)=>ss+t.amount,0),0)/half;
      const secAvg=keys.slice(half).reduce((s,k)=>s+getTxnsForTendPeriod(k).filter(t=>t.currency==='ARS').reduce((ss,t)=>ss+t.amount,0),0)/(keys.length-half);
      if(secAvg>firstAvg*1.15)insights.push({icon:'📊',type:'warn',text:'Tu gasto promedio subió un <strong>+'+Math.round((secAvg/firstAvg-1)*100)+'%</strong> en la segunda mitad del período.'});
      else if(firstAvg>secAvg*1.1)insights.push({icon:'🎉',type:'good',text:'Tu promedio bajó un <strong>'+Math.round((1-secAvg/firstAvg)*100)+'%</strong> en la segunda mitad. ¡Buen trabajo!'});
    }
    if(!insights.length)insights.push({icon:'👍',type:'info',text:'Todo dentro de parámetros normales. Seguí así.'});
    const colors={warn:'rgba(255,100,50,0.08)',good:'rgba(52,199,89,0.08)',alert:'rgba(255,59,48,0.1)',info:'var(--surface2)'};
    const borders={warn:'rgba(255,100,50,0.2)',good:'rgba(52,199,89,0.2)',alert:'rgba(255,59,48,0.25)',info:'var(--border)'};
    insEl.innerHTML=insights.map(i=>'<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;background:'+(colors[i.type]||colors.info)+';border:1px solid '+(borders[i.type]||borders.info)+';border-radius:10px;"><span style="font-size:16px;flex-shrink:0;">'+i.icon+'</span><span style="font-size:12px;color:var(--text2);line-height:1.5;">'+i.text+'</span></div>').join('');
  }

  document.getElementById('tend-sub-title').textContent=(state.tendMode==='week'?'Por semana':'Por mes')+' · '+activeParents.length+' categorías activas';
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
function getPeriodKeys(){
  if(state.compareMode==='tc'){
    return getTcCycles().slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate)).map(c=>c.id);
  }
  return[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort();
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
  const sa=document.getElementById('cmp-a'),sb=document.getElementById('cmp-b');sa.innerHTML=opts;sb.innerHTML=opts;if(keys.length>=2){sa.value=keys[keys.length-2];sb.value=keys[keys.length-1];}
}
function getTxnsFor(key){
  if(state.compareMode==='tc'){
    const cycles=getTcCycles();
    const cycle=cycles.find(c=>c.id===key);
    return cycle?getTcCycleTxns(cycle,cycles):[];
  }
  return state.transactions.filter(t=>(t.month||getMonthKey(t.date))===key);
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

// ══ INSIGHTS IA (REDESIGNED) ══
async function generateInsights(){
  if(!state.transactions.length)return;
  if(!document.getElementById('insights-empty'))return;
  document.getElementById('insights-empty').style.display='none';document.getElementById('insights-content').style.display='none';document.getElementById('insights-loading').style.display='flex';
  const catD=getCatData();const wkD=getWeeklyData();
  const arsT=state.transactions.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdT=state.transactions.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const incArs=state.income.ars+state.income.varArs;
  const avgWeek=arsT/Math.max(wkD.values.length,1);
  const monthEstimate=avgWeek*4.3;
  // Find fastest growing category across periods
  const pKeys=getTendPeriodKeys();
  let topGrow=null,topGrowPct=0;
  if(pKeys.length>=2){
    const last=pKeys[pKeys.length-1],prev=pKeys[pKeys.length-2];
    const txLast=getTxnsForTendPeriod(last),txPrev=getTxnsForTendPeriod(prev);
    const cLast=getCatData(txLast),cPrev=getCatData(txPrev);
    const cMapL={},cMapP={};cLast.labels.forEach((l,i)=>{cMapL[l]=cLast.values[i];});cPrev.labels.forEach((l,i)=>{cMapP[l]=cPrev.values[i];});
    Object.keys(cMapL).forEach(cat=>{if(cMapP[cat]>0){const pct=(cMapL[cat]-cMapP[cat])/cMapP[cat]*100;if(pct>topGrowPct){topGrowPct=pct;topGrow=cat;}}});
  }
  // Sidebar stats
  document.getElementById('ins-monthly').textContent='$'+fmtN(monthEstimate);
  document.getElementById('ins-monthly-sub').textContent='Basado en $'+fmtN(avgWeek)+' / semana';
  if(topGrow){document.getElementById('ins-top-grow').textContent=topGrow;document.getElementById('ins-top-grow-sub').textContent='+'+topGrowPct.toFixed(0)+'% vs período anterior';}
  else{document.getElementById('ins-top-grow').textContent='—';document.getElementById('ins-top-grow-sub').textContent='Necesitás más períodos';}
  // Mini proj chart
  if(state.charts.proj)state.charts.proj.destroy();
  const ctx=document.getElementById('chart-proj');
  const today=new Date();const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();const dayOfMonth=today.getDate();
  const soFar=state.transactions.filter(t=>t.currency==='ARS'&&t.month===getMonthKey(today)).reduce((s,t)=>s+t.amount,0)||arsT;
  const projected=soFar/dayOfMonth*daysInMonth;
  const incLimit=incArs>0?incArs*state.alertThreshold/100:null;
  if(ctx)state.charts.proj=new Chart(ctx,{type:'bar',data:{labels:['Actual','Proyectado',...(incLimit?['Límite']:[])] ,datasets:[{data:[soFar,projected,...(incLimit?[incLimit]:[])],backgroundColor:['rgba(200,240,96,0.3)',projected>soFar*1.5?'rgba(240,96,96,0.3)':'rgba(96,200,240,0.3)',...(incLimit?['rgba(240,160,96,0.2)']:[])],borderColor:['#007aff',projected>soFar*1.5?'#ff3b30':'#34c759',...(incLimit?['#ff9500']:[])],borderWidth:1.5,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:_isL()?'#1d1d1f':'#2c2c2e',titleColor:_isL()?'#fff':'#f5f5f7',bodyColor:'#8e8e93',borderColor:'rgba(0,0,0,0.08)',borderWidth:1,callbacks:{label:c=>' $'+fmtN(c.parsed.y)+' ARS'}}},scales:{x:{grid:{display:false},ticks:{color:'#c7c7cc',font:{size:11}}},y:{grid:{color:'#1a1a1a'},ticks:{color:'#c7c7cc',font:{size:10},callback:v=>'$'+fmtN(v)}}}}});
  // Generate insight items
  const summary={total_ars:arsT,total_usd:usdT,income_ars:incArs,spending_pct:incArs>0?Math.round(arsT/incArs*100):null,categories:catD.labels.map((l,i)=>({name:l,amount:catD.values[i],pct:Math.round(catD.values[i]/arsT*100)})).slice(0,8),weekly_avg:avgWeek,monthly_est:monthEstimate,top_grow:topGrow,top_grow_pct:topGrowPct.toFixed(0),txn_count:state.transactions.length,periods:pKeys.length,alert_threshold:state.alertThreshold};
  let items=[];const apiKey=getApiKey();
  if(apiKey){
    try{
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,messages:[{role:'user',content:'Sos asesor financiero experto en finanzas personales argentinas. Analizá estos datos REALES y generá exactamente 6 insights accionables y específicos en español rioplatense informal. Cada insight debe ser concreto, usar los números reales y decir algo útil.\n\nDatos: '+JSON.stringify(summary)+'\n\nResponde SOLO este JSON (sin backticks, sin texto extra):\n[{"emoji":"X","type":"good|warn|info|bad","label":"TITULO CORTO","headline":"Una oración directa con el dato concreto","body":"2-3 oraciones de contexto y qué hacer, mencionando montos exactos"}]'}]})});
      const d=await r.json();items=JSON.parse((d.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim());
    }catch(e){items=fallbackInsights(summary);}
  }else items=fallbackInsights(summary);
  document.getElementById('insight-feed').innerHTML=items.map(item=>'<div class="insight-item '+item.type+'-item"><div class="i-emoji">'+item.emoji+'</div><div class="i-content"><div class="i-label">'+esc(item.label)+'</div><div class="i-headline">'+esc(item.headline)+'</div><div class="i-body">'+item.body+'</div></div></div>').join('');
  document.getElementById('insights-loading').style.display='none';document.getElementById('insights-content').style.display='flex';
}
function fallbackInsights(s){
  const top=s.categories[0];const sec=s.categories[1];
  const pct=s.spending_pct;const overBudget=pct&&pct>s.alert_threshold;
  return[
    {emoji:overBudget?'🔴':'🟢',type:overBudget?'bad':'good',label:'PRESUPUESTO',headline:overBudget?'Estás al '+pct+'% de tu ingreso — sobre el límite del '+s.alert_threshold+'%':'Bien encaminado: usaste el '+pct+'% del ingreso',body:overBudget?'Gastaste <strong>$'+fmtN(s.total_ars)+' ARS</strong> de un ingreso de <strong>$'+fmtN(s.income_ars)+'</strong>. Revisá '+top?.name+' y '+sec?.name+' para recortar.':'Gastaste <strong>$'+fmtN(s.total_ars)+' ARS</strong>. El margen restante es <strong>$'+fmtN(s.income_ars-s.total_ars)+'</strong>. Buen trabajo.'},
    {emoji:'🏆',type:'info',label:'CATEGORÍA TOP',headline:top?.name+' se llevó el '+top?.pct+'% de tus gastos',body:'<strong>$'+fmtN(top?.amount)+'</strong> en '+top?.name+'. El segundo puesto es '+sec?.name+' con <strong>$'+fmtN(sec?.amount)+'</strong>. Juntos suman el '+(top?.pct+sec?.pct)+'% del total.'},
    {emoji:'📅',type:'info',label:'RITMO SEMANAL',headline:'Gastás $'+fmtN(s.weekly_avg)+' ARS por semana en promedio',body:'A este ritmo, el mes te sale <strong>$'+fmtN(s.monthly_est)+'</strong>.'+(s.income_ars>0?' Eso es el '+Math.round(s.monthly_est/s.income_ars*100)+'% de tu ingreso mensual.':'')},
    {emoji:s.total_usd>0?'💵':'💡',type:s.total_usd>0?'warn':'info',label:s.total_usd>0?'GASTOS USD':'SIN USD',headline:s.total_usd>0?'U$D '+fmtN(s.total_usd)+' en gastos en dólares':'No tenés gastos en dólares registrados',body:s.total_usd>0?'Tené en cuenta el tipo de cambio para estimar el impacto real en pesos. Estos gastos no entran en los porcentajes ARS.':'Si tenés suscripciones en USD (Netflix, Spotify, etc.) podés agregarlas en la sección Suscripciones.'},
    {emoji:s.top_grow?'📈':'📊',type:s.top_grow?'warn':'info',label:'CRECIMIENTO',headline:s.top_grow?s.top_grow+' creció un +'+s.top_grow_pct+'% vs el período anterior':'Sin comparación disponible aún',body:s.top_grow?'Ojo con <strong>'+s.top_grow+'</strong> — fue la categoría que más aumentó. Revisá si fue algo puntual o una tendencia.':'Importá más períodos para ver qué categorías están creciendo.'},
    {emoji:'🎯',type:'good',label:'PRÓXIMOS PASOS',headline:'Tenés '+s.txn_count+' movimientos en '+s.periods+' período'+(s.periods!==1?'s':'')+' importados',body:'Para un análisis completo importá al menos 4 semanas. Revisá la pestaña <strong>Cuotas</strong> para ver compromisos futuros y <strong>Suscripciones</strong> para tener visibilidad total de gastos fijos.'}
  ];
}

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
    options:{...chartOpts('$',false),plugins:{...chartOpts('$',false).plugins,legend:{display:false}}}
  });
}

