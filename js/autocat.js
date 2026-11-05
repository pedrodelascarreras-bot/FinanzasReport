// ══ CATEGORIZAR SOLO ══
// Propone categoría para los gastos pendientes según lo que ya categorizaste antes
// (todos tus gastos con categoría), tus reglas y el historial de confirmaciones.
// Nada se aplica sin que lo revises: la lista muestra la sugerencia, el motivo y
// la confianza; podés cambiarla, destildarla o dejar el gasto sin categoría.

const AC_PROCESSOR_TOKENS=new Set(['merpago','mercadopago','mercadolibre','mp','dlo','dlocal','payu','payuar','paypal','ebanx','pago','pagos','compra']);
const AC_STOPWORDS=new Set(['sa','srl','sas','com','ar','www','http','https','the','de','del','la','el','los','las','y','en','cuota','cuotas','suscripcion','inc','llc','ltd']);
const AC_PENDING_CATS=new Set(['','Procesando...','Uncategorized','Sin categoría']);

function acTokens(text){
  return String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/\(cuota[^)]*\)/g,' ').replace(/\b\d{1,2}:\d{2}\b/g,' ').replace(/\d+/g,' ')
    .split(/[^a-z]+/).filter(tok=>tok.length>1 && !AC_PROCESSOR_TOKENS.has(tok) && !AC_STOPWORDS.has(tok));
}
function acMerchantKey(t){
  const src=t.gmailMerchantRaw||t._baseDesc||t.comercio_detectado||t.description||'';
  return acTokens(src).join('');
}
function acIsPending(t){
  if(!t || t.isPendingSubscription) return false;
  const cat=t.category||'';
  if(AC_PENDING_CATS.has(cat)) return true;
  // "Otros" puesto a mano es una decisión tuya; solo cuenta como pendiente si nadie lo confirmó
  return cat==='Otros' && t.estado_revision!=='confirmado_por_usuario';
}
function acIsLearnable(t){
  if(!t || t.isPendingSubscription || acIsPending(t)) return false;
  return !!t.category;
}

// Modelo: comercio → {categoría: peso}. Lo que confirmaste a mano pesa el doble.
function acBuildModel(txns=state.transactions||[], skipId=null){
  const byKey=new Map(), byToken=new Map();
  txns.forEach(t=>{
    if(t.id===skipId || !acIsLearnable(t)) return;
    const key=acMerchantKey(t); if(!key) return;
    const w=t.estado_revision==='confirmado_por_usuario'?2:1;
    if(!byKey.has(key)) byKey.set(key,{});
    const m=byKey.get(key); m[t.category]=(m[t.category]||0)+w;
    const tok=acTokens(t.gmailMerchantRaw||t._baseDesc||t.description)[0];
    if(tok && tok.length>=4){
      if(!byToken.has(tok)) byToken.set(tok,{});
      const mt=byToken.get(tok); mt[t.category]=(mt[t.category]||0)+w;
    }
  });
  return {byKey, byToken};
}
function acTop(counts){
  const entries=Object.entries(counts||{}).sort((a,b)=>b[1]-a[1]);
  if(!entries.length) return null;
  const total=entries.reduce((s,e)=>s+e[1],0);
  return {category:entries[0][0], weight:entries[0][1], total, share:entries[0][1]/total};
}
function acCategoryExists(name){
  return CATEGORY_GROUPS.some(g=>g.subs.includes(name));
}
// Devuelve {category, confidence:'alta'|'media'|'baja', reason} o null
function acSuggest(t, model){
  const key=acMerchantKey(t);
  const exact=key?acTop(model.byKey.get(key)):null;
  const times=n=>Math.round(n)+(Math.round(n)===1?' vez':' veces');
  if(exact && exact.weight>=2 && exact.share>=0.75)
    return {category:exact.category, confidence:'alta', reason:'Lo categorizaste '+times(exact.weight)+' como '+exact.category};
  const desc=t.gmailMerchantRaw||t._baseDesc||t.description||'';
  const rule=(state.catRules||[]).filter(r=>r.active!==false && r.keyword)
    .sort((a,b)=>(b.priority||0)-(a.priority||0))
    .find(r=>String(desc).toLowerCase().includes(String(r.keyword).toLowerCase()));
  if(rule) return {category:rule.category, confidence:'alta', reason:'Tu regla "'+rule.keyword+'"'};
  if(exact)
    return {category:exact.category, confidence:'media', reason:exact.share<0.75
      ?'Este comercio lo usaste en varias categorías; la más común es '+exact.category
      :'Lo categorizaste 1 vez como '+exact.category};
  // "MercadoPago" como comercio no dice nada: detrás hay cientos de comercios distintos
  const comercio=(t.comercio_detectado||'').toLowerCase();
  const genericComercio=!acTokens(comercio).length;
  const hist=comercio&&!genericComercio&&state.catHistory?acTop(state.catHistory[comercio]):null;
  if(hist) return {category:hist.category, confidence:'media', reason:'Confirmaste '+times(hist.weight)+' '+hist.category+' para '+t.comercio_detectado};
  const tok=acTokens(desc)[0];
  const byTok=tok&&tok.length>=4?acTop(model.byToken.get(tok)):null;
  if(byTok && byTok.share>=0.6)
    return {category:byTok.category, confidence:'baja', reason:'Se parece a otros gastos de "'+tok+'"'};
  return null;
}

// ── Pantalla de revisión ──
let _acRows=[];        // [{id, category, confidence, reason, checked, edited}]
let _acLastApplied=[]; // para deshacer: [{id, category, estado_revision, cat_source}]

function acPendingSuggestions(){
  const model=acBuildModel();
  const order={alta:0, media:1, baja:2, none:3};
  return (state.transactions||[]).filter(acIsPending).map(t=>{
    const s=acSuggest(t, model);
    return {id:t.id, category:s?.category||'', confidence:s?.confidence||'none', reason:s?.reason||'No encontré gastos parecidos',
      checked:!!s && s.confidence!=='baja', edited:false};
  }).sort((a,b)=>order[a.confidence]-order[b.confidence] || acTxnTime(b.id)-acTxnTime(a.id));
}
function acTxnTime(id){
  const t=(state.transactions||[]).find(x=>x.id===id);
  return t?new Date(t.date).getTime():0;
}
function openAutoCategorize(){
  _acRows=acPendingSuggestions();
  _acLastApplied=[];
  if(!_acRows.length){ showToast('✓ No hay gastos sin categoría','success'); return; }
  acRender();
  openModal('modal-autocat');
}
function acCategoryOptions(selected){
  let html='<option value="">— Sin categoría —</option>';
  CATEGORY_GROUPS.filter(g=>g.group!=='Sin clasificar').forEach(g=>{
    html+='<optgroup label="'+esc(g.emoji+' '+g.group)+'">'+g.subs.map(sub=>
      '<option value="'+esc(sub)+'"'+(sub===selected?' selected':'')+'>'+esc(sub)+'</option>').join('')+'</optgroup>';
  });
  if(selected && !acCategoryExists(selected)) html+='<option value="'+esc(selected)+'" selected>'+esc(selected)+'</option>';
  return html;
}
const AC_CONF_LABEL={alta:'Segura', media:'Revisala', baja:'Dudosa', none:'Sin idea'};
function acRowHtml(r, i){
  const t=(state.transactions||[]).find(x=>x.id===r.id); if(!t) return '';
  const d=new Date(t.date).toLocaleDateString('es-AR',{day:'2-digit',month:'short'});
  const amt=(t.currency==='USD'?'U$D ':'$')+fmtN(t.amount);
  return '<div class="ac-row'+(r.checked?'':' off')+'">'
    +'<label class="ac-check"><input type="checkbox" '+(r.checked?'checked':'')+' onchange="acToggle('+i+',this.checked)" aria-label="Aplicar a este gasto"></label>'
    +'<div class="ac-main">'
      +'<div class="ac-desc">'+esc(t.description||'')+'</div>'
      +'<div class="ac-meta">'+esc(d)+' · '+esc(amt)+'</div>'
    +'</div>'
    +'<div class="ac-side">'
      +'<select class="ac-select" onchange="acSetCategory('+i+',this.value)">'+acCategoryOptions(r.category)+'</select>'
      +'<div class="ac-why"><span class="ac-chip ac-'+(r.edited?'edited':r.confidence)+'">'+(r.edited?'Elegida por vos':AC_CONF_LABEL[r.confidence])+'</span>'
        +(r.edited?'':'<span class="ac-reason">'+esc(r.reason)+'</span>')+'</div>'
    +'</div>'
  +'</div>';
}
function acRender(){
  const body=document.getElementById('ac-body'); if(!body) return;
  if(_acLastApplied.length){
    body.innerHTML='<div class="ac-done"><div class="ac-done-icon">✓</div>'
      +'<div class="ac-done-title">'+_acLastApplied.length+' gasto'+(_acLastApplied.length!==1?'s':'')+' categorizado'+(_acLastApplied.length!==1?'s':'')+'</div>'
      +'<div class="ac-done-sub">La app también aprendió de los que cambiaste vos.</div></div>';
    document.getElementById('ac-footer').innerHTML='<button class="btn btn-ghost" onclick="acUndo()">Deshacer</button><button class="btn btn-primary" onclick="closeModal(\'modal-autocat\')">Listo</button>';
    document.getElementById('ac-summary').textContent='';
    return;
  }
  const withSug=_acRows.filter(r=>r.category).length;
  document.getElementById('ac-summary').textContent='Encontré categoría para '+withSug+' de '+_acRows.length+' gastos. Revisá y tocá Aplicar: lo que destildes queda como está.';
  const groups=[['alta','Seguras'],['media','Para revisar'],['baja','Dudosas'],['none','Sin sugerencia: elegí vos o dejalas']];
  body.innerHTML=groups.map(([conf,title])=>{
    const idx=_acRows.map((r,i)=>i).filter(i=>_acRows[i].confidence===conf);
    if(!idx.length) return '';
    return '<div class="ac-group"><div class="ac-group-title">'+title+' <span>'+idx.length+'</span></div>'+idx.map(i=>acRowHtml(_acRows[i],i)).join('')+'</div>';
  }).join('');
  const n=_acRows.filter(r=>r.checked && r.category).length;
  document.getElementById('ac-footer').innerHTML='<button class="btn btn-ghost" onclick="acCheckAll(false)">Destildar todos</button>'
    +'<button class="btn btn-ghost" onclick="acCheckAll(true)">Tildar todos</button>'
    +'<button class="btn btn-primary" onclick="acApply()" '+(n?'':'disabled')+'>Aplicar a '+n+' gasto'+(n!==1?'s':'')+'</button>';
}
function acToggle(i, on){
  const r=_acRows[i]; if(!r) return;
  r.checked=!!on && !!r.category;
  acRender();
}
function acCheckAll(on){
  _acRows.forEach(r=>{ r.checked=!!on && !!r.category; });
  acRender();
}
// Elegir la categoría de un gasto también la propone para los demás del mismo comercio que no tocaste
function acSetCategory(i, cat){
  const r=_acRows[i]; if(!r) return;
  r.category=cat; r.edited=true; r.checked=!!cat;
  const t=(state.transactions||[]).find(x=>x.id===r.id);
  const key=t?acMerchantKey(t):'';
  if(cat && key) _acRows.forEach(o=>{
    if(o===r || o.edited) return;
    const ot=(state.transactions||[]).find(x=>x.id===o.id);
    if(ot && acMerchantKey(ot)===key){ o.category=cat; o.edited=true; o.checked=true; }
  });
  acRender();
}
function acApply(){
  const apply=_acRows.filter(r=>r.checked && r.category);
  if(!apply.length) return;
  _acLastApplied=[];
  apply.forEach(r=>{
    const t=(state.transactions||[]).find(x=>x.id===r.id); if(!t) return;
    _acLastApplied.push({id:t.id, category:t.category, estado_revision:t.estado_revision, cat_source:t.cat_source});
    t.category=r.category;
    t.estado_revision='confirmado_por_usuario';
    t.cat_source=r.edited?'manual':'autocat';
    if(typeof learnFromConfirmation==='function') learnFromConfirmation(t, r.category);
  });
  saveState();
  if(typeof refreshAll==='function') refreshAll();
  if(typeof updateQrBadge==='function') updateQrBadge();
  acRender();
}
function acUndo(){
  _acLastApplied.forEach(p=>{
    const t=(state.transactions||[]).find(x=>x.id===p.id); if(!t) return;
    if(typeof learnFromConfirmation==='function' && t.comercio_detectado && state.catHistory){
      const h=state.catHistory[t.comercio_detectado.toLowerCase()];
      if(h && h[t.category]>0){ h[t.category]--; if(!h[t.category]) delete h[t.category]; }
    }
    t.category=p.category; t.estado_revision=p.estado_revision; t.cat_source=p.cat_source;
  });
  _acLastApplied=[];
  saveState();
  if(typeof refreshAll==='function') refreshAll();
  if(typeof updateQrBadge==='function') updateQrBadge();
  closeModal('modal-autocat');
  showToast('Cambios deshechos','info');
}
