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
      // Dynamic strings
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
      // month/days
      month_1: 'Enero', month_2: 'Febrero', month_3: 'Marzo', month_4: 'Abril',
      month_5: 'Mayo', month_6: 'Junio', month_7: 'Julio', month_8: 'Agosto',
      month_9: 'Septiembre', month_10: 'Octubre', month_11: 'Noviembre', month_12: 'Diciembre',
      day_0: 'Domingo', day_1: 'Lunes', day_2: 'Martes', day_3: 'Miércoles', day_4: 'Jueves', day_5: 'Viernes', day_6: 'Sábado'
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
      // Dynamic strings
      global_total_spent: 'TOTAL SPENT',
      global_ars_spent: 'ARS SPENT',
      global_usd_spent: 'USD SPENT',
      global_available_margin: 'AVAILABLE MARGIN',
      global_payment_methods: 'PAYMENT METHODS',
      global_official_dollar: 'OFFICIAL DOLLAR',
      global_live_agenda: 'Live Agenda',
      global_spending_evolution: 'Spending Evolution',
      global_month_categories: 'Month Categories',
      global_rising_category: 'RISING CATEGORY',
      global_closest_goal: 'CLOSEST GOAL',
      global_period_income: 'PERIOD INCOME',
      global_usd_exposure: 'USD EXPOSURE',
      global_highest_expense: 'HIGHEST EXPENSE',
      global_card_close: 'Card Close',
      global_card_due: 'Card Due',
      global_subscription: 'Subscription',
      global_fixed_expense: 'Fixed expense',
      global_next_installment: 'Next installment',
      global_date: 'Date',
      global_description: 'Description',
      global_category: 'Category',
      global_method: 'Method',
      global_amount: 'Amount',
      global_all_months: 'All months',
      global_all_categories: 'All categories',
      global_no_results: 'No results',
      global_decision_center: 'DECISION CENTER',
      global_alerts_center: 'ALERTS & DECISIONS CENTER',
      splash_good_morning: 'Good morning',
      splash_good_afternoon: 'Good afternoon',
      splash_good_evening: 'Good evening',
      splash_preparing: 'Preparing your day...',
      tab_title_dashboard: 'Finance · Dashboard',
      all_categorized: '✓ All transactions are categorized',
      marked_not_duplicate: '✓ Marked as unique expenses',
      desktop_only_page: 'That screen is only available on desktop',
      // month/days
      month_1: 'January', month_2: 'February', month_3: 'March', month_4: 'April',
      month_5: 'May', month_6: 'June', month_7: 'July', month_8: 'August',
      month_9: 'September', month_10: 'October', month_11: 'November', month_12: 'December',
      day_0: 'Sunday', day_1: 'Monday', day_2: 'Tuesday', day_3: 'Wednesday', day_4: 'Thursday', day_5: 'Friday', day_6: 'Saturday'
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

    // Set document title
    if (T['tab_title_dashboard']) {
      document.title = T['tab_title_dashboard'];
      const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (metaTitle) metaTitle.content = T['tab_title_dashboard'].split(' · ')[0];
    }

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
    
    // For widgets that need re-rendering
    if(window.renderDashboard) window.renderDashboard();
    if(window.renderTransactions) window.renderTransactions();
    
    // Auto translate dom if switching or rendering
    setTimeout(() => {
        if(window.translateDOM) window.translateDOM();
    }, 50);
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

  // ── Auto-translate DOM for English Demo ──
  const DEMO_EN_DICT = {
    'Suscripciones': 'Subscriptions',
    'Ingreso consolidado del período': 'Consolidated income for the period',
    'Prioridades claras para ': 'Clear priorities for ',
    'Aparece cuando hay movimientos reales en el período': 'Appears when there are real transactions in the period',
    'Gasto mensual': 'Monthly expense',
    'Gasto semanal': 'Weekly expense',
    'Gasto diario': 'Daily expense',
    'Ingreso consolidado del período activo': 'Consolidated income of active period',
    'Tu ticket individual más pesado del período activo': 'Your heaviest individual ticket of the active period',
    'El período viene estable': 'The period is stable',
    'El ritmo del período está bajo control': 'The period rhythm is under control',
    'El ritmo actual proyecta cierre en rojo': 'Current rhythm projects closing in red',
    'Gasto fijo': 'Fixed expense',
    'Buscar, revisar y corregir movimientos': 'Search, review and correct transactions',
    'Ordenar movimientos': 'Sort transactions',
    'Definí el ingreso mensual para activar decisiones más precisas': 'Define monthly income to enable precise decisions',
    'Definí tu base de ingresos': 'Define your income base',
    'Ya estás al límite': 'You are already at the limit',
    'Todavía tenés margen': 'You still have margin',
    'Cuánto ya está tomado antes de arrancar el próximo período': 'How much is already taken before starting the next period',
    'Porcentaje del ingreso comprometido': 'Percentage of committed income',
    'Ciclos, vencimientos y detalle de tarjetas': 'Cycles, expirations and card details',
    'Marcá un movimiento como tercero para seguirlo acá': 'Mark a transaction as third-party to track it here',
    'No hay gastos de terceros': 'No third-party expenses',
    'Tu ritmo diario promedio usando toda la historia': 'Your average daily rhythm using all history',
    'Tu gasto mensual promedio con toda la historia': 'Your average monthly expense with all history',
    'Rutina financiera': 'Financial routine',
    'Gastos manuales': 'Manual expenses',
    'Gastos de terceros': 'Third-party expenses',
    'Presión semanal': 'Weekly pressure',
    'Volumen operativo': 'Operational volume',
    'Concentración': 'Concentration',
    'Ritmo alto para este mes': 'High rhythm for this month',
    'Seguir monitoreando': 'Keep monitoring',
    'Sin urgencias': 'No urgencies',
    'Semana despejada': 'Clear week',
    'Control de ritmo': 'Rhythm control',
    'El ticket individual más alto del período': 'The highest individual ticket of the period',
    'Zona de control': 'Control zone',
    'Palanca principal': 'Main lever',
    'Cierre estimado al ritmo actual': 'Estimated close at current rhythm',
    'Lo que todavía podés gastar sin pasarte del objetivo': 'What you can still spend without exceeding the target',
    'Proyección automática del período activo': 'Automatic projection of active period',
    'Calidad de datos': 'Data quality',
    'Backup desactualizado': 'Outdated backup',
    'Backup al día': 'Backup up to date',
    'Exportar una copia de seguridad ahora': 'Export a backup now',
    'Conviene renovar backup': 'Advisable to renew backup',
    'Sin datos cargados en este ciclo': 'No data loaded in this cycle',
    'Sin gastos de terceros por ahora': 'No third-party expenses for now',
    'Todas las categorías': 'All categories',
    'Todos los meses': 'All months',
    'Sin movimientos aún': 'No transactions yet',
    'Todavía no hay movimientos para revisar. Importá datos o cargá un gasto manual para empezar a ordenar el día a día.': 'No transactions to review yet. Import data or add a manual expense to start organizing your day.',
    'Limpiar búsqueda': 'Clear search',
    'Importar datos': 'Import data',
    'Nuevo gasto': 'New expense',
    'Sin ciclo activo': 'No active cycle',
    'Sin conexión': 'No connection',
    'Sin resultados': 'No results',
    'Efectivo': 'Cash',
    'Débito': 'Debit',
    'Tarjeta': 'Card',
    'Tarjeta de crédito': 'Credit card',
    'Ahorro': 'Savings',
    'Ahorros': 'Savings',
    'Terceros': 'Third parties',
    'Otros': 'Others',
    'Siguiente paso': 'Next step',
    'Resolver': 'Resolve',
    'Ver detalle': 'View details',
    'Ver tendencias': 'View trends',
    'Abrir insights': 'Open insights',
    'Abrir tarjetas': 'Open cards',
    'Abrir ingresos': 'Open income',
    'Volver al tablero principal': 'Back to main board',
    'Cierre tarjeta': 'Card closing',
    'Vencimiento tarjeta': 'Card expiration',
    'Próxima cuota': 'Next installment',
    'Próximo cobro': 'Next payment',
    'Ritmo estimado al cierre mensual': 'Estimated rhythm at monthly close',
    'Categoría líder': 'Leading category',
    'Mes cerrado': 'Closed month',
    'Lectura general': 'General reading',
    'Alerta real': 'Real alert',
    'Suscripción': 'Subscription',
    'Cuotas': 'Installments',
    'Compromisos': 'Commitments',
    'Gasto de terceros': 'Third-party expense',
    'Sin movimientos este mes': 'No transactions this month',
    'Sin categoría': 'No category',
    'Sin grupo': 'No group',
    'Uncategorized': 'Uncategorized',
    'Nuevo grupo': 'New group',
    'Renombrar grupo': 'Rename group',
    'Eliminar grupo': 'Delete group',
    'Nueva categoría': 'New category',
    'Editar categoría': 'Edit category',
    'Eliminar categoría': 'Delete category',
    'Categoría guardada': 'Category saved',
    'Categoría eliminada': 'Category deleted',
    'Grupo eliminado': 'Group deleted',
    'Atajos': 'Shortcuts',
    'Agenda': 'Agenda',
    'Saldo': 'Balance',
    'Movimientos': 'Transactions',
    'Presupuesto': 'Budget',
    'Notas': 'Notes',
    'Dashboard': 'Dashboard',
    'Fin de mes': 'End of month',
    'Hoy': 'Today',
    'Mañana': 'Tomorrow',
    'Nunca': 'Never',
    'Todo': 'All',
    'Todos': 'All',
    'Activa': 'Active',
    'Pausada': 'Paused',
    'Activar': 'Activate',
    'Pausar': 'Pause',
    'Premium': 'Premium',
    'Configuración': 'Settings',
    'Config': 'Config',
    'Perfil actualizado': 'Profile updated',
    'Cuenta eliminada': 'Account deleted',
    'Diseño restablecido': 'Design reset',
    'Preferencias guardadas': 'Preferences saved',
    'Gasto agregado': 'Expense added',
    'Gasto eliminado': 'Expense deleted',
    'Conectá tu cuenta de Google': 'Connect your Google account',
    'Tu cuenta ya está sincronizada. Podés continuar al dashboard.': 'Your account is already synchronized. You can continue to the dashboard.',
    'Sincronizá tus datos bancarios y accedé desde cualquier dispositivo.': 'Synchronize your bank data and access from any device.',
    'Continuar': 'Continue',
    'Contectar con Google': 'Connect with Google',
    'Saldo actual': 'Current balance',
    'Total gastado': 'Total spent',
    'Sin margen calculado': 'No margin calculated',
    'Necesitás más historial': 'You need more history',
    'Comparador de tarjetas': 'Card comparator',
    
    // Additional strings from screenshots
    'CENTRO DE ALERTAS Y DECISIONES': 'ALERTS AND DECISIONS CENTER',
    'Alertas reales y próximos pasos para': 'Real alerts and next steps for',
    'Última copia hace': 'Last backup was',
    'Tener una copia reciente te protege antes de grandes cambios o importaciones.': 'Having a recent backup protects you before big changes or imports.',
    'del ingreso': 'of income',
    'Te quedan': 'You have left',
    'disponibles': 'available',
    'Presupuesto': 'Budget',
    'PROMEDIO / DÍA': 'AVERAGE / DAY',
    'ESTIMACIÓN ACTIVA HASTA': 'ACTIVE ESTIMATION UNTIL',
    'Mostrando': 'Showing',
    'movimientos': 'transactions',
    'FECHA': 'DATE',
    'DESCRIPCIÓN': 'DESCRIPTION',
    'CATEGORÍA': 'CATEGORY',
    'MEDIO': 'METHOD',
    'MONTO': 'AMOUNT',
    'Cambiar a Español': 'Switch to Spanish',
    'Crear regla': 'Create rule',
    'Revisar categorías': 'Review categories',
    'Buscar descripción, mo': 'Search description, am', // placeholder prefix
    'Por mes': 'By month',
    'Todas las categorías': 'All categories',
    'Mes': 'Month',
    'Editar diseño': 'Edit layout',
    'APERTURA': 'OPENING',
    'CIERRE': 'CLOSING',
    'VENCIMIENTO': 'EXPIRATION',
    'TOTAL SPENT': 'TOTAL SPENT',
    'ARS SPENT': 'ARS SPENT',
    'USD SPENT': 'USD SPENT',
    'AVAILABLE MARGIN': 'AVAILABLE MARGIN',
    'PAYMENT METHODS': 'PAYMENT METHODS',
    'CICLO TARJETAS': 'CARD CYCLES',
    'PROYECCIÓN AL CIERRE': 'CLOSING PROJECTION',
    'ALERTAS': 'ALERTS',
    'TAREA': 'TASK',
    'LECTURA ASISTIDA': 'ASSISTED READING',
    'MOSTRAR': 'SHOW',
    'Ocultar': 'Hide',
    'Ver detalle de gastos': 'View expense details',
    'Ciclo actual': 'Current cycle',
    'Todas': 'All',
    'Duplicados': 'Duplicates',
    'De terceros': 'Third-party',
    'Sin categoría': 'Uncategorized',
    
    // Dates & Months (Lowercase / Capitalized / Uppercase)
    ' de mar de ': ' of Mar ',
    ' de abr de ': ' of Apr ',
    ' de may de ': ' of May ',
    ' de jun de ': ' of Jun ',
    ' de jul de ': ' of Jul ',
    ' de ago de ': ' of Aug ',
    ' de sep de ': ' of Sep ',
    ' de oct de ': ' of Oct ',
    ' de nov de ': ' of Nov ',
    ' de dic de ': ' of Dec ',
    ' de ene de ': ' of Jan ',
    ' de feb de ': ' of Feb ',
    'Enero': 'January', 'Febrero': 'February', 'Marzo': 'March', 'Abril': 'April',
    'Mayo': 'May', 'Junio': 'June', 'Julio': 'July', 'Agosto': 'August',
    'Septiembre': 'September', 'Octubre': 'October', 'Noviembre': 'November', 'Diciembre': 'December',
    'enero': 'january', 'febrero': 'february', 'marzo': 'march', 'abril': 'april',
    'mayo': 'may', 'junio': 'june', 'julio': 'july', 'agosto': 'august',
    'septiembre': 'september', 'octubre': 'october', 'noviembre': 'november', 'diciembre': 'december',
    'ENERO': 'JANUARY', 'FEBRERO': 'FEBRUARY', 'MARZO': 'MARCH', 'ABRIL': 'APRIL',
    'MAYO': 'MAY', 'JUNIO': 'JUNE', 'JULIO': 'JULY', 'AGOSTO': 'AUGUST',
    'SEPTIEMBRE': 'SEPTEMBER', 'OCTUBRE': 'OCTOBER', 'NOVIEMBRE': 'NOVEMBER', 'DICIEMBRE': 'DECEMBER',
    ' d\u00edas': ' days', // ' días'
    ' d\u00eda': ' day', // ' día'
    // Ensure boundary space for " de " inside dates etc
    ' de ': ' of '
  };

  let _translating = false;
  window.translateDOM = function() {
    if(document.documentElement.lang !== 'en') return; // Only translate when English
    if(_translating) return;
    _translating = true;
    
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const keys = Object.keys(DEMO_EN_DICT).sort((a,b)=>b.length - a.length);
    
    while(node = walker.nextNode()) {
      const text = node.nodeValue;
      if(!text) continue;
      const tTrim = text.trim();
      if(!tTrim) continue;
      
      // Exact match
      if(DEMO_EN_DICT[tTrim]) {
         node.nodeValue = text.replace(tTrim, DEMO_EN_DICT[tTrim]);
         continue;
      }
      
      // Partial matches
      let newText = text;
      for(let k of keys) {
        if(newText.includes(k)) {
          // Use split/join instead of regex to avoid escaping issues
          newText = newText.split(k).join(DEMO_EN_DICT[k]);
        }
      }
      if(newText !== text) {
        node.nodeValue = newText;
      }
    }
    
    // Also translate placeholders
    document.querySelectorAll('input,textarea').forEach(inp => {
       if(inp.placeholder) {
         let pText = inp.placeholder;
         for(let k of keys) {
           if(pText.includes(k)) pText = pText.split(k).join(DEMO_EN_DICT[k]);
         }
         if(pText !== inp.placeholder) inp.placeholder = pText;
       }
    });

    _translating = false;
  };

  // Setup mutation observer to automatically translate any newly injected HTML
  document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(mutations => {
       if(document.documentElement.lang !== 'en') return;
       // Only trigger translateDOM if real nodes were added
       let shouldTranslate = false;
       for(let m of mutations) {
         if(m.addedNodes.length > 0) shouldTranslate = true;
       }
       if(shouldTranslate) {
         // Debounce translation
         clearTimeout(window._domTranslateTimer);
         window._domTranslateTimer = setTimeout(window.translateDOM, 10);
       }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial paint translation
    setTimeout(window.translateDOM, 500);
  });

})();

