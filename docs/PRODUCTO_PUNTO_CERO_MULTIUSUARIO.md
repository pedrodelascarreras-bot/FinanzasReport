# Punto Cero de Producto: abrir Finanzas App a otras personas

Fecha: 2026-04-05

Este documento resume el trabajo hecho para que la app deje de estar pensada solo para Pedro y empiece a poder ser usada por otras personas con sus propios datos, bancos, tarjetas y reglas de captura.

## Objetivo general

Transformar la app de:

- dashboard financiero personal de un solo usuario

a:

- plataforma configurable por perfil
- con distintas maneras de capturar gastos
- preparada para onboarding
- preparada para múltiples bancos y múltiples personas

## Qué ya quedó implementado

### 1. Configuración como centro real

Se rediseñó la pantalla de Configuración para que funcione como hub de producto y no como un simple acceso a páginas sueltas.

Hoy incluye base para:

- onboarding guiado
- conexión con Google
- reglas Gmail
- importación universal
- perfiles bancarios
- automatizaciones
- perfiles de usuario

Idea clave:

- que una persona nueva pueda entrar primero a Configuración y desde ahí preparar su cuenta sin tocar cosas técnicas.

### 2. Onboarding guiado

Se agregó un onboarding con pasos reales, no decorativos.

Pasos base:

- identidad / nombre
- perfil de uso
- conexión con Google
- reglas de captura
- banco / tarjeta
- ingresos base

Objetivo:

- bajar la fricción inicial
- dejar al usuario listo para empezar a importar o registrar movimientos

### 3. Conexión con Google y reglas Gmail

Se reforzó el flujo de Google para que:

- la app pueda conectarse con una cuenta Google
- se puedan definir reglas Gmail por usuario
- cada regla apunte a remitentes, consultas o bancos concretos

Esto deja sentada la base para el flujo ideal:

- conecto Google
- defino qué mails mirar
- asocio esas alertas a una tarjeta o banco
- la app detecta y propone importaciones

### 4. Importación universal

Se empezó a desacoplar la importación de un único banco.

Ya quedó base para:

- texto pegado
- archivo / CSV
- Gmail / alertas
- carga manual

Y además:

- `importConfig` persistido
- elección de perfil bancario activo
- elección de modo de parser

Parsers base ya preparados:

- `santander_auto`
- `generic_text`
- `generic_csv`

Objetivo:

- que cualquier persona pueda importar aunque su banco no sea igual al flujo original.

### 5. Perfiles bancarios

Se agregaron perfiles bancarios configurables para guardar:

- banco
- tarjeta o cuenta
- método preferido de captura
- cierre
- vencimiento
- notas

Esto permite pensar la app por "fuente financiera" y no solo por una implementación fija.

### 6. Perfiles de usuario

Se agregó una base multiusuario real a nivel de configuración y estado.

Cada perfil puede guardar:

- nombre
- template de uso
- reglas Gmail
- perfiles bancarios
- importConfig
- automatizaciones
- ingresos
- tarjetas y ciclos
- categorías y reglas
- layout del dashboard
- onboarding

También se agregó:

- guardar perfil activo
- aplicar perfil
- duplicar perfil

### 7. Aislamiento real de datos por perfil activo

Se avanzó sobre la separación real de datos por perfil.

Hoy ya quedó preparado para que cada perfil arrastre sus propios datos operativos en vez de compartir una sola bolsa global.

Cobertura implementada:

- movimientos
- importaciones
- cuotas
- suscripciones
- gastos fijos
- reglas Gmail
- perfiles bancarios
- ingresos y meses de ingreso
- tarjetas y ciclos
- ahorro, metas y depósitos
- reglas de categorización
- layout del dashboard

Además:

- nuevas importaciones quedan marcadas con `ownerProfileId`
- nuevos gastos manuales también
- se agregó bootstrap automático de perfil activo para datos viejos

### 8. Bootstrap automático de perfil activo

Se agregó una capa para que, si la app arranca con datos históricos pero sin perfil activo válido:

- cree automáticamente un `Perfil principal`
- asigne ownership a los datos que no lo tenían
- deje el perfil persistido

Esto evita que el multiusuario dependa de una acción manual del usuario para empezar a funcionar.

### 9. Dashboard más personalizable

Se rediseñó el editor de dashboard y después se simplificó para acercarlo más a una lógica tipo iPhone widgets.

Hoy ya existe base para:

- mover widgets
- ocultarlos
- cambiar tamaños
- guardar vistas
- editar diseño

Esto es importante porque una app para distintas personas necesita dashboards distintos.

### 10. Insights más fuertes

Se mejoró la pestaña de Insights con nuevas vistas como:

- modo ahorro
- salud y patrimonio

Esto ayuda a que distintos perfiles de usuario tengan valor más allá del simple registro de gastos.

### 11. Automatizaciones

Se dejó una base visible de automatizaciones dentro de Configuración.

Hoy ya hay estructura para preferencias como:

- reporte semanal
- alertas de gasto
- recordatorio de backup
- recordatorio de cierre de tarjeta

Todavía queda profundizar su ejecución y UX.

## Qué falta para que esto sea realmente "para cualquiera"

### A. Importación universal más robusta

Aunque la base ya está, todavía falta llevarla a un nivel más sólido.

Pendientes:

- detectar mejor formatos variados de texto
- mejorar soporte CSV de distintos bancos
- preview más inteligente antes de importar
- asistentes más específicos por banco

### B. Multiusuario con QA funcional total

La base está muy avanzada, pero hay que hacer una pasada pantalla por pantalla para verificar que ninguna sección siga leyendo algo global por accidente.

QA recomendado:

- Dashboard
- Movimientos
- Compromisos
- Ingresos
- Ahorros
- Insights
- Reportes
- Configuración
- Importar

### C. Configuración todavía más producto

Pendientes lógicos:

- defaults por usuario
- banco principal
- moneda base
- formato de resumen preferido
- método favorito de captura
- más parámetros de tarjetas

### D. Automatizaciones reales

La estructura ya está, pero falta volverla más concreta:

- ejecutar acciones automáticas visibles
- mejores reglas
- más feedback al usuario

### E. Editor de widgets todavía más potente

Hay base, pero falta profundizar:

- variantes visuales
- constructor más visual
- presets más claros
- preview más simple

## Qué no se priorizó ahora

A pedido del usuario, no se priorizaron por ahora:

- objetivos financieros detallados
- metas de producto relacionadas con punto 4 y 5 del roadmap anterior

Sí se decidió priorizar:

- configuración
- onboarding
- sincronización
- importación
- multiusuario
- automatizaciones
- historial/score dentro de Insights

## Próximo paso recomendado al retomar este tema

Cuando retomemos, el mejor siguiente bloque es:

1. QA funcional del aislamiento por perfil activo
2. endurecer importación universal
3. profundizar automatizaciones
4. seguir profesionalizando Configuración

## Nota técnica

Gran parte de esta base quedó implementada por código, pero en este entorno no se pudo correr validación runtime con Node. Al retomar, conviene hacer una pasada real de prueba manual usando:

- perfil principal
- perfil duplicado
- datos distintos en cada uno
- cambio de perfil
- prueba de Dashboard / Importar / Insights / Reportes

