// ══ PANEL DE REGLAS ══
function openRulesPanel(){
  closeTxnDetail();
  renderRulesPanel();
  document.getElementById('rules-panel')?.classList.add('open');
  _iosLock();
  setTimeout(()=>{ document.addEventListener('click', _closePanelsOnOutside); }, 50);
}
function closeRulesPanel(){
  const rp=document.getElementById('rules-panel');
  if(rp&&rp.classList.contains('open')){rp.classList.remove('open');_iosUnlock();}
  document.removeEventListener('click', _closePanelsOnOutside);
}
function renderRulesPanel(){
  window._rulesJustRendered=true;
  const panel=document.getElementById('rules-panel');if(!panel)return;
  const rules=state.catRules||[];
  const histEntries=Object.entries(state.catHistory||{}).sort((a,b)=>{
    const aMax=Math.max(...Object.values(a[1]));const bMax=Math.max(...Object.values(b[1]));return bMax-aMax;
  });
  let catOptsHtml='';
  CATEGORY_GROUPS.forEach(g=>{
    catOptsHtml+='<optgroup label="'+g.emoji+' '+g.group+'">';
    g.subs.forEach(s=>{catOptsHtml+='<option value="'+esc(s)+'">'+esc(s)+'</option>';});
    catOptsHtml+='</optgroup>';
  });

  // Suggestions
  const suggestions=[];
  const comercioCounts={};
  state.transactions.forEach(t=>{
    const com=t.comercio_detectado;if(!com)return;
    const key=com.toLowerCase();
    if(!comercioCounts[key])comercioCounts[key]={name:com,cats:{},total:0};
    comercioCounts[key].total++;
    const cat=t.category;
    if(cat&&cat!=='Procesando...'&&cat!=='Uncategorized') comercioCounts[key].cats[cat]=(comercioCounts[key].cats[cat]||0)+1;
  });
  const existingKw=new Set((rules||[]).map(r=>r.keyword.toLowerCase()));
  Object.entries(comercioCounts).forEach(([key,data])=>{
    if(data.total<2||existingKw.has(key))return;
    const catEntries=Object.entries(data.cats).sort((a,b)=>b[1]-a[1]);
    if(!catEntries.length)return;
    const top=catEntries[0];const confidence=Math.round(top[1]/data.total*100);
    if(confidence>=60) suggestions.push({keyword:key,displayName:data.name,category:top[0],count:data.total,confidence});
  });
  suggestions.sort((a,b)=>b.count-a.count);

  // Stats
  const uncategorized=state.transactions.filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized').length;
  const tab=state._rulesTab||'rules';

  panel.innerHTML=`
    <div class="rp-header">
      <div>
        <div class="rp-title">⚡ Reglas de categorización</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px;">${rules.length} reglas · ${histEntries.length} aprendidos${uncategorized>0?' · <span style="color:var(--danger);">'+uncategorized+' sin categoría</span>':''}</div>
      </div>
      <button class="tdp-close" onclick="closeRulesPanel()">✕</button>
    </div>
    <div class="rp-body">
      <!-- TABS -->
      <div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:8px;">
        <button onclick="state._rulesTab='rules';renderRulesPanel();" style="padding:6px 14px;border-radius:6px 6px 0 0;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:var(--font);transition:all .12s;${tab==='rules'?'background:var(--accent);color:#fff;':'background:transparent;color:var(--text3);'}">📋 Mis reglas (${rules.length})</button>
        <button onclick="state._rulesTab='learned';renderRulesPanel();" style="padding:6px 14px;border-radius:6px 6px 0 0;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:var(--font);transition:all .12s;${tab==='learned'?'background:var(--accent);color:#fff;':'background:transparent;color:var(--text3);'}">🧠 Aprendidas (${histEntries.length})</button>
        <button onclick="state._rulesTab='suggest';renderRulesPanel();" style="padding:6px 14px;border-radius:6px 6px 0 0;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:var(--font);transition:all .12s;${tab==='suggest'?'background:var(--accent);color:#fff;':'background:transparent;color:var(--text3);'}">💡 Sugeridas (${suggestions.length})</button>
      </div>

      ${tab==='rules'?`
      <!-- ═══ TAB: MIS REGLAS ═══ -->
      ${rules.length===0?'<div style="color:var(--text3);font-size:12px;padding:20px 0;text-align:center;background:var(--surface2);border-radius:8px;">Sin reglas. Creá la primera abajo o aceptá una sugerencia.</div>':''}
      ${rules.map((r,i)=>{
        const cc=catColor(r.category);
        const matchCount=state.transactions.filter(t=>(t.description||'').toLowerCase().includes(r.keyword.toLowerCase())).length;
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:4px;border:1px solid var(--border);'+(r.active===false?'opacity:.45;':'')+'">'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">'
              +'<span style="font-size:12px;font-weight:700;color:var(--text);background:var(--bg);padding:1px 6px;border-radius:4px;border:1px solid var(--border);">'+esc(r.keyword)+'</span>'
              +'<span style="font-size:10px;color:var(--text3);">→</span>'
              +'<span style="font-size:11px;font-weight:600;color:'+cc+';background:'+cc+'12;padding:1px 6px;border-radius:4px;">'+esc(r.category)+'</span>'
            +'</div>'
            +'<div style="font-size:10px;color:var(--text3);margin-top:2px;">'+matchCount+' coincidencia'+(matchCount!==1?'s':'')+'</div>'
          +'</div>'
          +'<button style="background:none;border:none;cursor:pointer;font-size:14px;color:'+(r.active!==false?'var(--accent)':'var(--text3)')+';padding:2px 4px;" onclick="toggleRule('+i+')" title="'+(r.active!==false?'Desactivar':'Activar')+'">'+(r.active!==false?'●':'○')+'</button>'
          +'<button style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:2px 4px;opacity:.5;" onclick="deleteRule('+i+')" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'">✕</button>'
        +'</div>';
      }).join('')}
      <!-- Add new rule form -->
      <div style="margin-top:12px;padding:14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:10px;">+ Nueva regla</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
          <div style="flex:1;min-width:120px;">
            <div style="font-size:9px;color:var(--text3);margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">Keyword</div>
            <input id="rule-new-keyword" type="text" placeholder="ej: PEDIDOSYA" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:12px;font-family:var(--font);">
          </div>
          <div style="flex:1;min-width:120px;">
            <div style="font-size:9px;color:var(--text3);margin-bottom:3px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">Categoría</div>
            <select id="rule-new-cat" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:12px;font-family:var(--font);">${catOptsHtml}</select>
          </div>
          <button style="padding:8px 16px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="addUserRule()">Agregar</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;" onclick="reApplySuggestionsAll()">↺ Re-aplicar reglas a movimientos sin categoría</button>
      `:''}

      ${tab==='learned'?`
      <!-- ═══ TAB: APRENDIDAS ═══ -->
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Comercios que el sistema aprendió por tus asignaciones. Podés borrar los incorrectos.</div>
      ${histEntries.length===0?'<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px;background:var(--surface2);border-radius:8px;">Sin historial todavía. Se genera al asignar categorías manualmente.</div>':''}
      ${histEntries.map(([comercio,catCounts])=>{
        const best=Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
        const cc=catColor(best[0]);
        const total=Object.values(catCounts).reduce((s,v)=>s+v,0);
        const allCats=Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+' ('+n+'x)').join(', ');
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:4px;border:1px solid var(--border);">'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="display:flex;align-items:center;gap:6px;">'
              +'<span style="font-size:12px;font-weight:700;color:var(--text);">'+esc(comercio)+'</span>'
              +'<span style="font-size:10px;color:var(--text3);">→</span>'
              +'<span style="font-size:11px;font-weight:600;color:'+cc+';">'+esc(best[0])+'</span>'
              +'<span style="font-size:10px;color:var(--text3);font-family:var(--font);">('+total+'x)</span>'
            +'</div>'
            +(Object.keys(catCounts).length>1?'<div style="font-size:9px;color:var(--text3);margin-top:2px;">También: '+esc(allCats)+'</div>':'')
          +'</div>'
          +'<button style="padding:4px 8px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap;" data-com="'+esc(comercio)+'" data-cat="'+esc(best[0])+'" onclick="convertLearnedToRule(this.dataset.com,this.dataset.cat)" title="Convertir en regla fija">→ Regla</button>'
          +'<button style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:2px 4px;opacity:.5;" data-com="'+esc(comercio)+'" onclick="deleteLearned(this.dataset.com)" onmouseover="this.style.opacity=1;this.style.color=\'var(--danger)\'" onmouseout="this.style.opacity=.5;this.style.color=\'var(--text3)\'" title="Eliminar aprendizaje">✕</button>'
        +'</div>';
      }).join('')}
      ${histEntries.length>0?'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;color:var(--danger);" onclick="clearAllLearned()">🗑 Borrar todo el historial de aprendizaje</button>':''}
      `:''}

      ${tab==='suggest'?`
      <!-- ═══ TAB: SUGERIDAS ═══ -->
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Reglas sugeridas basadas en patrones detectados en tus movimientos.</div>
      ${suggestions.length===0?'<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px;background:var(--surface2);border-radius:8px;">No hay sugerencias nuevas. Importá más movimientos o asigná categorías para generar patrones.</div>':''}
      ${suggestions.slice(0,15).map(s=>{
        const cc=catColor(s.category);
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:4px;border:1px solid var(--border);">'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="display:flex;align-items:center;gap:6px;">'
              +'<span style="font-size:12px;font-weight:700;color:var(--text);">'+esc(s.displayName)+'</span>'
              +'<span style="font-size:10px;color:var(--text3);">→</span>'
              +'<span style="font-size:11px;font-weight:600;color:'+cc+';">'+esc(s.category)+'</span>'
            +'</div>'
            +'<div style="font-size:10px;color:var(--text3);margin-top:2px;">'+s.count+' movimientos · '+s.confidence+'% confianza</div>'
          +'</div>'
          +'<button style="padding:5px 10px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:var(--font);white-space:nowrap;" data-kw="'+esc(s.keyword)+'" data-cat="'+esc(s.category)+'" onclick="acceptRuleSuggestion(this.dataset.kw,this.dataset.cat)">+ Crear</button>'
        +'</div>';
      }).join('')}
      `:''}
    </div>
  `;
}

function deleteLearned(comercio){
  if(!state.catHistory)return;
  delete state.catHistory[comercio];
  saveState();renderRulesPanel();
  showToast('✓ Aprendizaje de "'+comercio+'" eliminado','info');
}

function convertLearnedToRule(comercio,category){
  if(!state.catRules)state.catRules=[];
  state.catRules.unshift({id:Date.now().toString(36),keyword:comercio,category,active:true,priority:state.catRules.length+1});
  delete state.catHistory[comercio];
  saveState();renderRulesPanel();
  showToast('✓ "'+comercio+'" → regla fija','success');
}

function clearAllLearned(){
  if(!confirm('¿Borrar todo el historial de aprendizaje? Las reglas creadas por vos no se tocan.'))return;
  state.catHistory={};
  saveState();renderRulesPanel();
  showToast('🗑 Historial de aprendizaje borrado','info');
}


function acceptRuleSuggestion(keyword,category){
  window._rulesJustRendered=true;
  if(!state.catRules)state.catRules=[];
  const id=Date.now().toString(36);
  state.catRules.unshift({id,keyword,category,active:true,priority:state.catRules.length+1});
  // Also apply immediately to matching transactions
  let applied=0;
  state.transactions.forEach(t=>{
    if(t.estado_revision==='confirmado_por_usuario')return;
    if((t.description||'').toLowerCase().includes(keyword)){
      t.category=category;applied++;
    }
  });
  saveState();renderRulesPanel();renderTransactions();
  showToast('✓ Regla creada y aplicada a '+applied+' movimientos','success');
}

function addUserRule(){
  const kw=(document.getElementById('rule-new-keyword')?.value||'').trim();
  const cat=document.getElementById('rule-new-cat')?.value||'';
  if(!kw||!cat){showToast('Completá keyword y categoría','error');return;}
  if(!state.catRules)state.catRules=[];
  const id=Date.now().toString(36);
  state.catRules.unshift({id,keyword:kw,category:cat,active:true,priority:state.catRules.length+1});
  window._rulesJustRendered=true;saveState();renderRulesPanel();showToast('✓ Regla agregada: "'+kw+'" → '+cat,'success');
}
function toggleRule(idx){
  if(!state.catRules[idx])return;
  state.catRules[idx].active=state.catRules[idx].active===false?true:false;
  window._rulesJustRendered=true;saveState();renderRulesPanel();
}
function deleteRule(idx){
  if(!confirm('¿Eliminar regla?'))return;
  state.catRules.splice(idx,1);
  saveState();renderRulesPanel();
}
function reApplySuggestionsAll(){
  let count=0;
  state.transactions.forEach(t=>{
    if(t.estado_revision==='confirmado_por_usuario')return;
    t.comercio_detectado=detectComercio(t.description)||t.comercio_detectado;
    const sug=suggestCategory(t.description);
    t.cat_sugerida=sug.category;t.cat_motivo=sug.reason;t.cat_source=sug.source;
    if(t.category==='Otros'||t.category==='Procesando...'||t.category==='Uncategorized'||!t.category){
      t.category=sug.category;count++;
    }
  });
  saveState();renderTransactions();
  showToast('↺ '+count+' categorías actualizadas','success');
}

// ══ CATEGORIES ══
function renderCategoryManage(){
  const counts={};state.transactions.forEach(t=>{counts[t.category]=(counts[t.category]||0)+1;});
  const el=document.getElementById('cat-list-manage');
  const sub=document.getElementById('cat-count-sub');
  const totalSubs=state.categories.length;
  const totalGroups=[...new Set(state.categories.map(c=>c.group))].length;
  if(sub)sub.textContent=totalGroups+' grupos \u00B7 '+totalSubs+' subcategor\u00EDa'+(totalSubs!==1?'s':'');
  if(el){
    let html='';
    const groups=[...new Set(state.categories.map(c=>c.group||'Sin clasificar'))];
    groups.forEach(g=>{
      const grp=CATEGORY_GROUPS.find(x=>x.group===g);
      const emoji=grp?grp.emoji:'\u{1F5D1}\u{FE0F}';
      const gColor=grp?grp.color:'#888888';
      const subs=state.categories.filter(c=>(c.group||'Sin clasificar')===g);
      const gCount=subs.reduce((s,c)=>s+(counts[c.name]||0),0);
      html+='<div class="cat-group-header" style="display:flex;align-items:center;gap:8px;padding:10px 10px 4px;margin-top:6px;">'+
        '<span style="font-size:15px;">'+emoji+'</span>'+
        '<span style="font-size:12px;font-weight:700;color:var(--text);letter-spacing:-.01em;flex:1;">'+esc(g)+'</span>'+
        '<span style="font-size:10px;color:var(--text3);font-family:var(--font);">'+gCount+' mov.</span>'+
      '</div>';
      subs.forEach(c=>{
        const n=counts[c.name]||0;
        html+='<div class="cat-item-row" data-cat="'+esc(c.name)+'" onclick="selectInlineCat(\x27'+esc(c.name)+'\x27)" style="padding-left:34px;">'+
          '<div class="cat-item-color" style="background:'+c.color+';width:10px;height:10px;border-radius:50%;flex-shrink:0;"></div>'+
          '<div class="cat-item-name" style="flex:1;font-size:12px;font-weight:500;">'+esc(c.name)+'</div>'+
          '<div class="cat-item-count" style="font-size:10px;color:var(--text3);font-family:var(--font);">'+n+'</div>'+
        '</div>';
      });
    });
    el.innerHTML=html;
  }
}
function selectInlineCat(name){
  const cat=state.categories.find(c=>c.name===name);if(!cat)return;
  document.getElementById('cat-form-title').textContent='Editar subcategoría';
  document.getElementById('cat-inline-name').value=cat.name;
  document.getElementById('cat-inline-editing').value=cat.name;
  document.getElementById('cat-inline-delete-btn').style.display='inline-flex';
  document.getElementById('cat-inline-empty-hint').style.display='none';
  renderInlineGroupSelector(cat.group||'Sin clasificar');
  renderInlineColorPicker(cat.color);
  // Highlight selected row
  document.querySelectorAll('.cat-item-row').forEach(r=>r.classList.remove('active'));
  const row=document.querySelector('.cat-item-row[data-cat="'+esc(name)+'"]');
  if(row)row.classList.add('active');
  document.getElementById('cat-inline-name').focus();
}
function renderInlineGroupSelector(selGroup){
  const el=document.getElementById('cat-inline-group');
  if(!el)return;
  el.innerHTML=CATEGORY_GROUPS.map(g=>'<option value="'+g.group+'" '+(g.group===selGroup?'selected':'')+'>'+g.emoji+' '+g.group+'</option>').join('');
}
function openInlineCatForm(){
  clearInlineCatForm();
  document.getElementById('cat-inline-name').focus();
}
function clearInlineCatForm(){
  document.getElementById('cat-form-title').textContent='Nueva subcategoría';
  renderInlineGroupSelector('Sin clasificar');
  document.getElementById('cat-inline-name').value='';
  document.getElementById('cat-inline-editing').value='';
  document.getElementById('cat-inline-delete-btn').style.display='none';
  document.getElementById('cat-inline-empty-hint').style.display='none';
  renderInlineColorPicker('');
  document.querySelectorAll('.cat-item-row').forEach(r=>r.classList.remove('active'));
}
function renderInlineColorPicker(sel){
  const el=document.getElementById('cat-inline-color-picker');
  if(!el)return;
  el.innerHTML=PALETTE.map(c=>'<div class="color-swatch '+(c===sel?'selected':'')+'" style="background:'+c+'" onclick="selectSwatch(\''+c+'\',this,\'cat-inline-color-picker\')"></div>').join('');
}
function saveInlineCat(){
  const name=document.getElementById('cat-inline-name').value.trim();
  if(!name){showToast('⚠️ Ingresá un nombre','error');return;}
  const sw=document.querySelector('#cat-inline-color-picker .color-swatch.selected');
  const rawColor=sw?sw.style.backgroundColor:'#888888';
  const hexColor=rawColor.startsWith('#')?rawColor:rgbToHex(rawColor);
  const editing=document.getElementById('cat-inline-editing').value;
  if(editing){
    const cat=state.categories.find(c=>c.name===editing);
    if(cat){if(name!==editing)state.transactions.forEach(t=>{if(t.category===editing)t.category=name;});cat.name=name;cat.color=hexColor;}
    showToast('✓ Categoría actualizada','success');
  } else {
    if(state.categories.find(c=>c.name===name)){showToast('⚠️ Ya existe esa categoría','error');return;}
    // Find which group this is being added to (default Sin clasificar)
    const selGroup=document.getElementById('cat-inline-group')?.value||'Sin clasificar';
    const grpInfo=CATEGORY_GROUPS.find(g=>g.group===selGroup);
    state.categories.push({name,color:hexColor,group:selGroup,emoji:grpInfo?grpInfo.emoji:'🗑️'});
    showToast('✓ Subcategoría creada','success');
  }
  saveState();refreshAll();
  clearInlineCatForm();
}
function deleteInlineCat(){
  const name=document.getElementById('cat-inline-editing').value;if(!name)return;
  if(!confirm('¿Eliminar la categoría "'+name+'"? Los movimientos pasarán a "Otros".'))return;
  state.categories=state.categories.filter(c=>c.name!==name);
  state.transactions.forEach(t=>{if(t.category===name)t.category='Uncategorized';});
  saveState();refreshAll();showToast('Categoría eliminada','info');
  clearInlineCatForm();
}
// renderReassignTable removed — legacy, reassign-filter/reassign-table elements no longer exist
function openNewCatModal(){document.getElementById('modal-cat-title').textContent='Nueva categoría';document.getElementById('modal-cat-name').value='';document.getElementById('modal-cat-editing').value='';document.getElementById('btn-delete-cat').style.display='none';renderColorPicker('');openModal('modal-cat');}
function openEditCatModal(name){const cat=state.categories.find(c=>c.name===name);if(!cat)return;document.getElementById('modal-cat-title').textContent='Editar categoría';document.getElementById('modal-cat-name').value=cat.name;document.getElementById('modal-cat-editing').value=cat.name;document.getElementById('btn-delete-cat').style.display='inline-flex';renderColorPicker(cat.color);openModal('modal-cat');}

// ══ EMOJI PICKER ══
const EMOJI_SETS = {
  general:  ['😀','😊','😎','🤩','🥳','😍','🤑','💪','🔥','⭐','💡','🎯','✅','❤️','💚','💙','🩵','💛','🧡','❤️‍🔥'],
  hogar:    ['🏠','🏡','🏢','🏗️','🛋','🛏','🚿','🧹','🔧','🔨','💡','🔌','💧','🌡️','🪟','🚪','🪑','🪴','🗑️','📦'],
  tech:     ['💻','🖥','📱','⌨️','🖱','📷','📸','🎮','🕹️','🎧','🖨','💾','📀','🔋','📡','🛰','⌚','📟','🔭','🔬'],
  comida:   ['🍕','🍔','🌮','🍣','🍜','🍰','🍦','☕','🧃','🥗','🥩','🍫','🧁','🍩','🍿','🥐','🥑','🍷','🍺','🥂'],
  transporte:['🚗','🚙','🏎','🚕','🏍','🚲','🛵','🚌','🚎','🚂','✈️','🚢','🚁','🛺','🚐','🚑','🚓','⛽','🅿️','🗺'],
  salud:    ['💊','🏥','🩺','🩹','🧬','🫀','🦷','👓','🩻','🏋','🧘','🏃','🚴','🤸','🥊','🏊','🛌','🌡','💉','🧪'],
  entretenimiento:['🎬','📺','🎵','🎸','🎹','🎮','🕹','🎲','🎯','🎭','🎨','📚','📖','🎤','🎙','🎧','🎳','🏆','🥇','🎗'],
  compras:  ['🛒','👜','👗','👠','👟','💍','🕶','🧴','🧸','🎁','🛍','💄','🪞','🧢','👒','⌚','💼','🧳','🪙','💳'],
  finanzas: ['💰','💵','💴','💶','💷','💸','🏦','📈','📉','🧾','💹','🪙','💳','🤑','💎','🏧','🔐','📊','🧮','💱'],
  educacion:['📚','📖','✏️','📝','🖊','📐','📏','🎓','🏫','🔬','🔭','🧪','💻','📓','📒','📔','📕','📗','📘','📙'],
};
const EMOJI_LABELS = {general:'General',hogar:'Hogar',tech:'Tecnología',comida:'Comida',transporte:'Transporte',salud:'Salud',entretenimiento:'Entretenimiento',compras:'Compras',finanzas:'Finanzas',educacion:'Educación'};

function buildEmojiPickerHTML(pickerId){
  let html = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">';
  Object.keys(EMOJI_SETS).forEach(cat=>{
    html+=`<button onclick="showEmojiCategory('${pickerId}','${cat}')" id="emcat-${pickerId}-${cat}" style="font-size:10px;padding:2px 7px;border-radius:18px;border:1px solid var(--border);background:var(--surface);color:var(--text3);cursor:pointer;white-space:nowrap;transition:all .15s;">${EMOJI_LABELS[cat]}</button>`;
  });
  html += '</div><div id="emoji-grid-'+pickerId+'" style="display:flex;flex-wrap:wrap;gap:3px;"></div>';
  return html;
}

function showEmojiCategory(pickerId, cat){
  // Highlight active tab
  Object.keys(EMOJI_SETS).forEach(c=>{
    const btn=document.getElementById('emcat-'+pickerId+'-'+c);
    if(btn){btn.style.background=c===cat?'var(--accent)':'var(--surface)';btn.style.color=c===cat?'#000':'var(--text3)';btn.style.borderColor=c===cat?'var(--accent)':'var(--border)';}
  });
  const grid=document.getElementById('emoji-grid-'+pickerId);
  if(!grid)return;
  grid.innerHTML=EMOJI_SETS[cat].map(e=>
    `<div onclick="selectEmoji('${pickerId}','${e}')" style="font-size:22px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;transition:background .1s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">${e}</div>`
  ).join('');
}

function selectEmoji(pickerId, emoji){
  document.getElementById(pickerId+'-emoji').value=emoji;
  const prev=document.getElementById(pickerId+'-emoji-preview');
  if(prev)prev.textContent=emoji;
  // Close picker
  const picker=document.getElementById(pickerId+'-emoji-picker');
  if(picker)picker.style.display='none';
}

function toggleEmojiPicker(pickerId){
  const picker=document.getElementById(pickerId+'-emoji-picker');
  if(!picker)return;
  if(picker.style.display==='none'||!picker.style.display){
    picker.style.display='flex';
    picker.style.flexDirection='column';
    // Build if empty
    if(!picker.innerHTML.trim()) picker.innerHTML=buildEmojiPickerHTML(pickerId);
    // Show first category by default
    showEmojiCategory(pickerId, 'general');
  } else {
    picker.style.display='none';
  }
}

function initEmojiPicker(pickerId, currentEmoji){
  const hidden=document.getElementById(pickerId+'-emoji');
  const prev=document.getElementById(pickerId+'-emoji-preview');
  const picker=document.getElementById(pickerId+'-emoji-picker');
  if(hidden)hidden.value=currentEmoji||'';
  if(prev)prev.textContent=currentEmoji||'●';
  if(picker){picker.style.display='none';picker.innerHTML='';}
}

function renderColorPicker(sel){document.getElementById('color-picker').innerHTML=PALETTE.map(c=>'<div class="color-swatch '+(c===sel?'selected':'')+'" style="background:'+c+'" onclick="selectSwatch(\''+c+'\',this,\'color-picker\')"></div>').join('');}
function selectSwatch(c,el,containerId){
  const container=containerId?document.getElementById(containerId):el.closest('.color-picker-row,.color-swatch-group');
  (container||document).querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
  el.classList.add('selected');
}
function saveCat(){
  const name=document.getElementById('modal-cat-name').value.trim();if(!name){showToast('⚠️ Ingresá un nombre','error');return;}
  const sw=document.querySelector('#color-picker .color-swatch.selected');const rawColor=sw?sw.style.backgroundColor:'#888888';const hexColor=rawColor.startsWith('#')?rawColor:rgbToHex(rawColor);
  const editing=document.getElementById('modal-cat-editing').value;
  if(editing){const cat=state.categories.find(c=>c.name===editing);if(cat){if(name!==editing)state.transactions.forEach(t=>{if(t.category===editing)t.category=name;});cat.name=name;cat.color=hexColor;}showToast('✓ Actualizada','success');}
  else{if(state.categories.find(c=>c.name===name)){showToast('⚠️ Ya existe','error');return;}state.categories.push({name,color:hexColor,group:'Sin clasificar',emoji:'🗑️'});showToast('✓ Creada','success');}
  saveState();closeModal('modal-cat');refreshAll();
}
function deleteCat(){const name=document.getElementById('modal-cat-editing').value;if(!name)return;state.categories=state.categories.filter(c=>c.name!==name);state.transactions.forEach(t=>{if(t.category===name)t.category='Uncategorized';});saveState();closeModal('modal-cat');refreshAll();showToast('Eliminada','info');}
function rgbToHex(rgb){const m=rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);if(!m)return'#888888';return'#'+[m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');}

