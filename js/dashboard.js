// ══ DASHBOARD ══
let USD_TO_ARS = state.usdRate || 1420;
async function fetchUsdRate(manual=false){
  const btn=document.getElementById('btn-refresh-usd');
  const statusEl=document.getElementById('usd-rate-status');
  if(btn){btn.disabled=true;btn.textContent='↻ ...';}
  if(statusEl)statusEl.textContent='Actualizando...';

  // Múltiples fuentes con fallback — todas tienen CORS abierto
  const sources=[
    // 1. dolarapi directo
    {url:'https://dolarapi.com/v1/dolares/oficial', parse:d=>d.venta},
    // 2. dolarapi via allorigins proxy
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://dolarapi.com/v1/dolares/oficial'), parse:d=>{const j=JSON.parse(d.contents);return j.venta;}},
    // 3. bluelytics directo
    {url:'https://api.bluelytics.com.ar/v2/latest', parse:d=>d.oficial?.value_sell},
    // 4. bluelytics via allorigins
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://api.bluelytics.com.ar/v2/latest'), parse:d=>{const j=JSON.parse(d.contents);return j.oficial?.value_sell;}},
    // 5. Argentina.gob.ar series de tiempo (BCRA oficial)
    {url:'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD', parse:d=>d.results?.[0]?.tipoPase}
  ];

  for(const src of sources){
    try{
      const _ctrl=new AbortController();const _tmr=setTimeout(()=>_ctrl.abort(),5000);
      const r=await fetch(src.url,{signal:_ctrl.signal});
      clearTimeout(_tmr);
      if(!r.ok)continue;
      const d=await r.json();
      const venta=src.parse(d);
      if(venta&&venta>0){
        USD_TO_ARS=venta;state.usdRate=venta;
        state.usdRateSource='oficial BNA';
        state.usdRateUpdated=new Date().toISOString();
        saveState();updateUsdRateUI();
        if(manual)showToast('✓ Oficial BNA: $'+fmtN(venta)+'/USD');
        if(btn){btn.disabled=false;btn.textContent='↻ Actualizar';}
        if(statusEl)statusEl.textContent='';
        return;
      }
    }catch(e){}
  }

  if(manual)showToast('⚠️ No se pudo conectar. Editá el valor manualmente.');
  if(btn){btn.disabled=false;btn.textContent='↻ Actualizar';}
  if(statusEl)statusEl.textContent='';
}
function updateUsdRateUI(){
  const rate=USD_TO_ARS;
  // Card en dashboard
  const disp=document.getElementById('usd-rate-display');
  if(disp)disp.textContent='$'+fmtN(rate);
  const src=document.getElementById('usd-rate-source-badge');
  if(src)src.textContent=state.usdRateSource||'manual';
  const upd=document.getElementById('usd-rate-updated');
  if(upd&&state.usdRateUpdated){const d=new Date(state.usdRateUpdated);upd.textContent='Actualizado '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});}
  // Legacy badge selector (otros lugares que puedan tener el badge)
  document.querySelectorAll('.usd-rate-badge').forEach(el=>{el.textContent='U$D 1 = $'+fmtN(rate)+' ('+( state.usdRateSource||'manual')+')'});
  // Si el dashboard ya tiene datos, recalcular
  if(state.transactions.length)renderDashboard();
}
function openUsdRateModal(){
  document.getElementById('modal-usd-input').value=Math.round(USD_TO_ARS);
  openModal('modal-usd-rate');
  loadAllRates();
}
function saveUsdRateManual(){
  const val=parseFloat(document.getElementById('modal-usd-input').value);
  if(!val||val<1){showToast('⚠️ Ingresá un valor válido','error');return;}
  USD_TO_ARS=val;state.usdRate=val;state.usdRateSource='manual';state.usdRateUpdated=new Date().toISOString();
  saveState();updateUsdRateUI();closeModal('modal-usd-rate');showToast('✓ Tipo de cambio actualizado: $'+fmtN(val),'success');
}
async function loadAllRates(){
  const blueEl=document.getElementById('ref-blue');
  const oficialEl=document.getElementById('ref-oficial');
  const mepEl=document.getElementById('ref-mep');
  if(blueEl)blueEl.textContent='Cargando...';
  try{
    const r=await fetch('https://dolarapi.com/v1/dolares');
    if(r.ok){
      const list=await r.json();
      const blue=list.find(d=>d.casa==='blue');
      const oficial=list.find(d=>d.casa==='oficial');
      const mep=list.find(d=>d.casa==='bolsa')||list.find(d=>d.casa==='mep');
      if(blueEl)blueEl.textContent=blue?'$'+fmtN(blue.venta):'—';
      if(oficialEl)oficialEl.textContent=oficial?'$'+fmtN(oficial.venta):'—';
      if(mepEl)mepEl.textContent=mep?'$'+fmtN(mep.venta):'—';
      // Pre-fill input with blue
      if(blue&&blue.venta){const inp=document.getElementById('modal-usd-input');if(inp&&!inp.value)inp.value=Math.round(blue.venta);}
      return;
    }
  }catch(e){}
  // fallback bluelytics
  try{
    const r2=await fetch('https://api.bluelytics.com.ar/v2/latest');
    if(r2.ok){const d=await r2.json();
      if(blueEl)blueEl.textContent=d.blue?.value_sell?'$'+fmtN(d.blue.value_sell):'—';
      if(oficialEl)oficialEl.textContent=d.oficial?.value_sell?'$'+fmtN(d.oficial.value_sell):'—';
      if(mepEl)mepEl.textContent='—';
    }
  }catch(e2){if(blueEl)blueEl.textContent='Sin conexión';}
}
function getActiveDashMonth(){
  return state.dashMonth || getMonthKey(new Date());
}
function getCurrentMonthTxns(){
  const mk=getActiveDashMonth();
  return state.transactions.filter(t=>t.month===mk||getMonthKey(t.date)===mk);
}
function getAvailableMonths(){
  const set=new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)));
  return [...set].sort();
}
function setDashView(mode){
  state.dashView=mode;
  // Update toggle button styles
  const btnMes=document.getElementById('dash-toggle-mes');
  const btnTc=document.getElementById('dash-toggle-tc');
  if(btnMes&&btnTc){
    if(mode==='tc'){
      btnMes.style.background='transparent';btnMes.style.color='var(--text3)';
      btnTc.style.background='var(--accent)';btnTc.style.color='#ffffff';
    } else {
      btnMes.style.background='var(--accent)';btnMes.style.color='#ffffff';
      btnTc.style.background='transparent';btnTc.style.color='var(--text3)';
    }
  }
  saveState();
  renderDashboard();
}

function setDashMonthFromSelect(val){
  if(state.dashView==='tc'){
    state.dashTcCycle=val||null;
  } else {
    state.dashMonth=val||null;
  }
  saveState();
  renderDashboard();
}
function updateMonthPicker(){
  // In TC mode, the selector is managed by renderDashboard's TC branch — don't touch it
  if(state.dashView==='tc') return;
  const sel=document.getElementById('dash-month-select');
  if(!sel)return;
  const months=getAvailableMonths();
  const cur=state.dashMonth||'';
  const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  sel.innerHTML='<option value="">Mes actual</option>'+months.reverse().map(m=>{
    const[y,mo]=m.split('-');
    return'<option value="'+m+'" '+(m===cur?'selected':'')+'>'+MNAMES[+mo-1]+' '+y+'</option>';
  }).join('');
}
function toggleDashInsights(){
  const panel=document.getElementById('dash-insights-panel');
  if(!panel)return;
  const visible=panel.style.display!=='none';
  panel.style.display=visible?'none':'flex';
  if(!visible)generateDashInsights();
}
async function generateDashInsights(){
  const panel=document.getElementById('dash-insights-panel');
  const loadEl=document.getElementById('dash-insights-loading');
  const feedEl=document.getElementById('dash-insight-feed');
  const monthLabelEl=document.getElementById('insights-month-label');
  if(!panel||!loadEl||!feedEl)return;
  const monthTxns=getCurrentMonthTxns();
  if(!monthTxns.length){feedEl.innerHTML='<div style="padding:16px;color:var(--text3);font-size:13px;">Sin movimientos para este mes.</div>';return;}
  const activeMk=getActiveDashMonth();
  const[iY,iM]=activeMk.split('-').map(Number);
  const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if(monthLabelEl)monthLabelEl.textContent=MNAMES[iM-1]+' '+iY;
  loadEl.style.display='flex';feedEl.style.display='none';
  const arsT=monthTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdT=monthTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const catD=getCatData(monthTxns);
  const incArs=state.income.ars+state.income.varArs;
  const summary={mes:MNAMES[iM-1]+' '+iY,total_ars:arsT,total_usd:usdT,income_ars:incArs,spending_pct:incArs>0?Math.round(arsT/incArs*100):null,categories:catD.labels.map((l,i)=>({name:l,amount:catD.values[i],pct:Math.round(catD.values[i]/arsT*100)})).slice(0,8),txn_count:monthTxns.length,alert_threshold:state.alertThreshold};
  let items=[];const apiKey=getApiKey();
  if(apiKey){
    try{
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,messages:[{role:'user',content:'Sos asesor financiero experto en finanzas personales argentinas. Analizá estos datos del mes de '+summary.mes+' y generá exactamente 5 insights accionables en español rioplatense informal. Usá los números reales.\n\nDatos: '+JSON.stringify(summary)+'\n\nResponde SOLO este JSON (sin backticks):\n[{"emoji":"X","type":"good|warn|info|bad","label":"TITULO","headline":"Una oración directa con el dato","body":"2-3 oraciones de contexto y qué hacer"}]'}]})});
      const d=await r.json();items=JSON.parse((d.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim());
    }catch(e){items=fallbackInsights(summary);}
  }else items=fallbackInsights(summary);
  feedEl.innerHTML=items.map(item=>'<div class="insight-item '+(item.type||'info')+'-item"><div class="i-emoji">'+item.emoji+'</div><div class="i-content"><div class="i-label">'+esc(item.label)+'</div><div class="i-headline">'+esc(item.headline)+'</div><div class="i-body">'+item.body+'</div></div></div>').join('');
  loadEl.style.display='none';feedEl.style.display='flex';
}


function renderDashboard(){
  if(!state.transactions.length)return;
  const today=new Date();
  const activeMk=getActiveDashMonth();
  // ── TC vs Mes mode (declared here, used throughout the function) ──
  const isTcView=state.dashView==='tc';
  // ── Sync toggle buttons ──
  const _btnM=document.getElementById('dash-toggle-mes');
  const _btnT=document.getElementById('dash-toggle-tc');
  if(_btnM&&_btnT){
    _btnM.style.background=isTcView?'transparent':'var(--accent)';
    _btnM.style.color=isTcView?'var(--text3)':'#ffffff';
    _btnT.style.background=isTcView?'var(--accent)':'transparent';
    _btnT.style.color=isTcView?'#ffffff':'var(--text3)';
  }
  // Keep period selector in sync
  const _dashSel=document.getElementById('dash-month-select');
  if(_dashSel){
    if(isTcView){
      // TC mode: show cycle list
      const _cycles=getTcCycles();
      const _selId=state.dashTcCycle||'';
      _dashSel.innerHTML='<option value="">Ciclo actual</option>'+_cycles.map(c=>'<option value="'+c.id+'" '+(c.id===_selId?'selected':'')+'>'+esc(c.label)+'</option>').join('');
    } else {
      // Mes mode: show calendar months
      if(!_dashSel.querySelector('option[value="'+activeMk+'"]')){
        const months=[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort().reverse();
        const _MN=['Enero','Feb','Marzo','Abril','Mayo','Junio','Julio','Agosto','Sep','Oct','Nov','Dic'];
        _dashSel.innerHTML='<option value="">Mes actual</option>'+months.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===activeMk?'selected':'')+'>'+_MN[+mo-1]+' '+y+'</option>';}).join('');
      } else {
        _dashSel.value=state.dashMonth||'';
      }
    }
  }
  const isCurrentMonth=activeMk===getMonthKey(today);
  let monthTxns, tcPeriodLabel='', activeTcCycle=null;
  if(isTcView){
    const cycles=getTcCycles(); // sorted desc by closeDate
    if(cycles.length){
      // Pick selected cycle, fall back to most recent (cycles[0])
      const selId=state.dashTcCycle||'';
      activeTcCycle=(selId&&cycles.find(c=>c.id===selId))||cycles[0];
      // Sync selector value
      if(_dashSel) _dashSel.value=activeTcCycle.id;
      state.dashTcCycle=activeTcCycle.id;
      const idx2=cycles.findIndex(c=>c.id===activeTcCycle.id);
      const open=getTcCycleOpen(cycles,idx2);
      if(open){
        const openD=new Date(open+'T12:00:00');
        const closeD=new Date(activeTcCycle.closeDate+'T12:00:00');
        tcPeriodLabel=activeTcCycle.label+' · '+openD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' → '+closeD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
        monthTxns=getTcCycleTxns(activeTcCycle, cycles);
      } else {
        monthTxns=[];
        tcPeriodLabel=activeTcCycle.label;
      }
    } else {
      monthTxns=[];
      tcPeriodLabel='Sin ciclos configurados — agregá uno en ⚙ Tarjeta de Crédito';
    }
  } else {
    monthTxns=getCurrentMonthTxns();
  }

  // ── Gastos ──
  const arsMonth=monthTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdMonth=monthTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const cntMonth=monthTxns.length;
  const arsCnt=monthTxns.filter(t=>t.currency==='ARS').length;

  // TC del mes
  const tcMonth=monthTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='tc').reduce((s,t)=>s+t.amount,0);
  const debMonth=monthTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='deb').reduce((s,t)=>s+t.amount,0);
  const hasPayTags=monthTxns.some(t=>t.payMethod);

  // ── Widget Tarjeta: SIEMPRE usa el ciclo TC activo (independiente del modo) ──
  const _tcCycles=getTcCycles();
  let _tcWidgetTxns=monthTxns; // fallback: mismo período
  if(_tcCycles.length){
    const _activeTc=_tcCycles.find(c=>{
      const _i=_tcCycles.findIndex(x=>x.id===c.id);
      const _op=getTcCycleOpen(_tcCycles,_i);
      const _today=dateToYMD(new Date());
      return _op&&_today>=_op&&_today<=c.closeDate;
    })||_tcCycles[0];
    _tcWidgetTxns=getTcCycleTxns(_activeTc,_tcCycles);
  }
  const tcWidgetAmt=_tcWidgetTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='tc').reduce((s,t)=>s+t.amount,0);
  const debWidgetAmt=_tcWidgetTxns.filter(t=>t.currency==='ARS'&&t.payMethod==='deb').reduce((s,t)=>s+t.amount,0);
  const hasPayTagsWidget=_tcWidgetTxns.some(t=>t.payMethod);

  // ── Ingresos ── (usa incomeMonths del mes activo si existe, fallback a legacy)
  let incARS=state.income.ars+state.income.varArs;
  let incUSD=state.income.usd+state.income.varUsd;
  if(state.incomeMonths&&state.incomeMonths.length){
    const _activeInc=state.incomeMonths.find(m=>m.month===activeMk)||[...state.incomeMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];
    if(_activeInc){incARS=getMonthTotalARS(_activeInc);incUSD=getMonthTotalUSD(_activeInc);}
  }
  const incTotalARS=incARS+(incUSD*USD_TO_ARS);
  const totalGastoARS=arsMonth+(usdMonth*USD_TO_ARS);
  const pct=incTotalARS>0?Math.round((totalGastoARS/incTotalARS)*100):null;
  const spendBudget=incTotalARS>0?incTotalARS*(state.spendPct||100)/100:0;
  const margen=incTotalARS>0?Math.max(0,spendBudget-totalGastoARS):null;

  // ── Proyección ──
  const[pY,pM]=activeMk.split('-').map(Number);
  const daysInMonth=new Date(pY,pM,0).getDate();
  let dailyRate=0, projected=0, daysLeft=0, projPeriodOpen=null, projPeriodClose=null;

  if(isTcView && activeTcCycle){
    // Modo TC: proyectar hasta el cierre del ciclo TC activo
    const _tcOpen=getTcCycleOpen(getTcCycles(), getTcCycles().findIndex(c=>c.id===activeTcCycle.id));
    const _tcOpenD = _tcOpen ? new Date(_tcOpen+'T12:00:00') : new Date();
    const _tcCloseD = new Date(activeTcCycle.closeDate+'T12:00:00');
    const _totalDays = Math.max(1, Math.round((_tcCloseD - _tcOpenD) / 86400000) + 1);
    const _daysElapsed = Math.max(1, Math.min(_totalDays, Math.round((today - _tcOpenD) / 86400000) + 1));
    daysLeft = Math.max(0, _totalDays - _daysElapsed);
    dailyRate = totalGastoARS / _daysElapsed;
    projected = Math.round(dailyRate * _totalDays);
    projPeriodClose = _tcCloseD;
  } else {
    // Modo Mes: proyectar hasta fin del mes calendario
    const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth;
    daysLeft = isCurrentMonth ? daysInMonth - today.getDate() : 0;
    dailyRate = dayOfMonth > 0 ? totalGastoARS / dayOfMonth : 0;
    projected = isCurrentMonth ? Math.round(dailyRate * daysInMonth) : totalGastoARS;
  }

  // ── Compromisos (cuotas + subs + gastos fijos) ──
  const autoGroups=detectAutoCuotas?detectAutoCuotas():[];
  const cuotasAmt=[
    ...autoGroups.map(g=>{const cfg=state.autoCuotaConfig[g.key]||{};const maxP=g.transactions.sort((a,b)=>b.cuotaNum-a.cuotaNum)[0]?.cuotaNum||1;const paid=cfg.paid!==undefined?cfg.paid:maxP;const total=cfg.total||g.transactions[0]?.cuotaTotal||maxP;if(paid>=total)return 0;const acc=g.transactions.reduce((s,t)=>s+(t.currency==='ARS'?t.amount:0),0);return paid>0?acc/paid:g.amount;}),
    ...state.cuotas.filter(c=>c.paid<c.total).map(c=>c.amount)
  ].reduce((s,v)=>s+v,0);
  const toMonthly=s=>{if(s.freq==='monthly')return s.price;if(s.freq==='annual')return s.price/12;if(s.freq==='weekly')return s.price*4.3;return s.price;};
  const subsARS=state.subscriptions.filter(s=>s.currency==='ARS').reduce((acc,s)=>acc+toMonthly(s),0);
  const subsUSD=state.subscriptions.filter(s=>s.currency==='USD').reduce((acc,s)=>acc+toMonthly(s),0);
  const fixedARS=(state.fixedExpenses||[]).filter(f=>f.currency==='ARS').reduce((a,f)=>a+f.amount,0);
  const fixedUSD=(state.fixedExpenses||[]).filter(f=>f.currency==='USD').reduce((a,f)=>a+f.amount,0);
  const compromisoARS=cuotasAmt+subsARS+fixedARS;
  const compromisoUSD=subsUSD+fixedUSD;
  const compromisoTotal=compromisoARS+(compromisoUSD*USD_TO_ARS);

  // ── Selector y fecha ──
  updateMonthPicker();
  const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('dash-date').textContent=isTcView
    ?tcPeriodLabel
    :(isCurrentMonth
      ?today.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
      :MNAMES[pM-1]+' '+pY+' · mes cerrado');


  // ── Hero ──
  const dhcML=document.getElementById('dhc-month-label');
  if(dhcML)dhcML.textContent=isTcView&&activeTcCycle?activeTcCycle.label.toUpperCase():(MNAMES[pM-1]+' '+pY).toUpperCase();
  document.getElementById('kpi-ars').textContent='$'+fmtN(totalGastoARS);
  // ARS/USD breakdown line
  const _arsLine=document.getElementById('dhc-ars-line');
  const _usdLine=document.getElementById('dhc-usd-line');
  const _pctInline=document.getElementById('dhc-pct-inline');
  if(_arsLine)_arsLine.textContent='$'+fmtN(arsMonth);
  if(_usdLine)_usdLine.textContent=usdMonth>0?'U$D '+fmtN(usdMonth):'—';
  if(_pctInline&&pct!==null)_pctInline.textContent=pct+'% del ingreso';
  else if(_pctInline)_pctInline.textContent='';
  // Hidden compat
  document.getElementById('kpi-ars-d').textContent=cntMonth+' movimientos · $'+fmtN(cntMonth>0?totalGastoARS/cntMonth:0)+' promedio';
  // 3 totals breakdown
  document.getElementById('kpi-total-ars').textContent='$'+fmtN(arsMonth);
  document.getElementById('kpi-total-usd').textContent=usdMonth>0?'U$D '+fmtN(usdMonth):'—';

  // Badge %
  const badge=document.getElementById('dhc-pct-badge');
  if(badge){
    if(pct!==null){
      const cls=pct>=100?'danger':pct>=state.alertThreshold?'warn':'safe';
      badge.className='dhc-badge '+cls;badge.textContent=pct+'% del ingreso';
    } else { badge.className='dhc-badge neutral';badge.textContent='Ingreso no configurado'; }
  }

  document.getElementById('kpi-inc-total').textContent=incTotalARS>0?'$'+fmtN(incTotalARS):'—';

  // ── Balance (hidden compat) ──
  const balRow=document.getElementById('dhc-balance-row');
  if(balRow)balRow.style.display='none';
  const resEl=document.getElementById('dhc-bal-result');
  if(resEl){
    if(incTotalARS>0){
      const result=incTotalARS-totalGastoARS;
      const positive=result>=0;
      document.getElementById('dhc-bal-income').textContent='$'+fmtN(Math.round(incTotalARS));
      document.getElementById('dhc-bal-gasto').textContent='$'+fmtN(Math.round(totalGastoARS));
      resEl.textContent=(positive?'+$':'−$')+fmtN(Math.abs(Math.round(result)));
    }
  }

  // ── Margin bar ──
  const marginSection=document.getElementById('dhc-margin-section');
  if(marginSection&&incTotalARS>0){
    marginSection.style.display='block';
    // Use spendBudget (respects the configured spend % from Ingresos window)
    const margenDisp=spendBudget-totalGastoARS;
    const margenPct=Math.max(0,Math.min(100,Math.round(margenDisp/spendBudget*100)));
    const gastoPct=Math.min(100,Math.round(totalGastoARS/spendBudget*100));
    const isOver=margenDisp<0;
    document.getElementById('dhc-margin-val').textContent=(isOver?'−$':'$')+fmtN(Math.abs(Math.round(margenDisp)));
    document.getElementById('dhc-margin-val').style.color=isOver?'var(--danger)':margenPct<20?'var(--accent3)':'var(--green-sys)';
    const mFill=document.getElementById('dhc-margin-fill');
    mFill.style.width=gastoPct+'%';
    mFill.style.background=isOver?'var(--danger)':gastoPct>=state.alertThreshold?'var(--accent3)':'var(--accent)';
    document.getElementById('dhc-margin-sub').textContent=isOver?'Excedido en $'+fmtN(Math.abs(Math.round(margenDisp))):'Te quedan $'+fmtN(Math.round(margenDisp))+' disponibles';
    const _sp=state.spendPct||100;
    document.getElementById('dhc-margin-ingreso').textContent=_sp<100?'Presupuesto $'+fmtN(Math.round(spendBudget))+' ('+_sp+'% del ingreso)':'Ingreso $'+fmtN(Math.round(incTotalARS));
  } else if(marginSection){
    marginSection.style.display='none';
  }
  const _mpLabel=document.getElementById('dhc-margen-pct-label');
  if(_mpLabel){const _sp=state.spendPct||100;_mpLabel.textContent=_sp<100?'('+_sp+'%)':'';}
  const margenEl=document.getElementById('dhc-margen');
  if(margenEl){
    if(margen!==null){
      const spPct=state.spendPct||100;
      margenEl.textContent='$'+fmtN(margen);
      margenEl.title=spPct<100?'Sobre el '+spPct+'% del ingreso ($'+fmtN(spendBudget)+')':'Sobre el ingreso total';
    } else { margenEl.textContent='—'; }
  }

  // ── Payment method breakdown ──
  const payMethodSection=document.getElementById('dhc-pay-method-section');
  const payBar=document.getElementById('dhc-pay-bar');
  const payLabels=document.getElementById('dhc-pay-labels');
  if(payMethodSection&&payBar&&payLabels){
    const methods=[
      {key:'visa', label:'TC VISA', color:'#e63946'},
      {key:'amex', label:'TC AMEX', color:'#457b9d'},
      {key:'deb', label:'Débito', color:'var(--accent)'},
      {key:'ef', label:'Efectivo', color:'var(--accent3)'}
    ];
    const filteredTxns=monthTxns.filter(t=>t.amount>0);
    const totByMethod={};
    let totalForBar=0;
    methods.forEach(m=>{totByMethod[m.key]=0;});
    filteredTxns.forEach(t=>{
      const pm=t.payMethod||'';
      const amt=t.currency==='USD'?t.amount*(USD_TO_ARS||1):t.amount;
      if(methods.find(m=>m.key===pm)){totByMethod[pm]+=amt;totalForBar+=amt;}
    });
    if(totalForBar>0){
      payMethodSection.style.display='block';
      payBar.innerHTML=methods.map(m=>{
        const pct=totalForBar>0?(totByMethod[m.key]/totalForBar*100):0;
        if(pct<0.5)return '';
        return '<div style="width:'+pct.toFixed(1)+'%;background:'+m.color+';height:100%;transition:width .5s ease;"></div>';
      }).join('');
      payLabels.innerHTML=methods.map(m=>{
        const pct=totalForBar>0?(totByMethod[m.key]/totalForBar*100):0;
        if(pct<0.5)return '';
        return '<div style="display:flex;align-items:center;gap:4px;">'+
          '<div style="width:8px;height:8px;border-radius:50%;background:'+m.color+';flex-shrink:0;"></div>'+
          '<span style="font-size:11px;color:var(--text3);">'+m.label+'</span>'+
          '<span style="font-size:11px;font-weight:700;color:var(--text);font-family:var(--font);">'+Math.round(pct)+'%</span>'+
        '</div>';
      }).join('');
    } else {
      payMethodSection.style.display='none';
    }
  }
  document.getElementById('kpi-usd').textContent=usdMonth>0?'U$D '+fmtN(usdMonth):'—';

  const pFill=document.getElementById('dhc-progress-fill');
  const pLabel=document.getElementById('dhc-progress-label');
  if(pFill&&pct!==null){
    const col=pct>=100?'var(--danger)':pct>=state.alertThreshold?'var(--accent3)':'var(--accent)';
    pFill.style.width=Math.min(100,pct)+'%';pFill.style.background=col;
    if(pLabel)pLabel.textContent=pct+'% usado del ingreso · meta: '+state.alertThreshold+'%';
  } else if(pFill){pFill.style.width='0%';}

  // ── KPI: Tarjeta — split VISA / AMEX using ccCycles (always current cycle) ──
  ccInit();
  const _ccCards=state.ccCards||[];
  const _ccCycles=state.ccCycles||[];
  const _todayStr=dateToYMD(new Date());
  _ccCards.forEach(card=>{
    const cardCycles=[..._ccCycles].filter(c=>c.cardId===card.id).sort((a,b)=>b.closeDate.localeCompare(a.closeDate));
    // Find the cycle whose range includes TODAY
    let activeCycle=null;
    for(const cy of cardCycles){
      const open=cy.openDate||null;
      const close=cy.closeDate;
      if(open && _todayStr>=open && _todayStr<=close){activeCycle=cy;break;}
      if(!open && _todayStr<=close){activeCycle=cy;break;}
    }
    // Fallback: most recent pending, then most recent overall
    if(!activeCycle){
      const pending=cardCycles.filter(c=>c.status==='pending');
      activeCycle=pending.length?pending[0]:cardCycles[0];
    }
    let cardArs=0,cardUsd=0;
    if(activeCycle){
      const expenses=ccGetCycleExpenses(activeCycle);
      const totals=ccGetTotals(expenses);
      cardArs=totals.ars;
      cardUsd=totals.usd;
    }
    const prefix=card.payMethodKey==='visa'?'visa':'amex';
    const arsEl=document.getElementById('kpi-'+prefix+'-ars');
    const usdEl=document.getElementById('kpi-'+prefix+'-usd');
    if(arsEl)arsEl.textContent=cardArs>0?'$'+fmtN(Math.round(cardArs)):'—';
    if(usdEl)usdEl.textContent=cardUsd>0?'U$D '+fmtN(cardUsd):'';
  });
  // Hidden compat element
  document.getElementById('kpi-tc').textContent=hasPayTagsWidget?'$'+fmtN(tcWidgetAmt+debWidgetAmt):'$'+fmtN(_tcWidgetTxns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0));
  document.getElementById('kpi-tc-d').innerHTML=hasPayTagsWidget
    ?'<span style="color:var(--accent2)">💳 $'+fmtN(tcWidgetAmt)+'</span>&nbsp;<span style="color:var(--accent)">🏦 $'+fmtN(debWidgetAmt)+'</span>'
    :'<span style="color:var(--text3)">Etiquetá con 💳/🏦</span>';

  // ── KPI: Proyección ──
  const projEl=document.getElementById('kpi-proj');
  const projD=document.getElementById('kpi-proj-d');
  const projTitle=document.getElementById('kpi-proj-title');
  if(projEl){
    if(isTcView && activeTcCycle){
      // TC mode: project to cycle close date
      if(daysLeft===0 && totalGastoARS===0){
        projEl.textContent='—'; projEl.style.color='var(--text3)';
        if(projD)projD.textContent='Sin datos en este ciclo';
      } else {
        projEl.textContent='$'+fmtN(projected);
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=overBudget?'var(--danger)':projected>incTotalARS*0.85?'var(--accent3)':'var(--text)';
        const closeLabel=projPeriodClose?projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'cierre';
        if(projD)projD.textContent='';
        const _dailyEl=document.getElementById('kpi-proj-daily');
        if(_dailyEl)_dailyEl.textContent='$'+fmtN(Math.round(dailyRate));
        const _daysEl=document.getElementById('kpi-proj-days');
        if(_daysEl)_daysEl.textContent=daysLeft;
        const _daysLabel=document.getElementById('kpi-proj-days-label');
        if(_daysLabel)_daysLabel.textContent='CIERRE TC'+(projPeriodClose?' · '+projPeriodClose.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'');
      }
      if(projTitle)projTitle.textContent='PROYECCIÓN AL CIERRE TC';
    } else {
      // Mes mode
      if(isCurrentMonth){
        projEl.textContent='$'+fmtN(projected);
        const overBudget=incTotalARS>0&&projected>incTotalARS;
        projEl.style.color=overBudget?'var(--danger)':projected>incTotalARS*0.85?'var(--accent3)':'var(--text)';
        if(projD)projD.textContent='';
        const _dailyEl2=document.getElementById('kpi-proj-daily');
        if(_dailyEl2)_dailyEl2.textContent='$'+fmtN(Math.round(dailyRate));
        const _daysEl2=document.getElementById('kpi-proj-days');
        if(_daysEl2)_daysEl2.textContent=daysLeft;
        const _daysLabel2=document.getElementById('kpi-proj-days-label');
        if(_daysLabel2)_daysLabel2.textContent='DÍAS AL CIERRE';
      } else {
        projEl.textContent='—'; projEl.style.color='var(--text3)';
        if(projD)projD.textContent='Mes cerrado';
        const _dailyEl3=document.getElementById('kpi-proj-daily');
        if(_dailyEl3)_dailyEl3.textContent='—';
        const _daysEl3=document.getElementById('kpi-proj-days');
        if(_daysEl3)_daysEl3.textContent='—';
      }
      if(projTitle)projTitle.textContent='PROYECCIÓN AL CIERRE';
    }
  }

  // ── KPI: Compromisos ──
  const compEl=document.getElementById('kpi-compromisos');
  const compD=document.getElementById('kpi-compromisos-d');
  if(compEl){
    compEl.textContent='$'+fmtN(Math.round(compromisoTotal));
    const nC=autoGroups.length+state.cuotas.filter(c=>c.paid<c.total).length;
    const nS=state.subscriptions.length;
    const nF=(state.fixedExpenses||[]).length;
    const parts=[];
    if(nC>0)parts.push(nC+' cuota'+(nC!==1?'s':''));
    if(nS>0)parts.push(nS+' sub'+(nS!==1?'s':''));
    if(nF>0)parts.push(nF+' fijo'+(nF!==1?'s':''));
    if(compromisoUSD>0)parts.push('U$D '+fmtN(compromisoUSD));
    if(compD)compD.textContent=parts.join(' · ')||'Sin compromisos';
    // Animate compromisos donut (% of income)
    const compDonut=document.getElementById('comp-donut-fill');
    const compDonutLabel=document.getElementById('comp-donut-label');
    if(compDonut&&incTotalARS>0){
      const compPct=Math.min(Math.round(compromisoTotal/incTotalARS*100),100);
      const circ=125.66;
      compDonut.style.strokeDashoffset=circ-(compPct/100*circ);
      compDonut.style.stroke=compPct>50?'var(--danger)':compPct>30?'var(--accent3)':'var(--accent2)';
      if(compDonutLabel){compDonutLabel.textContent=compPct+'%';compDonutLabel.style.color=compPct>50?'var(--danger)':compPct>30?'var(--accent3)':'var(--accent2)';}
    } else if(compDonut){
      compDonut.style.strokeDashoffset=125.66;
      if(compDonutLabel)compDonutLabel.textContent='—';
    }
  }

  // Ensure a valid chart mode is always set before rendering
  if(!['bars','area','daily'].includes(state.chartMode)) state.chartMode='bars';
  ['bars','area','daily'].forEach(m=>{
    const btn=document.getElementById('cmt-'+m);
    if(btn)btn.classList.toggle('active',state.chartMode===m);
  });
  renderWeeklyChart(monthTxns);
  renderCatBars(monthTxns);
  renderDashWidgets(monthTxns, arsMonth, incTotalARS, margen, pct, daysLeft);
  renderTop5();
}

function getWeeklyData(txns){
  txns=txns||state.transactions;
  const w={};txns.filter(t=>t.currency==='ARS').forEach(t=>{const k=t.week||getWeekKey(t.date);w[k]=(w[k]||0)+t.amount;});
  const s=Object.keys(w).sort();return{labels:s.map(k=>fmtWeekLabel(k)),values:s.map(k=>w[k]),keys:s};
}
function getCatData(txns,byGroup){
  txns=txns||state.transactions;
  const c={};
  txns.filter(t=>t.category&&t.category!=='Procesando...').forEach(t=>{
    const amt=t.currency==='USD'?t.amount*USD_TO_ARS:t.amount;
    const key=byGroup?catGroup(t.category):t.category;
    c[key]=(c[key]||0)+amt;
  });
  const s=Object.entries(c).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  return{labels:s.map(e=>e[0]),values:s.map(e=>e[1])};
}

function setChartMode(mode){
  const validModes=['bars','area','daily'];
  state.chartMode=validModes.includes(mode)?mode:'bars';
  validModes.forEach(m=>{
    const btn=document.getElementById('cmt-'+m);
    if(btn)btn.classList.toggle('active',state.chartMode===m);
  });
  renderWeeklyChart(getCurrentMonthTxns());
}

function renderWeeklyChart(monthTxns){
  const mode=state.chartMode||'bars';
  if(state.charts.weekly)state.charts.weekly.destroy();
  const ctx=document.getElementById('chart-weekly');if(!ctx)return;
  const sub=document.getElementById('weekly-chart-sub');
  const titleEl=document.getElementById('dash-chart-title');
  const legEl=document.getElementById('weekly-chart-legend');

  if(mode==='bars'){
    // Monthly bars — all months
    const byMonth={};
    state.transactions.filter(t=>t.currency==='ARS').forEach(t=>{
      const k=t.month||getMonthKey(t.date);
      byMonth[k]=(byMonth[k]||0)+t.amount;
    });
    const sorted=Object.keys(byMonth).sort();
    const labels=sorted.map(k=>{const[y,m]=k.split('-');return['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+m-1]+' '+y.slice(2);});
    const values=sorted.map(k=>byMonth[k]);
    const avg=values.length?values.reduce((s,v)=>s+v,0)/values.length:0;
    const currentMonthKey=getMonthKey(new Date());
    const barColors=sorted.map(k=>k===currentMonthKey?'rgba(200,240,96,0.9)':'rgba(200,240,96,0.5)');

    if(titleEl)titleEl.textContent='Gasto mensual';
    if(sub)sub.textContent=sorted.length+' meses · promedio $'+fmtN(Math.round(avg))+'/mes';
    if(legEl)legEl.innerHTML='';

    state.charts.weekly=new Chart(ctx,{type:'bar',data:{labels,datasets:[
      {data:values,backgroundColor:barColors,borderColor:'rgba(200,240,96,0.3)',borderWidth:0,borderRadius:6,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10}},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.04)'}}}
    }});

  } else if(mode==='area'){
    // Cumulative area — running total by month
    const byMonth={};
    state.transactions.filter(t=>t.currency==='ARS').forEach(t=>{
      const k=t.month||getMonthKey(t.date);
      byMonth[k]=(byMonth[k]||0)+t.amount;
    });
    const sorted=Object.keys(byMonth).sort();
    const labels=sorted.map(k=>{const[y,m]=k.split('-');return['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+m-1]+' '+y.slice(2);});
    const values=sorted.map(k=>byMonth[k]);
    let cumulative=0;
    const cumValues=values.map(v=>{cumulative+=v;return cumulative;});

    if(titleEl)titleEl.textContent='Gasto acumulado';
    if(sub)sub.textContent='Total acumulado · $'+fmtN(Math.round(cumulative))+' ARS';
    if(legEl)legEl.innerHTML='';

    state.charts.weekly=new Chart(ctx,{type:'line',data:{labels,datasets:[
      {data:cumValues,borderColor:'rgba(200,240,96,0.9)',backgroundColor:'rgba(200,240,96,0.12)',borderWidth:2.5,fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:'rgba(200,240,96,1)',pointBorderColor:'#1c1a18',pointBorderWidth:1.5}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:c=>' Acumulado: $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10}},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.04)'}}}
    }});

  } else if(mode==='daily'){
    // Daily spending for current month — scatter-like with trend
    const txns=(monthTxns||getCurrentMonthTxns()).filter(t=>t.currency==='ARS');
    const byDay={};
    txns.forEach(t=>{
      const d=dateToYMD(t.date);
      byDay[d]=(byDay[d]||0)+t.amount;
    });
    const sorted=Object.keys(byDay).sort();
    const labels=sorted.map(d=>{const dt=new Date(d+'T12:00:00');return dt.getDate()+'/'+(dt.getMonth()+1);});
    const values=sorted.map(d=>byDay[d]);
    const avg=values.length?values.reduce((s,v)=>s+v,0)/values.length:0;

    if(titleEl)titleEl.textContent='Gasto diario';
    if(sub)sub.textContent='Mes actual · promedio $'+fmtN(Math.round(avg))+'/día · '+sorted.length+' días';
    if(legEl)legEl.innerHTML='';

    state.charts.weekly=new Chart(ctx,{type:'bar',data:{labels,datasets:[
      {data:values,backgroundColor:values.map(v=>v>avg*1.5?'rgba(255,100,80,0.7)':v>avg?'rgba(255,200,80,0.6)':'rgba(200,240,96,0.6)'),borderWidth:0,borderRadius:4,borderSkipped:false},
      {type:'line',data:values.map(()=>avg),borderColor:'rgba(160,154,148,0.5)',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,order:0}
    ]},options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1a18',titleColor:'#f0ebe6',bodyColor:'#a09a94',borderColor:'#2e2b28',borderWidth:1,padding:10,callbacks:{label:c=>c.datasetIndex===1?' Promedio: $'+fmtN(Math.round(c.parsed.y)):' $'+fmtN(c.parsed.y)}}},
      scales:{x:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:9},maxRotation:0},grid:{display:false}},y:{ticks:{color:_isL()?'#86868b':'#8a8480',font:{size:10},callback:v=>'$'+fmtN(v)},grid:{color:_isL()?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.04)'}}}
    }});
  }
}


function renderCatBars(monthTxns){
  const txns = monthTxns || getCurrentMonthTxns();
  // Group by parent category
  const grouped={};
  CATEGORY_GROUPS.forEach(g=>{grouped[g.group]={total:0,color:g.color,emoji:g.emoji};});
  txns.filter(t=>t.category&&t.category!=='Procesando...').forEach(t=>{
    const amt=t.currency==='USD'?t.amount*USD_TO_ARS:t.amount;
    const parent=catGroup(t.category);
    if(!grouped[parent])grouped[parent]={total:0,color:'#888',emoji:''};
    grouped[parent].total+=amt;
  });
  const sorted=Object.entries(grouped).filter(([,d])=>d.total>0).sort((a,b)=>b[1].total-a[1].total);
  const total=sorted.reduce((s,[,d])=>s+d.total,0);
  const el=document.getElementById('cat-bars');if(!el)return;
  if(!sorted.length){
    el.innerHTML='<div style="color:var(--text3);font-size:12px;font-family:var(--font);padding:8px 0;">Sin gastos este mes</div>';
    return;
  }
  const maxVal=sorted[0][1].total;
  el.innerHTML=sorted.map(([name,d])=>{
    const pct=total>0?Math.round(d.total/total*100):0;
    const barW=maxVal>0?Math.max(Math.round(d.total/maxVal*100),2):0;
    return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
      +'<span style="font-size:13px;width:20px;text-align:center;flex-shrink:0;">'+d.emoji+'</span>'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">'
          +'<span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+name+'</span>'
          +'<span style="font-size:11px;font-family:var(--font);color:var(--text3);flex-shrink:0;margin-left:8px;">$'+fmtN(d.total)+'<span style="opacity:.5;margin-left:3px;">'+pct+'%</span></span>'
        +'</div>'
        +'<div style="height:4px;background:var(--surface3);border-radius:3px;overflow:hidden;">'
          +'<div style="height:100%;width:'+barW+'%;background:'+d.color+';border-radius:3px;transition:width .5s ease;"></div>'
        +'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}

function renderTop5(){
  const el=document.getElementById('top5-list');
  const sub=document.getElementById('top5-sub');
  if(!el)return;
  const txns=getCurrentMonthTxns().filter(t=>t.currency==='ARS').sort((a,b)=>b.amount-a.amount).slice(0,5);
  if(!txns.length){el.innerHTML='<div style="color:var(--text3);font-size:12px;font-family:var(--font);padding:8px 0;">Sin movimientos este mes</div>';return;}
  if(sub)sub.textContent=txns.length+' movimientos más altos del mes';
  const medals=['🥇','🥈','🥉','4º','5º'];
  el.innerHTML=txns.map((t,i)=>{
    const c=catColor(t.category);
    return'<div class="top5-inline-item">'+
      '<div class="top5-inline-rank">'+medals[i]+'</div>'+
      '<div class="top5-inline-amount" style="color:var(--text);">$'+fmtN(t.amount)+'</div>'+
      '<div class="top5-inline-desc">'+esc(t.description)+'</div>'+
      '<div class="top5-inline-cat" style="color:'+c+';">'+catEmoji(t.category)+' '+t.category+'</div>'+
    '</div>';
  }).join('');
}

function renderDashWidgets(monthTxns, arsMonth, incTotalARS, margen, pct, daysLeft){

  /* ── Widget 1: Margen disponible ── */
  const wMargenVal = document.getElementById('dw-margen-val');
  const wMargenSub = document.getElementById('dw-margen-sub');
  const wMargenBar = document.getElementById('dw-margen-bar');
  const wMargenFoot= document.getElementById('dw-margen-footer');
  if(incTotalARS > 0 && margen !== null){
    const dailyLeft = daysLeft > 0 ? Math.round(margen / daysLeft) : 0;
    const usedPct   = Math.min(100, Math.round((arsMonth / incTotalARS) * 100));
    const col       = usedPct >= 100 ? 'var(--danger)' : usedPct >= 80 ? 'var(--accent3)' : 'var(--accent)';
    wMargenVal.textContent   = '$' + fmtN(margen);
    wMargenVal.style.color   = margen <= 0 ? 'var(--danger)' : 'var(--text)';
    wMargenSub.textContent   = margen > 0 ? (daysLeft > 0 ? daysLeft + ' días restantes este mes' : 'Fin de mes') : 'Ingreso superado ⚠️';
    wMargenBar.style.width   = usedPct + '%';
    wMargenBar.style.background = col;
    wMargenFoot.textContent  = dailyLeft > 0 ? '$' + fmtN(dailyLeft) + '/día disponible · ' + usedPct + '% del ingreso usado' : usedPct + '% del ingreso usado';
  } else {
    wMargenVal.textContent  = '—';
    wMargenSub.textContent  = 'hasta fin de mes';
    wMargenBar.style.width  = '0%';
    wMargenFoot.textContent = 'Configurá tu ingreso en Ingresos para ver esto';
  }

  /* ── Widget 2: Categoría que más creció vs mes anterior ── */
  const wTrendVal   = document.getElementById('dw-trend-val');
  const wTrendSub   = document.getElementById('dw-trend-sub');
  const wTrendBadge = document.getElementById('dw-trend-badge');
  const wTrendAmt   = document.getElementById('dw-trend-amounts');
  const activeMk    = getActiveDashMonth();
  const [pY, pM]    = activeMk.split('-').map(Number);
  const prevMk      = getMonthKey(new Date(pY, pM - 2, 1));
  const prevTxns    = getTxnsFor(prevMk).filter(t => t.currency === 'ARS');
  if(prevTxns.length && monthTxns.length){
    // build category totals for both months
    const sumCats = txns => {
      const c = {};
      txns.filter(t => t.currency === 'ARS').forEach(t => { c[t.category] = (c[t.category] || 0) + t.amount; });
      return c;
    };
    const curCats  = sumCats(monthTxns);
    const prevCats = sumCats(prevTxns);
    // Find category with biggest absolute increase
    let biggest = null, biggestDiff = 0;
    Object.entries(curCats).forEach(([cat, cur]) => {
      const prev = prevCats[cat] || 0;
      const diff = cur - prev;
      if(diff > biggestDiff){ biggestDiff = diff; biggest = { cat, cur, prev, diff }; }
    });
    if(biggest){
      const pctDiff = biggest.prev > 0 ? Math.round((biggest.diff / biggest.prev) * 100) : null;
      const c = catColor(biggest.cat);
      wTrendVal.textContent       = biggest.cat;
      wTrendVal.style.color       = c;
      wTrendSub.textContent       = 'gastaste más que el mes pasado';
      wTrendBadge.className       = 'dw-badge up';
      wTrendBadge.textContent     = pctDiff !== null ? '+' + pctDiff + '%' : '+nuevo';
      wTrendAmt.textContent       = '$' + fmtN(biggest.prev) + ' → $' + fmtN(biggest.cur);
    } else {
      wTrendVal.textContent  = '✓ Sin alzas';
      wTrendVal.style.color  = 'var(--accent)';
      wTrendSub.textContent  = 'ninguna categoría creció vs el mes anterior';
      wTrendBadge.textContent= '';
      wTrendAmt.textContent  = '';
    }
  } else {
    wTrendVal.textContent  = '—';
    wTrendSub.textContent  = 'necesitás al menos 2 meses de datos';
    wTrendBadge.textContent= '';
    wTrendAmt.textContent  = '';
  }

  /* ── Widget 3: Meta de ahorro más cercana ── */
  const wGoalVal  = document.getElementById('dw-goal-val');
  const wGoalSub  = document.getElementById('dw-goal-sub');
  const wGoalBar  = document.getElementById('dw-goal-bar');
  const wGoalFoot = document.getElementById('dw-goal-footer');
  const goals     = (state.savGoals || []).filter(g => g.target > 0);
  const _dAccARS = (state.savAccounts||[]).filter(a=>a.currency==='ARS').reduce((s,a)=>s+a.balance,0);
  const _dAccUSD = (state.savAccounts||[]).filter(a=>a.currency==='USD').reduce((s,a)=>s+a.balance,0);
  const _dRate   = USD_TO_ARS || 1420;
  // Closest = highest completion percentage that's not yet 100%
  const active    = goals.filter(g => { const _gc = g.currency==='USD' ? _dAccUSD+(_dAccARS/_dRate) : _dAccARS+(_dAccUSD*_dRate); return _gc < g.target; })
                         .sort((a, b) => { const ca=a.currency==='USD'?_dAccUSD+(_dAccARS/_dRate):_dAccARS+(_dAccUSD*_dRate); const cb=b.currency==='USD'?_dAccUSD+(_dAccARS/_dRate):_dAccARS+(_dAccUSD*_dRate); return (cb/b.target)-(ca/a.target); });
  if(active.length){
    const g   = active[0];
    const _gCur = g.currency==='USD' ? _dAccUSD+(_dAccARS/_dRate) : _dAccARS+(_dAccUSD*_dRate);
    const pct = Math.round((_gCur / g.target) * 100);
    const rem = g.target - _gCur;
    const prefix = g.currency === 'USD' ? 'U$D ' : '$';
    const deps   = state.savDeposits || [];
    const depsARS = deps.filter(d => d.currency === 'ARS');
    const months  = [...new Set(depsARS.map(d => d.month))];
    const avgDep  = months.length ? Math.round(depsARS.reduce((s,d) => s + d.amount, 0) / months.length) : 0;
    const eta     = avgDep > 0 ? Math.ceil(rem / avgDep) : null;
    const c       = g.color || 'var(--accent3)';
    wGoalVal.textContent    = (g.emoji || '🎯') + ' ' + g.name;
    wGoalVal.style.color    = 'var(--text)';
    wGoalSub.textContent    = prefix + fmtN(Math.round(_gCur)) + ' de ' + prefix + fmtN(g.target) + ' · ' + pct + '%';
    wGoalBar.style.width    = pct + '%';
    wGoalBar.style.background = c;
    wGoalFoot.textContent   = eta ? eta + ' mes' + (eta !== 1 ? 'es' : '') + ' estimados al ritmo actual' : 'Registrá depósitos para estimar el tiempo';
  } else if(goals.length){
    wGoalVal.textContent  = '🎉 Todas completadas';
    wGoalVal.style.color  = 'var(--accent)';
    wGoalSub.textContent  = goals.length + ' meta' + (goals.length !== 1 ? 's' : '') + ' alcanzada' + (goals.length !== 1 ? 's' : '');
    wGoalBar.style.width  = '100%';
    wGoalFoot.textContent = '¡Creá una nueva meta!';
  } else {
    wGoalVal.textContent  = '—';
    wGoalSub.textContent  = 'Sin metas configuradas';
    wGoalBar.style.width  = '0%';
    wGoalFoot.textContent = 'Ir a Ahorros → Nueva meta →';
  }
}

// Stubs para IDs que ya no existen pero podrian ser llamados desde otro lado
function renderDonutChart(){}
function renderProjection(){}
function renderDowHeatmap(){}

