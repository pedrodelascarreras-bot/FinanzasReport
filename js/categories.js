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

function rulesCategoryOptionsHTML(){
  let html='';
  CATEGORY_GROUPS.forEach(g=>{
    html+='<optgroup label="'+g.emoji+' '+g.group+'">';
    g.subs.forEach(s=>{ html+='<option value="'+esc(s)+'">'+esc(s)+'</option>'; });
    html+='</optgroup>';
  });
  return html;
}

function rulesLogoOptionsHTML(selected){
  const presets = (typeof getBrandLogoPresets==='function' ? getBrandLogoPresets() : {}) || {};
  const keys = Object.keys(presets);
  if(!keys.length) return '<option value="">Sin presets</option>';
  return keys.map(k=>{
    const p = presets[k] || {};
    return '<option value="'+esc(k)+'" '+(selected===k?'selected':'')+'>'+esc((p.label||k)+' · '+k)+'</option>';
  }).join('');
}

function rulesCountMatches(keyword){
  const kw = normalizeRuleKeyword(keyword);
  if(!kw) return 0;
  return (state.transactions||[]).filter(t=>txnRuleHaystack(t).includes(kw)).length;
}

function rulesBuildCategorySuggestions(){
  const suggestions=[];
  const counts={};
  (state.transactions||[]).forEach(t=>{
    const com=t.comercio_detectado||detectComercio(t.description);
    if(!com) return;
    const key=normalizeRuleKeyword(com);
    if(!counts[key]) counts[key]={displayName:com,total:0,cats:{}};
    counts[key].total++;
    const cat=t.category;
    if(cat&&cat!=='Procesando...'&&cat!=='Uncategorized') counts[key].cats[cat]=(counts[key].cats[cat]||0)+1;
  });
  const existing=new Set((state.catRules||[]).map(r=>normalizeRuleKeyword(r.keyword)));
  Object.entries(counts).forEach(([key,data])=>{
    if(data.total<2 || existing.has(key)) return;
    const top=Object.entries(data.cats).sort((a,b)=>b[1]-a[1])[0];
    if(!top) return;
    const confidence=Math.round((top[1]/data.total)*100);
    if(confidence>=60) suggestions.push({keyword:key,displayName:data.displayName,category:top[0],count:data.total,confidence});
  });
  return suggestions.sort((a,b)=>b.count-a.count).slice(0,18);
}

function rulesBuildNameSuggestions(){
  const suggestions=[];
  const existing=new Set((state.nameRules||[]).map(r=>normalizeRuleKeyword(r.keyword)));
  const seen=new Set();
  (state.transactions||[]).forEach(t=>{
    const base=String(t.gmailMerchantRaw||t._baseDesc||t.description||'').trim();
    const detected=detectComercio(base);
    if(!base||!detected) return;
    const kw=normalizeRuleKeyword(base);
    if(!kw || existing.has(kw) || seen.has(kw)) return;
    if(normalizeRuleKeyword(base)===normalizeRuleKeyword(detected)) return;
    seen.add(kw);
    suggestions.push({keyword:base,renameTo:detected,count:rulesCountMatches(base)});
  });
  return suggestions.sort((a,b)=>b.count-a.count).slice(0,18);
}

function rulesBuildLogoSuggestions(){
  const suggestions=[];
  const existing=new Set((state.logoRules||[]).map(r=>normalizeRuleKeyword(r.keyword)));
  const presets=(typeof getBrandLogoPresets==='function' ? getBrandLogoPresets() : {}) || {};
  const seen=new Set();
  (state.transactions||[]).forEach(t=>{
    const logoKey=detectBuiltinLogoKey(t);
    if(!logoKey||!presets[logoKey]) return;
    const keyword=String(t.gmailMerchantRaw||t._baseDesc||t.comercio_detectado||t.description||'').trim();
    const kwNorm=normalizeRuleKeyword(keyword);
    if(!kwNorm||existing.has(kwNorm)||seen.has(kwNorm)) return;
    seen.add(kwNorm);
    suggestions.push({keyword,logoKey,count:rulesCountMatches(keyword)});
  });
  return suggestions.sort((a,b)=>b.count-a.count).slice(0,18);
}

function renderRulesPanel(){
  window._rulesJustRendered=true;
  const panel=document.getElementById('rules-panel');
  if(!panel) return;

  if(!Array.isArray(state.catRules)) state.catRules=[];
  if(!Array.isArray(state.nameRules)) state.nameRules=[];
  if(!Array.isArray(state.logoRules)) state.logoRules=[];

  const catRules=state.catRules;
  const nameRules=state.nameRules;
  const logoRules=state.logoRules;
  const tab = ['category','name','logo','suggest'].includes(state._rulesTab) ? state._rulesTab : 'category';
  state._rulesTab = tab;

  const catSuggestions = rulesBuildCategorySuggestions();
  const nameSuggestions = rulesBuildNameSuggestions();
  const logoSuggestions = rulesBuildLogoSuggestions();

  const totalRules = catRules.length + nameRules.length + logoRules.length;
  const uncategorized=(state.transactions||[]).filter(t=>!t.category||t.category==='Procesando...'||t.category==='Uncategorized').length;
  const catOptsHtml=rulesCategoryOptionsHTML();

  panel.innerHTML=''
    +'<div class="rp-header">'
      +'<div>'
        +'<div class="rp-title">🧠 Reglas inteligentes</div>'
        +'<div style="font-size:12px;color:var(--text3);margin-top:4px;font-family:var(--font);">'+totalRules+' reglas totales'+(uncategorized>0?' · <span style="color:var(--danger);font-weight:700;">'+uncategorized+' sin categoría</span>':'')+'</div>'
      +'</div>'
      +'<button class="tdp-close" onclick="closeRulesPanel()">✕</button>'
    +'</div>'
    +'<div class="rp-body">'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">'
        +'<button onclick="state._rulesTab=\'category\';renderRulesPanel();" style="padding:8px 13px;border-radius:999px;border:none;cursor:pointer;font-size:11.4px;font-weight:700;font-family:var(--font);'+(tab==='category'?'background:var(--accent);color:#fff;':'background:#f5f5fb;color:var(--text3);')+'">🏷 Categorías ('+catRules.length+')</button>'
        +'<button onclick="state._rulesTab=\'name\';renderRulesPanel();" style="padding:8px 13px;border-radius:999px;border:none;cursor:pointer;font-size:11.4px;font-weight:700;font-family:var(--font);'+(tab==='name'?'background:var(--accent);color:#fff;':'background:#f5f5fb;color:var(--text3);')+'">✍ Nombres ('+nameRules.length+')</button>'
        +'<button onclick="state._rulesTab=\'logo\';renderRulesPanel();" style="padding:8px 13px;border-radius:999px;border:none;cursor:pointer;font-size:11.4px;font-weight:700;font-family:var(--font);'+(tab==='logo'?'background:var(--accent);color:#fff;':'background:#f5f5fb;color:var(--text3);')+'">🖼 Logos ('+logoRules.length+')</button>'
        +'<button onclick="state._rulesTab=\'suggest\';renderRulesPanel();" style="padding:8px 13px;border-radius:999px;border:none;cursor:pointer;font-size:11.4px;font-weight:700;font-family:var(--font);'+(tab==='suggest'?'background:var(--accent);color:#fff;':'background:#f5f5fb;color:var(--text3);')+'">💡 Sugeridas</button>'
      +'</div>'
      +(tab==='category' ? renderCategoryRulesTab(catRules, catOptsHtml) : '')
      +(tab==='name' ? renderNameRulesTab(nameRules) : '')
      +(tab==='logo' ? renderLogoRulesTab(logoRules) : '')
      +(tab==='suggest' ? renderSuggestedRulesTab(catSuggestions, nameSuggestions, logoSuggestions) : '')
      +'<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px;" onclick="reApplySuggestionsAll()">↺ Re-aplicar reglas a todos los movimientos</button>'
    +'</div>';
}

// ── Helpers para colapso + edición ─────────────────────────
function _isRulesCollapsed(section){
  if(!state._rulesCollapsed) state._rulesCollapsed = { category:true, name:true, logo:true };
  return state._rulesCollapsed[section] !== false;
}

function toggleRulesCollapse(section){
  if(!state._rulesCollapsed) state._rulesCollapsed = { category:true, name:true, logo:true };
  state._rulesCollapsed[section] = !state._rulesCollapsed[section];
  renderRulesPanel();
}

function startEditRule(type, idx){
  state._editingRule = { type, idx };
  // Auto-expand the section if collapsed
  if(state._rulesCollapsed) state._rulesCollapsed[type] = false;
  renderRulesPanel();
}

function cancelEditRule(){
  state._editingRule = null;
  renderRulesPanel();
}

function _renderCollapseHeader(section, count){
  const collapsed = _isRulesCollapsed(section);
  if(!count) return '';
  return '<button class="rules-collapse-hd" onclick="toggleRulesCollapse(\''+section+'\')" '
    +'style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:#fafafd;font-size:11.5px;font-weight:700;color:var(--text2);cursor:pointer;font-family:var(--font);margin-bottom:'+(collapsed?'0':'10px')+';">'
    +'<span>'+(collapsed?'▸':'▾')+'  '+count+' regla'+(count!==1?'s':'')+' creada'+(count!==1?'s':'')+'</span>'
    +'<span style="font-size:10.5px;color:var(--text3);">'+(collapsed?'mostrar':'ocultar')+'</span>'
  +'</button>';
}

// ── CATEGORY RULES TAB ─────────────────────────────────────
function renderCategoryRulesTab(rules, catOptsHtml){
  const editing = state._editingRule && state._editingRule.type==='category' ? state._editingRule.idx : -1;
  const collapsed = _isRulesCollapsed('category');
  let html = '';

  // Form para agregar (siempre visible arriba)
  html += '<div style="padding:14px;background:#f8f8fc;border-radius:16px;border:1px solid var(--border);margin-bottom:12px;">'
    +'<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;font-family:var(--font);">+ Nueva regla de categoría</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">'
      +'<div style="flex:1;min-width:120px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Keyword</div><input id="rule-new-keyword" type="text" placeholder="ej: PEDIDOSYA" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text);font-size:12.6px;font-family:var(--font);"></div>'
      +'<div style="flex:1;min-width:120px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Categoría</div><select id="rule-new-cat" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text);font-size:12.6px;font-family:var(--font);">'+catOptsHtml+'</select></div>'
      +'<button style="padding:10px 14px;border-radius:999px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="addUserRule()">Agregar</button>'
    +'</div>'
  +'</div>';

  // Header colapsable
  if(!rules.length){
    html += '<div style="color:var(--text3);font-size:12.4px;padding:18px 14px;text-align:center;background:#f8f8fc;border-radius:14px;border:1px solid var(--border);font-family:var(--font);">Sin reglas de categoría todavía.</div>';
    return html;
  }
  html += _renderCollapseHeader('category', rules.length);

  // Lista de reglas (oculta por default)
  if(!collapsed){
    html += rules.map((r,i)=>{
      if(i===editing){
        // Edit mode
        return '<div style="padding:10px 12px;background:#fff8e1;border-radius:14px;margin-bottom:6px;border:1.5px solid var(--accent);">'
          +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px;">'
            +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Keyword</div><input id="cat-edit-keyword" type="text" value="'+esc(r.keyword)+'" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font-size:12.4px;font-family:var(--font);"></div>'
            +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Categoría</div><select id="cat-edit-cat" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font-size:12.4px;font-family:var(--font);">'+rulesCategoryOptionsHTML(r.category)+'</select></div>'
          +'</div>'
          +'<div style="display:flex;gap:6px;justify-content:flex-end;">'
            +'<button style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="cancelEditRule()">Cancelar</button>'
            +'<button style="padding:6px 12px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="saveEditCatRule('+i+')">Guardar</button>'
          +'</div>'
        +'</div>';
      }
      const cc=catColor(r.category);
      const count=rulesCountMatches(r.keyword);
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fcfcfe;border-radius:14px;margin-bottom:6px;border:1px solid var(--border);'+(r.active===false?'opacity:.45;':'')+'">'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
            +'<span style="font-size:12.2px;font-weight:700;color:var(--text);background:#fff;padding:3px 8px;border-radius:999px;border:1px solid var(--border);font-family:var(--font);">'+esc(r.keyword)+'</span>'
            +'<span style="font-size:10px;color:var(--text3);">→</span>'
            +'<span style="font-size:11px;font-weight:700;color:'+cc+';background:'+cc+'12;padding:3px 8px;border-radius:999px;font-family:var(--font);">'+esc(r.category)+'</span>'
          +'</div>'
          +'<div style="font-size:10.5px;color:var(--text3);margin-top:4px;font-family:var(--font);">'+count+' coincidencias</div>'
        +'</div>'
        +'<button title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:3px 5px;opacity:.7;" onclick="startEditRule(\'category\','+i+')">✎</button>'
        +'<button title="Activar/desactivar" style="background:none;border:none;cursor:pointer;font-size:14px;color:'+(r.active!==false?'var(--accent)':'var(--text3)')+';padding:2px 4px;" onclick="toggleRule('+i+')">'+(r.active!==false?'●':'○')+'</button>'
        +'<button title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:2px 4px;opacity:.6;" onclick="deleteRule('+i+')">✕</button>'
      +'</div>';
    }).join('');
  }
  return html;
}

// ── NAME RULES TAB ─────────────────────────────────────────
function renderNameRulesTab(rules){
  const editing = state._editingRule && state._editingRule.type==='name' ? state._editingRule.idx : -1;
  const collapsed = _isRulesCollapsed('name');
  let html = '';

  // Form siempre visible arriba
  html += '<div style="padding:14px;background:#f8f8fc;border-radius:16px;border:1px solid var(--border);margin-bottom:12px;">'
    +'<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;font-family:var(--font);">+ Nueva regla de nombre</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">'
      +'<div style="flex:1;min-width:120px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Detectar</div><input id="name-rule-keyword" type="text" placeholder="ej: MC DONALDS" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text);font-size:12.6px;font-family:var(--font);"></div>'
      +'<div style="flex:1;min-width:120px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Renombrar a</div><input id="name-rule-target" type="text" placeholder="ej: McDonald\'s" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text);font-size:12.6px;font-family:var(--font);"></div>'
      +'<button style="padding:10px 14px;border-radius:999px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="addNameRule()">Agregar</button>'
    +'</div>'
  +'</div>';

  if(!rules.length){
    html += '<div style="color:var(--text3);font-size:12.4px;padding:18px 14px;text-align:center;background:#f8f8fc;border-radius:14px;border:1px solid var(--border);font-family:var(--font);">Sin reglas de nombre todavía.</div>';
    return html;
  }
  html += _renderCollapseHeader('name', rules.length);

  if(!collapsed){
    html += rules.map((r,i)=>{
      if(i===editing){
        return '<div style="padding:10px 12px;background:#fff8e1;border-radius:14px;margin-bottom:6px;border:1.5px solid var(--accent);">'
          +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px;">'
            +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Detectar</div><input id="name-edit-keyword" type="text" value="'+esc(r.keyword)+'" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font-size:12.4px;font-family:var(--font);"></div>'
            +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Renombrar a</div><input id="name-edit-target" type="text" value="'+esc(r.renameTo)+'" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font-size:12.4px;font-family:var(--font);"></div>'
          +'</div>'
          +'<div style="display:flex;gap:6px;justify-content:flex-end;">'
            +'<button style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="cancelEditRule()">Cancelar</button>'
            +'<button style="padding:6px 12px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="saveEditNameRule('+i+')">Guardar</button>'
          +'</div>'
        +'</div>';
      }
      const count=rulesCountMatches(r.keyword);
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fcfcfe;border-radius:14px;margin-bottom:6px;border:1px solid var(--border);'+(r.active===false?'opacity:.45;':'')+'">'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
            +'<span style="font-size:12.2px;font-weight:700;color:var(--text);background:#fff;padding:3px 8px;border-radius:999px;border:1px solid var(--border);font-family:var(--font);">'+esc(r.keyword)+'</span>'
            +'<span style="font-size:10px;color:var(--text3);">→</span>'
            +'<span style="font-size:11px;font-weight:700;color:var(--accent);background:rgba(87,50,243,0.12);padding:3px 8px;border-radius:999px;font-family:var(--font);">'+esc(r.renameTo)+'</span>'
          +'</div>'
          +'<div style="font-size:10.5px;color:var(--text3);margin-top:4px;font-family:var(--font);">'+count+' coincidencias</div>'
        +'</div>'
        +'<button title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:3px 5px;opacity:.7;" onclick="startEditRule(\'name\','+i+')">✎</button>'
        +'<button title="Activar/desactivar" style="background:none;border:none;cursor:pointer;font-size:14px;color:'+(r.active!==false?'var(--accent)':'var(--text3)')+';padding:2px 4px;" onclick="toggleNameRule('+i+')">'+(r.active!==false?'●':'○')+'</button>'
        +'<button title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:2px 4px;opacity:.6;" onclick="deleteNameRule('+i+')">✕</button>'
      +'</div>';
    }).join('');
  }
  return html;
}

// ── LOGO PREVIEW (preset o custom) ─────────────────────────
function ruleLogoPreviewHtml(logoKey, customUrl){
  if(customUrl){
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:#f5f5fb;overflow:hidden;border:1px solid var(--border);"><img src="'+esc(customUrl)+'" style="width:100%;height:100%;object-fit:cover;" alt=""></span>';
  }
  const presets=(typeof getBrandLogoPresets==='function' ? getBrandLogoPresets() : {}) || {};
  const p=presets[logoKey];
  if(!p) return '<span style="font-size:10px;color:var(--text3);">Sin preset</span>';
  return '<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:8px;background:'+p.bg+';color:'+p.text+';font-size:10px;font-weight:800;">'+esc(p.label||logoKey.slice(0,2).toUpperCase())+'</span>';
}

// ── LOGO RULES TAB ─────────────────────────────────────────
function renderLogoRulesTab(rules){
  const editing = state._editingRule && state._editingRule.type==='logo' ? state._editingRule.idx : -1;
  const collapsed = _isRulesCollapsed('logo');
  let html = '';

  // Form siempre visible arriba (con upload custom)
  html += '<div style="padding:14px;background:#f8f8fc;border-radius:16px;border:1px solid var(--border);margin-bottom:12px;">'
    +'<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;font-family:var(--font);">+ Nueva regla de logo</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px;">'
      +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Detectar</div><input id="logo-rule-keyword" type="text" placeholder="ej: RAPPI" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text);font-size:12.6px;font-family:var(--font);"></div>'
      +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Logo preset</div><select id="logo-rule-key" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:#fff;color:var(--text);font-size:12.6px;font-family:var(--font);"><option value="">— ninguno —</option>'+rulesLogoOptionsHTML('')+'</select></div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px dashed var(--border);border-radius:12px;margin-bottom:10px;">'
      +'<div id="logo-rule-custom-preview" style="width:38px;height:38px;border-radius:10px;background:#f5f5fb;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--text3);flex-shrink:0;">📷</div>'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:11.5px;font-weight:700;color:var(--text);font-family:var(--font);">O subí una imagen propia</div>'
        +'<div style="font-size:10.5px;color:var(--text3);font-family:var(--font);margin-top:2px;">PNG, JPG o WebP · se redimensiona a 100×100 automáticamente</div>'
      +'</div>'
      +'<input type="file" accept="image/*" id="logo-rule-upload" style="display:none;" onchange="_handleLogoUpload(this,\'add\')">'
      +'<button style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text2);font-size:11.2px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="document.getElementById(\'logo-rule-upload\').click()">Elegir archivo</button>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end;">'
      +'<button style="padding:10px 16px;border-radius:999px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="addLogoRule()">Agregar</button>'
    +'</div>'
  +'</div>';

  if(!rules.length){
    html += '<div style="color:var(--text3);font-size:12.4px;padding:18px 14px;text-align:center;background:#f8f8fc;border-radius:14px;border:1px solid var(--border);font-family:var(--font);">Sin reglas de logo todavía.</div>';
    return html;
  }
  html += _renderCollapseHeader('logo', rules.length);

  if(!collapsed){
    html += rules.map((r,i)=>{
      if(i===editing){
        const presetSel = rulesLogoOptionsHTML(r.logoKey||'');
        return '<div style="padding:10px 12px;background:#fff8e1;border-radius:14px;margin-bottom:6px;border:1.5px solid var(--accent);">'
          +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px;">'
            +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Detectar</div><input id="logo-edit-keyword" type="text" value="'+esc(r.keyword)+'" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font-size:12.4px;font-family:var(--font);"></div>'
            +'<div style="flex:1;min-width:110px;"><div style="font-size:9.5px;color:var(--text3);margin-bottom:4px;font-weight:700;text-transform:uppercase;">Logo preset</div><select id="logo-edit-key" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font-size:12.4px;font-family:var(--font);"><option value="">— ninguno —</option>'+presetSel+'</select></div>'
          +'</div>'
          +'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#fff;border:1px dashed var(--border);border-radius:10px;margin-bottom:8px;">'
            +'<div id="logo-edit-custom-preview" style="width:34px;height:34px;border-radius:8px;background:#f5f5fb;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">'
              +(r.logoCustomUrl?'<img src="'+esc(r.logoCustomUrl)+'" style="width:100%;height:100%;object-fit:cover;" alt="">':'<span style="font-size:14px;color:var(--text3);">📷</span>')
            +'</div>'
            +'<div style="flex:1;font-size:10.5px;color:var(--text3);">'+(r.logoCustomUrl?'Imagen custom cargada':'Sin imagen custom')+'</div>'
            +'<input type="file" accept="image/*" id="logo-edit-upload" style="display:none;" onchange="_handleLogoUpload(this,\'edit\')">'
            +'<button style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="document.getElementById(\'logo-edit-upload\').click()">'+(r.logoCustomUrl?'Cambiar':'Subir')+'</button>'
            +(r.logoCustomUrl?'<button title="Quitar imagen" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;" onclick="_clearEditCustomLogo()">✕</button>':'')
          +'</div>'
          +'<div style="display:flex;gap:6px;justify-content:flex-end;">'
            +'<button style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="cancelEditRule()">Cancelar</button>'
            +'<button style="padding:6px 12px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);" onclick="saveEditLogoRule('+i+')">Guardar</button>'
          +'</div>'
        +'</div>';
      }
      const count=rulesCountMatches(r.keyword);
      const isCustom = !!r.logoCustomUrl;
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fcfcfe;border-radius:14px;margin-bottom:6px;border:1px solid var(--border);'+(r.active===false?'opacity:.45;':'')+'">'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">'
            +'<span style="font-size:12.2px;font-weight:700;color:var(--text);background:#fff;padding:3px 8px;border-radius:999px;border:1px solid var(--border);font-family:var(--font);">'+esc(r.keyword)+'</span>'
            +'<span style="font-size:10px;color:var(--text3);">→</span>'
            +ruleLogoPreviewHtml(r.logoKey, r.logoCustomUrl)
            +'<span style="font-size:11px;font-weight:700;color:var(--text);font-family:var(--font);">'+(isCustom?'Custom':esc(r.logoKey||'(sin preset)'))+'</span>'
          +'</div>'
          +'<div style="font-size:10.5px;color:var(--text3);margin-top:4px;font-family:var(--font);">'+count+' coincidencias</div>'
        +'</div>'
        +'<button title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:3px 5px;opacity:.7;" onclick="startEditRule(\'logo\','+i+')">✎</button>'
        +'<button title="Activar/desactivar" style="background:none;border:none;cursor:pointer;font-size:14px;color:'+(r.active!==false?'var(--accent)':'var(--text3)')+';padding:2px 4px;" onclick="toggleLogoRule('+i+')">'+(r.active!==false?'●':'○')+'</button>'
        +'<button title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:2px 4px;opacity:.6;" onclick="deleteLogoRule('+i+')">✕</button>'
      +'</div>';
    }).join('');
  }
  return html;
}

function renderSuggestedRulesTab(catSuggestions, nameSuggestions, logoSuggestions){
  let html='<div style="font-size:11.2px;color:var(--text3);margin-bottom:10px;font-family:var(--font);">Sugerencias basadas en patrones reales de tus movimientos.</div>';

  html+='<div style="font-size:11px;font-weight:800;color:var(--text2);margin:8px 0 6px;font-family:var(--font);">Categoría</div>';
  html += (catSuggestions.length?catSuggestions.map(s=>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fcfcfe;border-radius:14px;margin-bottom:6px;border:1px solid var(--border);">'
      +'<div style="flex:1;min-width:0;"><div style="font-size:12.1px;font-weight:700;color:var(--text);">'+esc(s.displayName)+'</div><div style="font-size:10.5px;color:var(--text3);">'+s.count+' mov · '+s.confidence+'% · '+esc(s.category)+'</div></div>'
      +'<button style="padding:6px 10px;border-radius:999px;border:none;background:var(--accent);color:#fff;font-size:10.8px;font-weight:700;cursor:pointer;" data-kw="'+esc(s.keyword)+'" data-cat="'+esc(s.category)+'" onclick="acceptRuleSuggestion(this.dataset.kw,this.dataset.cat)">+ Crear</button>'
    +'</div>'
  ).join(''):'<div style="font-size:11px;color:var(--text3);padding:8px 0;">Sin sugerencias.</div>');

  html+='<div style="font-size:11px;font-weight:800;color:var(--text2);margin:10px 0 6px;font-family:var(--font);">Nombre</div>';
  html += (nameSuggestions.length?nameSuggestions.map(s=>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fcfcfe;border-radius:14px;margin-bottom:6px;border:1px solid var(--border);">'
      +'<div style="flex:1;min-width:0;"><div style="font-size:12.1px;font-weight:700;color:var(--text);">'+esc(s.keyword)+'</div><div style="font-size:10.5px;color:var(--text3);">→ '+esc(s.renameTo)+' · '+s.count+' mov</div></div>'
      +'<button style="padding:6px 10px;border-radius:999px;border:none;background:var(--accent);color:#fff;font-size:10.8px;font-weight:700;cursor:pointer;" data-kw="'+esc(s.keyword)+'" data-rename="'+esc(s.renameTo)+'" onclick="acceptNameSuggestion(this.dataset.kw,this.dataset.rename)">+ Crear</button>'
    +'</div>'
  ).join(''):'<div style="font-size:11px;color:var(--text3);padding:8px 0;">Sin sugerencias.</div>');

  html+='<div style="font-size:11px;font-weight:800;color:var(--text2);margin:10px 0 6px;font-family:var(--font);">Logo</div>';
  html += (logoSuggestions.length?logoSuggestions.map(s=>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fcfcfe;border-radius:14px;margin-bottom:6px;border:1px solid var(--border);">'
      +'<div style="flex:1;min-width:0;"><div style="font-size:12.1px;font-weight:700;color:var(--text);">'+esc(s.keyword)+'</div><div style="font-size:10.5px;color:var(--text3);">'+esc(s.logoKey)+' · '+s.count+' mov</div></div>'
      +'<button style="padding:6px 10px;border-radius:999px;border:none;background:var(--accent);color:#fff;font-size:10.8px;font-weight:700;cursor:pointer;" data-kw="'+esc(s.keyword)+'" data-logo="'+esc(s.logoKey)+'" onclick="acceptLogoSuggestion(this.dataset.kw,this.dataset.logo)">+ Crear</button>'
    +'</div>'
  ).join(''):'<div style="font-size:11px;color:var(--text3);padding:8px 0;">Sin sugerencias.</div>');

  return html;
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
  if(!state.catRules)state.catRules=[];
  const id=Date.now().toString(36);
  state.catRules.unshift({id,keyword,category,active:true,priority:state.catRules.length+1});
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();renderTransactions();
  showToast('✓ Regla de categoría creada','success');
}

function addUserRule(){
  const kw=(document.getElementById('rule-new-keyword')?.value||'').trim();
  const cat=document.getElementById('rule-new-cat')?.value||'';
  if(!kw||!cat){showToast('Completá keyword y categoría','error');return;}
  if(!state.catRules)state.catRules=[];
  state.catRules.unshift({id:Date.now().toString(36),keyword:kw,category:cat,active:true,priority:state.catRules.length+1});
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla de categoría agregada','success');
}

function toggleRule(idx){
  if(!state.catRules[idx])return;
  state.catRules[idx].active=state.catRules[idx].active===false?true:false;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
}

function deleteRule(idx){
  if(!confirm('¿Eliminar regla?'))return;
  state.catRules.splice(idx,1);
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
}

function addNameRule(){
  const kw=(document.getElementById('name-rule-keyword')?.value||'').trim();
  const renameTo=(document.getElementById('name-rule-target')?.value||'').trim();
  if(!kw||!renameTo){showToast('Completá detectar y renombrar','error');return;}
  if(!state.nameRules) state.nameRules=[];
  state.nameRules.unshift({id:Date.now().toString(36),keyword:kw,renameTo,active:true,priority:state.nameRules.length+1});
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla de nombre agregada','success');
}

function acceptNameSuggestion(keyword, renameTo){
  if(!state.nameRules) state.nameRules=[];
  state.nameRules.unshift({id:Date.now().toString(36),keyword,renameTo,active:true,priority:state.nameRules.length+1});
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla de nombre creada','success');
}

function toggleNameRule(idx){
  if(!state.nameRules[idx]) return;
  state.nameRules[idx].active = state.nameRules[idx].active===false?true:false;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
}

function deleteNameRule(idx){
  if(!confirm('¿Eliminar regla?'))return;
  state.nameRules.splice(idx,1);
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
}

function addLogoRule(){
  const kw=(document.getElementById('logo-rule-keyword')?.value||'').trim();
  const logoKey=(document.getElementById('logo-rule-key')?.value||'').trim();
  const customUrl = window._pendingLogoDataUrl || '';
  if(!kw){showToast('Completá la keyword','error');return;}
  if(!logoKey && !customUrl){showToast('Elegí un preset o subí una imagen','error');return;}
  if(!state.logoRules) state.logoRules=[];
  state.logoRules.unshift({
    id:Date.now().toString(36),
    keyword:kw,
    logoKey: logoKey || null,
    logoCustomUrl: customUrl || null,
    active:true,
    priority:state.logoRules.length+1
  });
  window._pendingLogoDataUrl = null;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla de logo agregada','success');
}

// ── Edit-save handlers ─────────────────────────────────────
function saveEditCatRule(idx){
  const r = state.catRules?.[idx]; if(!r) return;
  const kw=(document.getElementById('cat-edit-keyword')?.value||'').trim();
  const cat=(document.getElementById('cat-edit-cat')?.value||'').trim();
  if(!kw||!cat){showToast('Completá keyword y categoría','error');return;}
  r.keyword = kw;
  r.category = cat;
  state._editingRule = null;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla actualizada','success');
}

function saveEditNameRule(idx){
  const r = state.nameRules?.[idx]; if(!r) return;
  const kw=(document.getElementById('name-edit-keyword')?.value||'').trim();
  const renameTo=(document.getElementById('name-edit-target')?.value||'').trim();
  if(!kw||!renameTo){showToast('Completá detectar y renombrar','error');return;}
  r.keyword = kw;
  r.renameTo = renameTo;
  state._editingRule = null;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla actualizada','success');
}

function saveEditLogoRule(idx){
  const r = state.logoRules?.[idx]; if(!r) return;
  const kw=(document.getElementById('logo-edit-keyword')?.value||'').trim();
  const logoKey=(document.getElementById('logo-edit-key')?.value||'').trim();
  if(!kw){showToast('Completá la keyword','error');return;}
  // logoCustomUrl might have been updated via window._pendingLogoDataUrl
  if(window._pendingLogoEditDataUrl !== undefined){
    r.logoCustomUrl = window._pendingLogoEditDataUrl || null;
    window._pendingLogoEditDataUrl = undefined;
  }
  if(!logoKey && !r.logoCustomUrl){showToast('Elegí un preset o una imagen','error');return;}
  r.keyword = kw;
  r.logoKey = logoKey || null;
  state._editingRule = null;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla actualizada','success');
}

function _clearEditCustomLogo(){
  window._pendingLogoEditDataUrl = null; // null means "remove"
  const preview = document.getElementById('logo-edit-custom-preview');
  if(preview) preview.innerHTML = '<span style="font-size:14px;color:var(--text3);">📷</span>';
}

// ── Image upload handler — resize + compress to data URL ──
function _handleLogoUpload(input, mode){
  const file = input.files && input.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){
    showToast('Solo imágenes (PNG/JPG/WebP)','error');
    return;
  }
  if(file.size > 5 * 1024 * 1024){
    showToast('Imagen demasiado grande (máx 5MB)','error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 100;
      const ratio = Math.min(MAX_DIM/img.width, MAX_DIM/img.height, 1);
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      // Try WebP first (smallest), fall back to PNG if not supported
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/webp', 0.85);
        if(!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
      } catch(_) {
        dataUrl = canvas.toDataURL('image/png');
      }
      // Store + show preview based on mode
      if(mode === 'edit'){
        window._pendingLogoEditDataUrl = dataUrl;
        const preview = document.getElementById('logo-edit-custom-preview');
        if(preview) preview.innerHTML = '<img src="'+esc(dataUrl)+'" style="width:100%;height:100%;object-fit:cover;" alt="">';
      } else {
        window._pendingLogoDataUrl = dataUrl;
        const preview = document.getElementById('logo-rule-custom-preview');
        if(preview) preview.innerHTML = '<img src="'+esc(dataUrl)+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="">';
      }
      const sizeKb = Math.round(dataUrl.length * 0.75 / 1024);
      showToast('✓ Imagen lista (' + sizeKb + ' KB · ' + w + '×' + h + ')','success');
    };
    img.onerror = () => showToast('No se pudo leer la imagen','error');
    img.src = e.target.result;
  };
  reader.onerror = () => showToast('Error leyendo el archivo','error');
  reader.readAsDataURL(file);
}

function acceptLogoSuggestion(keyword, logoKey){
  if(!state.logoRules) state.logoRules=[];
  state.logoRules.unshift({id:Date.now().toString(36),keyword,logoKey,active:true,priority:state.logoRules.length+1});
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
  showToast('✓ Regla de logo creada','success');
}

function toggleLogoRule(idx){
  if(!state.logoRules[idx]) return;
  state.logoRules[idx].active = state.logoRules[idx].active===false?true:false;
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
}

function deleteLogoRule(idx){
  if(!confirm('¿Eliminar regla?'))return;
  state.logoRules.splice(idx,1);
  reApplySuggestionsAll(false);
  saveState();renderRulesPanel();
}

function reApplySuggestionsAll(showMessage=true){
  let count=0;
  (state.transactions||[]).forEach(t=>{
    const prevDesc=t.description;
    const prevLogo=t.logoKey||'';
    enrichTransaction(t);
    if((t.category==='Otros'||t.category==='Procesando...'||t.category==='Uncategorized'||!t.category) && t.cat_sugerida){
      t.category=t.cat_sugerida;
      count++;
    }
    if(prevDesc!==t.description || prevLogo!==(t.logoKey||'')) count++;
  });
  saveState();
  if(typeof renderTransactions==='function') renderTransactions();
  if(typeof renderDashboard==='function') renderDashboard();
  if(showMessage) showToast('↺ Reglas re-aplicadas en '+count+' cambios','success');
}

// ══ CATEGORIES ══
function renderCategoryManage(){
  if(typeof normalizeCategoryState === 'function') normalizeCategoryState(state);
  const counts={};state.transactions.forEach(t=>{counts[t.category]=(counts[t.category]||0)+1;});
  const el=document.getElementById('cat-list-manage');
  const sub=document.getElementById('cat-count-sub');
  const groups=typeof getCategoryGroups === 'function' ? getCategoryGroups() : [...new Set((state.categories||[]).map(c=>c.group))].map((name, index)=>({id:`group-${index}`,name}));
  const totalSubs=(state.categories||[]).length;
  const totalGroups=groups.length;
  if(sub)sub.textContent=totalGroups+' grupos \u00B7 '+totalSubs+' subcategor\u00EDa'+(totalSubs!==1?'s':'');
  if(el){
    let html='';
    groups.forEach(group=>{
      const g=group.name||'Sin clasificar';
      const grp=typeof getCategoryGroupById === 'function' ? (getCategoryGroupById(group.id) || getCategoryGroupByName(g)) : CATEGORY_GROUPS.find(x=>x.group===g);
      const emoji=grp?grp.emoji:'\u{1F5D1}\u{FE0F}';
      const subs=state.categories.filter(c=>((c.groupId&&c.groupId===group.id)||(c.group||'Sin clasificar')===g));
      const gCount=subs.reduce((s,c)=>s+(counts[c.name]||0),0);
      html+='<div class="cat-group-header" style="display:flex;align-items:center;gap:8px;padding:10px 10px 4px;margin-top:6px;">'+
        '<span style="font-size:15px;">'+emoji+'</span>'+
        '<span style="font-size:12px;font-weight:700;color:var(--text);letter-spacing:-.01em;flex:1;">'+esc(g)+'</span>'+
        '<span style="font-size:10px;color:var(--text3);font-family:var(--font);">'+gCount+' mov.</span>'+
      '</div>';
      subs.forEach(c=>{
        const n=counts[c.name]||0;
        html+='<div class="cat-item-row" data-cat-id="'+esc(c.id||c.name)+'" onclick="selectInlineCat(\x27'+esc(c.id||c.name)+'\x27)" style="padding-left:34px;">'+
          '<div class="cat-item-color" style="background:'+c.color+';width:10px;height:10px;border-radius:50%;flex-shrink:0;"></div>'+
          '<div class="cat-item-name" style="flex:1;font-size:12px;font-weight:500;">'+esc(c.name)+'</div>'+
          '<div class="cat-item-count" style="font-size:10px;color:var(--text3);font-family:var(--font);">'+n+'</div>'+
        '</div>';
      });
    });
    el.innerHTML=html;
  }
}
function selectInlineCat(id){
  const cat=(typeof getCategoryById==='function' ? getCategoryById(id) : null) || state.categories.find(c=>c.name===id||c.id===id);if(!cat)return;
  document.getElementById('cat-form-title').textContent='Editar subcategoría';
  document.getElementById('cat-inline-name').value=cat.name;
  document.getElementById('cat-inline-id').value=cat.id||'';
  document.getElementById('cat-inline-editing').value=cat.name;
  document.getElementById('cat-inline-delete-btn').style.display='inline-flex';
  document.getElementById('cat-inline-empty-hint').style.display='none';
  renderInlineGroupSelector(cat.groupId||cat.group||'Sin clasificar');
  renderInlineColorPicker(cat.color);
  // Highlight selected row
  document.querySelectorAll('.cat-item-row').forEach(r=>r.classList.remove('active'));
  const row=document.querySelector('.cat-item-row[data-cat-id="'+esc(cat.id||cat.name)+'"]');
  if(row)row.classList.add('active');
  document.getElementById('cat-inline-name').focus();
}
function renderInlineGroupSelector(selGroup){
  const el=document.getElementById('cat-inline-group');
  if(!el)return;
  const groups=typeof getCategoryGroups==='function' ? getCategoryGroups() : [];
  el.innerHTML=groups.map(group=>{
    const value=group.id||group.name;
    const selected=value===selGroup || group.name===selGroup;
    return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(group.emoji||'•')+' '+esc(group.name)+'</option>';
  }).join('');
}
function openInlineCatForm(){
  clearInlineCatForm();
  document.getElementById('cat-inline-name').focus();
}
function clearInlineCatForm(){
  document.getElementById('cat-form-title').textContent='Nueva subcategoría';
  const fallback=typeof getCategoryGroupByName==='function' ? (getCategoryGroupByName('Sin clasificar')||getCategoryGroups?.()[0]) : null;
  renderInlineGroupSelector(fallback?.id||'Sin clasificar');
  document.getElementById('cat-inline-name').value='';
  if(document.getElementById('cat-inline-id')) document.getElementById('cat-inline-id').value='';
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
  const categoryId=document.getElementById('cat-inline-id')?.value||'';
  const editing=document.getElementById('cat-inline-editing').value;
  const groupId=document.getElementById('cat-inline-group')?.value||'';
  let result=null;
  if(editing){
    result=typeof updateCategory==='function' ? updateCategory(categoryId||editing,{name,groupId,group:groupId,color:hexColor}) : null;
    if(!result?.ok){showToast(result?.error||'No se pudo guardar','error');return;}
    showToast('✓ Categoría actualizada','success');
  } else {
    result=typeof createCategory==='function' ? createCategory({name,groupId,group:groupId,color:hexColor}) : null;
    if(!result?.ok){showToast(result?.error||'No se pudo guardar','error');return;}
    showToast('✓ Subcategoría creada','success');
  }
  saveState();refreshAll();
  clearInlineCatForm();
}
function deleteInlineCat(){
  const name=document.getElementById('cat-inline-editing').value;if(!name)return;
  const categoryId=document.getElementById('cat-inline-id')?.value||name;
  if(!confirm('¿Eliminar la categoría "'+name+'"? Los movimientos pasarán a "Otros".'))return;
  const result=typeof deleteCategory==='function' ? deleteCategory(categoryId) : null;
  if(!result?.ok){showToast(result?.error||'No se pudo eliminar','error');return;}
  saveState();refreshAll();showToast('Categoría eliminada','info');
  clearInlineCatForm();
}
// renderReassignTable removed — legacy, reassign-filter/reassign-table elements no longer exist
function openNewCatModal(){document.getElementById('modal-cat-title').textContent='Nueva categoría';document.getElementById('modal-cat-name').value='';document.getElementById('modal-cat-editing').value='';document.getElementById('btn-delete-cat').style.display='none';renderColorPicker('');openModal('modal-cat');}
function openEditCatModal(name){const cat=state.categories.find(c=>c.name===name);if(!cat)return;document.getElementById('modal-cat-title').textContent='Editar categoría';document.getElementById('modal-cat-name').value=cat.name;document.getElementById('modal-cat-editing').value=cat.name;document.getElementById('btn-delete-cat').style.display='inline-flex';renderColorPicker(cat.color);openModal('modal-cat');}

// ══ EMOJI PICKER ══
const EMOJI_SETS = {
  compromisos:['🛒','💳','🧾','📦','🎓','💻','📱','🏠','🔌','🛠️','🎁','🪑','🧸','🧼','📚','🧠','💡','🚗','✈️','🎟️'],
  suscripciones:['🔁','📺','🎵','🎧','🎬','🧠','☁️','💻','📱','📰','📚','🏋️','🧘','🎮','🎨','🛡️','🗂️','🤖','🛰️','🧪'],
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
const EMOJI_LABELS = {compromisos:'Compromisos',suscripciones:'Suscripciones',general:'General',hogar:'Hogar',tech:'Tecnología',comida:'Comida',transporte:'Transporte',salud:'Salud',entretenimiento:'Entretenimiento',compras:'Compras',finanzas:'Finanzas',educacion:'Educación'};

function getDefaultEmojiCategory(pickerId){
  if(['cuota','autocuota','fixed'].includes(pickerId)) return 'compromisos';
  if(pickerId==='sub') return 'suscripciones';
  return 'general';
}

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
    showEmojiCategory(pickerId, getDefaultEmojiCategory(pickerId));
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
  const fallback=typeof getCategoryGroupByName==='function' ? getCategoryGroupByName('Sin clasificar') : null;
  const result=editing
    ? (typeof updateCategory==='function' ? updateCategory(editing,{name,color:hexColor}) : null)
    : (typeof createCategory==='function' ? createCategory({name,groupId:fallback?.id||'group-sin-clasificar',color:hexColor}) : null);
  if(!result?.ok){showToast(result?.error||'No se pudo guardar','error');return;}
  showToast(editing?'✓ Actualizada':'✓ Creada','success');
  saveState();closeModal('modal-cat');refreshAll();
}
function deleteCat(){const name=document.getElementById('modal-cat-editing').value;if(!name)return;const result=typeof deleteCategory==='function' ? deleteCategory(name) : null;if(!result?.ok){showToast(result?.error||'No se pudo eliminar','error');return;}saveState();closeModal('modal-cat');refreshAll();showToast('Eliminada','info');}
function rgbToHex(rgb){const m=rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);if(!m)return'#888888';return'#'+[m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');}
