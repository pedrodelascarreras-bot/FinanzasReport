// ══ BÚSQUEDA GLOBAL (Cmd/Ctrl+K) ══
function openGlobalSearch(prefill=''){
  openModal('modal-global-search');
  setTimeout(()=>{
    const input=document.getElementById('global-search-input');
    if(!input)return;
    input.value=prefill;
    input.focus();
    input.select();
    renderGlobalSearchResults(prefill);
  },80);
}
function handleGlobalSearchInput(el){
  renderGlobalSearchResults(el?.value||'');
}
function getGlobalSearchBuckets(query=''){
  const q=String(query||'').trim().toLowerCase();
  const match=text=>String(text||'').toLowerCase().includes(q);
  const buckets=[];
  const shortcuts=[
    {icon:'spark', title:'Dashboard', meta:'Volver al tablero principal', action:'page', payload:'dashboard', tag:'atajo'},
    {icon:'trend', title:'Movimientos', meta:'Buscar, revisar y corregir movimientos', action:'page', payload:'transactions', tag:'atajo'},
    {icon:'loop', title:'Compromisos', meta:'Cuotas, suscripciones y gastos fijos', action:'page', payload:'cuotas', tag:'atajo'},
    {icon:'card', title:'Tarjeta de crédito', meta:'Ciclos, vencimientos y detalle de tarjetas', action:'page', payload:'credit-cards', tag:'atajo'},
    {icon:'safe', title:'Descargar backup', meta:'Exportar una copia de seguridad ahora', action:'backup', payload:'backup', tag:'seguridad'},
    {icon:'report', title:'Restaurar backup', meta:'Importar una copia guardada desde un archivo JSON', action:'restore', payload:'restore', tag:'seguridad'},
    {icon:'ai', title:'Conectar Google', meta:'Sincronizar tu archivo para verlo también desde el celular', action:'google', payload:'google', tag:'sync'}
  ].filter(item=>!q||match(item.title)||match(item.meta)||match(item.tag));
  buckets.push({title:q?'Coincidencias rápidas':'Atajos', items:shortcuts.slice(0,6)});

  const txns=(state.transactions||[])
    .filter(t=>!q||match(t.description)||match(t.category)||match(t.comercio_detectado)||match(fmtN(t.amount))||match(fmtDate(t.date)))
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .slice(0,q?6:4)
    .map(t=>({icon:'report',title:t.description,meta:`${fmtDate(t.date)} · ${t.currency==='USD'?'U$D ':'$'}${fmtN(t.amount)} · ${t.category||'Sin categoría'}`,action:'txn-search',payload:t.description,tag:'movimiento'}));
  if(txns.length) buckets.push({title:'Movimientos', items:txns});

  const cuotaHits=(state.cuotas||[])
    .filter(c=>!q||match(c.name))
    .slice(0,4)
    .map(c=>{
      const st=getCuotaStatus(c);
      return {icon:'loop',title:c.name,meta:`${st.paid}/${st.total} pagadas · $${fmtN(Math.round(st.amount))} por cuota`,action:'page',payload:'cuotas',tag:'cuota'};
    });
  if(cuotaHits.length) buckets.push({title:'Cuotas', items:cuotaHits});

  const recurring=[
    ...(state.subscriptions||[]).map(s=>({icon:'bell', title:s.name, meta:`Suscripción · ${(s.currency==='USD'?'U$D ':'$')+fmtN(s.price)} · día ${s.day||'sin definir'}`, action:'page', payload:'cuotas', tag:'suscripción'})),
    ...((state.fixedExpenses||[]).map(f=>({icon:'calendar', title:f.name, meta:`Gasto fijo · ${(f.currency==='USD'?'U$D ':'$')+fmtN(f.amount)} · día ${f.day||'sin definir'}`, action:'page', payload:'cuotas', tag:'fijo'})))
  ].filter(item=>!q||match(item.title)||match(item.meta)||match(item.tag)).slice(0,6);
  if(recurring.length) buckets.push({title:'Compromisos', items:recurring});

  const cats=(state.categories||[])
    .filter(c=>!q||match(c.name)||match(c.group))
    .slice(0,6)
    .map(c=>({icon:'tag', title:c.name, meta:`Categoría · ${c.group||'Sin grupo'}`, action:'txn-search', payload:c.name, tag:'categoría'}));
  if(cats.length) buckets.push({title:'Categorías', items:cats});

  return buckets.filter(bucket=>bucket.items.length);
}
function runGlobalSearchAction(action,payload){
  closeModal('modal-global-search');
  if(action==='page'){nav(payload);return;}
  if(action==='txn-search'){
    nav('transactions');
    setTimeout(()=>{
      const input=document.getElementById('f-search');
      if(input){input.value=payload||'';onSearchInput(input);}
    },120);
    return;
  }
  if(action==='backup'){if(typeof confirmarAccion==='function') confirmarAccion('backup');return;}
  if(action==='restore'){document.getElementById('restore-json-input')?.click();return;}
  if(action==='google'){
    if(typeof openCloudSync==='function') openCloudSync();
    else if(typeof gmailSync==='function') gmailSync();
  }
}
function renderGlobalSearchResults(query=''){
  const el=document.getElementById('global-search-results');
  if(!el)return;
  const buckets=getGlobalSearchBuckets(query);
  if(!buckets.length){
    el.innerHTML='<div class="global-search-empty">No encontré resultados para esa búsqueda. Probá con otro comercio, categoría o acción.</div>';
    return;
  }
  el.innerHTML=buckets.map(bucket=>`
    <div class="global-search-section">
      <div class="global-search-section-title">${esc(bucket.title)}</div>
      ${bucket.items.map(item=>`
        <button class="global-search-item" onclick="runGlobalSearchAction('${item.action}','${String(item.payload||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
          <div class="global-search-item-icon">${renderUiGlyph(item.icon||'spark')}</div>
          <div class="global-search-item-copy">
            <div class="global-search-item-title">${esc(item.title)}</div>
            <div class="global-search-item-meta">${item.meta}</div>
          </div>
          <div class="global-search-item-tag">${esc(item.tag||'ir')}</div>
        </button>
      `).join('')}
    </div>
  `).join('');
}

if(!window._globalSearchShortcutBound){
  window._globalSearchShortcutBound=true;
  document.addEventListener('keydown',e=>{
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    const typingField=['input','textarea','select'].includes(tag);
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();
      openGlobalSearch();
    } else if(!typingField&&e.key==='/'&&document.getElementById('page-dashboard')?.classList.contains('active')){
      e.preventDefault();
      openGlobalSearch();
    }
  });
}
