# Fluxen — finanzas personales

App web (HTML + JS sin framework) para seguir gastos, cuotas, suscripciones, gastos fijos,
ingresos y ahorros. Los datos viven en el navegador; Google es opcional.

## Cómo se usa

- **Entrada:** PIN de 4 dígitos (se crea la primera vez). Ver `js/lock.js`.
- **Datos:** se guardan en el navegador (`localStorage`). Conectando Google se respaldan en
  Google Drive (carpeta privada de la app) y se pueden importar consumos desde Gmail.
  Si hay cambios locales sin subir, conectar Google no los pisa (`js/state.js`).
- **Importar:** CSV, texto pegado del resumen o Gmail. La categorización es por reglas
  y solo completa movimientos sin categoría.

## Cómo se calculan los números

- **Totales de un período** (mes o ciclo de tarjeta): una sola función,
  `getPeriodTotals` en `js/totals.js`, que usan todas las pantallas.
  Suma movimientos reales + compromisos ya vencidos que todavía no tienen su cargo real.
  Vista tarjeta: Visa = visa, tarjeta genérica o sin medio de pago; Amex aparte.
  Gastos compartidos: tu parte en todas las pantallas, salvo Tarjetas (monto completo).
- **Proyección al cierre:** `getPeriodProjection` — extrapola solo el gasto variable;
  cuotas, suscripciones y fijos se suman una vez.
- **Cuotas:** fuente única `state.cuotas`, cada una con su calendario
  (`getCuotaStatus` en `js/expenses.js`).

## Desarrollo

```bash
npm test
```

Corre las pruebas con JavaScriptCore (viene con macOS, no hace falta Node):
cuotas, totales y consistencia entre pantallas.
