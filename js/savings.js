// ══ SAVINGS PAGE — 100% MANUAL ══
function savSignedAmount(dep){
  const raw = Math.abs(parseFloat(dep?.amount)||0);
  return dep?.kind==='withdrawal' ? -raw : raw;
}

function applySavingsAccountDelta(accountId, currency, delta){
  if(!accountId || !delta) return;
  const acc = (state.savAccounts||[]).find(a=>a.id===accountId);
  if(!acc) return;
  if(currency && acc.currency!==currency) return;
  acc.balance = (parseFloat(acc.balance)||0) + delta;
}

function renderSavingsPage(){
  const page = document.getElementById('page-savings');
  if(!page) return;
  const accounts = state.savAccounts || [];
  const goals = state.savGoals || [];
  const deps = state.savDeposits || [];
  const usdRate = USD_TO_ARS || 0;
  if(state.charts?.savHistory){ state.charts.savHistory.destroy(); state.charts.savHistory = null; }
  if(state.charts?.savDonut){ state.charts.savDonut.destroy(); state.charts.savDonut = null; }

  const money = (amount,currency='USD',dec=2)=>{
    if(!Number.isFinite(Number(amount))) return '—';
    return currency === 'USD' ? 'USD '+fmtN(Number(amount),dec) : '$'+fmtN(Number(amount),dec);
  };
  const signedMoney = dep=>{
    const signed = savSignedAmount(dep);
    return (signed < 0 ? '-' : '+') + money(Math.abs(signed), dep.currency || 'ARS');
  };
  const toUsd = (amount,currency)=>currency === 'USD' ? Number(amount)||0 : (usdRate>0 ? (Number(amount)||0)/usdRate : 0);
  const toArs = (amount,currency)=>currency === 'USD' ? (Number(amount)||0)*usdRate : Number(amount)||0;
  const totalARS = accounts.filter(a=>a.currency==='ARS').reduce((s,a)=>s+(Number(a.balance)||0),0);
  const totalUSD = accounts.filter(a=>a.currency==='USD').reduce((s,a)=>s+(Number(a.balance)||0),0);
  const totalEquivUSD = totalUSD + (usdRate>0 ? totalARS/usdRate : 0);
  const totalEquivARS = totalARS + (totalUSD*usdRate);
  const allMonths = [...new Set(deps.map(d=>d.month).filter(Boolean))].sort();
  const thisYear = new Date().getFullYear();
  const ytdDeposits = deps.filter(d=>d.kind!=='withdrawal' && d.month && d.month.startsWith(String(thisYear)));
  const ytdDepositUsd = ytdDeposits.reduce((s,d)=>s+toUsd(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0);
  const depositMonths = [...new Set(ytdDeposits.map(d=>d.month).filter(Boolean))];
  const monthlyDepositUsd = depositMonths.map(month=>
    ytdDeposits.filter(d=>d.month===month).reduce((s,d)=>s+toUsd(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0)
  );
  const avgMonthlyUsd = monthlyDepositUsd.length ? monthlyDepositUsd.reduce((s,v)=>s+v,0)/monthlyDepositUsd.length : 0;
  const incMonths = {};
  (state.incomeMonths||[]).forEach(m=>{
    const total = typeof getMonthTotalARS === 'function' ? getMonthTotalARS(m) : (m.sources?Object.values(m.sources).reduce((s,v)=>s+(Number(v)||0),0):0);
    incMonths[m.month] = total;
  });
  const rateValues = depositMonths.map(month=>{
    const income = incMonths[month] || 0;
    const savedArs = ytdDeposits.filter(d=>d.month===month).reduce((s,d)=>s+toArs(Math.abs(Number(d.amount)||0), d.currency||'ARS'),0);
    return income > 0 ? (savedArs/income)*100 : null;
  }).filter(v=>v!==null);
  const avgRate = rateValues.length ? Math.round(rateValues.reduce((s,v)=>s+v,0)/rateValues.length) : null;
  const monthNow = getMonthKey(new Date());
  const movementsThisMonth = deps.filter(d=>d.month===monthNow).length;
  const sortedMoves = [...deps].sort((a,b)=>(b.month||'').localeCompare(a.month||'') || String(b.id||'').localeCompare(String(a.id||'')));
  const recentMove = sortedMoves[0] || null;
  const accountById = id => accounts.find(a=>a.id===id) || null;
  const accountMovementSummary = account=>{
    const accMoves = deps.filter(d=>d.accountId===account.id && (d.currency||account.currency)===account.currency);
    if(!accMoves.length) return 'Sin movimientos';
    const net = accMoves.reduce((s,d)=>s+savSignedAmount(d),0);
    return accMoves.length+' movimiento'+(accMoves.length!==1?'s':'')+' - '+money(Math.abs(net), account.currency);
  };
  const goalCurrent = goal=>{
    if(goal.accountId){
      const acc = accountById(goal.accountId);
      return acc ? (goal.currency==='USD' ? toUsd(acc.balance,acc.currency) : toArs(acc.balance,acc.currency)) : 0;
    }
    return goal.currency==='USD' ? totalEquivUSD : totalEquivARS;
  };
  const goalModels = goals.map(g=>{
    const current = goalCurrent(g);
    const pct = g.target > 0 ? Math.min(100,Math.round((current/g.target)*100)) : 0;
    return {...g,current,pct};
  });
  const bestGoal = goalModels.length ? [...goalModels].sort((a,b)=>b.pct-a.pct)[0] : null;
  const savingsTargetUsd = Number(state.savMonthlyTargetUsd || state.savingsMonthlyTargetUsd || 500);
  const annualProjectionUsd = avgMonthlyUsd > 0 ? avgMonthlyUsd * 12 : totalEquivUSD * 12;

  const iconForAccount = account => esc(account.emoji || ({banco:'🏦',billetera:'📱',efectivo:'💵',inversion:'📈',cripto:'🔷',otro:'💰'}[account.type]||'🏦'));
  const statCard = (tone,icon,title,value,sub)=>`
    <article class="sav2-stat-card">
      <div class="sav2-stat-icon ${tone}">${icon}</div>
      <div>
        <div class="sav2-stat-title">${title}</div>
        <div class="sav2-stat-value">${value}</div>
        <div class="sav2-stat-sub">${sub}</div>
      </div>
    </article>`;
  const accountCard = (account,index)=>{
    const color = account.color || (index===1?'#ff3b30':'#6d4aff');
    return `<article class="sav2-list-card" onclick="editSavAccount('${account.id}')">
      <div class="sav2-avatar" style="background:${color}16;color:${color};">${iconForAccount(account)}</div>
      <div class="sav2-list-main">
        <div class="sav2-list-name">${esc(account.name)}</div>
        <div class="sav2-list-sub">${esc(account.type||'Banco')}</div>
        <div class="sav2-account-value" style="color:${color};">${money(Number(account.balance)||0, account.currency)}</div>
        <div class="sav2-list-foot">${accountMovementSummary(account)}</div>
      </div>
      <button class="sav2-menu-btn" onclick="event.stopPropagation();editSavAccount('${account.id}')">⋯</button>
    </article>`;
  };
  const goalCard = (goal,index)=>{
    const color = goal.color || (index===1?'#1497e8':'#f5a623');
    return `<article class="sav2-list-card sav2-goal-card" onclick="editSavGoal('${goal.id}')">
      <div class="sav2-avatar" style="background:${color}16;color:${color};">${esc(goal.emoji||'🎯')}</div>
      <div class="sav2-list-main">
        <div class="sav2-goal-head">
          <div>
            <div class="sav2-list-name">${esc(goal.name)}</div>
            <div class="sav2-list-sub">Meta: ${money(Number(goal.target)||0, goal.currency)}</div>
          </div>
          <button class="sav2-menu-btn" onclick="event.stopPropagation();editSavGoal('${goal.id}')">⋯</button>
        </div>
        <div class="sav2-goal-row">
          <div class="sav2-goal-value" style="color:${color};">${money(goal.current||0, goal.currency)}</div>
          <div class="sav2-goal-pct">${goal.pct}%</div>
        </div>
        <div class="sav2-progress"><span style="width:${goal.pct}%;background:${color};"></span></div>
        <div class="sav2-list-foot">${goal.pct}% completado</div>
      </div>
    </article>`;
  };
  const recentHtml = recentMove ? (()=>{
    const account = accountById(recentMove.accountId);
    const isOut = savSignedAmount(recentMove) < 0;
    const monthLabel = recentMove.month ? new Date(recentMove.month+'-01T12:00:00').toLocaleDateString('es-AR',{month:'long',year:'numeric'}) : 'Sin fecha';
    return `<article class="sav2-activity-card" onclick="editSavDeposit('${recentMove.id}')">
      <div class="sav2-activity-icon">${isOut?'↘':'↗'}</div>
      <div class="sav2-activity-copy">
        <div class="sav2-activity-title">${isOut?'Uso de ahorros':'Aporte a ahorros'} <span>${monthLabel}</span></div>
        <div class="sav2-activity-sub">${esc(recentMove.note || (isOut?'Pago de TC':'Movimiento'))}${account?' · '+esc(account.name):''}</div>
      </div>
      <div class="sav2-activity-amount ${isOut?'out':'in'}">${signedMoney(recentMove)}</div>
    </article>`;
  })() : '<div class="sav2-empty">Sin actividad reciente</div>';

  page.innerHTML = `
    <div class="sav2-shell">
      <header class="sav2-header">
        <div>
          <h1>Ahorros</h1>
          <p>${accounts.length} cuenta${accounts.length!==1?'s':''} · ${allMonths.length} mes${allMonths.length!==1?'es':''} con movimientos</p>
        </div>
        <div class="sav2-actions">
          <button class="sav2-btn" onclick="openSavAccountModal()">🏦 Nueva cuenta</button>
          <button class="sav2-btn" onclick="openSavGoalModal()">🎯 Nueva meta</button>
          <button class="sav2-btn-primary" onclick="openSavDepositModal()">+ Registrar movimiento</button>
        </div>
      </header>

      <section class="sav2-top-grid">
        <article class="sav2-feature-card">
          <div class="sav2-feature-label">Total acumulado</div>
          <div class="sav2-feature-currency">USD</div>
          <div class="sav2-feature-amount">${fmtN(totalEquivUSD,2)}</div>
          <div class="sav2-feature-pill">= $${fmtN(Math.round(totalEquivARS),2)} ARS - TC $${fmtN(usdRate,2)}</div>
          <div class="sav2-split-card">
            <div><span>ARS</span><strong>$${fmtN(Math.round(totalEquivARS),2)}</strong></div>
            <div><span>USD</span><strong class="usd">USD ${fmtN(totalEquivUSD,2)}</strong></div>
          </div>
          <div class="sav2-vault-art" aria-hidden="true">
            <span class="leaf l1"></span><span class="leaf l2"></span>
            <span class="coin c1"></span><span class="coin c2"></span><span class="coin c3"></span><span class="coin c4"></span>
            <span class="safe"><i></i><b></b></span>
          </div>
        </article>

        <div class="sav2-summary-block">
          <div class="sav2-section-head"><h2>Resumen rápido</h2><button>Ver detalle</button></div>
          <div class="sav2-stat-grid">
            ${statCard('green','🏛','Depositado este año',money(ytdDepositUsd,'USD'),ytdDeposits.length+' movimiento'+(ytdDeposits.length!==1?'s':''))}
            ${statCard('orange','⚙','Promedio mensual ahorrado',money(avgMonthlyUsd,'USD'),depositMonths.length+' mes'+(depositMonths.length!==1?'es':'')+' con registro')}
            ${statCard('purple','▟','Tasa de ahorro promedio',avgRate!==null?avgRate+'%':'—',avgRate!==null?rateValues.length+' mes'+(rateValues.length!==1?'es':'')+' con ingreso registrado':'Registrá ingresos para ver este dato')}
          </div>

          <div class="sav2-duo-grid">
            <section>
              <div class="sav2-section-head compact"><h2>Mis cuentas</h2><button>Ver todas</button></div>
              <div class="sav2-list-stack">
                ${accounts.map(accountCard).join('') || '<div class="sav2-empty">Sin cuentas registradas</div>'}
              </div>
            </section>
            <section>
              <div class="sav2-section-head compact"><h2>Metas de ahorro</h2><button>Ver todas</button></div>
              <div class="sav2-list-stack">
                ${goalModels.map(goalCard).join('') || '<div class="sav2-empty">Sin metas de ahorro</div>'}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section class="sav2-bottom-strip">
        <div><span>Liquidez total</span><strong>${money(totalEquivUSD,'USD')}</strong><small>Disponible para usar</small></div>
        <div><span>Movimientos este mes</span><strong>${movementsThisMonth}</strong><small>Últimos 30 días</small></div>
        <div class="with-icon"><i>⚙</i><span>Mejor meta</span><strong>${bestGoal?esc(bestGoal.name):'—'}</strong><small>${bestGoal?bestGoal.pct+'% completado':'Sin metas'}</small></div>
        <div><span>Ahorro mensual objetivo</span><strong>${money(savingsTargetUsd,'USD')}</strong><small>Sugerido personalizable</small></div>
        <div><span>Proyección anual</span><strong>${money(annualProjectionUsd,'USD')}</strong><small>Si mantenés el hábito</small></div>
      </section>

      <section class="sav2-activity-section">
        <div class="sav2-section-head compact"><h2>Actividad reciente</h2><button>Ver todo</button></div>
        ${recentHtml}
      </section>
    </div>`;
}

// ── Depósitos CRUD ──
function openSavDepositModal(){
  document.getElementById('modal-dep-title').textContent='Registrar movimiento';
  document.getElementById('modal-dep-editing').value='';
  document.getElementById('btn-del-dep').style.display='none';
  const now=new Date();
  document.getElementById('dep-month').value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('dep-amount').value='';
  document.getElementById('dep-currency').value='ARS';
  document.getElementById('dep-kind').value='deposit';
  document.getElementById('dep-note').value='';
  const sel=document.getElementById('dep-account');
  sel.innerHTML='<option value="">Sin especificar</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'">'+esc(a.name)+' ('+a.currency+')</option>').join('');
  openModal('modal-sav-deposit');
}
function editSavDeposit(id){
  const d=state.savDeposits.find(x=>x.id===id);if(!d)return;
  document.getElementById('modal-dep-title').textContent='Editar movimiento';
  document.getElementById('modal-dep-editing').value=id;
  document.getElementById('btn-del-dep').style.display='inline-flex';
  document.getElementById('dep-month').value=d.month;
  document.getElementById('dep-amount').value=Math.abs(parseFloat(d.amount)||0);
  document.getElementById('dep-currency').value=d.currency;
  document.getElementById('dep-kind').value=d.kind||'deposit';
  document.getElementById('dep-note').value=d.note||'';
  const sel=document.getElementById('dep-account');
  sel.innerHTML='<option value="">Sin especificar</option>'+state.savAccounts.map(a=>'<option value="'+a.id+'"'+(a.id===d.accountId?' selected':'')+'>'+esc(a.name)+' ('+a.currency+')</option>').join('');
  openModal('modal-sav-deposit');
}
function saveSavDeposit(){
  const month=document.getElementById('dep-month').value;
  const amount=parseFloat(document.getElementById('dep-amount').value)||0;
  if(!month||amount<=0){showToast('⚠️ Completá mes y monto','error');return;}
  const editingId=document.getElementById('modal-dep-editing').value||Date.now().toString(36);
  const previous=state.savDeposits.find(x=>x.id===editingId)||null;
  if(previous){
    applySavingsAccountDelta(previous.accountId, previous.currency, -savSignedAmount(previous));
  }
  const obj={
    id:editingId,
    month,amount,
    kind:document.getElementById('dep-kind').value||'deposit',
    currency:document.getElementById('dep-currency').value,
    accountId:document.getElementById('dep-account').value||null,
    note:document.getElementById('dep-note').value.trim()
  };
  applySavingsAccountDelta(obj.accountId, obj.currency, savSignedAmount(obj));
  const idx=state.savDeposits.findIndex(x=>x.id===obj.id);
  if(idx>=0)state.savDeposits[idx]=obj;else state.savDeposits.push(obj);
  saveState();closeModal('modal-sav-deposit');renderSavingsPage();refreshAll();showToast(obj.kind==='withdrawal'?'✓ Uso de ahorros registrado':'✓ Ahorro registrado','success');
}
function deleteSavDeposit(){
  const id=document.getElementById('modal-dep-editing').value;
  const previous=state.savDeposits.find(d=>d.id===id);
  if(previous){
    applySavingsAccountDelta(previous.accountId, previous.currency, -savSignedAmount(previous));
  }
  state.savDeposits=state.savDeposits.filter(d=>d.id!==id);
  saveState();closeModal('modal-sav-deposit');renderSavingsPage();showToast('Movimiento eliminado','info');
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
