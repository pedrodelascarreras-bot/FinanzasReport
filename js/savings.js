// ══ SAVINGS PAGE — 100% MANUAL ══
function renderSavingsPage(){
  const accounts = state.savAccounts;
  const goals    = state.savGoals;
  const deps     = state.savDeposits || [];
  const usdRate  = USD_TO_ARS || 1420;

  /* ─── Patrimonio: suma de TODAS las cuentas convertidas a ARS ─── */
  const totalARS   = accounts.filter(a=>a.currency==='ARS').reduce((s,a)=>s+a.balance,0);
  const totalUSD   = accounts.filter(a=>a.currency==='USD').reduce((s,a)=>s+a.balance,0);
  const totalEquiv = totalARS + (totalUSD * usdRate); // total unificado en ARS

  /* ─── Hero: mostrar el total acumulado en USD ─── */
  const totalEquivUSD = (totalARS / usdRate) + totalUSD; // todo convertido a USD
  const heroEl = document.getElementById('sav-hero-total');
  if(heroEl) heroEl.textContent = 'U$D '+fmtN(totalEquivUSD, 0);

  document.getElementById('sav-total-ars').textContent = '$'+fmtN(totalARS);
  document.getElementById('sav-total-usd').textContent = 'U$D '+fmtN(totalUSD);

  // Badge equivalente ARS (solo si hay USD)
  const equivBadge = document.getElementById('sav-hero-equiv-badge');
  // Badge: always show ARS equivalent (since hero is now USD)
  if(usdRate > 0 && totalEquiv > 0){
    equivBadge.style.display = 'inline-flex';
    equivBadge.textContent   = '≈ $'+fmtN(Math.round(totalEquiv))+' ARS · TC $'+fmtN(usdRate);
  } else {
    equivBadge.style.display = 'none';
  }

  /* ─── Barra de distribución por cuenta ─── */
  const barWrap = document.getElementById('sav-accounts-bar-wrap');
  const barEl   = document.getElementById('sav-accounts-bar');
  const barLeg  = document.getElementById('sav-accounts-bar-legend');
  const accsWithBalance = accounts.filter(a=>a.balance>0);
  if(accsWithBalance.length >= 2 && totalEquiv > 0){
    barWrap.style.display = 'block';
    barEl.innerHTML = accsWithBalance.map(a=>{
      const val = a.currency==='USD' ? a.balance*usdRate : a.balance;
      const pct = Math.round(val/totalEquiv*100);
      const c   = a.color||'#888888';
      return '<div style="width:'+pct+'%;background:'+c+';transition:width 0.6s ease;" title="'+esc(a.name)+' '+pct+'%"></div>';
    }).join('');
    barLeg.innerHTML = accsWithBalance.map(a=>{
      const val = a.currency==='USD' ? a.balance*usdRate : a.balance;
      const pct = Math.round(val/totalEquiv*100);
      const c   = a.color||'#888888';
      return '<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-family:var(--font);">'
        +'<div style="width:8px;height:8px;border-radius:2px;background:'+c+';flex-shrink:0;"></div>'
        +'<span style="color:var(--text2);">'+esc(a.name)+'</span>'
        +'<span style="color:var(--text3);">'+pct+'%</span>'
        +'</div>';
    }).join('');
  } else {
    barWrap.style.display = 'none';
  }

  /* ─── KPIs de depósitos ─── */
  const thisYear    = new Date().getFullYear();
  const depsARS     = deps.filter(d=>d.currency==='ARS');
  const ytdDeps     = depsARS.filter(d=>d.month && d.month.startsWith(thisYear+''));
  const ytdTotal    = ytdDeps.reduce((s,d)=>s+d.amount,0);
  const allMonths   = [...new Set(depsARS.map(d=>d.month))].sort();
  const monthTotals = allMonths.map(m=>depsARS.filter(d=>d.month===m).reduce((s,d)=>s+d.amount,0));
  const avgDep      = monthTotals.length ? Math.round(monthTotals.reduce((s,v)=>s+v,0)/monthTotals.length) : 0;

  /* ─── Promedio % de ingresos ─── */
  // Para cada mes con depósito, buscamos el ingreso registrado en state.incomeMonths
  const incMonths = {};
  (state.incomeMonths||[]).forEach(m=>{ incMonths[m.month]={total:(m.sources?Object.values(m.sources).reduce((s,v)=>s+v,0):0)}; });
  const rateValues = allMonths.map(m=>{
    const dep = depsARS.filter(d=>d.month===m).reduce((s,d)=>s+d.amount,0);
    const inc = incMonths[m]?.total || 0;
    return inc > 0 ? dep/inc*100 : null;
  }).filter(v=>v!==null);
  const avgRate = rateValues.length ? Math.round(rateValues.reduce((s,v)=>s+v,0)/rateValues.length) : null;

  // Badge % ingreso en hero
  const statIncPct = document.getElementById('sav-stat-inc-pct');
  const incPctVal  = document.getElementById('sav-inc-pct-val');
  if(avgRate !== null){
    statIncPct.style.display = 'flex';
    incPctVal.textContent    = avgRate+'%';
    incPctVal.style.color    = avgRate>=20 ? 'var(--accent)' : avgRate>=10 ? 'var(--accent3)' : 'var(--danger)';
  } else {
    statIncPct.style.display = 'none';
  }

  /* ─── Racha ─── */
  let streak = 0;
  const sortedDesc = [...allMonths].sort().reverse();
  let cur = getMonthKey(new Date());
  for(const m of sortedDesc){
    if(m===cur){ streak++;
      const[y,mo]=cur.split('-').map(Number);
      cur=getMonthKey(new Date(y,mo-2,1));
    } else break;
  }
  const streakEl = document.getElementById('sav-streak');
  if(streakEl){
    if(streak>=2){ streakEl.style.display='inline-flex'; streakEl.textContent='🔥 '+streak+' meses seguidos ahorrando'; }
    else { streakEl.style.display='none'; }
  }

  /* ─── Texto subtítulo ─── */
  const subEl = document.getElementById('sav-page-sub');
  if(subEl) subEl.textContent = accounts.length+' cuenta'+(accounts.length!==1?'s':'')+' · '+allMonths.length+' mes'+(allMonths.length!==1?'es':'')+' con depósito'+(avgRate!==null?' · '+avgRate+'% tasa de ahorro promedio':'');

  /* ─── KPI cards ─── */
  document.getElementById('sav-kpi-year').textContent     = ytdTotal>0 ? '$'+fmtN(ytdTotal) : '$0';
  document.getElementById('sav-kpi-year-sub').textContent = ytdDeps.length+' depósito'+(ytdDeps.length!==1?'s':'')+' en '+thisYear;
  document.getElementById('sav-kpi-avg').textContent      = avgDep>0 ? '$'+fmtN(avgDep) : '$0';
  document.getElementById('sav-kpi-avg-sub').textContent  = monthTotals.length+' mes'+(monthTotals.length!==1?'es':'')+' con depósito'+(streak>=2?' · 🔥 '+streak+' racha':'');
  const rateEl    = document.getElementById('sav-kpi-rate');
  const rateSubEl = document.getElementById('sav-kpi-rate-sub');
  if(avgRate!==null){
    rateEl.textContent    = avgRate+'%';
    rateEl.style.color    = avgRate>=20 ? 'var(--accent)' : avgRate>=10 ? 'var(--accent3)' : 'var(--danger)';
    rateSubEl.textContent = rateValues.length+' mes'+(rateValues.length!==1?'es':'')+' con ingreso registrado · '+(avgRate>=20?'💪 Excelente':avgRate>=10?'👍 Bueno':'⚠️ Mejorable');
  } else {
    rateEl.textContent    = '—';
    rateSubEl.textContent = 'Registrá ingresos en la sección Ingresos para ver este dato';
  }

  /* ─── Cuentas ─── */
  const agEl = document.getElementById('sav-accounts-grid');
  if(accounts.length){
    agEl.innerHTML = accounts.map(a=>{
      const c = a.color||'#888888';
      const typeEmoji = {banco:'🏦',billetera:'📱',efectivo:'💵',inversion:'📈',cripto:'🔷',otro:'💰'}[a.type]||'💰';
      const yieldInfo = a.yieldPct ? '<div style="font-size:11px;font-family:var(--font);color:var(--accent3);margin-top:3px;">+'+a.yieldPct+'% anual</div>' : '';
      // Equivalente en ARS si es USD
      const equivInfo = (a.currency==='USD'&&a.balance>0)
        ? '<div style="font-size:11px;font-family:var(--font);color:var(--text3);margin-top:2px;">≈ $'+fmtN(Math.round(a.balance*usdRate))+' ARS</div>' : '';
      const accDeps  = deps.filter(d=>d.accountId===a.id&&d.currency===a.currency);
      const depCount = accDeps.length;
      const depInfo  = depCount ? '<div style="font-size:11px;font-family:var(--font);color:var(--text3);margin-top:3px;">'+depCount+' depósito'+(depCount!==1?'s':'')+' · $'+fmtN(accDeps.reduce((s,d)=>s+d.amount,0))+'</div>' : '';
      return '<div class="sav-account-card" onclick="editSavAccount(\''+a.id+'\')">'
        +'<div class="sav-account-accent" style="background:'+c+';"></div>'
        +'<div class="sav-account-header"><div class="sav-account-icon" style="background:'+c+'22;">'+esc(a.emoji||typeEmoji)+'</div>'
        +'<div><div class="sav-account-name">'+esc(a.name)+'</div><div class="sav-account-type">'+esc(a.type)+'</div></div>'
        +'<button class="btn btn-ghost btn-sm btn-icon" style="margin-left:auto" onclick="event.stopPropagation();editSavAccount(\''+a.id+'\')">✎</button></div>'
        +'<div class="sav-account-balance" style="color:'+c+';">'+(a.currency==='USD'?'U$D ':'$')+fmtN(a.balance)+'</div>'
        +'<div class="sav-account-currency">'+a.currency+equivInfo+yieldInfo+depInfo+'</div></div>';
    }).join('');
  } else {
    agEl.innerHTML = '<div class="empty-state" style="padding:40px;grid-column:1/-1;"><div class="empty-icon">🏦</div><div class="empty-title">Sin cuentas</div><div class="empty-sub">Agregá tus cuentas de ahorro</div></div>';
  }

  /* ─── Metas (current = suma de TODAS las cuentas) ─── */
  const ggEl = document.getElementById('sav-goals-grid');
  const _allAccARS = accounts.filter(a=>a.currency==='ARS').reduce((s,a)=>s+a.balance,0);
  const _allAccUSD = accounts.filter(a=>a.currency==='USD').reduce((s,a)=>s+a.balance,0);
  if(goals.length){
    ggEl.innerHTML = goals.map(g=>{
      const c   = g.color||'#34c759';
      const gCurrent = g.currency==='USD'
        ? _allAccUSD + (_allAccARS / usdRate)
        : _allAccARS + (_allAccUSD * usdRate);
      const pct = g.target>0 ? Math.min(100,Math.round(gCurrent/g.target*100)) : 0;
      const rem = Math.max(0,g.target-gCurrent);
      let etaText = '';
      if(g.deadline){const dl=new Date(g.deadline+'-01');const mLeft=Math.round((dl-new Date())/(30*24*3600*1000));etaText=mLeft>0?'Faltan '+mLeft+' meses':'Vencida';}
      if(rem>0&&avgDep>0){const mn=Math.ceil(rem/avgDep);etaText+=(etaText?' · ':'')+mn+' mes'+(mn!==1?'es':'')+' al ritmo actual';}
      else if(rem<=0) etaText='¡Meta alcanzada! 🎉';
      const motivMsg = pct>=100?'🎉 ¡Completada!':pct>=75?'🔥 ¡Casi llegás!':pct>=50?'💪 Vas a la mitad':pct>=25?'🚀 Buen inicio':'✨ Cada peso cuenta';
      return '<div class="sav-goal-card" onclick="editSavGoal(\''+g.id+'\')">'
        +'<div class="sav-goal-accent" style="background:'+c+';"></div>'
        +'<div class="sav-goal-body"><div class="sav-goal-emoji">'+esc(g.emoji||'🎯')+'</div>'
        +'<div class="sav-goal-name">'+esc(g.name)+'</div>'
        +'<div class="sav-goal-target">Meta: '+(g.currency==='USD'?'U$D ':'$')+fmtN(g.target)+'</div>'
        +'<div class="sav-goal-amounts"><div class="sav-goal-current" style="color:'+c+';">'+(g.currency==='USD'?'U$D ':'$')+fmtN(Math.round(gCurrent))+'</div><div class="sav-goal-of">de '+(g.currency==='USD'?'U$D ':'$')+fmtN(g.target)+'</div></div>'
        +'<div class="sav-goal-bar"><div class="sav-goal-fill" style="width:'+pct+'%;background:'+c+';"></div></div>'
        +'<div style="display:flex;justify-content:space-between;align-items:center;"><div class="sav-goal-pct">'+pct+'% completado</div><div style="font-size:11px;color:'+c+';font-weight:700;">'+motivMsg+'</div></div></div>'
        +'<div class="sav-goal-footer"><div class="sav-goal-eta">'+esc(etaText)+'</div>'
        +'<button class="btn btn-ghost btn-sm btn-icon" style="margin-left:auto" onclick="event.stopPropagation();editSavGoal(\''+g.id+'\')">✎</button></div></div>';
    }).join('');
  } else {
    ggEl.innerHTML = '<div class="empty-state" style="padding:40px;grid-column:1/-1;"><div class="empty-icon">🎯</div><div class="empty-title">Sin metas</div><div class="empty-sub">Creá tu primera meta de ahorro</div></div>';
  }

  /* ─── Gráfico de barras: depósitos por mes ─── */
  if(state.charts.savHistory) state.charts.savHistory.destroy();
  const ctx = document.getElementById('chart-sav-history');
  if(ctx){
    if(allMonths.length){
      const labels = allMonths.map(m=>{const[y,mo]=m.split('-');return new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'});});
      const maxV   = Math.max(...monthTotals,1);
      const bgColors = monthTotals.map(v=>v===maxV?'rgba(96,200,240,0.55)':'rgba(96,200,240,0.25)');
      const bdColors = monthTotals.map(v=>v===maxV?'#34c759':'rgba(96,200,240,0.5)');
      state.charts.savHistory = new Chart(ctx,{type:'bar',data:{labels,datasets:[
        {label:'Ahorro ARS',data:monthTotals,backgroundColor:bgColors,borderColor:bdColors,borderWidth:2,borderRadius:8,maxBarThickness:42}
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{..._chartTooltip(),callbacks:{label:c=>' $'+fmtN(c.parsed.y)+' ARS'+(c.parsed.y===maxV?' 🏆 mejor mes':'')}}},scales:{x:{grid:{display:false},ticks:{color:_chartTickColor(),font:_chartTickFont()}},y:{grid:_chartGridY(),ticks:{color:_chartTickColor(),font:_chartTickFont(),callback:v=>'$'+fmtN(v)}}}}});
    } else {
      const c2d = ctx.getContext('2d');
      ctx.height=80;
      c2d.fillStyle='#1d1d1f';c2d.font="13px -apple-system,'SF Pro Display',sans-serif";c2d.textAlign='center';
      c2d.fillText('Registrá depósitos para ver el historial',ctx.width/2,50);
    }
  }

  /* ─── Donut por cuenta ─── */
  if(state.charts.savDonut) state.charts.savDonut.destroy();
  const ctxD = document.getElementById('chart-sav-donut');
  const arsAccounts = accounts.filter(a=>a.currency==='ARS'&&a.balance>0);
  if(ctxD&&arsAccounts.length){
    const accLabels = arsAccounts.map(a=>a.name);
    const accVals   = arsAccounts.map(a=>a.balance);
    const accColors = arsAccounts.map(a=>a.color||'#888888');
    state.charts.savDonut = new Chart(ctxD,{type:'doughnut',data:{labels:accLabels,datasets:[{data:accVals,backgroundColor:accColors.map(c=>c+'cc'),borderColor:accColors,borderWidth:2,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{..._chartTooltip(),callbacks:{label:c=>' $'+fmtN(c.parsed)+' ARS'}}},cutout:'62%'}});
    const legEl = document.getElementById('sav-donut-legend');
    if(legEl){
      const total = accVals.reduce((s,v)=>s+v,0);
      legEl.innerHTML = accLabels.map((name,i)=>{
        const pct = total>0?Math.round(accVals[i]/total*100):0;
        return '<div style="display:flex;align-items:center;gap:7px;">'
          +'<div style="width:9px;height:9px;border-radius:3px;background:'+accColors[i]+';flex-shrink:0;"></div>'
          +'<div style="flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(name)+'</div>'
          +'<div style="font-size:11px;font-family:var(--font);color:var(--text3);">'+pct+'%</div>'
          +'</div>';
      }).join('');
    }
  }

}

// ── Depósitos CRUD ──
function openSavDepositModal(){
  document.getElementById('modal-dep-title').textContent='Registrar ahorro';
  document.getElementById('modal-dep-editing').value='';
  document.getElementById('btn-del-dep').style.display='none';
  const now=new Date();
  document.getElementById('dep-month').value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('dep-amount').value='';
  document.getElementById('dep-currency').value='ARS';
  document.getElementById('dep-note').value='';
  const sel=document.getElementById('dep-account');
  sel.innerHTML='<option value="">Sin especificar</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'">'+esc(a.name)+' ('+a.currency+')</option>').join('');
  openModal('modal-sav-deposit');
}
function editSavDeposit(id){
  const d=state.savDeposits.find(x=>x.id===id);if(!d)return;
  document.getElementById('modal-dep-title').textContent='Editar depósito';
  document.getElementById('modal-dep-editing').value=id;
  document.getElementById('btn-del-dep').style.display='inline-flex';
  document.getElementById('dep-month').value=d.month;
  document.getElementById('dep-amount').value=d.amount;
  document.getElementById('dep-currency').value=d.currency;
  document.getElementById('dep-note').value=d.note||'';
  const sel=document.getElementById('dep-account');
  sel.innerHTML='<option value="">Sin especificar</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'"'+(a.id===d.accountId?' selected':'')+'>'+esc(a.name)+' ('+a.currency+')</option>').join('');
  openModal('modal-sav-deposit');
}
function saveSavDeposit(){
  const month=document.getElementById('dep-month').value;
  const amount=parseFloat(document.getElementById('dep-amount').value)||0;
  if(!month||amount<=0){showToast('⚠️ Completá mes y monto','error');return;}
  const obj={
    id:document.getElementById('modal-dep-editing').value||Date.now().toString(36),
    month,amount,
    currency:document.getElementById('dep-currency').value,
    accountId:document.getElementById('dep-account').value||null,
    note:document.getElementById('dep-note').value.trim()
  };
  const idx=state.savDeposits.findIndex(x=>x.id===obj.id);
  if(idx>=0)state.savDeposits[idx]=obj;else state.savDeposits.push(obj);
  saveState();closeModal('modal-sav-deposit');renderSavingsPage();refreshAll();showToast('✓ Ahorro registrado','success');
}
function deleteSavDeposit(){
  const id=document.getElementById('modal-dep-editing').value;
  state.savDeposits=state.savDeposits.filter(d=>d.id!==id);
  saveState();closeModal('modal-sav-deposit');renderSavingsPage();showToast('Depósito eliminado','info');
}

// ── Savings account CRUD ──
function openSavAccountModal(){
  document.getElementById('modal-sav-acc-title').textContent='Nueva cuenta de ahorro';
  document.getElementById('modal-sav-acc-editing').value='';
  document.getElementById('sav-acc-name').value='';document.getElementById('sav-acc-emoji').value='';
  document.getElementById('sav-acc-balance').value='';document.getElementById('sav-acc-yield').value='';
  document.getElementById('sav-acc-currency').value='ARS';document.getElementById('sav-acc-type').value='banco';
  document.getElementById('btn-del-sav-acc').style.display='none';
  renderGenericColorPicker('sav-acc-color-picker','');openModal('modal-sav-account');
}
function editSavAccount(id){
  const a=state.savAccounts.find(x=>x.id===id);if(!a)return;
  document.getElementById('modal-sav-acc-title').textContent='Editar cuenta';
  document.getElementById('modal-sav-acc-editing').value=id;
  document.getElementById('sav-acc-name').value=a.name;document.getElementById('sav-acc-emoji').value=a.emoji||'';
  document.getElementById('sav-acc-balance').value=a.balance;document.getElementById('sav-acc-yield').value=a.yieldPct||'';
  document.getElementById('sav-acc-currency').value=a.currency;document.getElementById('sav-acc-type').value=a.type;
  document.getElementById('btn-del-sav-acc').style.display='inline-flex';
  renderGenericColorPicker('sav-acc-color-picker',a.color||'');openModal('modal-sav-account');
}
function saveSavAccount(){
  const name=document.getElementById('sav-acc-name').value.trim();if(!name){showToast('⚠️ Ingresá nombre','error');return;}
  const sw=document.querySelector('#sav-acc-color-picker .color-swatch.selected');const color=sw?rgbToHex(sw.style.backgroundColor):'#34c759';
  const obj={id:document.getElementById('modal-sav-acc-editing').value||Date.now().toString(36),name,emoji:document.getElementById('sav-acc-emoji').value||'',balance:parseFloat(document.getElementById('sav-acc-balance').value)||0,currency:document.getElementById('sav-acc-currency').value,type:document.getElementById('sav-acc-type').value,yieldPct:parseFloat(document.getElementById('sav-acc-yield').value)||0,color};
  const idx=state.savAccounts.findIndex(x=>x.id===obj.id);if(idx>=0)state.savAccounts[idx]=obj;else state.savAccounts.push(obj);
  saveState();closeModal('modal-sav-account');renderSavingsPage();refreshAll();showToast('✓ Cuenta guardada','success');
}
function deleteSavAccount(){
  const id=document.getElementById('modal-sav-acc-editing').value;
  state.savAccounts=state.savAccounts.filter(a=>a.id!==id);
  saveState();closeModal('modal-sav-account');renderSavingsPage();refreshAll();showToast('Cuenta eliminada','info');
}

// ── Savings goal CRUD ──
function openSavGoalModal(){
  document.getElementById('modal-sav-goal-title').textContent='Nueva meta de ahorro';
  document.getElementById('modal-sav-goal-editing').value='';
  document.getElementById('sav-goal-name').value='';document.getElementById('sav-goal-emoji').value='';
  document.getElementById('sav-goal-target').value='';document.getElementById('sav-goal-current').value='';
  document.getElementById('sav-goal-deadline').value='';document.getElementById('sav-goal-currency').value='ARS';
  document.getElementById('btn-del-sav-goal').style.display='none';
  // populate account selector
  const acSel=document.getElementById('sav-goal-account');acSel.innerHTML='<option value="">Sin vincular</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
  renderGenericColorPicker('sav-goal-color-picker','');openModal('modal-sav-goal');
}
function editSavGoal(id){
  const g=state.savGoals.find(x=>x.id===id);if(!g)return;
  document.getElementById('modal-sav-goal-title').textContent='Editar meta';
  document.getElementById('modal-sav-goal-editing').value=id;
  document.getElementById('sav-goal-name').value=g.name;document.getElementById('sav-goal-emoji').value=g.emoji||'';
  document.getElementById('sav-goal-target').value=g.target;document.getElementById('sav-goal-current').value=g.current;
  document.getElementById('sav-goal-deadline').value=g.deadline||'';document.getElementById('sav-goal-currency').value=g.currency;
  const acSel=document.getElementById('sav-goal-account');acSel.innerHTML='<option value="">Sin vincular</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'"'+(a.id===g.accountId?' selected':'')+'>'+esc(a.name)+'</option>').join('');
  document.getElementById('btn-del-sav-goal').style.display='inline-flex';
  renderGenericColorPicker('sav-goal-color-picker',g.color||'');openModal('modal-sav-goal');
}
function saveSavGoal(){
  const name=document.getElementById('sav-goal-name').value.trim();const target=parseFloat(document.getElementById('sav-goal-target').value)||0;
  if(!name||target<=0){showToast('⚠️ Completá nombre y monto','error');return;}
  const sw=document.querySelector('#sav-goal-color-picker .color-swatch.selected');const color=sw?rgbToHex(sw.style.backgroundColor):'#34c759';
  const obj={id:document.getElementById('modal-sav-goal-editing').value||Date.now().toString(36),name,emoji:document.getElementById('sav-goal-emoji').value||'🎯',target,currency:document.getElementById('sav-goal-currency').value,current:parseFloat(document.getElementById('sav-goal-current').value)||0,deadline:document.getElementById('sav-goal-deadline').value||null,accountId:document.getElementById('sav-goal-account').value||null,color};
  const idx=state.savGoals.findIndex(x=>x.id===obj.id);if(idx>=0)state.savGoals[idx]=obj;else state.savGoals.push(obj);
  saveState();closeModal('modal-sav-goal');renderSavingsPage();refreshAll();showToast('✓ Meta guardada','success');
}
function deleteSavGoal(){
  const id=document.getElementById('modal-sav-goal-editing').value;
  state.savGoals=state.savGoals.filter(g=>g.id!==id);
  saveState();closeModal('modal-sav-goal');renderSavingsPage();refreshAll();showToast('Meta eliminada','info');
}

// ── Generic color picker helper ──
function renderGenericColorPicker(containerId,sel){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML=PALETTE.map(c=>'<div class="color-swatch '+(c===sel?'selected':'')+'" style="background:'+c+'" onclick="selectSwatch(\''+c+'\',this,\''+containerId+'\')"></div>').join('');
}

