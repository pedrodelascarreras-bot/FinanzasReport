// ══ INCOME PAGE ══
function getMonthTotalARS(m){
  let total=(m.extraArs||0);
  (m.sources?Object.entries(m.sources):[]).forEach(([srcId,amt])=>{
    const src=state.incomeSources.find(s=>s.id===srcId);
    if(src&&src.currency==='ARS')total+=amt||0;
  });
  return total;
}
function getMonthTotalUSD(m){
  let total=(m.extraUsd||0);
  (m.sources?Object.entries(m.sources):[]).forEach(([srcId,amt])=>{
    const src=state.incomeSources.find(s=>s.id===srcId);
    if(src&&src.currency==='USD')total+=amt||0;
  });
  return total;
}
// Combined ARS + USD×TC for income KPIs and chart
function getMonthTotalCombined(m){
  return getMonthTotalARS(m) + (getMonthTotalUSD(m) * USD_TO_ARS);
}

function getLatestIncomeARS(){
  if(!state.incomeMonths.length)return state.income.ars+state.income.varArs||0;
  const sorted=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month));
  return getMonthTotalARS(sorted[0]);
}
// setIncCurrency replaced by setIncChartMode
function renderIncomePage(){
  const months=[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month));
  const curMonthKey=getMonthKey(new Date());
  const TC=USD_TO_ARS||state.usdRate||1420;

  // Helper: combined total for a month entry (ARS + USD converted)
  function getMonthCombined(m){
    return getMonthTotalARS(m) + getMonthTotalUSD(m)*TC;
  }

  // Hero — widgets compactos: ARS fijo | USD fijo | Total | KPIs
  const curMonthData=months.find(m=>m.month===curMonthKey)||months[0];
  const curARS=curMonthData?getMonthTotalARS(curMonthData):0;
  const curUSD=curMonthData?getMonthTotalUSD(curMonthData):0;
  const curCombined=curARS+curUSD*TC;

  // Calcular fijos vs variables/comisiones
  function getMonthFixedARS(m){
    let t=0;(m&&m.sources?Object.entries(m.sources):[]).forEach(([sid,amt])=>{
      const s=state.incomeSources.find(x=>x.id===sid);if(s&&s.currency==='ARS'&&s.type==='fijo')t+=amt||0;});return t;}
  function getMonthFixedUSD(m){
    let t=0;(m&&m.sources?Object.entries(m.sources):[]).forEach(([sid,amt])=>{
      const s=state.incomeSources.find(x=>x.id===sid);if(s&&s.currency==='USD'&&s.type==='fijo')t+=amt||0;});return t;}

  const curFixedARS=getMonthFixedARS(curMonthData);
  const curFixedUSD=getMonthFixedUSD(curMonthData);
  const curVarCombined=(curARS-curFixedARS)+((curUSD-curFixedUSD)*TC);
  const mesLabel=curMonthData?fmtMonthLabel(curMonthData.month):fmtMonthLabel(curMonthKey);

  // ARS fijo
  const arsEl=document.getElementById('inc-hero-val');
  if(arsEl) arsEl.textContent=curFixedARS>0?'$'+fmtN(curFixedARS):(curARS>0?'$'+fmtN(curARS):'—');

  // USD fijo
  const usdEl=document.getElementById('inc-hero-val-usd');
  if(usdEl) usdEl.textContent=curFixedUSD>0?'U$D '+fmtN(curFixedUSD):(curUSD>0?'U$D '+fmtN(curUSD):'—');
  const usdEquivEl=document.getElementById('inc-hero-usd-ars-equiv');
  if(usdEquivEl){const u=curFixedUSD>0?curFixedUSD:(curUSD||0);usdEquivEl.textContent=u>0?'≈ $'+fmtN(u*TC)+' ARS':'—';}

  // Total combinado
  const combinedEl=document.getElementById('inc-hero-combined');
  if(combinedEl) combinedEl.textContent=curCombined>0?'$'+fmtN(curCombined):'—';
  const combinedDetail=document.getElementById('inc-hero-combined-detail');
  if(combinedDetail) combinedDetail.textContent='TC $'+fmtN(TC);

  // Comisiones pill
  const comPill=document.getElementById('inc-hero-comisiones-pill');
  if(comPill){
    if(curVarCombined>100){comPill.style.display='inline';comPill.textContent='+$'+fmtN(curVarCombined)+' extras';}
    else{comPill.style.display='none';}
  }

  // Delta vs mes anterior
  const deltaEl=document.getElementById('inc-hero-delta');
  if(months.length>=2){
    const prev=months[1];const prevCombined=getMonthCombined(prev);
    const diff=curCombined-prevCombined;const pct=prevCombined>0?(diff/prevCombined*100).toFixed(1):null;
    if(deltaEl){deltaEl.className='inc-hero-delta '+(diff>=0?'up':'down');
      deltaEl.textContent=(diff>=0?'▲ +':'▼ ')+'$'+fmtN(Math.abs(diff))+(pct?' ('+Math.abs(pct)+'%)':'');}
  } else if(deltaEl){deltaEl.className='inc-hero-delta neutral';deltaEl.textContent=mesLabel;}
  const heroSub=document.getElementById('inc-hero-sub');if(heroSub)heroSub.style.display='none';

  // KPIs — use combined values
  const allCombined=months.map(m=>getMonthCombined(m));
  const avgCombined=allCombined.reduce((s,v)=>s+v,0)/Math.max(allCombined.length,1);
  const bestCombined=Math.max(...allCombined,0);
  const bestMonthIdx=allCombined.indexOf(bestCombined);
  const bestMonth=months[bestMonthIdx];
  document.getElementById('inc-kpi-avg').textContent='$'+fmtN(avgCombined);
  document.getElementById('inc-kpi-avg-sub').textContent='ARS + USD×TC';
  if(document.getElementById('inc-kpi-best')) document.getElementById('inc-kpi-best').textContent='$'+fmtN(bestCombined);
  if(document.getElementById('inc-kpi-best-sub')) document.getElementById('inc-kpi-best-sub').textContent=bestMonth?fmtMonthLabel(bestMonth.month):'—';
  document.getElementById('inc-kpi-count').textContent=months.length;
  document.getElementById('inc-kpi-count-sub').textContent=' mes'+(months.length!==1?'es':'')+' registrado'+(months.length!==1?'s':'');

  // Ratio ahorro (combinado ingreso - gasto ARS / ingreso combinado)
  const spendCurARS=state.transactions.filter(t=>t.currency==='ARS'&&(t.month||getMonthKey(t.date))===curMonthKey).reduce((s,t)=>s+t.amount,0);
  const spendCurUSD=state.transactions.filter(t=>t.currency==='USD'&&(t.month||getMonthKey(t.date))===curMonthKey).reduce((s,t)=>s+t.amount,0);
  const spendCurCombined=spendCurARS+spendCurUSD*TC;
  if(curCombined>0){
    const ratio=Math.round((1-spendCurCombined/curCombined)*100);
    document.getElementById('inc-kpi-ratio').textContent=ratio+'%';
    document.getElementById('inc-kpi-ratio-sub').style.color=ratio>=state.savingsGoal?'var(--accent)':'var(--danger)';
    // Donut SVG
    const donut=document.getElementById('inc-ratio-donut');
    const donutLabel=document.getElementById('inc-ratio-donut-label');
    if(donut){const circ=201;const offset=circ-(Math.min(Math.max(ratio,0),100)/100*circ);donut.style.strokeDashoffset=offset;donut.style.stroke=ratio>=state.savingsGoal?'url(#incDonutGrad)':'var(--danger)';}
    if(donutLabel){donutLabel.textContent=ratio+'%';donutLabel.style.color=ratio>=state.savingsGoal?'var(--accent)':'var(--danger)';}
  }
  // Retomances = ingreso combinado acumulado histórico total
  const retomances=allCombined.reduce((s,v)=>s+v,0);
  const retEl=document.getElementById('inc-kpi-retomances');
  const retSubEl=document.getElementById('inc-kpi-retomances-sub');
  if(retEl) retEl.textContent=retomances>0?'$'+fmtN(Math.round(retomances)):'—';
  if(retSubEl) retSubEl.textContent=months.length>0?fmtMonthLabel(months[months.length-1].month)+' → '+fmtMonthLabel(months[0].month):(curMonthData?fmtMonthLabel(curMonthData.month):'—');

  // Monthly history list (show combined)
  const maxCombined=Math.max(...allCombined,1);
  document.getElementById('inc-month-list').innerHTML=months.length?months.map((m,i)=>{
    const ars=getMonthTotalARS(m),usd=getMonthTotalUSD(m);
    const combined=getMonthCombined(m);
    const prev=months[i+1];const prevCombined=prev?getMonthCombined(prev):null;
    const diff=prevCombined!==null?combined-prevCombined:null;const pct=prevCombined&&prevCombined>0?(diff/prevCombined*100).toFixed(0):null;
    const deltaColor=diff===null?'var(--text3)':diff>=0?'var(--accent)':'var(--danger)';
    const chips=Object.entries(m.sources||{}).map(([sid,amt])=>{const src=state.incomeSources.find(s=>s.id===sid);return src?'<span class="inc-month-source-chip" style="background:'+src.color+'18;border-color:'+src.color+'33;color:'+src.color+'">'+esc(src.name)+'</span>':''}).join('');
    const isCur=m.month===curMonthKey;
    return'<div class="inc-month-row'+(isCur?' current-month':'')+'" onclick="editIncMonth(\''+m.id+'\')">'
      +'<div class="inc-month-dot" style="background:'+(isCur?'var(--accent)':'var(--border2)')+'"></div>'
      +'<div class="inc-month-name">'+(isCur?'<span style="color:var(--accent)">▶ </span>':'')+fmtMonthLabel(m.month)+'</div>'
      +'<div class="inc-month-sources">'+chips+'</div>'
      +'<div class="inc-bar-wrap"><div class="inc-bar"><div class="inc-bar-fill" style="width:'+Math.round(combined/maxCombined*100)+'%"></div></div></div>'
      +'<div class="inc-month-total" style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;padding-left:16px;min-width:0;">'
        +(usd>0
          // Has both ARS and USD: show 3 chips
          ?'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">'
            +'<span style="font-size:11px;font-family:var(--font);color:var(--text3);background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:2px 8px;">$'+fmtN(ars)+'</span>'
            +'<span style="font-size:11px;font-family:var(--font);color:var(--accent2);background:rgba(96,200,240,0.08);border:1px solid rgba(96,200,240,0.2);border-radius:5px;padding:2px 8px;">U$D '+fmtN(usd)+'</span>'
          +'</div>'
          +'<div style="font-size:15px;font-weight:700;font-family:var(--font);color:var(--accent);">$'+fmtN(combined)+'</div>'
          // ARS only: one clean line
          :'<div style="font-size:15px;font-weight:700;font-family:var(--font);color:var(--text);">$'+fmtN(ars)+'</div>'
        )
      +'</div>'
      +'<div class="inc-month-delta" style="color:'+deltaColor+';">'+(pct?(diff>=0?'+':'')+pct+'%':'—')+'</div>'
      +'<div class="inc-month-actions"><button class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation();editIncMonth(\''+m.id+'\')">✎</button></div>'
      +'</div>';
  }).join(''):'<div class="empty-state" style="padding:40px;"><div class="empty-icon">◎</div><div class="empty-title">Sin meses registrados</div><div class="empty-sub">Hacé click en "+ Registrar mes"</div></div>';
  document.getElementById('inc-total-badge').textContent=months.length+' mes'+(months.length!==1?'es':'')+' · prom $'+fmtN(avgCombined)+' combinado';

  // ── Sync banner: warn if current month has no logged entry ──
  const _syncBanner=document.getElementById('inc-sync-banner');
  if(_syncBanner){
    const _hasCurEntry=!!state.incomeMonths.find(m=>m.month===curMonthKey);
    const _hasSources=(state.incomeSources||[]).some(s=>s.base>0);
    if(!_hasCurEntry&&_hasSources){
      const _srcTotal=(state.incomeSources||[]).filter(s=>s.currency==='ARS').reduce((a,s)=>a+(s.base||0),0);
      _syncBanner.style.display='flex';
      _syncBanner.innerHTML='<span style="font-size:13px;">⚠️ No hay ingreso registrado para el mes actual.</span>'
        +'<span style="font-size:12px;color:var(--text3);">Las fuentes tienen un base de <strong>$'+fmtN(_srcTotal)+'</strong> configurado.</span>'
        +'<button class="btn btn-primary" style="padding:7px 16px;font-size:12px;" onclick="syncCurrentMonthIncome()">🔄 Aplicar al mes actual</button>';
    } else {
      _syncBanner.style.display='none';
    }
  }

  // Sources panel
  renderIncSourcesPanel();
  renderIncomeChart();
}
function renderIncSourcesPanel(){
  const el=document.getElementById('inc-sources-list');if(!el)return;
  if(!state.incomeSources.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);font-family:var(--font);font-weight:400;">Sin fuentes configuradas</div>';return;}
  el.innerHTML='<div class="inc-source-grid">'+state.incomeSources.map(s=>{
    const c=s.color||'#888888';
    const typeLabel={fijo:'Fijo',variable:'Variable',freelance:'Freelance',alquiler:'Alquiler',dividendos:'Inversión',otro:'Otro'}[s.type]||s.type;
    return'<div class="inc-source-card" onclick="openIncomeSourceModal(\''+s.id+'\')" style="cursor:pointer;">'
      +'<div style="position:absolute;top:0;left:0;width:3px;height:100%;background:'+c+';border-radius:3px 0 0 3px;"></div>'
      +'<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;padding-left:4px;">'+esc(s.name)+'</div>'
      +'<div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;padding-left:4px;">'+typeLabel+'</div>'
      +'<div style="font-size:16px;font-weight:700;letter-spacing:-0.02em;font-family:var(--font);color:'+c+';padding-left:4px;">'+(s.currency==='USD'?'U$D ':'$')+fmtN(s.base||0)+'</div>'
      +'<div style="font-size:9px;color:var(--text3);font-family:var(--font);padding-left:4px;margin-top:2px;">base mensual</div>'
      +'</div>';
  }).join('')+'</div>';
}
function renderIncomeChart(){
  const TC=USD_TO_ARS||state.usdRate||1420;
  const mode=state.incChartMode||'ciclo'; // 'ciclo' | 'mensual'
  const months=[...state.incomeMonths].sort((a,b)=>a.month.localeCompare(b.month));
  if(!months.length)return;

  // Helper: combined income for a month entry
  const incCombined=m=>getMonthTotalARS(m)+getMonthTotalUSD(m)*TC;

  let labels=[], incData=[], spendData=[];

  if(mode==='ciclo'){
    // ── Spend by TC cycle, income = month where most of the cycle falls ──
    const allCycles=getTcCycles(); // desc sorted for getTcCycleOpen
    const cycles=allCycles.slice().sort((a,b)=>a.closeDate.localeCompare(b.closeDate)); // asc
    if(!cycles.length){
      // No TC cycles configured — show message and fall back to monthly
      const ctx2=document.getElementById('chart-income-evo');if(!ctx2)return;
      if(state.charts.incEvo)state.charts.incEvo.destroy();
      // Draw empty chart with a note
      state.charts.incEvo=null;
      ctx2.style.display='none';
      let noMsg=document.getElementById('chart-income-no-cycles');
      if(!noMsg){noMsg=document.createElement('div');noMsg.id='chart-income-no-cycles';noMsg.style.cssText='display:flex;align-items:center;justify-content:center;height:180px;flex-direction:column;gap:8px;color:var(--text3);font-size:13px;font-family:var(--font);';noMsg.innerHTML='<div style="font-size:22px;">📅</div><div>No hay ciclos de TC configurados</div><div style="font-size:11px;">Configuralos en Movimientos → selector de ciclo</div>';ctx2.parentNode.appendChild(noMsg);}
      noMsg.style.display='flex';
      return;
    }
    // Hide no-cycles msg if it was shown before
    const noMsg=document.getElementById('chart-income-no-cycles');if(noMsg)noMsg.style.display='none';
    const ctx2=document.getElementById('chart-income-evo');if(ctx2)ctx2.style.display='';

    cycles.forEach(cycle=>{
      const idx=allCycles.findIndex(c=>c.id===cycle.id);
      const openStr=getTcCycleOpen(allCycles,idx);
      if(!openStr)return;
      // Short label: close date month
      const closeD=new Date(cycle.closeDate+'T12:00:00');
      const openD=new Date(openStr+'T12:00:00');
      labels.push(cycle.label||openD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' – '+closeD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}));
      // Spend: all txns (ARS + USD×TC) within cycle dates
      const spend=state.transactions.reduce((s,t)=>{
        const d=dateToYMD(t.date);
        if(d>=openStr&&d<=cycle.closeDate)return s+(t.currency==='ARS'?t.amount:t.amount*TC);
        return s;
      },0);
      spendData.push(spend);
      // Income: find the income month that overlaps most with this cycle
      // Strategy: use the month of the midpoint of the cycle
      const midD=new Date((new Date(openStr+'T12:00:00').getTime()+new Date(cycle.closeDate+'T12:00:00').getTime())/2);
      const midMonthKey=getMonthKey(midD);
      // First try midpoint month, then close month, then open month
      const mEntry=months.find(m=>m.month===midMonthKey)
        ||months.find(m=>m.month===cycle.closeDate.slice(0,7))
        ||months.find(m=>m.month===openStr.slice(0,7));
      incData.push(mEntry?incCombined(mEntry):0);
    });
  } else {
    // ── Default: month by month ──
    labels=months.map(m=>fmtMonthLabel(m.month));
    incData=months.map(m=>incCombined(m));
    spendData=months.map(m=>{
      return state.transactions
        .filter(t=>(t.month||getMonthKey(t.date))===m.month)
        .reduce((s,t)=>s+(t.currency==='ARS'?t.amount:t.amount*TC),0);
    });
  }

  const saveData=incData.map((v,i)=>Math.max(0,v-spendData[i]));

  if(state.charts.incEvo)state.charts.incEvo.destroy();
  const ctx=document.getElementById('chart-income-evo');if(!ctx)return;
  state.charts.incEvo=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {label:'Ingreso combinado',data:incData,backgroundColor:'rgba(200,240,96,0.25)',borderColor:'#007aff',borderWidth:2,borderRadius:5,order:2},
    {label:'Gasto combinado',data:spendData,backgroundColor:'rgba(240,96,96,0.2)',borderColor:'#ff3b30',borderWidth:2,borderRadius:5,order:2},
    {label:'Ahorro neto',data:saveData,type:'line',borderColor:'#34c759',backgroundColor:'rgba(96,200,240,0.1)',borderWidth:2.5,fill:true,tension:0.4,pointRadius:4,pointBackgroundColor:'#34c759',order:1}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:'#8e8e93',font:{size:11},boxWidth:12,padding:14}},tooltip:{backgroundColor:_isL()?'#1d1d1f':'#2c2c2e',titleColor:_isL()?'#fff':'#f5f5f7',bodyColor:'#8e8e93',borderColor:'rgba(0,0,0,0.08)',borderWidth:1,callbacks:{label:c=>' $'+fmtN(c.parsed.y)+' (ARS+USD×TC)'}}},scales:{x:{grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'},ticks:{color:_isL()?'#86868b':'#6e6e73',font:{size:10}}},y:{grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'},ticks:{color:_isL()?'#86868b':'#6e6e73',font:{size:10},callback:v=>'$'+fmtN(v)}}}}});
}
function setIncChartMode(m){
  state.incChartMode=m;
  document.getElementById('inc-tog-mensual')?.classList.toggle('active',m==='mensual');
  document.getElementById('inc-tog-ciclo')?.classList.toggle('active',m==='ciclo');
  const sub=document.getElementById('inc-chart-sub');
  if(sub)sub.textContent=m==='ciclo'?'Ingreso vs Gasto por ciclo TC (ARS + USD×TC)':'Ingreso vs Gasto por mes (ARS + USD×TC)';
  renderIncomeChart();
}
function fmtMonthLabel(k){if(!k)return'—';const[y,m]=k.split('-');return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'});}

// ── Income source modal ──
function openIncomeSourceModal(id){
  const editing=id?state.incomeSources.find(s=>s.id===id):null;
  document.getElementById('modal-inc-src-title').textContent=editing?'Editar fuente':'Nueva fuente de ingreso';
  document.getElementById('modal-inc-src-editing').value=editing?editing.id:'';
  document.getElementById('inc-src-name').value=editing?editing.name:'';
  document.getElementById('inc-src-type').value=editing?editing.type:'fijo';
  document.getElementById('inc-src-currency').value=editing?editing.currency:'ARS';
  document.getElementById('inc-src-base').value=editing&&editing.base?editing.base:'';
  document.getElementById('btn-del-inc-src').style.display=editing?'inline-flex':'none';
  renderGenericColorPicker('inc-src-color-picker',editing?editing.color:'');
  openModal('modal-inc-source');
}
function saveIncSource(){
  const name=document.getElementById('inc-src-name').value.trim();if(!name){showToast('⚠️ Ingresá nombre','error');return;}
  const sw=document.querySelector('#inc-src-color-picker .color-swatch.selected');
  const color=sw?rgbToHex(sw.style.backgroundColor):'#007aff';
  const obj={id:document.getElementById('modal-inc-src-editing').value||Date.now().toString(36),name,type:document.getElementById('inc-src-type').value,currency:document.getElementById('inc-src-currency').value,base:parseFloat(document.getElementById('inc-src-base').value)||0,color};
  const idx=state.incomeSources.findIndex(s=>s.id===obj.id);
  if(idx>=0)state.incomeSources[idx]=obj;else state.incomeSources.push(obj);
  // Auto-sync: if current month already has an entry, update this source's amount in it
  if(obj.base>0){
    const _mk=getMonthKey(new Date());
    const _cur=state.incomeMonths.find(m=>m.month===_mk);
    if(_cur){
      if(!_cur.sources)_cur.sources={};
      _cur.sources[obj.id]=obj.base;
      state.income.ars=getMonthTotalARS(_cur);
    }
  }
  saveState();closeModal('modal-inc-source');renderIncomePage();refreshAll();showToast('✓ Fuente guardada','success');
}

// ── Sync current month with source bases ──────────────────────────────────────
function syncCurrentMonthIncome(){
  if(!(state.incomeSources||[]).some(s=>s.base>0)){
    showToast('⚠️ Configurá un monto base en las fuentes primero','error');return;
  }
  const mk=getMonthKey(new Date());
  const sources={};
  state.incomeSources.forEach(s=>{if(s.base>0)sources[s.id]=s.base;});
  let entry=state.incomeMonths.find(m=>m.month===mk);
  if(entry){
    // Merge: update each source amount but preserve extra and notes
    entry.sources=Object.assign({},entry.sources,sources);
  } else {
    entry={id:Date.now().toString(36),month:mk,sources,extraArs:0,extraUsd:0,note:'Auto-sincronizado'};
    state.incomeMonths.push(entry);
  }
  state.income.ars=getMonthTotalARS(entry);
  saveState();renderIncomePage();refreshAll();
  showToast('✓ Ingreso del mes sincronizado con las fuentes configuradas','success');
}
function deleteIncSource(){
  const id=document.getElementById('modal-inc-src-editing').value;
  state.incomeSources=state.incomeSources.filter(s=>s.id!==id);
  saveState();closeModal('modal-inc-source');renderIncomePage();refreshAll();showToast('Fuente eliminada','info');
}

// ── Log income month modal ──
function openLogIncomeModal(){
  document.getElementById('modal-log-inc-title').textContent='Registrar ingresos del mes';
  document.getElementById('log-inc-editing').value='';
  document.getElementById('log-inc-month').value=getMonthKey(new Date());
  document.getElementById('log-inc-note').value='';
  document.getElementById('log-inc-extra-ars').value='';
  document.getElementById('log-inc-extra-usd').value='';
  document.getElementById('btn-del-inc-month').style.display='none';
  buildLogIncSourceFields({});updateIncModalPreview();openModal('modal-log-income');
}
function editIncMonth(id){
  const m=state.incomeMonths.find(x=>x.id===id);if(!m)return;
  document.getElementById('modal-log-inc-title').textContent='Editar — '+fmtMonthLabel(m.month);
  document.getElementById('log-inc-editing').value=id;
  document.getElementById('log-inc-month').value=m.month;
  document.getElementById('log-inc-note').value=m.note||'';
  document.getElementById('log-inc-extra-ars').value=m.extraArs||'';
  document.getElementById('log-inc-extra-usd').value=m.extraUsd||'';
  document.getElementById('btn-del-inc-month').style.display='inline-flex';
  buildLogIncSourceFields(m.sources||{});updateIncModalPreview();openModal('modal-log-income');
}
function buildLogIncSourceFields(values){
  const el=document.getElementById('log-inc-sources-fields');
  if(!state.incomeSources.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);font-family:var(--font);padding:8px 0;">Configurá fuentes de ingreso primero (botón ⚙ Fuentes).</div>';return;}
  el.innerHTML=state.incomeSources.map(src=>{
    const c=src.color||'#888888';
    return'<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--surface2);border-radius:var(--r2);border:1px solid var(--border);">'
      +'<div style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0;"></div>'
      +'<div style="flex:1;font-size:13px;font-weight:600;">'+esc(src.name)+'<span style="font-size:10px;color:var(--text3);margin-left:6px;font-family:var(--font);">'+src.currency+'</span></div>'
      +'<input type="number" class="input-field" style="width:150px;padding:7px 10px;" id="log-src-'+src.id+'" placeholder="'+(src.base||0)+'" value="'+(values[src.id]||'')+'" oninput="updateIncModalPreview()">'
      +'</div>';
  }).join('');
}
function updateIncModalPreview(){
  let arsTotal=parseFloat(document.getElementById('log-inc-extra-ars')?.value)||0;
  let usdTotal=parseFloat(document.getElementById('log-inc-extra-usd')?.value)||0;
  state.incomeSources.forEach(src=>{const v=parseFloat(document.getElementById('log-src-'+src.id)?.value)||0;if(src.currency==='ARS')arsTotal+=v;else usdTotal+=v;});
  document.getElementById('log-inc-preview-ars').textContent='$'+fmtN(arsTotal);
  document.getElementById('log-inc-preview-usd').textContent='U$D '+fmtN(usdTotal);
}
function saveIncMonth(){
  const month=document.getElementById('log-inc-month').value;if(!month){showToast('⚠️ Seleccioná el mes','error');return;}
  const sources={};
  state.incomeSources.forEach(src=>{const v=parseFloat(document.getElementById('log-src-'+src.id)?.value)||0;if(v>0)sources[src.id]=v;});
  const extraArs=parseFloat(document.getElementById('log-inc-extra-ars').value)||0;
  const extraUsd=parseFloat(document.getElementById('log-inc-extra-usd').value)||0;
  const note=document.getElementById('log-inc-note').value.trim();
  const editing=document.getElementById('log-inc-editing').value;
  const obj={id:editing||Date.now().toString(36),month,sources,extraArs,extraUsd,note};
  const idx=state.incomeMonths.findIndex(x=>x.id===obj.id);
  if(idx>=0)state.incomeMonths[idx]=obj;else{
    // also check by month key
    const mIdx=state.incomeMonths.findIndex(x=>x.month===month&&!editing);
    if(mIdx>=0)state.incomeMonths[mIdx]=obj;else state.incomeMonths.push(obj);
  }
  // update legacy income fields so dashboard still works
  const totalARS=getMonthTotalARS(obj);
  state.income.ars=totalARS;
  saveState();closeModal('modal-log-income');renderIncomePage();
  showToast('✓ '+fmtMonthLabel(month)+' guardado','success');
  refreshAll();
}
function deleteIncMonth(){
  const id=document.getElementById('log-inc-editing').value;
  state.incomeMonths=state.incomeMonths.filter(m=>m.id!==id);
  saveState();closeModal('modal-log-income');renderIncomePage();refreshAll();showToast('Mes eliminado','info');
}
function saveIncConfig(){
  state.savingsGoal=parseInt(document.getElementById('inc-save').value)||20;
  state.alertThreshold=parseInt(document.getElementById('inc-alert').value)||80;
  const _sp=parseInt(document.getElementById('inc-spend-pct')?.value);
  state.spendPct=(_sp>0&&_sp<=100)?_sp:100;
  saveState();refreshAll();
}

// ══ INCOME (legacy compat) ══
function saveIncome(){
  const pn=s=>{const c=String(s||'').replace(/\./g,'').replace(',','.');return parseFloat(c)||0;};
  state.income.ars=pn(document.getElementById('inc-ars').value);state.income.varArs=pn(document.getElementById('inc-var-ars').value);state.income.usd=pn(document.getElementById('inc-usd').value);state.income.varUsd=pn(document.getElementById('inc-var-usd').value);
  state.savingsGoal=parseInt(document.getElementById('inc-save').value)||20;state.alertThreshold=parseInt(document.getElementById('inc-alert').value)||80;
  saveState();showToast('✓ Guardado','success');refreshAll();
}

// ══ API KEY ══
function getApiKey(){return state.apiKey||localStorage.getItem('fin_apikey')||'';}
function saveApiKey(){const k=document.getElementById('input-apikey').value.trim();if(!k)return;state.apiKey=k;localStorage.setItem('fin_apikey',k);closeModal('modal-apikey');showToast('✓ API Key guardada','success');}

