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

// Build flat DEFAULT_CATS from groups (backward compatible: each entry has name, color, group, emoji)
const DEFAULT_CATS = [];
CATEGORY_GROUPS.forEach(g => {
  g.subs.forEach(sub => {
    DEFAULT_CATS.push({name: sub, color: g.color, group: g.group, emoji: g.emoji});
  });
});

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
  // 2. Replace categories array with new structure if it lacks 'group' field
  if (state.categories.length && !state.categories[0].group) {
    state.categories = [...DEFAULT_CATS];
  }
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
}
const INC_CURRENCY={ARS:'ARS',USD:'USD'};

