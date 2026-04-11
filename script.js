const state = { categories: [], categoryGroups: [] };
// ══ THEME HELPER ══
function _isL(){return document.body&&document.body.classList.contains('light-mode');}
// ══ CHART.JS APPLE DEFAULTS ══
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "-apple-system,'SF Pro Display','SF Pro Text',BlinkMacSystemFont,'Helvetica Neue',sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = '#86868b';
  Chart.defaults.borderColor = 'rgba(0,0,0,0.06)';
  Chart.defaults.plugins.legend.labels.font = {
    family: "-apple-system,'SF Pro Display',sans-serif",
    size: 12, weight: '500'
  };
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(44,44,46,0.95)';
  Chart.defaults.plugins.tooltip.titleColor = '#1d1d1f';
  Chart.defaults.plugins.tooltip.bodyColor = '#424245';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.08)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: '600', family: "-apple-system,'SF Pro Display',sans-serif" };
  Chart.defaults.plugins.tooltip.bodyFont  = { size: 12, weight: '400', family: "-apple-system,'SF Pro Display',sans-serif" };
  Chart.defaults.plugins.tooltip.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
}
// ══ CONSTANTS ══
const PALETTE=['#007aff','#34c759','#ff9500','#af52de','#ff6b00','#5ac8fa','#ff3b30','#30d158','#ffd60a','#bf5af2','#64d2ff','#ff9f0a','#ac8e68','#6d6d72','#ff2d55','#0a84ff'];
// ══ CATEGORY SYSTEM: group → subcategories ══
// Each category has: name (subcategory), group (parent), color, emoji
const CATEGORY_GROUPS = [
  {group:'Alimentación',   emoji:'🍽️', color:'#007aff', subs:['Supermercado','Restaurantes','Delivery','Kiosco']},
  {group:'Transporte',     emoji:'🚗', color:'#ff9500', subs:['Transporte público','Uber','Combustible','Mantenimiento auto','Estacionamiento']},
  {group:'Vida Social',    emoji:'🎉', color:'#f060c8', subs:['Fiesta','Alcohol','Eventos','Juegos']},
  {group:'Consumo Personal',emoji:'🧍', color:'#a060f0', subs:['Ropa','Cuidado personal','Compras generales','Otros']},
  {group:'Salud',          emoji:'🏥', color:'#60f0a0', subs:['Consultas médicas','Farmacia']},
  {group:'Bienestar',      emoji:'💪', color:'#34c759', subs:['Gimnasio','Deportes','Terapia']},
  {group:'Educación',      emoji:'🧠', color:'#80f0c0', subs:['Cursos','Libros','Universidad']},
  {group:'Servicios & Hogar',emoji:'🧾', color:'#e8c0a0', subs:['Alquiler','Expensas','Internet','Telefonía','Plataformas']},
  {group:'Tecnología',     emoji:'💻', color:'#60a0f0', subs:['Dispositivos','Suscripciones tech','Accesorios']},
  {group:'Viajes',         emoji:'✈️', color:'#f0c040', subs:['Vuelos','Alojamiento','Transporte en destino','Comida en viaje','Actividades']},
  {group:'Finanzas',       emoji:'💸', color:'#50d0d0', subs:['Transferencias','Comisiones bancarias','Inversiones','Ahorro']},
  {group:'Regalos',        emoji:'🎁', color:'#f09070', subs:['Regalos']},
  {group:'Consumos Sensibles',emoji:'⚠️', color:'#c0a050', subs:['Sustancias','Marihuana']},
  {group:'Sin clasificar', emoji:'🗑️', color:'#888888', subs:['Uncategorized']},
];

function categorySlug(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

const DEFAULT_CATEGORY_GROUPS = CATEGORY_GROUPS.map((group, index) => ({
  id: `group-${categorySlug(group.group) || index}`,
  name: group.group,
  type: 'expense',
  order: index,
  icon: group.emoji,
  emoji: group.emoji,
  color: group.color,
  active: true
}));

// Build flat DEFAULT_CATS from groups (backward compatible plus richer data model)
const DEFAULT_CATS = [];
DEFAULT_CATEGORY_GROUPS.forEach(group => {
  const legacy = CATEGORY_GROUPS.find(item => item.group === group.name);
  (legacy?.subs || []).forEach((sub, subIndex) => {
    DEFAULT_CATS.push({
      id: `cat-${categorySlug(group.name)}-${categorySlug(sub) || subIndex}`,
      name: sub,
      group: group.name,
      groupId: group.id,
      type: 'expense',
      icon: group.icon,
      emoji: group.emoji,
      color: group.color,
      active: true,
      order: subIndex
    });
  });
});

function buildDefaultCategoryGroups(){
  return DEFAULT_CATEGORY_GROUPS.map(group => ({ ...group }));
}

function buildDefaultCategories(){
  return DEFAULT_CATS.map(category => ({ ...category }));
}

function normalizeCategoryGroups(rawGroups, rawCategories){
  const sourceGroups = Array.isArray(rawGroups) && rawGroups.length
    ? rawGroups
    : buildDefaultCategoryGroups();
  const usedNames = new Set();
  const groups = sourceGroups
    .filter(Boolean)
    .map((group, index) => {
      const name = String(group.name || group.group || '').trim() || `Grupo ${index + 1}`;
      let id = String(group.id || group.groupId || `group-${categorySlug(name) || index}`).trim();
      while(usedNames.has(id)) id = `${id}-${usedNames.size + 1}`;
      usedNames.add(id);
      return {
        id,
        name,
        type: group.type || 'expense',
        order: Number.isFinite(Number(group.order)) ? Number(group.order) : index,
        icon: group.icon || group.emoji || '•',
        emoji: group.emoji || group.icon || '•',
        color: group.color || '#888888',
        active: group.active !== false
      };
    });
  const existingNames = new Set(groups.map(group => group.name));
  (Array.isArray(rawCategories) ? rawCategories : []).forEach(category => {
    const groupName = String(category?.group || '').trim();
    if(!groupName || existingNames.has(groupName)) return;
    const fallback = DEFAULT_CATEGORY_GROUPS.find(item => item.name === groupName);
    groups.push({
      id: fallback?.id || `group-${categorySlug(groupName) || groups.length}`,
      name: groupName,
      type: fallback?.type || category?.type || 'expense',
      order: groups.length,
      icon: fallback?.icon || category?.icon || '•',
      emoji: fallback?.emoji || category?.emoji || '•',
      color: fallback?.color || category?.color || '#888888',
      active: true
    });
    existingNames.add(groupName);
  });
  if(!groups.find(group => group.name === 'Sin clasificar')){
    groups.push({
      id:'group-sin-clasificar',
      name:'Sin clasificar',
      type:'expense',
      order:groups.length,
      icon:'🗑️',
      emoji:'🗑️',
      color:'#888888',
      active:true
    });
  }
  return groups.sort((a,b)=>(a.order||0)-(b.order||0));
}

function normalizeCategories(rawCategories, groups){
  const groupList = Array.isArray(groups) && groups.length ? groups : buildDefaultCategoryGroups();
  const groupById = new Map(groupList.map(group => [group.id, group]));
  const groupByName = new Map(groupList.map(group => [group.name, group]));
  const sourceCategories = Array.isArray(rawCategories) && rawCategories.length
    ? rawCategories
    : buildDefaultCategories();
  const usedIds = new Set();
  return sourceCategories
    .filter(Boolean)
    .map((category, index) => {
      const name = String(category.name || category.label || '').trim() || `Categoría ${index + 1}`;
      const resolvedGroup =
        groupById.get(String(category.groupId || '').trim()) ||
        groupByName.get(String(category.group || '').trim()) ||
        groupByName.get('Sin clasificar') ||
        groupList[0];
      let id = String(category.id || `cat-${categorySlug(name) || index}`).trim();
      while(usedIds.has(id)) id = `${id}-${usedIds.size + 1}`;
      usedIds.add(id);
      return {
        id,
        name,
        group: resolvedGroup?.name || 'Sin clasificar',
        groupId: resolvedGroup?.id || 'group-sin-clasificar',
        type: category.type || resolvedGroup?.type || 'expense',
        icon: category.icon || category.emoji || resolvedGroup?.icon || resolvedGroup?.emoji || '•',
        emoji: category.emoji || category.icon || resolvedGroup?.emoji || resolvedGroup?.icon || '•',
        color: category.color || resolvedGroup?.color || '#888888',
        active: category.active !== false,
        order: Number.isFinite(Number(category.order)) ? Number(category.order) : index
      };
    })
    .sort((a,b)=>(a.order||0)-(b.order||0) || a.name.localeCompare(b.name));
}

function syncCategoryGroupRegistry(targetState){
  const stateRef = targetState || (typeof state !== 'undefined' ? state : null);
  const groups = normalizeCategoryGroups(stateRef?.categoryGroups, stateRef?.categories);
  const categories = normalizeCategories(stateRef?.categories, groups);
  if(stateRef){
    stateRef.categoryGroups = groups;
    stateRef.categories = categories;
  }
  CATEGORY_GROUPS.splice(0, CATEGORY_GROUPS.length, ...groups.map(group => ({
    group: group.name,
    emoji: group.emoji || group.icon || '•',
    color: group.color || '#888888',
    subs: categories
      .filter(category => category.groupId === group.id && category.active !== false)
      .sort((a,b)=>(a.order||0)-(b.order||0) || a.name.localeCompare(b.name))
      .map(category => category.name)
  })));
  return { groups, categories };
}

function normalizeCategoryState(targetState){
  const stateRef = targetState || (typeof state !== 'undefined' ? state : null);
  if(!stateRef) return { categoryGroups: buildDefaultCategoryGroups(), categories: buildDefaultCategories() };
  const synced = syncCategoryGroupRegistry(stateRef);
  return { categoryGroups: synced.groups, categories: synced.categories };
}

function getCategoryGroups(){
  return normalizeCategoryState(typeof state !== 'undefined' ? state : null).categoryGroups;
}

function getActiveCategories(){
  return normalizeCategoryState(typeof state !== 'undefined' ? state : null).categories.filter(category => category.active !== false);
}

function buildCategoryOptions(includeAutoDetect){
  const groups = getCategoryGroups();
  const categories = getActiveCategories();
  const parts = [];
  if(includeAutoDetect) parts.push('<option value="">Auto detectar</option>');
  groups.forEach(group => {
    const subs = categories.filter(category => category.groupId === group.id);
    if(!subs.length) return;
    parts.push(`<optgroup label="${group.emoji || group.icon || '•'} ${group.name}">`);
    subs.forEach(category => {
      parts.push(`<option value="${category.name}">${category.name}</option>`);
    });
    parts.push('</optgroup>');
  });
  return parts.join('');
}

function getCategoryGroupById(groupId){
  return getCategoryGroups().find(group => group.id === groupId) || null;
}

function getCategoryGroupByName(groupName){
  const name = String(groupName || '').trim();
  return getCategoryGroups().find(group => group.name === name) || null;
}

function getCategoryById(categoryId){
  return normalizeCategoryState(typeof state !== 'undefined' ? state : null).categories.find(category => category.id === categoryId) || null;
}

function getCategoryByName(categoryName){
  const name = String(categoryName || '').trim();
  return normalizeCategoryState(typeof state !== 'undefined' ? state : null).categories.find(category => category.name === name) || null;
}

function updateCategoryReferences(oldName, nextName){
  const prev = String(oldName || '').trim();
  const next = String(nextName || '').trim();
  if(!prev || !next || prev === next || typeof state === 'undefined' || !state) return;
  (state.transactions || []).forEach(txn => {
    if(txn.category === prev) txn.category = next;
  });
  (state.catRules || []).forEach(rule => {
    if(rule.category === prev) rule.category = next;
  });
  if(state.catHistory && typeof state.catHistory === 'object'){
    Object.values(state.catHistory).forEach(entry => {
      if(!entry || typeof entry !== 'object' || !Object.prototype.hasOwnProperty.call(entry, prev)) return;
      entry[next] = (entry[next] || 0) + (entry[prev] || 0);
      delete entry[prev];
    });
  }
  (state.gmailImportRules || []).forEach(rule => {
    if(rule.category === prev) rule.category = next;
  });
}

function createCategoryGroup(input){
  const payload = input || {};
  const groups = getCategoryGroups().map(group => ({ ...group }));
  const name = String(payload.name || '').trim();
  if(!name) return { ok:false, error:'Ingresá un nombre de grupo' };
  if(groups.some(group => group.name.toLowerCase() === name.toLowerCase())) return { ok:false, error:'Ese grupo ya existe' };
  const next = {
    id: payload.id || `group-${categorySlug(name) || Date.now().toString(36)}`,
    name,
    type: payload.type || 'expense',
    order: Number.isFinite(Number(payload.order)) ? Number(payload.order) : groups.length,
    icon: payload.icon || payload.emoji || '•',
    emoji: payload.emoji || payload.icon || '•',
    color: payload.color || '#64748b',
    active: payload.active !== false
  };
  state.categoryGroups = [...groups, next];
  normalizeCategoryState(state);
  return { ok:true, group: getCategoryGroupByName(name) };
}

function updateCategoryGroup(groupIdOrName, input){
  const payload = input || {};
  const groups = getCategoryGroups().map(group => ({ ...group }));
  const current = groups.find(group => group.id === groupIdOrName || group.name === groupIdOrName);
  if(!current) return { ok:false, error:'Grupo no encontrado' };
  const nextName = String(payload.name ?? current.name).trim();
  if(!nextName) return { ok:false, error:'Ingresá un nombre de grupo' };
  if(groups.some(group => group.id !== current.id && group.name.toLowerCase() === nextName.toLowerCase())) return { ok:false, error:'Ese grupo ya existe' };
  const previousName = current.name;
  const updatedGroups = groups.map(group => group.id !== current.id ? group : {
    ...group,
    name: nextName,
    type: payload.type || group.type || 'expense',
    icon: payload.icon || payload.emoji || group.icon || group.emoji || '•',
    emoji: payload.emoji || payload.icon || group.emoji || group.icon || '•',
    color: payload.color || group.color || '#64748b',
    active: payload.active !== false ? true : false,
    order: Number.isFinite(Number(payload.order)) ? Number(payload.order) : group.order
  });
  state.categoryGroups = updatedGroups;
  state.categories = (state.categories || []).map(category => {
    if(category.groupId !== current.id && category.group !== previousName) return category;
    return {
      ...category,
      group: nextName,
      groupId: current.id,
      type: payload.type || category.type || current.type || 'expense',
      color: category.color || payload.color || current.color || '#64748b',
      icon: category.icon || payload.icon || payload.emoji || current.icon || current.emoji || '•',
      emoji: category.emoji || payload.emoji || payload.icon || current.emoji || current.icon || '•'
    };
  });
  normalizeCategoryState(state);
  return { ok:true, group: getCategoryGroupById(current.id) };
}

function deleteCategoryGroup(groupIdOrName, fallbackGroupIdOrName){
  const groups = getCategoryGroups().map(group => ({ ...group }));
  const current = groups.find(group => group.id === groupIdOrName || group.name === groupIdOrName);
  if(!current) return { ok:false, error:'Grupo no encontrado' };
  if(current.name === 'Sin clasificar') return { ok:false, error:'No podés eliminar el grupo Sin clasificar' };
  const categoriesInGroup = (state.categories || []).filter(category => category.groupId === current.id || category.group === current.name);
  if(categoriesInGroup.length){
    const fallback = groups.find(group => (group.id === fallbackGroupIdOrName || group.name === fallbackGroupIdOrName) && group.id !== current.id) || getCategoryGroupByName('Sin clasificar');
    if(!fallback) return { ok:false, error:'Necesitás un grupo de destino para mover las categorías' };
    state.categories = (state.categories || []).map(category => {
      if(category.groupId !== current.id && category.group !== current.name) return category;
      return {
        ...category,
        groupId: fallback.id,
        group: fallback.name,
        type: category.type || fallback.type || 'expense'
      };
    });
  }
  state.categoryGroups = groups.filter(group => group.id !== current.id);
  normalizeCategoryState(state);
  return { ok:true };
}

function createCategory(input){
  const payload = input || {};
  const categories = normalizeCategoryState(typeof state !== 'undefined' ? state : null).categories.map(category => ({ ...category }));
  const name = String(payload.name || '').trim();
  if(!name) return { ok:false, error:'Ingresá un nombre de categoría' };
  if(categories.some(category => category.name.toLowerCase() === name.toLowerCase())) return { ok:false, error:'Ya existe una categoría con ese nombre' };
  const group = getCategoryGroupById(payload.groupId) || getCategoryGroupByName(payload.group || '') || getCategoryGroupByName('Sin clasificar');
  if(!group) return { ok:false, error:'Seleccioná un grupo' };
  const next = {
    id: payload.id || `cat-${categorySlug(group.name)}-${categorySlug(name) || Date.now().toString(36)}`,
    name,
    group: group.name,
    groupId: group.id,
    type: payload.type || group.type || 'expense',
    icon: payload.icon || payload.emoji || group.icon || group.emoji || '•',
    emoji: payload.emoji || payload.icon || group.emoji || group.icon || '•',
    color: payload.color || group.color || '#64748b',
    active: payload.active !== false,
    order: Number.isFinite(Number(payload.order)) ? Number(payload.order) : categories.filter(category => category.groupId === group.id).length
  };
  state.categories = [...categories, next];
  normalizeCategoryState(state);
  return { ok:true, category:getCategoryById(next.id) || getCategoryByName(name) };
}

function updateCategory(categoryIdOrName, input){
  const payload = input || {};
  const categories = normalizeCategoryState(typeof state !== 'undefined' ? state : null).categories.map(category => ({ ...category }));
  const current = categories.find(category => category.id === categoryIdOrName || category.name === categoryIdOrName);
  if(!current) return { ok:false, error:'Categoría no encontrada' };
  const name = String(payload.name ?? current.name).trim();
  if(!name) return { ok:false, error:'Ingresá un nombre de categoría' };
  if(categories.some(category => category.id !== current.id && category.name.toLowerCase() === name.toLowerCase())) return { ok:false, error:'Ya existe una categoría con ese nombre' };
  const group = getCategoryGroupById(payload.groupId || current.groupId) || getCategoryGroupByName(payload.group || current.group) || getCategoryGroupByName('Sin clasificar');
  if(!group) return { ok:false, error:'Seleccioná un grupo' };
  state.categories = categories.map(category => category.id !== current.id ? category : {
    ...category,
    name,
    group: group.name,
    groupId: group.id,
    type: payload.type || category.type || group.type || 'expense',
    icon: payload.icon || payload.emoji || category.icon || category.emoji || group.icon || group.emoji || '•',
    emoji: payload.emoji || payload.icon || category.emoji || category.icon || group.emoji || group.icon || '•',
    color: payload.color || category.color || group.color || '#64748b',
    active: payload.active !== false ? true : false
  });
  if(name !== current.name) updateCategoryReferences(current.name, name);
  normalizeCategoryState(state);
  return { ok:true, category:getCategoryById(current.id) || getCategoryByName(name) };
}

function deleteCategory(categoryIdOrName, options){
  const config = options || {};
  const current = getCategoryById(categoryIdOrName) || getCategoryByName(categoryIdOrName);
  if(!current) return { ok:false, error:'Categoría no encontrada' };
  state.categories = (state.categories || []).filter(category => category.id !== current.id && category.name !== current.name);
  const fallbackCategoryName = String(config.fallbackCategory || 'Uncategorized').trim() || 'Uncategorized';
  (state.transactions || []).forEach(txn => {
    if(txn.category === current.name) txn.category = fallbackCategoryName;
  });
  (state.catRules || []).forEach(rule => {
    if(rule.category === current.name) rule.category = '';
  });
  if(state.catHistory && typeof state.catHistory === 'object'){
    Object.values(state.catHistory).forEach(entry => {
      if(entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, current.name)){
        delete entry[current.name];
      }
    });
  }
  (state.gmailImportRules || []).forEach(rule => {
    if(rule.category === current.name) rule.category = '';
  });
  normalizeCategoryState(state);
  return { ok:true };
}

// Migration map: old flat category names → new subcategory names
const CAT_MIGRATION_MAP = {
  'Alimentación': 'Supermercado',
  'Restaurantes': 'Restaurantes',
  'Gastronomía': 'Delivery',
  'Supermercado': 'Supermercado',
  'Transporte': 'Transporte público',
  'Combustible': 'Combustible',
  'Entretenimiento': 'Fiesta',
  'Salud': 'Farmacia',
  'Ropa y calzado': 'Ropa',
  'Tecnología': 'Dispositivos',
  'Viajes': 'Vuelos',
  'Servicios': 'Plataformas',
  'Educación': 'Cursos',
  'Otros': 'Uncategorized',
};

// Migrate old categories in state
function migrateCategories() {
  // 1. Migrate transactions — also handle category names that match parent group names
  const allValidSubs = new Set(CATEGORY_GROUPS.flatMap(g=>g.subs));
  state.transactions.forEach(t => {
    if (!t.category || t.category==='Procesando...') return;
    // Direct migration map hit
    if (CAT_MIGRATION_MAP[t.category]) { t.category = CAT_MIGRATION_MAP[t.category]; return; }
    // If category is a parent group name (not a valid sub), migrate to first sub
    if (!allValidSubs.has(t.category)) {
      const grp = CATEGORY_GROUPS.find(g => g.group === t.category);
      if (grp) { t.category = grp.subs[0]; return; }
      // Unknown category — leave as-is, catGroup fallback will handle
    }
  });
  // 2. Normalize groups + categories into the richer shared model
  normalizeCategoryState(state);
  // 3. Migrate catHistory keys
  if (state.catHistory) {
    const newHist = {};
    Object.entries(state.catHistory).forEach(([comercio, catCounts]) => {
      const migrated = {};
      Object.entries(catCounts).forEach(([cat, count]) => {
        const newCat = CAT_MIGRATION_MAP[cat] || cat;
        migrated[newCat] = (migrated[newCat] || 0) + count;
      });
      newHist[comercio] = migrated;
    });
    state.catHistory = newHist;
  }
  // 4. Migrate catRules
  if (state.catRules) {
    state.catRules.forEach(r => {
      if (r.category && CAT_MIGRATION_MAP[r.category]) {
        r.category = CAT_MIGRATION_MAP[r.category];
      }
    });
  }
  syncCategoryGroupRegistry(state);
}
const INC_CURRENCY={ARS:'ARS',USD:'USD'};
console.log(getCategoryGroups());
