# Auditoría de cambios y cierre de pulido — 26 de octubre de 2026

## Alcance y criterios

Revisión de los cambios entre `20ce524` y `d60e9fa`, más las correcciones locales de esta auditoría. Se comprobó el remoto mediante `git fetch origin`: `HEAD...origin/main` dio `0 0`. Se conservan las clasificaciones de la biblioteca, las rutinas mensuales y las protecciones de borrado añadidas por el usuario.

Criterios: casillas, tiempo y contadores deben compartir el mismo periodo; una semanal completada el sábado conserva su estado el domingo y se renueva el lunes; deshacer debe afectar a la sesión original; borrar una fila no debe cancelar el arrastre de otra; las migraciones deben continuar aunque un padre esté eliminado. La interfaz se verifica en Chromium a 375, 768 y 1440 px, con movimiento reducido, teclado y comprobaciones de contraste.

## Hallazgos corregidos

| Prioridad | Evidencia y efecto | Corrección | Coste |
| --- | --- | --- | --- |
| Alta | `MainContent.tsx`, `taskDuration.ts` y `routineBreakdown.ts` no propagaban las fechas de sesión a todos los consumidores. Una diaria reconocida como hecha dentro de la semanal podía seguir sumando tiempo o aparecer pendiente. | Compartir el contexto de sesión entre casillas, filtros, contadores, secuencias y duración. Conservar la fecha histórica al desmarcar. | Medio |
| Alta | `contentMigrations.ts` evitaba recrear el padre eliminado «Limpiar espejos», pero después accedía a su identificador con `!`. Esto podía interrumpir el resto de la migración. | Comprobar la existencia del padre antes de sincronizar subtareas; conservar el borrado y continuar las demás migraciones. | Bajo |
| Media | `MainSectionHeader.tsx` comparaba pendientes propios y acumulados para decidir si mostraba «Rutina completa». Con las diarias hechas, desaparecía el control aunque hubiera tareas incluidas. | Usar la existencia del conjunto acumulado, independientemente de sus pendientes. Aplicar el mismo criterio al desglose y al título de la secuencia. | Bajo |
| Media | La limpieza al desmontar cualquier `TaskCard` eliminaba todos los elementos de arrastre y restablecía el desplazamiento del documento. | Cada fila libera únicamente su arrastre; al desmontar su propietaria se cancelan listeners y desplazamiento automático y se restaura el valor anterior de `overflow`. | Medio |
| Media | Deshacer una tarea usaba la fecha del momento de deshacer; cruzar medianoche podía afectar al periodo equivocado. El callback podía ejecutarse dos veces. | Capturar la fecha de la acción y consumir el callback una sola vez. Mensaje común «Acción deshecha». | Bajo |
| Media | El buscador presentaba contraste insuficiente en «Enfocar» sobre el resultado seleccionado en modo oscuro. | Ajustar el color mediante los tokens existentes; conservar controles nativos y navegación por teclado. | Bajo |
| Baja | El tachado superpuesto atravesaba una sola línea aunque el título ocupara varias. El menú forzaba desplazamiento animado con movimiento reducido. | Tachado nativo sobre todo el texto y desplazamiento instantáneo cuando el usuario reduce las animaciones. | Bajo |
| Baja | `AIService.ts` afirmaba haber programado una notificación en un minuto antes de confirmarla, aunque la petición indicara otra fecha. | Describir el resultado como propuesta y conservar la fecha y el aviso solicitados. | Bajo |

También se corrigió el cálculo del contador de objetivos al cambiar de periodo para que un valor antiguo no dispare una confirmación de finalización prematura.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `npx --no-install vitest run --maxWorkers=1` | **Correcto: 70 archivos, 598 pruebas.** Incluye migraciones con padres eliminados y tombstones, sesiones acumuladas, propiedad del arrastre, confirmación de notificaciones y callbacks de deshacer repetidos. |
| `npm run build` | Correcto: generación de Prisma, comprobación TypeScript, compilación Vite y generación del service worker. |
| `npm run lint` | Correcto, con dos avisos previos; sin errores. |
| `npm audit --omit=dev --audit-level=high` | Correcto: 0 vulnerabilidades detectadas en dependencias de producción. |
| `git diff --check` | Correcto. Git avisa de la conversión habitual LF/CRLF en Windows. |
| `tests/user_changes_audit.spec.ts`, Chromium | **6/6 correctas**, a 375, 768 y 1440 px: desmarcado histórico, tiempo restante, tachado multilínea, deshacer al cruzar medianoche, arrastre y movimiento reducido. |
| `tests/spotlight_accessibility.spec.ts`, Chromium | **3/3 correctas**, a los mismos tamaños: teclado, foco, historial, exclusión de elementos eliminados y axe en temas claro y oscuro. |
| `tests/weekly_completion.spec.ts` y `tests/period_done.spec.ts`, Chromium | **6/6 correctas en las ejecuciones finales por lotes.** La pasada conjunta pasó 14/15; el caso semanal de 768 px agotó la espera de hidratación tras recargar. Se cambió esa espera a sondeo desde el runner, conservando las aserciones y sin ampliar tiempos; la repetición semanal pasó **3/3**. |

Se inspeccionaron también capturas de la rutina en móvil y escritorio. La primera ejecución general detectó que el nuevo mensaje de la IA había perdido la palabra «notificación»; se corrigió el texto y la suite completa posterior pasó. No se modificaron las aserciones para ocultar ese fallo.

## Límites

La comprobación usa datos de prueba y un backend en memoria; no modifica datos de producción. No se ha publicado, hecho push ni creado un commit. No se ha validado Safari/WebKit, un dispositivo físico ni la entrega real de notificaciones. El lint conserva dos avisos previos en `RoutineAnalytics.tsx` y `MainGlassHeader.tsx`.

Se revisó `.github/workflows/ci.yml`: la ejecución alojada usa Linux, PostgreSQL y la suite completa de Playwright. Los resultados locales de esta auditoría no acreditan esa matriz ni sustituyen las pruebas de integración con PostgreSQL. La auditoría de dependencias tampoco equivale a una revisión exhaustiva de seguridad.

## Cierre del alcance

La segunda revisión de consumidores detectó el control «Rutina completa» que desaparecía al completarse las tareas incluidas; quedó incorporado a la corrección y a su prueba de navegador. Se revisaron además el ciclo de vida del arrastre, los borrados persistentes, la reutilización de los helpers temporales y el texto de confirmación de la IA. No se añadieron dependencias, funciones nuevas ni cambios en la clasificación de contenidos. Las correcciones se entregan como diff local para su revisión.
