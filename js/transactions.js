// ══ TRANSACTIONS ══
function onSearchInput(el){
  const clearBtn=document.getElementById('search-clear-btn');
  if(clearBtn)clearBtn.classList.toggle('visible',el.value.length>0);
  renderTransactions();
}
function clearSearch(){
  const inp=document.getElementById('f-search');
  if(inp)inp.value='';
  const clearBtn=document.getElementById('search-clear-btn');
  if(clearBtn)clearBtn.classList.remove('visible');
  renderTransactions();
}

// Card filter for transactions
if(state.txnCardFilter===undefined) state.txnCardFilter='';
function setCardFilter(key){
  state.txnCardFilter=key||'';
  document.getElementById('tcf-all')?.classList.toggle('active',!key);
  document.getElementById('tcf-visa')?.classList.toggle('active',key==='visa');
  document.getElementById('tcf-amex')?.classList.toggle('active',key==='amex');
  renderTransactions();
}

// Toggle modo filtro: 'mes' | 'tc'
function setTxnFilterMode(mode){
  state.txnFilterMode=mode||'mes';
  document.getElementById('tft-mes')?.classList.toggle('active',state.txnFilterMode==='mes');
  document.getElementById('tft-tc')?.classList.toggle('active',state.txnFilterMode==='tc');
  document.getElementById('txn-month-wrap').style.display=state.txnFilterMode==='mes'?'':'none';
  document.getElementById('txn-tc-wrap').style.display=state.txnFilterMode==='tc'?'':'none';
  renderTransactions();
}

function deleteTxn(id){
  const t=state.transactions.find(x=>x.id===id);
  if(!t)return;
  const label=t.description.length>50?t.description.slice(0,50)+'…':t.description;
  // Show inline confirm toast instead of browser confirm()
  showDeleteConfirm(id, label, t.amount, t.currency, t.date);
}
function confirmDeleteTxn(id){
  state.transactions=state.transactions.filter(t=>t.id!==id);
  state.imports.forEach(imp=>{if(imp.txnIds)imp.txnIds=imp.txnIds.filter(x=>x!==id);});
  saveState();
  renderTransactions();
  renderDashboard();
  showToast('Gasto eliminado');
}
function showDeleteConfirm(id, label, amount, currency, date){
  // Remove any existing confirm bar
  const existing=document.getElementById('del-confirm-bar');
  if(existing)existing.remove();
  const bar=document.createElement('div');
  bar.id='del-confirm-bar';
  bar.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--danger);border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:14px;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,.3);max-width:480px;width:90%;font-family:var(--font);';
  const sym=currency==='USD'?'U$D ':'$';
  bar.innerHTML='<div style="flex:1;font-size:13px;"><div style="color:var(--text3);font-size:11px;margin-bottom:3px;">¿Eliminar gasto?</div><div style="color:var(--text);font-weight:600;">'+esc(label)+'</div><div style="color:var(--danger);font-size:12px;">'+sym+fmtN(amount)+' · '+fmtDate(date)+'</div></div>'
    +'<button id="del-confirm-yes" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:700;font-size:13px;">Eliminar</button>'
    +'<button id="del-confirm-no" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 14px;cursor:pointer;font-size:13px;">Cancelar</button>';
  bar.querySelector('#del-confirm-yes').onclick=function(){confirmDeleteTxn(id);};
  bar.querySelector('#del-confirm-no').onclick=function(){bar.remove();};
  document.body.appendChild(bar);
  // Auto-dismiss after 6s
  setTimeout(()=>{const b=document.getElementById('del-confirm-bar');if(b)b.remove();},6000);
}

function getTxnCycleCommitmentsTab(){
  return localStorage.getItem('fin_txn_cycle_commitments_tab') || 'all';
}

function setTxnCycleCommitmentsTab(tab){
  localStorage.setItem('fin_txn_cycle_commitments_tab', tab || 'all');
  renderTransactions();
}

function renderTxnCycleCommitmentsPanel(wrap, entries){
  const oldPanel=document.getElementById('txn-cycle-commitments');
  if(oldPanel) oldPanel.remove();
  if(!wrap || !entries.length) return;

  const activeTab=getTxnCycleCommitmentsTab();
  const tabs=[
    {key:'all', label:'Todo'},
    {key:'cuotas', label:'Cuotas'},
    {key:'suscripciones', label:'Suscripciones'},
    {key:'fijos', label:'Fijos'}
  ];
  const counts=tabs.reduce((acc,tab)=>{
    acc[tab.key]=tab.key==='all'?entries.length:entries.filter(e=>e.group===tab.key).length;
    return acc;
  },{});
  const visible=activeTab==='all'?entries:entries.filter(e=>e.group===activeTab);
  const panel=document.createElement('div');
  panel.id='txn-cycle-commitments';
  panel.className='txn-cycle-panel';
  panel.innerHTML=
    '<div class="txn-cycle-panel-head">'
      +'<div>'
        +'<div class="txn-cycle-panel-kicker">Cuotas y compromisos del ciclo</div>'
        +'<div class="txn-cycle-panel-sub">Acá ves lo que cae dentro del ciclo actual aunque el banco no mande un mail nuevo todos los meses.</div>'
      +'</div>'
      +`<div class="txn-cycle-panel-count">${entries.length} item${entries.length!==1?'s':''}</div>`
    +'</div>'
    +'<div class="txn-cycle-tabs">'
      +tabs.map(tab=>`<button class="txn-cycle-tab ${activeTab===tab.key?'active':''}" onclick="setTxnCycleCommitmentsTab('${tab.key}')">${tab.label} <span>${counts[tab.key]||0}</span></button>`).join('')
    +'</div>'
    +(
      visible.length
        ? '<div class="txn-cycle-list">'+visible.map(item=>{
            const amount=(item.currency==='USD'?'U$D ':'$')+fmtN(item.amount);
            const settled=item.includeInTotal===true;
            return '<div class="txn-cycle-entry">'
              +`<div class="txn-cycle-dot" style="--entry-tone:${item.tone};"></div>`
              +'<div class="txn-cycle-copy">'
                +`<div class="txn-cycle-title">${esc(item.title)}</div>`
                +`<div class="txn-cycle-meta">${esc(item.kind)} · ${esc(item.meta)} · ${fmtDate(item.date)}${settled?' · Cobrado':' · Pendiente'}</div>`
              +'</div>'
              +`<div class="txn-cycle-amount" style="color:${item.tone};">${amount}</div>`
            +'</div>';
          }).join('')+'</div>'
        : '<div class="txn-cycle-empty">No hay elementos para esta vista dentro del ciclo actual.</div>'
    );
  wrap.appendChild(panel);
}

// ── Duplicate filter in transactions list ──
state._dupFilterOn = state._dupFilterOn || false;
// toggleDupFilter removed — legacy, f-dup-toggle element no longer exists

function txnDupKey(t){
  const d=t.date instanceof Date?t.date.toISOString().slice(0,10):String(t.date).slice(0,10);
  return String(t.amount)+'|'+t.currency+'|'+d;
}

function getDuplicateAmountKeys(){
  // Returns a Set of "amount|currency|date" keys that appear 2+ times
  var counts={};
  state.transactions.forEach(function(t){
    if(t.notDuplicate) return; // user confirmed not a duplicate
    var k=txnDupKey(t);
    counts[k]=(counts[k]||0)+1;
  });
  var dupKeys=new Set();
  Object.keys(counts).forEach(function(k){ if(counts[k]>1) dupKeys.add(k); });
  return dupKeys;
}

if(!window._dupGroups) window._dupGroups=[];

function resolveDupInline(groupIdx, action){
  const ids=window._dupGroups[groupIdx];
  if(!ids||!ids.length)return;
  if(action==='delete'){
    const toDelete=new Set(ids.slice(1)); // keep first, delete rest
    state.transactions=state.transactions.filter(t=>!toDelete.has(t.id));
    showToast('🗑 Duplicado eliminado','success');
  } else {
    ids.forEach(id=>{const t=state.transactions.find(x=>x.id===id);if(t)t.notDuplicate=true;});
    showToast('✓ Marcados como gastos distintos','success');
  }
  saveState();renderTransactions();renderDashboard();
}

function renderTransactions(){
  const mode=state.txnFilterMode||'mes';
  let activeCycleMeta=null;
  const todayRef=new Date();
  todayRef.setHours(23,59,59,999);
  const todayYmd=dateToYMD(todayRef);
  const getCommitmentTone=settled=>settled ? '#34c759' : '#ff9500';
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

  // ── Poblar selects ──
  const months=[...new Set(state.transactions.map(t=>t.month||getMonthKey(t.date)))].sort().reverse();
  const MNAMES=['Enero','Feb','Marzo','Abril','Mayo','Junio','Julio','Agosto','Sep','Oct','Nov','Dic'];
  const mf=document.getElementById('f-month');
  const activeMesKey = getActiveDashMonth();
  if(mf){
    const mv=mf.value||activeMesKey;
    mf.innerHTML='<option value="">Todos los meses</option>'+months.map(m=>{
      const[y,mo]=m.split('-');
      return'<option value="'+m+'" '+(m===mv?'selected':'')+'>'+MNAMES[+mo-1]+' '+y+'</option>';
    }).join('');
    if(!mf.value) mf.value=activeMesKey;
  }
  const tcf=document.getElementById('f-tc-cycle');const tcv=tcf?.value||'';
  if(tcf){
    const cycles=getTcCycles();
    if(cycles.length){
      tcf.innerHTML='<option value="">Ciclo actual</option>'+cycles.map(c=>'<option value="'+c.id+'" '+(c.id===tcv?'selected':'')+'>'+esc(c.label)+'</option>').join('');
    } else { tcf.innerHTML='<option value="">Sin ciclos</option>'; }
  }
  const cats=[...new Set(state.transactions.map(t=>t.category))].filter(c=>c&&c!=='Procesando...'&&c!=='Uncategorized').sort();
  const cf=document.getElementById('f-cat');const cv=cf?.value||'';
  if(cf){
    let fHtml='<option value="">Todas las categorías</option>';
    // Group filter options
    const usedGroups=[...new Set(cats.map(c=>catGroup(c)))];
    CATEGORY_GROUPS.forEach(g=>{
      const groupCats=cats.filter(c=>catGroup(c)===g.group);
      if(!groupCats.length)return;
      fHtml+='<optgroup label="'+g.emoji+' '+g.group+'">';
      // Add group-level filter
      fHtml+='<option value="__group__'+g.group+'" '+(cv==='__group__'+g.group?'selected':'')+'>── Todo '+g.group+'</option>';
      groupCats.forEach(c=>{
        fHtml+='<option value="'+c+'" '+(c===cv?'selected':'')+'>'+c+'</option>';
      });
      fHtml+='</optgroup>';
    });
    // Uncategorized cats not in any group
    const ungrouped=cats.filter(c=>!CATEGORY_GROUPS.find(g=>g.group===catGroup(c)));
    if(ungrouped.length){
      ungrouped.forEach(c=>{fHtml+='<option value="'+c+'" '+(c===cv?'selected':'')+'>'+c+'</option>';});
    }
    cf.innerHTML=fHtml;
  }

  // ── Filtrar ──
  let txns=[...state.transactions];
  const searchVal=(document.getElementById('f-search')?.value||'').toLowerCase().trim();
  const cfv=cf?.value||'';
  const cufv=document.getElementById('f-cur')?.value||'';
  let periodoLabel='';

  // When searching, skip period filter to search across ALL transactions
  const _isSearching=searchVal.length>=1;
  if(_isSearching){
    periodoLabel='🔍 Búsqueda en todos los períodos';
  } else if(state._dupFilterOn){
    periodoLabel='Todos (duplicados)';
  } else if(mode==='mes'){
    const mfv=mf?.value||activeMesKey;
    if(mfv){
      txns=txns.filter(t=>(t.month||getMonthKey(t.date))===mfv);
      const[y,mo]=mfv.split('-');periodoLabel=MNAMES[+mo-1]+' '+y;
    } else { periodoLabel='Todos los meses'; }
  } else {
    const selCycleId=tcf?.value||'';
    const allCycles=getTcCycles();
    let activeCycle=selCycleId?allCycles.find(c=>c.id===selCycleId):null;
    if(!activeCycle&&allCycles.length){
      const todayStr=dateToYMD(new Date());
      activeCycle=allCycles.find(c=>{const i2=allCycles.findIndex(x=>x.id===c.id);const op=getTcCycleOpen(allCycles,i2);return todayStr>=op&&todayStr<=c.closeDate;})||allCycles[0];
    }
    if(activeCycle){
      const i2=allCycles.findIndex(c=>c.id===activeCycle.id);
      const openStr=getTcCycleOpen(allCycles,i2);
      activeCycleMeta={cycle:activeCycle,openStr,closeStr:activeCycle.closeDate};
      txns=txns.filter(t=>{const d=dateToYMD(t.date);return d>=openStr&&d<=activeCycle.closeDate;});
      const openD=new Date(openStr+'T12:00:00');const closeD=new Date(activeCycle.closeDate+'T12:00:00');
      periodoLabel=activeCycle.label+' ('+openD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+' → '+closeD.toLocaleDateString('es-AR',{day:'2-digit',month:'short'})+')';
    }
  }

  if(cfv)txns=txns.filter(t=>t.category===cfv);
  if(cufv)txns=txns.filter(t=>t.currency===cufv);
  const cardFv=state.txnCardFilter||'';
  if(cardFv)txns=txns.filter(t=>t.payMethod===cardFv);
  // Sync card filter button states
  document.getElementById('tcf-all')?.classList.toggle('active',!cardFv);
  document.getElementById('tcf-visa')?.classList.toggle('active',cardFv==='visa');
  document.getElementById('tcf-amex')?.classList.toggle('active',cardFv==='amex');
  if(searchVal){
    const sv=searchVal.replace(/^\$/,'').trim(); // strip leading $ for amount search
    txns=txns.filter(t=>{
      const desc=(t.description||'').toLowerCase();
      const cat=(t.category||'').toLowerCase();
      const comercio=(t.comercio_detectado||'').toLowerCase();
      const parentCat=catGroup(t.category).toLowerCase();
      const dateStr=(fmtDate(t.date)||'').toLowerCase();
      const amtStr=fmtN(t.amount);
      const amtRaw=String(t.amount);
      const cur=t.currency.toLowerCase();
      return desc.includes(sv)||cat.includes(sv)||comercio.includes(sv)||
        parentCat.includes(sv)||dateStr.includes(sv)||
        amtStr.includes(sv)||amtRaw.includes(sv)||cur.includes(sv);
    });
    // Sort by relevance: exact description match first, then by date desc
    txns.sort((a,b)=>{
      const aExact=a.description.toLowerCase().startsWith(sv)?0:1;
      const bExact=b.description.toLowerCase().startsWith(sv)?0:1;
      if(aExact!==bExact)return aExact-bExact;
      return new Date(b.date)-new Date(a.date);
    });
  }

  // ── Filtro duplicados — calcular SIEMPRE para poder contar y marcar ──
  const dupKeys = getDuplicateAmountKeys();

  // Marcar duplicados en todos los movimientos (no solo los visibles)
  if(state._dupFilterOn){
    txns = txns.filter(t=>dupKeys.has(txnDupKey(t)));
  }

  // ── Filtro de estado (solo si NO estamos en modo duplicados) ──
  const estadoF = state.txnEstadoFilter||'all';
  if(estadoF==='sin_categoria'){
    txns = txns.filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized');
  }

  txns.sort((a,b)=>new Date(b.date)-new Date(a.date));

  // ── Contar estados para badges ──
  const allPeriodTxns = (() => {
    let base=[...state.transactions];
    if(!state._dupFilterOn){
      if(mode==='mes'){
        const mfv=mf?.value||activeMesKey;
        if(mfv)base=base.filter(t=>(t.month||getMonthKey(t.date))===mfv);
      } else if(mode==='tc'){
        // Aplicar el mismo filtro de ciclo TC para que los badges sean del período actual
        const _selId=tcf?.value||'';
        const _allCyc=getTcCycles();
        let _actCyc=_selId?_allCyc.find(c=>c.id===_selId):null;
        if(!_actCyc&&_allCyc.length){
          const _todayS=dateToYMD(new Date());
          _actCyc=_allCyc.find(c=>{const _i=_allCyc.findIndex(x=>x.id===c.id);const _op=getTcCycleOpen(_allCyc,_i);return _todayS>=_op&&_todayS<=c.closeDate;})||_allCyc[0];
        }
        if(_actCyc){
          const _i2=_allCyc.findIndex(c=>c.id===_actCyc.id);
          const _op2=getTcCycleOpen(_allCyc,_i2);
          base=base.filter(t=>{const d=dateToYMD(t.date);return d>=_op2&&d<=_actCyc.closeDate;});
        }
      }
    }
    return base;
  })();
  const _dupKeysForCount = getDuplicateAmountKeys();
  const estadoCounts = {
    sin_categoria: allPeriodTxns.filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized').length,
    duplicado_sospechoso: _dupKeysForCount.size>0?allPeriodTxns.filter(t=>_dupKeysForCount.has(txnDupKey(t))).length:0,
  };

  // Actualizar estado tabs
  const estadoTabs = document.getElementById('estado-filter-tabs');
  if(estadoTabs){
    estadoTabs.innerHTML = [
      {k:'all',label:'Todos',cls:''},
      {k:'sin_categoria',label:'⏳ Sin categoría',cls:'pendiente'},
      {k:'duplicado_sospechoso',label:'⊘ Duplicados',cls:'duplicado'},
    ].map(tab=>{
      const cnt=tab.k==='all'?allPeriodTxns.length:(estadoCounts[tab.k]||0);
      const act=estadoF===tab.k;
      return '<button class="eft-btn'+(act?' active'+( tab.cls?' '+tab.cls:''):'')+(tab.cls&&!act?' '+tab.cls:'')+'" onclick="setEstadoFilter(\''+tab.k+'\')" >'+tab.label+' <span class="eft-count">'+cnt+'</span></button>';
    }).join('');
  }

  // Banner sin categoría
  const banEl=document.getElementById('pendientes-banner');
  if(banEl){
    const nPend=estadoCounts.sin_categoria;
    if(nPend>0&&estadoF==='all'){
      banEl.classList.add('show');
      banEl.innerHTML='<span class="pb-text">⏳ '+nPend+' movimiento'+(nPend!==1?'s':'')+' sin categoría</span><button class="pb-btn" onclick="setEstadoFilter(\'sin_categoria\')">Categorizar ahora →</button>';
    } else { banEl.classList.remove('show'); }
  }

  // ── Resumen ──
  const arsTotal=txns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);
  const usdTotal=txns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
  const grandTotal=arsTotal+(usdTotal*USD_TO_ARS);
  const mainEl=document.getElementById('txns-main');const detailEl=document.getElementById('txns-detail');
  const arsEl=document.getElementById('txns-total-ars');const usdEl=document.getElementById('txns-total-usd');
  if(searchVal){const sArs=txns.filter(t=>t.currency==='ARS').reduce((s,t)=>s+t.amount,0);const sUsd=txns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);if(mainEl)mainEl.textContent=txns.length+' resultado'+(txns.length!==1?'s':'');if(arsEl)arsEl.textContent=sArs>0?'$'+fmtN(sArs):'—';if(usdEl)usdEl.textContent=sUsd>0?'U$D '+fmtN(sUsd):'—';}
  else{if(mainEl)mainEl.textContent='$'+fmtN(grandTotal);if(arsEl)arsEl.textContent='$'+fmtN(arsTotal);if(usdEl)usdEl.textContent=usdTotal>0?'U$D '+fmtN(usdTotal):'—';}
  if(detailEl){const parts=[];if(searchVal)parts.push('"'+searchVal+'"');else parts.push(periodoLabel||'Todos');parts.push('Mostrando '+txns.length+' de '+state.transactions.length+' movimientos');if(cfv)parts.push(cfv);detailEl.textContent=parts.join(' · ');}

  // ── Helpers visuales ──
  const highlight=(text,q)=>{if(!q)return esc(text);const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');return esc(text).replace(re,'<mark style="background:rgba(200,240,96,0.2);color:var(--accent);border-radius:2px;padding:0 1px;">$1</mark>');};

  const ESTADO_MAP = {
    detectado_automaticamente: {cls:'estado-detectado',  label:'Auto'},
    pendiente_de_revision:     {cls:'estado-pendiente',  label:'Pendiente'},
    confirmado_por_usuario:    {cls:'', label:''},  // hidden
    duplicado_sospechoso:      {cls:'estado-duplicado',  label:'Duplicado'},
  };
  const ORIGEN_MAP = {
    importado_desde_resumen: {cls:'origen-resumen', label:'📄 Resumen'},
    pegado_manualmente:       {cls:'origen-manual',  label:'✎ Manual'},
    importado_desde_gmail:    {cls:'origen-gmail',   label:'✉ Gmail'},
    suscripcion_proyectada:   {cls:'origen-gmail',   label:'🔁 Suscripción'},
  };
  function cuotaProjectedChip(t){
    if(!t.isPendingCuota) return '';
    const _crd=t.payMethod==='visa'?'<span style="background:rgba(230,57,70,0.12);color:#e63946;border:1px solid rgba(230,57,70,0.25);border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;letter-spacing:.03em;margin-left:3px;vertical-align:middle;">VISA</span>'
      :t.payMethod==='amex'?'<span style="background:rgba(69,123,157,0.12);color:#457b9d;border:1px solid rgba(69,123,157,0.25);border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;letter-spacing:.03em;margin-left:3px;vertical-align:middle;">AMEX</span>':'';
    return '<span class="origen-chip" style="background:rgba(255,149,0,0.12);color:var(--accent3);border:1px solid rgba(255,149,0,0.3);">📋 Cuota '+t.cuotaNum+'/'+t.cuotaTotal+_crd+'</span>';
  }
  function subscriptionProjectedChip(t){
    if(!t.isPendingSubscription) return '';
    return '<span class="origen-chip" style="background:rgba(90,200,250,0.12);color:#5ac8fa;border:1px solid rgba(90,200,250,0.28);">🔁 Próximo cobro</span>';
  }

  function estadoBadge(t){
    const estado = t.estado_revision || 'detectado_automaticamente';
    const m = ESTADO_MAP[estado]||{cls:'estado-detectado',label:estado};
    return '<span class="estado-badge '+m.cls+'">'+m.label+'</span>';
  }
  function origenChip(t){
    let origen = t.origen_del_movimiento||(t.source==='gmail'?'importado_desde_gmail':'importado_desde_resumen');
    // Si tiene payMethod visa/amex pero origen está marcado como resumen → fue importado desde Gmail
    if((t.payMethod==='visa'||t.payMethod==='amex')&&origen==='importado_desde_resumen') origen='importado_desde_gmail';
    const m = ORIGEN_MAP[origen]||{cls:'origen-resumen',label:origen};
    return '<span class="origen-chip '+m.cls+'">'+m.label+'</span>';
  }
  function sugerenciaBadge(t){ return ''; }

  // ── Tabla ──
  const wrap=document.getElementById('txn-wrap');
  if(!txns.length){
    wrap.innerHTML=`
      <div class="empty-state fade-up">
        <div class="empty-icon">📊</div>
        <div class="empty-title">${searchVal ? 'Sin resultados' : 'Sin movimientos aún'}</div>
        <p class="empty-sub">${searchVal ? 'No encontramos nada que coincida con "' + esc(searchVal) + '" en este período. Probá con otra categoría, monto o descripción.' : 'Todavía no hay movimientos para revisar. Importá datos o cargá un gasto manual para empezar a ordenar el día a día.'}</p>
        <div class="empty-actions">
           ${searchVal ? '<button class="btn btn-secondary" onclick="clearSearch()">Limpiar búsqueda</button>' : '<button class="btn btn-primary" onclick="nav(\'import\')">Importar datos</button><button class="btn btn-ghost" onclick="openNewExpenseModal()">Nuevo gasto</button>'}
        </div>
      </div>`;
    return;
  }

  const _payLbls={visa:'💳 VISA',amex:'💳 AMEX',deb:'🏦 Débito',ef:'💵 Efectivo'};
  const _payCls={visa:'tc',amex:'tc',deb:'deb',ef:'ef'};

  // Sort duplicates together
  let displayTxns = txns;
  let _dupAmtGroupMap = {};
  if(state._dupFilterOn){
    displayTxns = txns.slice().sort((a,b)=>{const d=b.amount-a.amount;if(d!==0)return d;return new Date(b.date)-new Date(a.date);});
    let _gi=0,_lastKey='';
    displayTxns.forEach(t=>{const k=txnDupKey(t);if(k!==_lastKey){_gi++;_lastKey=k;}_dupAmtGroupMap[t.id]=_gi;});
  }

  if(window.innerWidth<=768){
    // ── MOBILE ──
    wrap.innerHTML='<div style="border-radius:14px;overflow:hidden;border:1px solid var(--border);">'
      +displayTxns.map((t,i)=>{
        const d=(t.date instanceof Date?t.date:new Date(t.date+'T12:00:00')).toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
        const amt=(t.currency==='USD'?'U$D ':'$')+fmtN(t.amount);
        const amtColor=t.currency==='USD'?'var(--accent2)':'var(--accent)';
        const catDot='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+catColor(t.category)+';margin-right:4px;flex-shrink:0;"></span>';
        const _mChecked=state._selectedTxns&&state._selectedTxns.has(t.id)?' checked':'';
        const _mAmtColor=t.isPendingCuota?'var(--accent3)':amtColor;
        return '<div style="display:flex;align-items:center;padding:11px 14px;'+(i>0?'border-top:1px solid var(--border)':'')+';gap:10px;'+(t.isPendingCuota?'border-left:3px solid var(--accent3);':'')+'" data-txnid="'+t.id+'">'
          +'<input type="checkbox" class="txn-cb" data-id="'+t.id+'"'+_mChecked+' onclick="event.stopPropagation();toggleSelectTxn(\''+t.id+'\')">'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(t.description)+'</div>'
            +'<div style="font-size:10px;color:var(--text3);margin-top:3px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">'
              +'<span>'+d+'</span>'
              +'<span style="color:var(--border2);">·</span>'
              +'<span style="display:inline-flex;align-items:center;">'+catDot+esc(t.category||'—')+'</span>'
              +(t.isPendingCuota?'<span style="color:var(--accent3);font-weight:700;">📋 '+t.cuotaNum+'/'+t.cuotaTotal+'</span>':'')
            +'</div>'
          +'</div>'
          +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'
            +'<span style="font-size:14px;font-weight:700;color:'+_mAmtColor+';font-family:var(--font);">'+amt+'</span>'
            +'<button class="txn-edit-btn" data-id="'+t.id+'" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:4px;line-height:1;border-radius:6px;">✎</button>'
            +'<button class="txn-del-btn" data-id="'+t.id+'" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:4px;line-height:1;border-radius:6px;">✕</button>'
          +'</div>'
        +'</div>';
      }).join('')+'</div>';
  } else {
    // ── DESKTOP: tabla enriquecida ──
    wrap.innerHTML='<div class="table-wrap"><table>'
      +'<thead><tr>'
        +'<th style="width:30px;padding:0 6px;"><input type="checkbox" class="txn-cb-header" onchange="toggleSelectAll(this.checked)"></th>'
        +'<th style="width:80px">Fecha</th>'
        +'<th>Descripción</th>'
        +'<th style="width:140px">Categoría</th>'
        +'<th style="width:70px">Medio</th>'
        
        +'<th style="text-align:right;width:110px">Monto</th>'
        +'<th style="width:48px"></th>'
      +'</tr></thead><tbody>'
      +(()=>{
        const buildRow=(t)=>{
          const _pTag=t.payMethod
            ?('<span class="pay-tag '+_payCls[t.payMethod]+'" onclick="event.stopPropagation();openPayMethodModal(\''+t.id+'\')" title="Cambiar medio">'+_payLbls[t.payMethod]+'</span>')
            :('<span class="pay-tag" style="background:var(--surface2);color:var(--text3);border:1px solid var(--border);" onclick="event.stopPropagation();openPayMethodModal(\''+t.id+'\')" title="Asignar medio">+ tag</span>');
          const _dupBg=state._dupFilterOn&&_dupAmtGroupMap[t.id]%2===0?'background:rgba(200,240,96,0.03);':'';
          const _isSelected=state._detailTxnId===t.id?'selected':'';
          const amtColor=t.currency==='USD'?'color:var(--accent2)':t.isPendingCuota?'color:var(--accent3)':'';
          const comercioHtml=t.comercio_detectado&&t.comercio_detectado.toLowerCase()!==t.description.toLowerCase()
            ?'<span class="td-desc-secondary"><span class="comercio-detected">'+esc(t.comercio_detectado)+'</span>'+origenChip(t)+cuotaProjectedChip(t)+subscriptionProjectedChip(t)+sugerenciaBadge(t)+'</span>'
            :'<span class="td-desc-secondary">'+origenChip(t)+cuotaProjectedChip(t)+subscriptionProjectedChip(t)+sugerenciaBadge(t)+'</span>';
          const _checked=state._selectedTxns&&state._selectedTxns.has(t.id)?' checked':'';
          const _projStyle=t.isPendingCuota?'border-left:3px solid var(--accent3);':'';
          return '<tr class="txn-row-v2 '+_isSelected+(_checked?' multi-selected':'')+'" data-txnid="'+t.id+'" style="'+_dupBg+_projStyle+'">'
            +'<td style="padding:0 6px;"><input type="checkbox" class="txn-cb" data-id="'+t.id+'"'+_checked+' onclick="event.stopPropagation();toggleSelectTxn(\''+t.id+'\')"></td>'
            +'<td style="font-family:var(--font);font-size:13px;font-weight:500;color:var(--text3);white-space:nowrap;">'+fmtDate(t.date)+'</td>'
            +'<td class="td-main">'
              +'<span class="td-desc-primary">'+highlight(t.description,searchVal)+'</span>'
              +comercioHtml
            +'</td>'
            +'<td><span class="cat-badge" style="'+catStyle(t.category)+';cursor:pointer;" onclick="event.stopPropagation();openAssignModal(\''+t.id+'\',this)">'
              +'<span class="cat-dot" style="background:'+catColor(t.category)+'"></span>'+esc(t.category)+'</span></td>'
            +'<td>'+_pTag+'</td>'
            +'<td class="td-amount" style="'+amtColor+';font-size:15px;font-weight:700;letter-spacing:-.4px;">'+(t.currency==='USD'?'U$D ':'$')+fmtN(t.amount)+'</td>'
            +'<td style="padding:0 4px;white-space:nowrap;text-align:right;">'
              +'<button class="txn-edit-btn" data-id="'+t.id+'" title="Editar" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:4px 5px;border-radius:6px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.5">✎</button>'
              +'<button class="txn-del-btn" data-id="'+t.id+'" title="Eliminar" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:4px 5px;border-radius:6px;opacity:.5;transition:opacity .13s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.5">✕</button>'
            +'</td>'
          +'</tr>';
        };
        if(!state._dupFilterOn) return displayTxns.map(buildRow).join('');
        // ── Dup mode: render groups with action rows ──
        window._dupGroups=[];
        const grpMap={},grpOrder=[];
        displayTxns.forEach(t=>{const k=txnDupKey(t);if(!grpMap[k]){grpMap[k]=[];grpOrder.push(k);}grpMap[k].push(t);});
        return grpOrder.map((k,gi)=>{
          const grp=grpMap[k];
          window._dupGroups.push(grp.map(t=>t.id));
          const amt=(grp[0].currency==='USD'?'U$D ':'$')+fmtN(grp[0].amount);
          return grp.map(buildRow).join('')
            +'<tr style="background:var(--surface2);"><td colspan="7" style="padding:7px 14px;border-top:1px solid var(--border);border-bottom:2px solid var(--border);">'
            +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
            +'<span style="font-size:11px;color:var(--text3);">'+grp.length+' movimientos · '+amt+'</span>'
            +'<span style="flex:1;"></span>'
            +'<button onclick="resolveDupInline('+gi+',\'delete\')" style="font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid rgba(240,96,96,0.4);background:rgba(240,96,96,0.1);color:#ff3b30;cursor:pointer;font-weight:700;white-space:nowrap;">🗑 Sí, es duplicado — borrar uno</button>'
            +'<button onclick="resolveDupInline('+gi+',\'keep\')" style="font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-weight:600;white-space:nowrap;">✓ No, son gastos distintos</button>'
            +'</div>'
            +'</td></tr>'
            +'<tr><td colspan="7" style="height:10px;background:var(--bg);"></td></tr>';
        }).join('');
      })()
      +'</tbody></table></div>';
  }

  // Event delegation
  wrap.onclick=function(e){
    const del=e.target.closest('.txn-del-btn');if(del){e.stopPropagation();deleteTxn(del.dataset.id);return;}
    const edit=e.target.closest('.txn-edit-btn');if(edit){e.stopPropagation();openEditTxnModal(edit.dataset.id);return;}
    const row=e.target.closest('[data-txnid]');
    if(row&&!e.target.closest('.cat-badge')&&!e.target.closest('.pay-tag')&&!e.target.closest('.sugerencia-badge')){
      openTxnDetail(row.dataset.txnid);
    }
  };

  if(mode==='tc' && activeCycleMeta && !searchVal){
    const openDate=new Date(activeCycleMeta.openStr+'T00:00:00');
    const closeDate=new Date(activeCycleMeta.closeStr+'T23:59:59');
    const inCycle=d=>{
      const dt=d instanceof Date?new Date(d):new Date(String(d).includes('T')?d:(String(d)+'T12:00:00'));
      return dt>=openDate&&dt<=closeDate;
    };
    const entries=[];
    const entryKeys=new Set();
    const pushEntry=(key,obj)=>{
      if(!key||entryKeys.has(key)) return;
      entryKeys.add(key);
      entries.push(obj);
    };

    (state.transactions||[]).filter(t=>(t.isPendingCuota||t.isPendingSubscription)&&inCycle(t.date)).forEach(t=>{
      if(t.isPendingSubscription && t.sourceSubscriptionId){
        const sub=(state.subscriptions||[]).find(s=>s.id===t.sourceSubscriptionId);
        const monthKey=getMonthKey(t.date);
        if(sub && typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(sub, monthKey, state.transactions||[])) return;
      }
      const key=t.isPendingCuota?`cuota-${t.cuotaGroupId}-${t.cuotaNum}`:`sub-${t.sourceSubscriptionId||t.id}`;
      pushEntry(key,{
        date:t.date,
        title:t._baseDesc||t.description,
        amount:t.amount,
        currency:t.currency,
        group:t.isPendingCuota?'cuotas':'suscripciones',
        kind:t.isPendingCuota?'Cuota proyectada':'Suscripción proyectada',
        meta:t.isPendingCuota?`Cuota ${t.cuotaNum}/${t.cuotaTotal}`:'Próximo cobro',
        includeInTotal:hasReachedChargeDate(t.date),
        synthetic:false,
        tone:getCommitmentTone(hasReachedChargeDate(t.date))
      });
    });

    if(typeof detectAutoCuotas==='function' && typeof getAutoCuotaSnapshot==='function'){
      detectAutoCuotas().forEach(g=>{
        const snap=getAutoCuotaSnapshot(g, new Date(Math.min(todayRef.getTime(), closeDate.getTime())));
        if(!snap || snap.rem<=0) return;
        const dueDay=snap.cfg?.day||snap.scheduleDay||null;
        if(!dueDay) return;
        const cycleDates=getRecurringDatesInRange(dueDay, openDate, closeDate);
        cycleDates.forEach(dueDate=>{
          const matured=hasReachedChargeDate(dueDate);
          const cuotaIndex=Math.min(snap.total, Math.max(1, matured ? snap.paid : snap.paid+1));
          const key=`auto-${g.key}-${dateToYMD(dueDate)}`;
          pushEntry(key,{
            date:dueDate,
            title:g.displayName||g.name,
            amount:snap.amountPerCuota,
            currency:g.currency||'ARS',
            group:'cuotas',
            kind:'Cuota del ciclo',
            meta:`Cuota ${cuotaIndex}/${snap.total}`,
            includeInTotal:matured,
            synthetic:true,
            tone:getCommitmentTone(matured)
          });
        });
      });
    }

    (state.cuotas||[]).forEach(c=>{
      if(c.paid>=c.total || !c.day || typeof getNextCuotaDate!=='function') return;
      getRecurringDatesInRange(c.day, openDate, closeDate).forEach(dueDate=>{
        const matured=hasReachedChargeDate(dueDate);
        const cuotaIndex=Math.min(c.total, Math.max(1, matured ? c.paid : c.paid+1));
        pushEntry(`manual-${c.id}-${dateToYMD(dueDate)}`,{
          date:dueDate,
          title:c.name,
          amount:c.amount,
          currency:'ARS',
          group:'cuotas',
          kind:'Cuota manual',
          meta:`Cuota ${cuotaIndex}/${c.total}`,
          includeInTotal:matured,
          synthetic:true,
          tone:getCommitmentTone(matured)
        });
      });
    });

    if(typeof getNextCuotaDate==='function'){
      (state.subscriptions||[]).filter(s=>s.active!==false&&s.freq==='monthly'&&s.day).forEach(s=>{
        getRecurringDatesInRange(s.day, openDate, closeDate).forEach(dueDate=>{
          const monthKey=getMonthKey(dueDate);
          if(typeof hasRealSubscriptionChargeInMonth==='function' && hasRealSubscriptionChargeInMonth(s, monthKey, state.transactions||[])) return;
          const matured=hasReachedChargeDate(dueDate);
          pushEntry(`sub-cycle-${s.id}-${dateToYMD(dueDate)}`,{
            date:dueDate,
            title:s.name,
            amount:s.price,
            currency:s.currency||'ARS',
            group:'suscripciones',
            kind:'Suscripción',
            meta:`Cobro mensual · día ${s.day}`,
            includeInTotal:matured,
            synthetic:true,
            tone:getCommitmentTone(matured)
          });
        });
      });
      (state.fixedExpenses||[]).filter(f=>f.day).forEach(f=>{
        getRecurringDatesInRange(f.day, openDate, closeDate).forEach(dueDate=>{
          const matured=hasReachedChargeDate(dueDate);
          pushEntry(`fixed-cycle-${f.id||f.name}-${dateToYMD(dueDate)}`,{
            date:dueDate,
            title:f.name,
            amount:f.amount,
            currency:f.currency||'ARS',
            group:'fijos',
            kind:'Gasto fijo',
            meta:`Débito mensual · día ${f.day}`,
            tone:'#34c759',
            includeInTotal:matured,
            synthetic:true
          });
        });
      });
    }

    entries.sort((a,b)=>new Date(a.date)-new Date(b.date));
    renderTxnCycleCommitmentsPanel(wrap, entries);

    if(mainEl && !searchVal){
      const actualVisibleTxns=txns.filter(t=>!t.isPendingCuota&&!t.isPendingSubscription);
      let totalARS=actualVisibleTxns.filter(t=>t.currency!=='USD').reduce((s,t)=>s+t.amount,0);
      let totalUSD=actualVisibleTxns.filter(t=>t.currency==='USD').reduce((s,t)=>s+t.amount,0);
      entries.filter(e=>e.synthetic&&e.includeInTotal).forEach(e=>{
        if((e.currency||'ARS')==='USD') totalUSD+=Number(e.amount)||0;
        else totalARS+=Number(e.amount)||0;
      });
      const grandTotal=totalARS+(totalUSD*USD_TO_ARS);
      mainEl.textContent='$'+fmtN(grandTotal);
      if(arsEl) arsEl.textContent=totalARS>0?'$'+fmtN(totalARS):'—';
      if(usdEl) usdEl.textContent=totalUSD>0?'U$D '+fmtN(totalUSD):'—';
      if(detailEl){
        const baseParts=[periodoLabel||'Ciclo actual',`Mostrando ${txns.length} de ${state.transactions.length} movimientos`];
        if(cfv) baseParts.push(cfv);
        detailEl.textContent=baseParts.join(' · ');
      }
    }
  } else {
    document.getElementById('txn-cycle-commitments')?.remove();
  }
}

// ══ MULTI-SELECT ══
if(!state._selectedTxns) state._selectedTxns=new Set();

function toggleSelectTxn(id){
  if(!state._selectedTxns) state._selectedTxns=new Set();
  if(state._selectedTxns.has(id)) state._selectedTxns.delete(id);
  else state._selectedTxns.add(id);
  updateSelectBar();
  // Update checkbox visually
  const cb=document.querySelector('.txn-cb[data-id="'+id+'"]');
  if(cb) cb.checked=state._selectedTxns.has(id);
  // Update header checkbox
  updateHeaderCheckbox();
}

function toggleSelectAll(checked){
  if(!state._selectedTxns) state._selectedTxns=new Set();
  const allCbs=document.querySelectorAll('.txn-cb[data-id]');
  allCbs.forEach(cb=>{
    const id=cb.dataset.id;
    if(checked) state._selectedTxns.add(id);
    else state._selectedTxns.delete(id);
    cb.checked=checked;
  });
  updateSelectBar();
}

function updateHeaderCheckbox(){
  const hcb=document.querySelector('.txn-cb-header');
  if(!hcb)return;
  const allCbs=document.querySelectorAll('.txn-cb[data-id]');
  const allChecked=allCbs.length>0&&[...allCbs].every(cb=>cb.checked);
  hcb.checked=allChecked;
}

function clearSelection(){
  state._selectedTxns=new Set();
  document.querySelectorAll('.txn-cb').forEach(cb=>{cb.checked=false;});
  const hcb=document.querySelector('.txn-cb-header');
  if(hcb) hcb.checked=false;
  updateSelectBar();
}

function updateSelectBar(){
  const bar=document.getElementById('txn-select-bar');
  const count=document.getElementById('sb-count');
  if(!bar)return;
  const n=state._selectedTxns?state._selectedTxns.size:0;
  bar.classList.toggle('visible',n>0);
  if(count) count.textContent=n+' seleccionado'+(n!==1?'s':'');
}

function bulkCategorize(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  // Open a modal-style picker
  const picker=document.getElementById('cat-inline-picker');
  if(!picker)return;
  let html='<input class="cip-search" id="cip-search-input" placeholder="Buscar categoría..." oninput="filterCipList(this.value)" autocomplete="off">';
  html+='<div class="cip-list" id="cip-list-container">';
  CATEGORY_GROUPS.forEach(g=>{
    html+='<div class="cip-group" data-group="'+g.group+'">'+g.emoji+' '+g.group+'</div>';
    g.subs.forEach(sub=>{
      const c=g.color;
      html+='<div class="cip-item" data-sub="'+sub.toLowerCase()+'" data-group="'+g.group.toLowerCase()+'" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background .1s;"'
        +' onclick="applyBulkCategory(\''+sub+'\')"'
        +' onmouseover="this.style.background=\''+c+'12\'" onmouseout="this.style.background=\'\'">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0;opacity:.5;"></span>'
        +'<span style="font-size:12px;font-weight:500;color:var(--text);flex:1;">'+sub+'</span>'
      +'</div>';
    });
  });
  html+='</div>';
  picker.innerHTML=html;
  picker.style.display='flex';
  // Center it
  picker.style.top='50%';picker.style.left='50%';picker.style.transform='translate(-50%,-50%)';
  picker.style.position='fixed';
  setTimeout(()=>{const si=document.getElementById('cip-search-input');if(si)si.focus();},50);
  setTimeout(()=>document.addEventListener('click',_closeCipOnOutside,{once:true}),10);
}

function applyBulkCategory(catName){
  const ids=[...state._selectedTxns];
  ids.forEach(id=>{
    const t=state.transactions.find(x=>x.id===id);
    if(t) t.category=catName;
  });
  const picker=document.getElementById('cat-inline-picker');
  if(picker)picker.style.display='none';
  clearSelection();
  saveState();refreshAll();
  showToast('✓ '+ids.length+' movimientos → '+catName,'success');
}

function bulkUncategorize(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  if(!confirm('¿Descategorizar '+ids.length+' movimiento'+(ids.length!==1?'s':'')+'?'))return;
  ids.forEach(id=>{
    const t=state.transactions.find(x=>x.id===id);
    if(t) t.category='';
  });
  clearSelection();
  saveState();refreshAll();
  showToast('↩ '+ids.length+' descategorizados','info');
}

function bulkDelete(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  if(!confirm('¿Eliminar '+ids.length+' movimiento'+(ids.length!==1?'s':'')+'? Esta acción no se puede deshacer.'))return;
  state.transactions=state.transactions.filter(t=>!ids.includes(t.id));
  clearSelection();
  saveState();refreshAll();
  showToast('✕ '+ids.length+' eliminados','info');
}

function bulkTag(){
  const ids=[...state._selectedTxns];
  if(!ids.length)return;
  window._bulkTagMode=true;
  document.getElementById('modal-pay-desc').textContent=ids.length+' movimientos seleccionados';
  document.getElementById('modal-pay-txn-id').value='';
  openModal('modal-pay-method');
}

function setEstadoFilter(k){
  // Si es duplicados, activar también el _dupFilterOn para que la tabla los muestre
  if(k==='duplicado_sospechoso'){
    state._dupFilterOn = true;
  } else {
    state._dupFilterOn = false;
  }
  state.txnEstadoFilter=k;
  renderTransactions();
}

function acceptTxnSuggestion(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  if(t.cat_sugerida){
    learnFromConfirmation(t,t.cat_sugerida);
    t.category=t.cat_sugerida;
    t.estado_revision='confirmado_por_usuario';
    saveState();renderTransactions();updateQrBadge();
    showToast('✓ '+t.cat_sugerida+' aplicada','success');
  }
}

// ══ PANEL DETALLE TRANSACCIÓN ══
function openTxnDetail(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._detailTxnId=txnId;
  const panel=document.getElementById('txn-detail-panel');
  if(!panel)return;

  const ESTADO_LABELS={
    detectado_automaticamente:'🤖 Detectado automáticamente',
    pendiente_de_revision:'⏳ Pendiente de revisión',
    confirmado_por_usuario:'✓ Confirmado',
    duplicado_sospechoso:'⊘ Posible duplicado',
  };
  const ORIGEN_LABELS={
    importado_desde_resumen:'📄 Resumen bancario',
    pegado_manualmente:'✎ Manual',
    paste:'✎ Pegado',
    importado_desde_gmail:'✉ Gmail',
  };

  const cc=catColor(t.category);
  const catLabel=t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'
    ?catEmoji(t.category)+' '+t.category
    :'⏳ Pendiente de categoría';
  const catBadgeStyle=t.category&&t.category!=='Procesando...'&&t.category!=='Uncategorized'
    ?'background:'+cc+'18;border:1.5px solid '+cc+'44;color:'+cc
    :'background:var(--surface3);border:1.5px solid var(--border);color:var(--text3)';

  panel.innerHTML=`
    <div class="tdp-header">
      <div style="flex:1;">
        <div style="font-size:10px;color:var(--text3);font-family:var(--font);margin-bottom:4px;">${fmtDate(t.date)}</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:6px;">${esc(t.description)}</div>
        <div class="tdp-amount-big${t.currency==='USD'?' usd':''}">${t.currency==='USD'?'U$D ':'$'}${fmtN(t.amount)}</div>
      </div>
      <button class="tdp-close" onclick="closeTxnDetail()">✕</button>
    </div>
    <div class="tdp-body">
      <!-- Category badge — click to change via inline picker -->
      <div class="tdp-section">
        <div class="tdp-section-label">Categoría</div>
        <button style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;${catBadgeStyle};font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;transition:all .13s;" onclick="event.stopPropagation();openAssignModal('${txnId}',this)">
          ${catLabel} <span style="font-size:10px;opacity:.5;">✎</span>
        </button>
      </div>

      <!-- Info fields -->
      <div class="tdp-section">
        <div class="tdp-section-label">Información</div>
        ${t.comercio_detectado?'<div class="tdp-field"><div class="tdp-field-label">Comercio detectado</div><div class="tdp-field-value" style="font-weight:700;">'+esc(t.comercio_detectado)+'</div></div>':''}
        <div class="tdp-field"><div class="tdp-field-label">Origen</div><div class="tdp-field-value">${esc(ORIGEN_LABELS[t.origen_del_movimiento]||t.origen_del_movimiento||'—')}</div></div>
        <div class="tdp-field"><div class="tdp-field-label">Estado</div><div class="tdp-field-value">${esc(ESTADO_LABELS[t.estado_revision]||t.estado_revision||'—')}</div></div>
        ${t.payMethod?'<div class="tdp-field"><div class="tdp-field-label">Tag de pago</div><div class="tdp-field-value">'+({visa:'💳 Santander VISA',amex:'💳 Santander AMEX',deb:'🏦 Santander Débito',ef:'💵 Efectivo'}[t.payMethod]||t.payMethod)+'</div></div>':''}
      </div>

      <!-- Actions -->
      <div class="tdp-section">
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openEditTxnModal('${txnId}');closeTxnDetail();">✎ Editar</button>
          <button class="btn btn-ghost btn-sm" style="flex:1;color:var(--danger);" onclick="if(confirm('¿Eliminar?')){deleteTxn('${txnId}');closeTxnDetail();}">✕ Eliminar</button>
        </div>
        ${t.comercio_detectado?'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;" onclick="openAddRuleFromTxn(\''+txnId+'\')">＋ Crear regla para "'+esc(t.comercio_detectado)+'"</button>':''}
      </div>
    </div>
  `;
  panel.classList.add('open');
  if(window.innerWidth<=768)_iosLock();
  // Marcar fila seleccionada
  document.querySelectorAll('.txn-row-v2').forEach(r=>r.classList.toggle('selected',r.dataset.txnid===txnId));
  setTimeout(()=>{ document.addEventListener('click', _closePanelsOnOutside); }, 50);
}

function closeTxnDetail(){
  state._detailTxnId=null;
  const panel=document.getElementById('txn-detail-panel');
  if(panel&&panel.classList.contains('open')){
    panel.classList.remove('open');
    if(window.innerWidth<=768)_iosUnlock();
  }
  document.querySelectorAll('.txn-row-v2').forEach(r=>r.classList.remove('selected'));
  document.removeEventListener('click', _closePanelsOnOutside);
}

function setDetailCat(txnId, catName){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  t.category=catName;
  // Re-render cat buttons
  const sel=document.getElementById('tdp-cat-selector');
  if(sel) sel.querySelectorAll('.tdp-cat-btn').forEach(btn=>{
    const isSel=btn.textContent.trim()===catName;
    const c=state.categories.find(x=>x.name===catName);
    btn.classList.toggle('active',isSel);
    if(isSel&&c){btn.style.borderColor=c.color;btn.style.color=c.color;btn.style.background=c.color+'18';}
    else{btn.style.borderColor='';btn.style.color='';btn.style.background='';}
  });
  // Update cat dot in table row
  const row=document.querySelector('[data-txnid="'+txnId+'"]');
  if(row){
    const badge=row.querySelector('.cat-badge');
    if(badge)badge.innerHTML='<span class="cat-dot" style="background:'+catColor(catName)+'"></span>'+esc(catName)+' ✎';
    badge&&(badge.style.cssText=catStyle(catName)+';cursor:pointer;');
  }
}

function _closePanelsOnOutside(e){
  // Guard: if rules panel just re-rendered, the clicked element may no longer be in DOM
  // Use coordinates to check if click was within panel bounds
  const detailPanel = document.getElementById('txn-detail-panel');
  const rulesPanel  = document.getElementById('rules-panel');

  let clickedInsideDetail = detailPanel && detailPanel.contains(e.target);
  let clickedInsideRules  = rulesPanel  && rulesPanel.contains(e.target);

  // Fallback: check by bounding rect (handles re-rendered DOM)
  if(!clickedInsideRules && rulesPanel && rulesPanel.classList.contains('open')){
    const r=rulesPanel.getBoundingClientRect();
    if(e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom){
      clickedInsideRules=true;
    }
  }
  if(!clickedInsideDetail && detailPanel && detailPanel.classList.contains('open')){
    const r=detailPanel.getBoundingClientRect();
    if(e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom){
      clickedInsideDetail=true;
    }
  }

  if(!clickedInsideDetail && !clickedInsideRules){
    if(detailPanel && detailPanel.classList.contains('open')) closeTxnDetail();
    if(rulesPanel  && rulesPanel.classList.contains('open'))  closeRulesPanel();
  }
}

function markAsNormal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  t.estado_revision='confirmado_por_usuario';
  // Guardar en historial para que no vuelva a marcarse como duplicado automáticamente
  learnFromConfirmation(t, t.category);
  saveState();
  closeTxnDetail();
  renderTransactions();
  showToast('✓ Marcado como gasto normal','success');
}

function confirmTxnDetail(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  learnFromConfirmation(t,t.category);
  t.estado_revision='confirmado_por_usuario';
  const btn=document.getElementById('tdp-confirm-btn');
  if(btn){btn.textContent='✓ Confirmado';btn.classList.add('confirmed');}
  saveState();renderTransactions();updateQrBadge();
  showToast('✓ '+t.category+' confirmado','success');
}

function openAddRuleFromTxn(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  openRulesPanel();
  setTimeout(()=>{
    const kw=document.getElementById('rule-new-keyword');
    const cat=document.getElementById('rule-new-cat');
    if(kw)kw.value=t.comercio_detectado||t.description;
    if(cat)cat.value=t.category||'';
  },300);
}

// ══ EDIT TRANSACTION MODAL ══
function openEditTxnModal(txnId){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._editingTxnId=txnId;
  document.getElementById('modal-edit-desc').textContent='"'+t.description+'"';
  document.getElementById('modal-edit-description').value=t.description||'';
  document.getElementById('modal-edit-amount').value=t.amount||'';
  document.getElementById('modal-edit-currency').value=t.currency||'ARS';
  const _editDateStr=t.date?(t.date instanceof Date?t.date.toISOString():String(t.date)).slice(0,10):'';
  document.getElementById('modal-edit-date').value=_editDateStr;
  // Category select removed from edit modal
  openModal('modal-edit-txn');
}
function confirmEditTxn(){
  const id=state._editingTxnId;if(!id)return;
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  const desc=document.getElementById('modal-edit-description').value.trim();
  const amt=parseFloat(document.getElementById('modal-edit-amount').value);
  const cur=document.getElementById('modal-edit-currency').value;
  const date=document.getElementById('modal-edit-date').value;
  // const cat removed — category edited via badge
  if(!desc||isNaN(amt)||amt<=0){showToast('Completá todos los campos');return;}
  t.description=desc;t.amount=amt;t.currency=cur;
  if(date){t.date=date;t.month=date.slice(0,7);}
  // t.category preserved
  saveState();closeModal('modal-edit-txn');
  renderTransactions();renderDashboard();
  showToast('✓ Gasto actualizado');
}

// ══ ASSIGN MODAL ══
// ── Inline category picker (click on cat-badge in table) ──
function openAssignModal(txnId, anchorEl){
  const t=state.transactions.find(x=>x.id===txnId);if(!t)return;
  state._assigningTxnId=txnId;
  const picker=document.getElementById('cat-inline-picker');
  if(!picker)return;

  // Build: search + grouped list
  let html='<input class="cip-search" id="cip-search-input" placeholder="Buscar categoría..." oninput="filterCipList(this.value)" autocomplete="off">';
  html+='<div class="cip-list" id="cip-list-container">';
  CATEGORY_GROUPS.forEach(g=>{
    html+='<div class="cip-group" data-group="'+g.group+'">'+g.emoji+' '+g.group+'</div>';
    g.subs.forEach(sub=>{
      const sel=(sub===t.category);
      const c=g.color;
      html+='<div class="cip-item" data-sub="'+sub.toLowerCase()+'" data-group="'+g.group.toLowerCase()+'" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background .1s;'+(sel?'background:'+c+'18;':'')
        +'" onclick="confirmAssignInline(\''+txnId+'\',\''+sub+'\')"'
        +' onmouseover="this.style.background=\''+c+'12\'" onmouseout="this.style.background=\''+(sel?c+'18':'')+'\'">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+c+';flex-shrink:0;'+(sel?'box-shadow:0 0 0 2px '+c+'44;':'opacity:.5;')+'"></span>'
        +'<span style="font-size:12px;font-weight:'+(sel?'700':'500')+';color:'+(sel?c:'var(--text)')+';flex:1;">'+sub+'</span>'
        +(sel?'<span style="font-size:10px;color:'+c+';">✓</span>':'')
      +'</div>';
    });
  });
  html+='</div>';
  picker.innerHTML=html;

  picker.style.display='flex';
  const src2=anchorEl||document.querySelector('[onclick*="'+txnId+'"]');
  if(src2){
    const r=src2.getBoundingClientRect();
    let top=r.bottom+window.scrollY+6;
    let left=r.left+window.scrollX;
    if(left+320>window.innerWidth-12) left=window.innerWidth-332;
    if(top+420>window.scrollY+window.innerHeight-12) top=r.top+window.scrollY-420-6;
    picker.style.top=top+'px';
    picker.style.left=left+'px';
  }
  // Focus search
  setTimeout(()=>{const si=document.getElementById('cip-search-input');if(si)si.focus();},50);
  setTimeout(()=>document.addEventListener('click',_closeCipOnOutside,{once:true}),10);
}
function filterCipList(val){
  const q=val.toLowerCase().trim();
  const container=document.getElementById('cip-list-container');if(!container)return;
  const items=container.querySelectorAll('.cip-item');
  const groups=container.querySelectorAll('.cip-group');
  const visibleGroups=new Set();
  items.forEach(el=>{
    const sub=el.dataset.sub||'';
    const grp=el.dataset.group||'';
    const show=!q||sub.includes(q)||grp.includes(q);
    el.style.display=show?'flex':'none';
    if(show)visibleGroups.add(grp);
  });
  groups.forEach(el=>{
    el.style.display=visibleGroups.has((el.dataset.group||'').toLowerCase())?'flex':'none';
  });
}
function _closeCipOnOutside(e){
  const p=document.getElementById('cat-inline-picker');
  if(p&&!p.contains(e.target)){p.style.display='none';}
}
// confirmAssign removed — legacy, modal-assign-cat element no longer exists
function confirmAssignInline(txnId, catName){
  const t=state.transactions.find(x=>x.id===txnId);
  if(t){
    t.category=catName;
    t.estado_revision='confirmado_por_usuario';
    learnFromConfirmation(t, catName);
    saveState();refreshAll();
    updateQrBadge();
    const picker=document.getElementById('cat-inline-picker');
    if(picker)picker.style.display='none';
    showToast('✓ '+catName,'success');
  }
}

// ══ SMART DUPLICATE REVIEW ══
// Tracks groups the user dismissed ("not a duplicate")
window._dupDismissedGroups = window._dupDismissedGroups || new Set();

function showDuplicatesModal(){
  const allGroups = findDuplicateGroups();
  const groups = allGroups.filter(function(g){
    var key = g.map(function(t){ return t.id; }).sort().join('|');
    return !window._dupDismissedGroups.has(key);
  });

  var sub  = document.getElementById('dupe-modal-sub');
  var body = document.getElementById('dupe-modal-body');
  var foot = document.getElementById('dupe-delete-btn');

  if(!groups.length){
    sub.textContent = allGroups.length ? 'Revisaste todos los grupos' : 'Sin movimientos con el mismo monto';
    body.innerHTML = '';
    var doneWrap = document.createElement('div');
    doneWrap.style.cssText = 'text-align:center;padding:48px 20px;';
    doneWrap.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">&#10003;</div><div style="font-size:14px;font-weight:700;color:var(--accent);">Todo revisado</div><div style="font-size:11px;color:var(--text3);margin-top:6px;font-family:var(--font);">No hay grupos pendientes</div>';
    body.appendChild(doneWrap);
    if(foot) foot.style.display='none';
    openModal('modal-duplicates');
    return;
  }

  sub.textContent = groups.length + ' grupo' + (groups.length>1?'s':'') + ' con el mismo monto';
  if(foot){ foot.style.display='block'; foot.textContent = groups.length + ' grupo' + (groups.length>1?'s':'') + ' por revisar'; }

  body.innerHTML = '';

  groups.forEach(function(grp, gi){
    var gKey = grp.map(function(t){ return t.id; }).sort().join('|');
    var amtStr = (grp[0].currency==='ARS' ? '$' : 'U$D ') + fmtN(grp[0].amount);

    // ── Contenedor del grupo ──
    var grpEl = document.createElement('div');
    grpEl.id = 'dupgrp-' + gi;
    grpEl.style.cssText = 'border:1px solid var(--border2);border-radius:14px;overflow:hidden;margin-bottom:4px;';

    // ── Header del grupo ──
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--surface3);border-bottom:1px solid var(--border2);';

    var hdrLeft = document.createElement('div');
    hdrLeft.style.cssText = 'display:flex;align-items:center;gap:12px;';
    var hdrAmt = document.createElement('div');
    hdrAmt.style.cssText = 'font-size:18px;font-weight:700;letter-spacing:-0.02em;font-family:var(--font);color:var(--accent);';
    hdrAmt.textContent = amtStr;
    var hdrCount = document.createElement('div');
    hdrCount.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.05em;color:var(--text3);text-transform:uppercase;font-family:var(--font);background:var(--surface2);padding:3px 8px;border-radius:6px;border:1px solid var(--border);';
    hdrCount.textContent = grp.length + ' mov.';
    hdrLeft.appendChild(hdrAmt);
    hdrLeft.appendChild(hdrCount);

    var hdrRight = document.createElement('div');
    hdrRight.style.cssText = 'display:flex;gap:7px;flex-shrink:0;';

    var btnDejar = document.createElement('button');
    btnDejar.textContent = '🗑 Dejar 1 solo';
    btnDejar.title = 'Mantiene el primero, borra el resto';
    btnDejar.style.cssText = 'font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid rgba(240,96,96,0.4);background:rgba(240,96,96,0.1);color:#ff3b30;cursor:pointer;font-weight:700;';
    btnDejar.addEventListener('click', (function(key, group){ return function(){ dupGroupAction('delAll', key, group); }; })(gKey, grp));

    var btnDismiss = document.createElement('button');
    btnDismiss.textContent = '✓ No son dup.';
    btnDismiss.title = 'Son gastos distintos, no tocar';
    btnDismiss.style.cssText = 'font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;font-weight:600;';
    btnDismiss.addEventListener('click', (function(key){ return function(){ dupGroupAction('dismiss', key); }; })(gKey));

    hdrRight.appendChild(btnDejar);
    hdrRight.appendChild(btnDismiss);
    hdr.appendChild(hdrLeft);
    hdr.appendChild(hdrRight);
    grpEl.appendChild(hdr);

    // ── Tarjetas de cada transacción (layout vertical, cada una completa) ──
    grp.forEach(function(t, ti){
      var dateObj = t.date instanceof Date ? t.date : new Date(t.date);
      var dateStr = dateObj.toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
      var catC = catColor(t.category||'Otros');
      var srcIcon = t.source==='gmail' ? '📧' : (t.source==='csv' ? '📄' : '✏');
      var srcText = t.source==='gmail' ? 'Gmail' : (t.source==='csv' ? 'CSV' : 'Manual');

      var card = document.createElement('div');
      card.id = 'duprow-' + t.id;
      card.style.cssText = 'padding:12px 16px;' + (ti > 0 ? 'border-top:1px solid var(--border);' : '') + (ti%2===1 ? 'background:rgba(255,255,255,0.02);' : '');

      // ── Row 1: Badge + Descripción (full width) ──
      var topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;';

      var numBadge = document.createElement('div');
      numBadge.style.cssText = 'flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--surface3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text2);font-family:var(--font);margin-top:1px;';
      numBadge.textContent = ti + 1;

      var descEl = document.createElement('div');
      descEl.style.cssText = 'flex:1;font-size:14px;font-weight:700;color:var(--text);line-height:1.35;word-break:break-word;min-width:0;';
      descEl.textContent = t.description || '—';

      topRow.appendChild(numBadge);
      topRow.appendChild(descEl);

      // ── Row 2: Metadata chips (fecha, categoría, fuente, cuenta) ──
      var metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:32px;margin-bottom:8px;';

      var dateChip = document.createElement('span');
      dateChip.style.cssText = 'font-size:11px;color:var(--text2);font-family:var(--font);padding:2px 8px;border-radius:6px;background:var(--surface3);border:1px solid var(--border);display:inline-flex;align-items:center;gap:4px;';
      dateChip.textContent = '📅 ' + dateStr;
      metaRow.appendChild(dateChip);

      var catChip = document.createElement('span');
      catChip.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:6px;font-weight:700;background:' + catC + '18;border:1px solid ' + catC + '33;color:' + catC + ';';
      catChip.textContent = t.category || '—';
      metaRow.appendChild(catChip);

      var srcChip = document.createElement('span');
      srcChip.style.cssText = 'font-size:10px;color:var(--text3);font-family:var(--font);padding:2px 7px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);';
      srcChip.textContent = srcIcon + ' ' + srcText;
      metaRow.appendChild(srcChip);

      if(t.account){
        var accChip = document.createElement('span');
        accChip.style.cssText = 'font-size:10px;color:var(--text3);font-family:var(--font);padding:2px 7px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);';
        accChip.textContent = '💳 ' + t.account;
        metaRow.appendChild(accChip);
      }

      // ── Row 3: Botones de acción ──
      var actRow = document.createElement('div');
      actRow.style.cssText = 'display:flex;gap:8px;margin-left:32px;';

      var btnDel = document.createElement('button');
      btnDel.textContent = '🗑 Eliminar este';
      btnDel.style.cssText = 'font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid rgba(240,96,96,0.4);background:rgba(240,96,96,0.08);color:#ff3b30;cursor:pointer;font-weight:700;';
      btnDel.addEventListener('click', (function(id, key){ return function(){ dupAction('del', id, key); }; })(t.id, gKey));

      var btnEdit = document.createElement('button');
      btnEdit.textContent = '✏ Editar';
      btnEdit.style.cssText = 'font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:var(--surface3);color:var(--text2);cursor:pointer;font-weight:600;';
      btnEdit.addEventListener('click', (function(id, key){ return function(){ dupAction('edit', id, key); }; })(t.id, gKey));

      actRow.appendChild(btnDel);
      actRow.appendChild(btnEdit);

      card.appendChild(topRow);
      card.appendChild(metaRow);
      card.appendChild(actRow);
      grpEl.appendChild(card);
    });

    body.appendChild(grpEl);
  });

  openModal('modal-duplicates');
}


function dupGroupAction(action, gKey, grpArray){
  if(action==='dismiss'){
    window._dupDismissedGroups.add(gKey);
    _dupRefreshModal();
  } else if(action==='delAll'){
    // Keep first (index 0), delete the rest
    var toDelete = new Set();
    for(var i=1; i<grpArray.length; i++) toDelete.add(String(grpArray[i].id));
    state.transactions = state.transactions.filter(function(t){ return !toDelete.has(String(t.id)); });
    saveState(); renderTransactions(); renderDashboard();
    showToast('Duplicado' + (toDelete.size!==1?'s':'') + ' eliminado' + (toDelete.size!==1?'s':'') + ' (' + toDelete.size + ')', 'success');
    _dupRefreshModal();
  }
}

function dupAction(action, txnId, gKey){
  if(action==='delete'||action==='del'){
    state.transactions = state.transactions.filter(t=>t.id!==txnId);
    saveState(); renderTransactions(); renderDashboard();
    const row=document.getElementById('duprow-'+txnId);
    if(row){
      row.style.transition='opacity .2s, max-height .3s';row.style.opacity='0';row.style.maxHeight='0';row.style.overflow='hidden';row.style.padding='0 16px';
      setTimeout(()=>{ row.remove(); _dupCheckGroupEmpty(); },300);
    }
    showToast('🗑 Eliminado','success');
  } else if(action==='edit'){
    closeModal('modal-duplicates');
    openEditTxnModal(txnId);
  }
}

function _dupCheckGroupEmpty(){
  document.querySelectorAll('[id^="dupgrp-"]').forEach(grpEl=>{
    if(!grpEl.querySelectorAll('[id^="duprow-"]').length){
      grpEl.style.transition='opacity .2s';grpEl.style.opacity='0';
      setTimeout(()=>{ grpEl.remove(); _dupUpdateFooter(); },220);
    }
  });
  _dupUpdateFooter();
}

function _dupUpdateFooter(){
  const remaining=document.querySelectorAll('[id^="dupgrp-"]').length;
  const foot=document.getElementById('dupe-delete-btn');
  const sub=document.getElementById('dupe-modal-sub');
  if(!remaining){
    document.getElementById('dupe-modal-body').innerHTML='<div style="text-align:center;padding:48px 20px;"><div style="font-size:28px;margin-bottom:10px;">✓</div><div style="font-size:14px;font-weight:700;color:var(--accent);">¡Todo revisado!</div></div>';
    if(sub)sub.textContent='✓ Sin grupos pendientes';
    if(foot)foot.style.display='none';
  } else {
    if(foot){foot.style.display='block';foot.textContent=remaining+' grupo'+(remaining!==1?'s':'')+' por revisar';}
  }
}

function _dupRefreshModal(){ showDuplicatesModal(); }

function confirmDeleteDuplicates(){ showDuplicatesModal(); }
function confirmDeleteDupes(){ showDuplicatesModal(); }

// ── Nuevo gasto desde Movimientos ──
function openNewExpenseModal(){
  document.getElementById('ne-desc').value='';
  document.getElementById('ne-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('ne-amount').value='';
  document.getElementById('ne-method').value='ef';
  const catSel=document.getElementById('ne-cat');
  let opts='';CATEGORY_GROUPS.forEach(g=>{opts+='<optgroup label="'+g.group+'">';g.subs.forEach(s=>{opts+='<option value="'+s+'">'+s+'</option>';});opts+='</optgroup>';});
  catSel.innerHTML=opts;
  openModal('modal-new-expense');
  setTimeout(()=>document.getElementById('ne-desc').focus(),100);
}
function saveNewExpense(){
  const desc=document.getElementById('ne-desc').value.trim();
  const dateVal=document.getElementById('ne-date').value;
  const amountVal=parseFloat(document.getElementById('ne-amount').value)||0;
  const method=document.getElementById('ne-method').value;
  const cat=document.getElementById('ne-cat').value;
  if(!desc){showToast('Ingresa una descripcion','error');return;}
  if(!dateVal){showToast('Ingresa una fecha','error');return;}
  if(!amountVal||amountVal<=0){showToast('Ingresa un monto valido','error');return;}
  const payMethodMap={ef:'ef',deb:'deb',tc:'tc',usd:'ef'};
  const currency=method==='usd'?'USD':'ARS';
  const date=new Date(dateVal+'T12:00:00');
  const id=Math.random().toString(36).substr(2,9);
  const txn={id,date,description:desc,amount:amountVal,currency,category:cat,
    payMethod:payMethodMap[method]||'ef',week:getWeekKey(date),month:getMonthKey(date),manual:true};
  state.transactions.push(txn);
  let manualImp=state.imports.find(i=>i.id==='manual');
  if(!manualImp){manualImp={id:'manual',label:'Gastos manuales',date:new Date().toLocaleDateString('es-AR'),count:0,source:'manual',txnIds:[]};state.imports.unshift(manualImp);}
  manualImp.txnIds.push(id);manualImp.count=manualImp.txnIds.length;
  saveState();refreshAll();
  closeModal('modal-new-expense');
  showToast('Gasto agregado: '+desc,'success');
}
