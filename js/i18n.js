// ══ INTERNATIONALIZATION (i18n) — solo español ══
(function () {
  const translations = {
    nav_tendencias: 'Tendencias',
    nav_transactions: 'Movimientos',
    nav_commitments: 'Compromisos',
    nav_income: 'Ingresos',
    nav_savings: 'Ahorros',
    nav_credit_card: 'Tarjeta de crédito',
    nav_balance: 'Balance mensual',
    nav_compare: 'Mes vs Mes',
    nav_reports: 'Reportes',
    gmail_sync: 'Gmail · Sincronizar',
    color_app: 'Color de la app',
    theme_label: 'Tema',
    notifications: 'Notificaciones',
    notif_subtitle: 'Actividad reciente y alertas útiles',
    quick_actions: 'Acciones rápidas',
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
    global_total_spent: 'GASTO TOTAL',
    global_ars_spent: 'GASTO ARS',
    global_usd_spent: 'GASTO USD',
    global_available_margin: 'MARGEN DISPONIBLE',
    global_payment_methods: 'MEDIOS DE PAGO',
    global_official_dollar: 'DÓLAR OFICIAL',
    global_live_agenda: 'Agenda viva',
    global_spending_evolution: 'Evolución del gasto',
    global_month_categories: 'Categorías del mes',
    global_rising_category: 'CATEGORÍA EN ALZA',
    global_closest_goal: 'META MÁS CERCANA',
    global_period_income: 'INGRESO DEL PERÍODO',
    global_usd_exposure: 'EXPOSICIÓN USD',
    global_highest_expense: 'GASTO MÁS ALTO',
    global_card_close: 'Cierre tarjeta',
    global_card_due: 'Vencimiento tarjeta',
    global_subscription: 'Suscripción',
    global_fixed_expense: 'Gasto fijo',
    global_next_installment: 'Próxima cuota',
    global_date: 'Fecha',
    global_description: 'Descripción',
    global_category: 'Categoría',
    global_method: 'Medio',
    global_amount: 'Monto',
    global_all_months: 'Todos los meses',
    global_all_categories: 'Todas las categorías',
    global_no_results: 'Sin resultados',
    global_decision_center: 'CENTRO DE DECISIONES',
    global_alerts_center: 'CENTRO DE ALERTAS Y DECISIONES',
    splash_good_morning: 'Buenos días',
    splash_good_afternoon: 'Buenas tardes',
    splash_good_evening: 'Buenas noches',
    splash_preparing: 'Preparando tu día...',
    tab_title_dashboard: 'Finanzas · Dashboard',
    all_categorized: '✓ Todos los movimientos están categorizados',
    marked_not_duplicate: '✓ Marcados como gastos distintos',
    desktop_only_page: 'Esa pantalla quedó disponible solo en desktop',
    month_1: 'Enero', month_2: 'Febrero', month_3: 'Marzo', month_4: 'Abril',
    month_5: 'Mayo', month_6: 'Junio', month_7: 'Julio', month_8: 'Agosto',
    month_9: 'Septiembre', month_10: 'Octubre', month_11: 'Noviembre', month_12: 'Diciembre',
    day_0: 'Domingo', day_1: 'Lunes', day_2: 'Martes', day_3: 'Miércoles', day_4: 'Jueves', day_5: 'Viernes', day_6: 'Sábado'
  };

  function t(key) {
    return translations[key] !== undefined ? translations[key] : key;
  }

  function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[key] !== undefined) el.textContent = translations[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (translations[key] !== undefined) el.placeholder = translations[key];
    });
    document.documentElement.lang = 'es';
    if (translations['tab_title_dashboard']) {
      document.title = translations['tab_title_dashboard'];
      const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (metaTitle) metaTitle.content = translations['tab_title_dashboard'].split(' · ')[0];
    }
    if (window.state) {
      if (!window.state.userPrefs) window.state.userPrefs = {};
      window.state.userPrefs.language = 'es';
    }
  }

  window.t = t;
  window.applyLanguage = applyLanguage;
  window.applyLanguageFromPref = function() {};
  window.toggleLanguage = function() {};
  window.translateDOM = function() {};

})();
