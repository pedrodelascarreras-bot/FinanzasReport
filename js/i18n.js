// ══ INTERNATIONALIZATION (i18n) ══
(function () {
  const translations = {
    es: {
      // Sidebar navigation
      nav_tendencias: 'Tendencias',
      nav_transactions: 'Movimientos',
      nav_commitments: 'Compromisos',
      nav_income: 'Ingresos',
      nav_savings: 'Ahorros',
      nav_credit_card: 'Tarjeta de crédito',
      nav_balance: 'Balance mensual',
      nav_compare: 'Mes vs Mes',
      nav_reports: 'Reportes',
      // Sidebar tools
      gmail_sync: 'Gmail · Sincronizar',
      color_app: 'Color de la app',
      theme_label: 'Tema',
      // Language toggle button
      lang_toggle_btn: 'Switch to English',
      // Notification panel
      notifications: 'Notificaciones',
      notif_subtitle: 'Actividad reciente y alertas útiles',
      // Create menu
      quick_actions: 'Acciones rápidas',
      // Page titles
      page_settings: 'Configuración',
      page_settings_sub: 'Centro de configuración operativo para cuentas, tarjetas, reglas, categorías e integración.',
      page_profile: 'Perfil',
      page_profile_sub: 'Identidad, preferencias y control de datos en una vista principal de ancho completo.',
      page_security: 'Seguridad y datos',
      page_security_sub: 'Centro de control para respaldos, restauración, exportación y permisos de acceso.',
      page_credit_card: 'Tarjeta de Crédito',
      page_reports: 'Reportes',
      page_transactions: 'Movimientos',
      page_transactions_sub: 'Tu mesa operativa diaria para buscar, corregir, categorizar y cerrar movimientos sin fricción.',
      page_trends: 'Tendencias',
      page_insights: 'Insights',
      page_balance: 'Balance mensual',
      page_balance_sub: 'Una sola vista para entender el cierre del mes, comparar contra el anterior y decidir qué hacer después.',
      page_commitments: 'Compromisos',
      page_commitments_sub: 'Gastos fijos · cuotas · suscripciones',
      page_categories: 'Categorías',
      page_categories_sub: 'Grupos y subcategorías de gastos',
      page_income: 'Ingresos',
      page_savings: 'Ahorros',
      page_import: 'Importar datos',
      page_import_sub: 'La entrada principal de movimientos: detectá, revisá, corregí y confirmá desde un flujo simple.',
      page_import_history: 'Historial de importaciones',
      page_import_history_sub: 'Pantalla dedicada para revisar origen, fecha y volumen importado.',
      page_reconciliation: 'Conciliación de resumen',
      page_reconciliation_sub: 'Compara tus gastos registrados con un resumen oficial en PDF.',
      page_search: 'Buscador global',
      page_search_sub: 'Movimientos, categorías, cuotas, suscripciones, accesos rápidos y seguridad.',
      // Settings page sections
      card_settings_title: 'Configuración de tarjetas',
      manage_cards: 'Administrar tarjetas',
      view_cycles: 'Ver ciclos',
      cat_mgmt_title: 'Gestión de categorías',
      cat_mgmt_copy1: 'Ordená y editá tus categorías en una vista más cómoda',
      cat_mgmt_copy2: 'Abrí la pantalla dedicada para crear nuevas, moverlas entre grupos o limpiar las que ya no usás.',
      cat_tag_create: 'Crear',
      cat_tag_edit: 'Editar',
      cat_tag_reorder: 'Reordenar',
      cat_tag_delete: 'Eliminar',
      open_categories_btn: 'Abrir gestión de categorías',
      create_new_btn: 'Crear nueva',
      gmail_rules_title: 'Reglas Gmail y automatización',
      new_rule_btn: 'Nueva regla',
      test_sync_btn: 'Probar sincronización',
      // Profile page
      choose_avatar: 'Elegir avatar',
      uploaded_image: 'Imagen subida',
      preset_avatar: 'Avatar predefinido',
      personal_info: 'Información personal',
      name_label: 'Nombre',
      preferences_title: 'Preferencias',
      main_currency: 'Moneda principal',
      language_label: 'Idioma',
      visual_theme: 'Tema visual',
      save_changes: 'Guardar cambios',
      save_preferences: 'Guardar preferencias',
      account_control: 'Control de cuenta',
      upload_image_btn: 'Subir imagen',
      remove_btn: 'Quitar',
      export_backup: 'Exportar backup',
      reset_data: 'Resetear datos',
    },
    en: {
      // Sidebar navigation
      nav_tendencias: 'Trends',
      nav_transactions: 'Transactions',
      nav_commitments: 'Commitments',
      nav_income: 'Income',
      nav_savings: 'Savings',
      nav_credit_card: 'Credit card',
      nav_balance: 'Monthly balance',
      nav_compare: 'Month vs Month',
      nav_reports: 'Reports',
      // Sidebar tools
      gmail_sync: 'Gmail · Sync',
      color_app: 'App color',
      theme_label: 'Theme',
      // Language toggle button
      lang_toggle_btn: 'Cambiar a Español',
      // Notification panel
      notifications: 'Notifications',
      notif_subtitle: 'Recent activity and useful alerts',
      // Create menu
      quick_actions: 'Quick actions',
      // Page titles
      page_settings: 'Settings',
      page_settings_sub: 'Operational configuration center for accounts, cards, rules, categories and integrations.',
      page_profile: 'Profile',
      page_profile_sub: 'Identity, preferences and data control in a full-width main view.',
      page_security: 'Security & data',
      page_security_sub: 'Control center for backups, restore, export and access permissions.',
      page_credit_card: 'Credit Card',
      page_reports: 'Reports',
      page_transactions: 'Transactions',
      page_transactions_sub: 'Your daily workspace to search, fix, categorize and close transactions effortlessly.',
      page_trends: 'Trends',
      page_insights: 'Insights',
      page_balance: 'Monthly balance',
      page_balance_sub: 'A single view to understand the month close, compare against the previous one and decide what to do next.',
      page_commitments: 'Commitments',
      page_commitments_sub: 'Fixed expenses · installments · subscriptions',
      page_categories: 'Categories',
      page_categories_sub: 'Expense groups and subcategories',
      page_income: 'Income',
      page_savings: 'Savings',
      page_import: 'Import data',
      page_import_sub: 'The main entry point for transactions: detect, review, fix and confirm from a simple flow.',
      page_import_history: 'Import history',
      page_import_history_sub: 'Dedicated screen to review source, date and imported volume.',
      page_reconciliation: 'Statement reconciliation',
      page_reconciliation_sub: 'Compare your recorded expenses with an official PDF statement.',
      page_search: 'Global search',
      page_search_sub: 'Transactions, categories, installments, subscriptions, quick access and security.',
      // Settings page sections
      card_settings_title: 'Card settings',
      manage_cards: 'Manage cards',
      view_cycles: 'View cycles',
      cat_mgmt_title: 'Category management',
      cat_mgmt_copy1: 'Organize and edit your categories in a more comfortable view',
      cat_mgmt_copy2: 'Open the dedicated screen to create new ones, move them between groups or clean up the ones you no longer use.',
      cat_tag_create: 'Create',
      cat_tag_edit: 'Edit',
      cat_tag_reorder: 'Reorder',
      cat_tag_delete: 'Delete',
      open_categories_btn: 'Open category management',
      create_new_btn: 'Create new',
      gmail_rules_title: 'Gmail rules & automation',
      new_rule_btn: 'New rule',
      test_sync_btn: 'Test sync',
      // Profile page
      choose_avatar: 'Choose avatar',
      uploaded_image: 'Uploaded image',
      preset_avatar: 'Preset avatar',
      personal_info: 'Personal information',
      name_label: 'Name',
      preferences_title: 'Preferences',
      main_currency: 'Main currency',
      language_label: 'Language',
      visual_theme: 'Visual theme',
      save_changes: 'Save changes',
      save_preferences: 'Save preferences',
      account_control: 'Account control',
      upload_image_btn: 'Upload image',
      remove_btn: 'Remove',
      export_backup: 'Export backup',
      reset_data: 'Reset data',
    }
  };

  // ── Core translation function ──
  function t(key, lang) {
    const l = lang || window.state?.userPrefs?.language || 'es';
    const dict = translations[l] || translations.es;
    return dict[key] !== undefined ? dict[key] : (translations.es[key] || key);
  }

  // ── Apply all translations to the DOM ──
  function applyLanguage(lang) {
    if (!lang) lang = window.state?.userPrefs?.language || 'es';
    const T = translations[lang] || translations.es;

    // Update text content of [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (T[key] !== undefined) el.textContent = T[key];
    });

    // Update placeholder of [data-i18n-placeholder] elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (T[key] !== undefined) el.placeholder = T[key];
    });

    // Set html lang attribute
    document.documentElement.lang = lang;

    // Sync language selects so they stay in sync
    const pfLang = document.getElementById('pf-lang');
    if (pfLang) pfLang.value = lang;
    const settingsLang = document.getElementById('settings-language');
    if (settingsLang) settingsLang.value = lang;

    // Update state
    if (window.state?.userPrefs) window.state.userPrefs.language = lang;
  }

  // ── Called from the language dropdown (instant apply) ──
  function applyLanguageFromPref(lang) {
    if (window.state?.userPrefs) window.state.userPrefs.language = lang;
    applyLanguage(lang);
    window.saveState?.();
    const msg = lang === 'en'
      ? '🌐 Language switched to English'
      : '🌐 Idioma cambiado a Español';
    window.showToast?.(msg, 'success');
  }

  // ── Toggle between es and en ──
  function toggleLanguage() {
    const current = window.state?.userPrefs?.language || 'es';
    const next = current === 'es' ? 'en' : 'es';
    applyLanguageFromPref(next);
  }

  // Expose globally
  window.t = t;
  window.applyLanguage = applyLanguage;
  window.applyLanguageFromPref = applyLanguageFromPref;
  window.toggleLanguage = toggleLanguage;
})();
