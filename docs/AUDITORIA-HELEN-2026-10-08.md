# Auditoría HELEN y correcciones — 8 de octubre de 2026

## Dictamen

El proyecto tenía fallos relevantes de aislamiento de sesiones, recuperación de datos, concurrencia de seguridad y entrega de avisos. Los controles existentes no bastaban para detectar esos escenarios. Se han aplicado correcciones y regresiones en el checkout local; no se ha publicado ni ejecutado SQL contra una base de producción.

La validación de tipos, lint, 439 pruebas y bundle de producción pasa. La batería completa de navegador aprobó 86/88; las dos interrupciones por tiempo y la regresión de familias grandes aprobaron en la repetición focalizada con presupuestos ajustados. Se cubrieron los resultados funcionales de los 88 escenarios; no se presenta esa combinación como una única ejecución completa con exit 0. Una publicación requiere comprobar las migraciones y los flujos con PostgreSQL, además de las pruebas locales descritas aquí.

## Alcance y criterios

Se revisaron los seis ejes de HELEN: funcionalidad y recorridos; profundidad de verificación; fallo y recuperación; contratos e invariantes; rendimiento y observabilidad; experiencia de desarrollo y veracidad de las afirmaciones. El punto de partida fue el commit `ec459b0575e6bc8b75a85021003acc7ed261e86d`.

Criterios observables:

- Una respuesta tardía de A no modifica datos, token ni estado de sesión de B.
- Una confirmación de sincronización conserva las ediciones y los borrados posteriores al envío.
- Un error de IndexedDB se muestra, mantiene el último estado pendiente y permite reintentar. Una lectura fallida no se interpreta como una base vacía.
- Los registros persistidos inválidos se apartan antes de las migraciones, conservando una copia original exacta y restringiendo su acceso a la cuenta correspondiente.
- Las importaciones inválidas no crean una parte del lote. Los precios, fechas, comillas y saltos de línea de CSV mantienen su significado.
- El segundo factor se consume una sola vez bajo concurrencia; otros escritores de preferencias no restauran su estado antiguo.
- Los avisos fallidos se reintentan y las ejecuciones de cron comparten un bloqueo en base de datos.
- La exportación PDF muestra los valores como texto; la CSP permite la conexión de GitHub necesaria para la interfaz.
- Las credenciales siguen la cuenta y se conservan al volver a entrar, conforme a la elección del usuario.
- Las vistas grandes limitan las tarjetas montadas; los diálogos manejan el foco y la interfaz se comprueba con Chromium, WebKit, distintas anchuras y movimiento reducido.

## Hallazgos prioritarios y medidas aplicadas

P1 significa impacto alto sobre datos, acceso o seguridad; P2, fallo significativo de funcionamiento, accesibilidad o verificación; P3, mantenimiento o claridad. El esfuerzo describe la intervención realizada, no una estimación de horas.

| Prioridad | Evidencia y efecto anterior | Corrección y archivos principales | Esfuerzo |
|---|---|---|---|
| P1 | Un pull o una respuesta de autenticación podía llegar después de cambiar de cuenta y actuar sobre la sesión nueva. | Identidad y generación de sesión comprobadas en push, pull, renovación, expiración y tiempo real. [src/sync/syncManager.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/sync/syncManager.ts), [src/store/useAppStore.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/store/useAppStore.ts). | Medio |
| P1 | Una confirmación antigua podía limpiar una preferencia editada mientras el envío seguía en vuelo. | Se compara el contenido y la marca de la instantánea enviada antes de quitar su estado pendiente. [src/sync/syncManager.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/sync/syncManager.ts). | Bajo |
| P1 | La confirmación de un borrado podía retirar un tombstone más reciente del mismo ID. | Se eliminan únicamente las instantáneas confirmadas, conservando versiones posteriores. [src/sync/syncManager.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/sync/syncManager.ts). | Bajo |
| P1 | IndexedDB ocultaba fallos y permitía interpretar una lectura fallida como ausencia de datos. | Escrituras serializadas, retención del último estado, aviso de fallo o demora, reintento y rechazo de hidratación insegura. [src/utils/idbStorage.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/idbStorage.ts), [src/components/ui/PersistenceStatusBanner.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/ui/PersistenceStatusBanner.tsx), [src/main.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/main.tsx). | Medio |
| P1 | Un título importado como objeto podía romper la aplicación y sus migraciones en el siguiente arranque. | Validación completa del lote, segunda validación al confirmar y recuperación antes de migrar el estado antiguo. Copia íntegra aparte antes de modificarlo. [src/utils/importValidation.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/importValidation.ts), [src/utils/persistedStateValidation.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/persistedStateValidation.ts), [src/store/useAppStore.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/store/useAppStore.ts). | Alto |
| P1 | Dos peticiones paralelas podían aceptar el mismo TOTP o código de recuperación mediante lectura y escritura separadas. | Consumo con compare-and-swap sobre preferencias y relectura ante conflicto. [server/security.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/security.ts), [server/routes/auth.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/routes/auth.ts). | Medio |
| P1 | Sincronización y registro de dispositivos podían escribir preferencias antiguas después de consumir un segundo factor. | Los escritores conservan el bloque de seguridad vigente y usan actualizaciones condicionales. Regresión que pausa sync, consume TOTP y reanuda sync. [server/routes/sync.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/routes/sync.ts), [server/security.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/security.ts). | Medio |
| P1 | Cambios de contraseña y actualización del hash podían sobrescribir operaciones concurrentes. | Condiciones sobre contraseña y preferencias anteriores; revalidación del acceso frente al estado vigente antes de emitir la sesión. [server/routes/auth.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/routes/auth.ts). | Medio |
| P1 | El enlace compartido público incluía la descripción privada de una tarea. | Proyección pública explícita que omite la descripción. [server/routes/share.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/routes/share.ts). | Bajo |
| P1 | Un envío push transitorio fallido podía avanzar el cursor y perder una alerta definitivamente. | El cursor solo avanza al confirmar el intervalo; se conservan los envíos confirmados al reintentar. [server/routes/cron.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/routes/cron.ts). | Medio |
| P1 | La deduplicación de alertas no identificaba de forma estable cada tarea y hora de disparo. | Registro por evento y etiqueta derivada de sus claves; varios avisos de una tarea conservan un único título en el resumen. [server/notifications.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/notifications.ts). | Medio |
| P1 | Un bloqueo de cron en memoria no coordinaba dos instancias del servidor. | Lease persistente con propietario, expiración, renovación y liberación condicional. Respuestas 429 si está ocupado y 503 si no puede reservarse. [server/routes/cron.ts](C:/Users/User/Desktop/ENEKO/recordatorios/server/routes/cron.ts), [prisma/schema.prisma](C:/Users/User/Desktop/ENEKO/recordatorios/prisma/schema.prisma). | Medio |
| P1 | Los valores de una tarea se interpolaban como HTML al imprimir/exportar PDF. | Escape de todos los campos dinámicos y conservación de saltos como texto. Regresión con cargas HTML maliciosas en el navegador de producción. [src/utils/pdfExport.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/pdfExport.ts). | Bajo |
| P1 | IA, Notion y GitHub leían claves globales después de cambiar de cuenta. | Almacenamiento por ID de cuenta, aislamiento del invitado, descarte de respuestas antiguas y cierre de los diálogos al cambiar de identidad. [src/utils/accountSettings.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/accountSettings.ts), [src/services/AIService.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/services/AIService.ts), [src/components/integrations/IntegrationsModal.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/integrations/IntegrationsModal.tsx), [src/components/ai/AIAssistantModal.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/ai/AIAssistantModal.tsx), [src/App.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/App.tsx). | Medio |
| P1 | Había dependencias transitivas vulnerables en el árbol instalado. | Actualización del lockfile y override compatible de `shell-quote`; comprobación con `npm audit`. `package.json`, `package-lock.json`. | Bajo |
| P2 | La importación CSV truncaba precios con separadores regionales y no trataba bien registros con saltos entre comillas. | Lectura de registros lógicos, comillas escapadas, precios españoles y estadounidenses, fechas de calendario y rechazo de valores ambiguos o inválidos. Conserva estado y duración de la exportación propia. [src/utils/importerParser.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/importerParser.ts). | Medio |
| P2 | La semana calculada como una duración fija podía fallar al cruzar el cambio horario. | Límites locales de lunes a lunes, con final exclusivo. Regresiones de horario de verano. [src/services/TaskService.ts](C:/Users/User/Desktop/ENEKO/recordatorios/src/services/TaskService.ts). | Bajo |
| P2 | La CSP publicada bloqueaba la comprobación de GitHub. | `https://api.github.com` en `connect-src`; preview con la misma CSP y comprobación real de la petición. `vercel.json`, `vite.config.ts`. | Bajo |
| P2 | El diálogo de integraciones no confinaba ni devolvía correctamente el foco; su disparador no era enfocable. | Foco inicial, ciclo de Tab, fondo inert, Escape, restauración y activación por teclado del perfil. [src/components/integrations/IntegrationsModal.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/integrations/IntegrationsModal.tsx), [src/components/layout/Sidebar.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/layout/Sidebar.tsx). | Medio |
| P2 | Etiquetas y contadores fallaban la medición de contraste en temas claro y oscuro. | Colores legibles de hábitos, indicadores y porcentajes de analítica; contraste comprobado con axe sobre la interfaz renderizada. [src/components/tasks/card/TaskHabitCounter.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/tasks/card/TaskHabitCounter.tsx), [src/components/analytics/AnalyticsView.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/analytics/AnalyticsView.tsx), [src/styles/polish.css](C:/Users/User/Desktop/ENEKO/recordatorios/src/styles/polish.css). | Bajo |
| P2 | Cada tarjeta recorría el conjunto completo de tareas para contar hijos y las vistas montaban todas las tarjetas. | Conteo compartido y páginas de hasta 100 tarjetas. Familias normales juntas y familias grandes repartidas conservando jerarquía. [src/components/layout/MainContent.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/layout/MainContent.tsx), [src/components/tasks/TaskCard.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/tasks/TaskCard.tsx). | Medio |
| P2 | Las pruebas de interfaz arrancaban con condiciones distintas de la publicación y esperas frágiles. | Preview de producción por defecto, hidratación explícita, configuración anterior al arranque, trazas de los fallos y WebKit real para iPhone. `playwright.config.ts`, [tests/support/bootApp.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/support/bootApp.ts), pruebas E2E. | Medio |
| P2 | Los fixtures asumían listas de plantilla que la limpieza inicial elimina; algunos selectores buscaban controles ya sustituidos. | Fixtures explícitos para las listas especiales; navegación y selectores del control real. Se mantienen las comprobaciones de resultados de calendario, tarjetas, importación y duración. [tests/e2e.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/e2e.spec.ts), [tests/calendario.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/calendario.spec.ts), [tests/pulido_final.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/pulido_final.spec.ts). | Bajo |
| P3 | La documentación prometía seguridad absoluta de los datos y un alcance de verificación superior al comando ejecutado. | Mensajes de recuperación precisos, hook coherente con sus controles, versión mínima de Node y documentación de E2E y migraciones. [src/components/ErrorBoundary.tsx](C:/Users/User/Desktop/ENEKO/recordatorios/src/components/ErrorBoundary.tsx), [.githooks/pre-push](C:/Users/User/Desktop/ENEKO/recordatorios/.githooks/pre-push), `README.md`. | Bajo |
| P3 | El verificador de despliegue usaba HTTPS incluso para su destino local HTTP. | Selección del transporte a partir de una URL validada. [scripts/verify-deploy.cjs](C:/Users/User/Desktop/ENEKO/recordatorios/scripts/verify-deploy.cjs). | Bajo |

## Descubrimientos durante la segunda revisión

Las regresiones iniciales llevaron a inspeccionar los consumidores y los recorridos de fallo. Esa revisión amplió las correcciones con evidencia concreta:

1. La validación al fusionar el estado era demasiado tarde: las migraciones antiguas accedían primero al título. La recuperación ahora ocurre antes de la migración y verifica que la copia original ya exista.
2. El respaldo y su descarga también necesitaban identidad: se limpia su referencia al salir o cambiar de cuenta y se vuelve a comprobar después de la lectura asíncrona.
3. Asignar una clave global antigua a la primera cuenta que la leyera habría trasladado el problema de aislamiento. Solo se migran claves con propietario registrado coincidente; las no atribuidas quedan conservadas y no se devuelven a ninguna cuenta automáticamente.
4. Un escritor de preferencias ajeno a 2FA podía restaurar un TOTP consumido. La prueba intercalada de sync y login cubre esa regresión.
5. Registrar un dispositivo podía traer una contraseña y versión de sesión posteriores a la comprobación inicial del login. El acceso se vuelve a verificar antes de emitir el token. Si 2FA se activa o cambia de secreto durante ese recorrido, la sesión exige prueba del segundo factor vigente.
6. El aviso de recuperación necesitaba ajuste en móvil. Se permite envolver texto y controles y se verifica a 375 px durante una recuperación real.
7. Se eliminó el registro de la URL con token de restablecimiento en el servidor de desarrollo.
8. La comprobación del CSV exportado por la propia app reveló pérdidas de estado y duración; se cubre ahora su recorrido de ida y vuelta.
9. La cola de sync se revisó también al eliminar definitivamente una tarea y al pedir sincronización de B mientras seguía pendiente A.
10. Guardar credenciales también ocultaba los fallos de almacenamiento. El resultado de escritura se propaga; Notion, GitHub e IA muestran el error y conservan el borrador sin afirmar que esté guardado.
11. La aplicación tenía otro temporizador de 4,5 segundos que forzaba la hidratación después de fallar la lectura. Se retiró y se bloquean las escrituras del almacén principal hasta fusionar correctamente los datos persistidos. La prueba de navegador conserva los bytes anteriores incluso tras esperar más que ese temporizador y después permite reintentar.

## Verificación y reproducibilidad

| Control | Estado | Evidencia y alcance |
|---|---|---|
| `npm run validate` | Aprobado | Prisma Client generado, `tsc -b`, oxlint, 54 archivos y 439 pruebas aprobadas, bundle de producción y service worker generados. |
| `npm audit --audit-level=high` | Aprobado | Cero vulnerabilidades informadas en el árbol instalado. |
| `git diff --check` | Aprobado | Sin errores de espacios en los cambios registrados por Git. |
| Regresiones de integraciones y escala | Aprobado | 5/5: foco y fondo inert, claves A → B → A, guardado rechazado, 1000 tareas y familia de 305 subtareas. |
| Lectura fallida durante el arranque | Aprobado | IndexedDB real en Chromium: bytes guardados idénticos durante el fallo, hidratación bloqueada y tarea recuperada después de reintentar. |
| Chromium y WebKit con bundle de producción | Aprobado con repetición focalizada | 86/88 en la batería completa de 14 minutos, incluidos 4/4 en WebKit; 3/3 en la repetición de 2 minutos con los dos plazos ajustados y la familia grande. Las mismas comprobaciones funcionales de los 88 escenarios quedan cubiertas. Backend en memoria y CSP del despliegue. |
| Verificador de despliegue con HTTP local | Aprobado | `/api/health` respondió 200 en el backend efímero; se verificó la selección correcta del transporte. |
| SQL y concurrencia con PostgreSQL real | No disponible localmente | Docker no tiene daemon operativo. CI tiene PostgreSQL efímero y aplica las migraciones, pero ese job remoto no se ejecutó desde esta sesión. |
| Entorno hospedado y entrega push real | No ejecutado | No se solicitó publicación ni se utilizaron proveedores reales para estas pruebas. |

Oxlint terminó con 158 advertencias y sin bloquear el gate; se mantienen registradas como deuda de mantenimiento. El bundle principal mide 615,52 kB, 166,08 kB con gzip. El precache contiene 47 entradas y 2466,72 KiB. Estos valores describen esta compilación; no son medidas de latencia de usuario.

Comandos reproducibles:

Los controles locales se ejecutaron en Windows con Node 24.19.0. El CI configura Ubuntu y Node 22; su ejecución remota no forma parte de los resultados locales de este informe.

WebKit dispone de un presupuesto de 120 segundos para el recorrido completo. Las trazas mostraron más de 30 segundos de arranque en esta máquina antes de visitar las seis vistas; el plazo anterior de 30/60 segundos abortaba operaciones ya iniciadas. Se mantienen todas las comprobaciones de desbordamiento, controles, fuentes y zoom. Este control es funcional y no define un objetivo de latencia del producto.

La ejecución completa más reciente terminó con 86 aprobadas y dos interrupciones por el plazo global. En el gesto móvil, las llamadas de movimiento terminaron después del plazo y las comprobaciones finales confirmaron la vuelta a las listas; el recorrido completo duró 34,4 segundos. En la prueba de 1000 tareas, la instantánea estaba en «Página 4 de 10» al agotarse el plazo, sin infringir el límite en las páginas comprobadas. Se asignaron 60 segundos al gesto y 90 al recorrido de las diez páginas; no se alteraron los gestos, el volumen de datos ni las aserciones.

La repetición final aprobó el gesto en 18,7 segundos, las diez páginas de 1000 tareas en 38,1 segundos y la familia de 305 subtareas en 25,3 segundos. Se verificó el límite de 100 tarjetas en todas las páginas recorridas y el acceso a la última tarea. Se conservan los tiempos observados; ampliar un presupuesto de prueba no constituye una mejora de rendimiento de la aplicación.

```powershell
npm ci
npm run validate
npm audit --audit-level=high
$env:E2E_MEMORY_DB='1'
$env:CI='true'
$env:JWT_SECRET='local-test-secret-for-helen-apply'
$env:BCRYPT_COST='4'
npm run test:e2e
```

`BCRYPT_COST=4` se usa únicamente para acelerar las pruebas. No constituye la configuración propuesta para producción. La opción `PW_BUILD_READY=1` solo debe utilizarse después de generar un bundle actual; por defecto Playwright compila y ejecuta el preview.

Las regresiones comprueban resultados: rechazo sin mutación, durabilidad después de reintentar y recargar, respaldo descargado idéntico al original, respuestas fuera de sesión descartadas, consumo único del segundo factor, reintentos y bloqueo entre instancias de cron, ausencia de inyección en PDF, foco real y montaje acotado de tarjetas. El control de axe cubre infracciones graves y críticas en las vistas y diálogos seleccionados; no equivale a certificar toda la conformidad WCAG.

Evidencias de prueba para revisar las correcciones:

| Prueba | Resultado que comprueba |
|---|---|
| [syncPersistenceRecoveryRegression.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/syncPersistenceRecoveryRegression.test.ts) | Respuestas A descartadas en B; preferencias y tombstones nuevos siguen pendientes; borrado definitivo inicia sync; B vuelve a sincronizar al terminar el vuelo de A. |
| [idbFailureRecoveryRegression.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/idbFailureRecoveryRegression.test.ts) | Fallo de escritura retenido y reintentado; lectura fallida rechazada; escritura lenta no permite que una antigua adelante a otra más nueva. |
| [hydrationWriteBarrierRegression.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/hydrationWriteBarrierRegression.test.ts) | Las escrituras tempranas quedan pendientes tras fallar la lectura; solo el estado fusionado con los datos recuperados puede sustituir la instantánea guardada. |
| [persistedCorruptStateRecoveryRegression.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/persistedCorruptStateRecoveryRegression.test.ts) | Respaldo exacto antes de migrar registros inválidos; aislamiento de su referencia; orden de escrituras durante logout. |
| [auditImportValidation.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/auditImportValidation.test.ts), [jsonImportStoreRegression.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/jsonImportStoreRegression.test.ts) | Tipos, fechas y lotes inválidos rechazados; ausencia de mutaciones parciales; CSV regional y recorrido de exportación/importación. |
| [weeklyDstBoundaryRegression.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/weeklyDstBoundaryRegression.test.ts) | Límites semanales al cruzar el cambio horario. |
| [securityHardening.test.js](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/securityHardening.test.js), [notifications.test.js](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/notifications.test.js) | TOTP y códigos de recuperación concurrentes; sync intercalado; contraseña y activación 2FA durante login; proyección pública; reintentos, bloqueo compartido y agrupación de avisos. |
| [accountSettings.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/accountSettings.test.ts) | Separación por cuenta e invitado; claves antiguas con y sin dueño; escritura rechazada comunicada al llamante. |
| [auditPdfExport.test.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/unit/auditPdfExport.test.ts), [audit_data.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/audit_data.spec.ts) | HTML mostrado como texto; importación sin mutación; fallo y reintento de IndexedDB real; copia descargada exacta; CSP de GitHub; anchuras 375/768/1440 con movimiento reducido. |
| [ui_fixes.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/ui_fixes.spec.ts), [a11y.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/a11y.spec.ts), [mobile.spec.ts](C:/Users/User/Desktop/ENEKO/recordatorios/tests/mobile.spec.ts) | Foco y fondo inert; credenciales A → B → A; guardado rechazado; escala y familias grandes; contraste; recorridos de iPhone en WebKit. |

## Migraciones y límites del dictamen

- Se generó una migración inicial del esquema anterior y otra aditiva para `CronLease`. El procedimiento para una base nueva y para una base existente creada con `db push` está en [prisma/README.md](C:/Users/User/Desktop/ENEKO/recordatorios/prisma/README.md). El CI aplica las migraciones a su PostgreSQL efímero.
- No se ejecutó esa migración contra PostgreSQL local: Docker está instalado, pero su daemon no está disponible. Tampoco se accedió a la base publicada. La validación local del backend usa el adaptador en memoria; los resultados de CI remoto siguen sin comprobarse.
- Los push tienen entrega con posibles reenvíos. Un cierre entre la aceptación por el proveedor y su confirmación en base de datos puede duplicar una notificación. La lease reduce concurrencia; no convierte dos sistemas separados en una transacción única.
- El almacenamiento de claves por cuenta limita qué muestra y usa la app al cambiar de sesión. Las claves siguen almacenadas en el navegador; no hay cifrado ni aislamiento frente a una persona con acceso al mismo perfil del navegador y sus herramientas.
- Las claves antiguas sin propietario deben introducirse de nuevo en la cuenta correspondiente. Su valor anterior permanece conservado sin asignación automática.
- La paginación limita el DOM; ordenar, agrupar y calcular totales sigue trabajando con los datos completos. No se midió una latencia garantizada para cantidades arbitrarias. El arrastre con puntero entre páginas no está implementado; la navegación y el reordenamiento por teclado conservan el conjunto completo.
- Sigue pendiente optimizar la incorporación de lotes grandes: la traza registró 12,9 segundos para sembrar 1000 tareas y 2,2–3,2 segundos por clic de paginación. Son observaciones del recorrido automatizado en esta máquina, no una medición aislada de CPU. La revisión del código confirma que [addTasksBatch](C:/Users/User/Desktop/ENEKO/recordatorios/src/store/useAppStore.ts:506) vuelve a recorrer y normalizar las tareas previas mediante [findDuplicateTask](C:/Users/User/Desktop/ENEKO/recordatorios/src/utils/taskDeduplication.ts:173) para cada incorporación. Ese crecimiento cuadrático merece una intervención específica que preserve las reglas de duplicado semántico.
- El bundle principal sigue siendo grande y el lint mantiene advertencias de mantenimiento. Son deuda visible; un exit 0 no significa que hayan desaparecido.
- No se realizó una prueba de entrega push en un proveedor real ni una prueba contra el despliegue hospedado. Tampoco se hizo commit, push, tag o publicación.
- La conexión de GitHub se simuló en el navegador para comprobar CSP y comportamiento. No se verificaron permisos de cuentas externas ni peticiones con claves reales de Gemini u OpenAI. Los recorridos de IA comprobados incluyen su extractor local.

## Trabajo pendiente y criterios de cierre

| Orden | Trabajo | Criterio observable | Esfuerzo orientativo |
|---|---|---|---|
| 1 — antes de publicar | Ejecutar las migraciones y las regresiones de concurrencia en PostgreSQL real. | Una base vacía se crea con `migrate deploy`; una copia del esquema anterior admite el procedimiento documentado; TOTP, preferencias y lease mantienen sus invariantes con peticiones intercaladas. Confirmar el job de CI. | Medio |
| 2 — antes de publicar | Comprobar el entorno destino y una entrega push real. | Health correcto, CSP efectiva, cron con lease disponible, aviso recibido y fallo transitorio recuperable sin avanzar indebidamente el cursor. | Medio |
| 3 | Optimizar la deduplicación de lotes y la paginación; reducir el JavaScript inicial. | Medir 1000 tareas antes/después en el mismo dispositivo y red; preservar duplicados semánticos, totales y el límite de tarjetas montadas. Comparar también transferencia inicial. | Medio |
| 4 | Resolver las 158 advertencias de lint por bloques revisables. | Reducir el recuento sin desactivar reglas y conservar la validación de tipos y las regresiones afectadas. | Medio |
| 5 | Completar la comprobación de integraciones externas. | Verificar permisos y errores de autenticación con cuentas de prueba de GitHub y los proveedores de IA; confirmar aislamiento A → B → A con esos recorridos. | Bajo/medio |

Las correcciones descritas quedan aplicadas y verificadas localmente con el alcance registrado. La preparación de publicación sigue condicionada a PostgreSQL y a las comprobaciones del entorno destino; la optimización de lotes grandes permanece como trabajo pendiente medido.
