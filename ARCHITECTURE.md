# Arquitectura

## Visión general

```
Dispositivo (PWA)                                   Servidor (Express · Vercel)
┌──────────────────────────────┐   push / pull    ┌──────────────────────────────┐
│ React + Zustand              │ ───────────────▶ │ /api/sync/push  (LWW + dueño) │
│ persistido en IndexedDB      │ ◀─────────────── │ /api/sync/pull  (incremental) │
│ syncManager (cola _is_dirty) │                  │ PostgreSQL vía Prisma         │
└──────────────────────────────┘                  └──────────────────────────────┘
```

## Estado local

- `useAppStore` guarda tareas en un diccionario `Record<id, TaskItem>` (acceso O(1)) y listas, ciclos y secciones en arrays. Todo se persiste en IndexedDB con el middleware `persist` de Zustand (clave `reminders-storage`, versión con migraciones).
- Cada mutación marca el registro con `_is_dirty: true` e incrementa `version`/`updated_at` (`TaskRepository`).
- Los borrados de tareas y secciones son *soft delete* (`deleted_at`). Las listas y ciclos borrados salen de la interfaz al instante y quedan como `tombstones` hasta que el servidor confirma el borrado; así no «resucitan» en la siguiente sincronización. Borrar una lista manda sus tareas a la papelera (recuperables 30 días) y admite deshacer.

## Sincronización

1. **Push:** se envían los registros sucios (tareas en lotes de 400). Al terminar, solo se limpia el flag de los que no cambiaron mientras la petición estaba en vuelo, para no perder ediciones concurrentes.
2. **Pull:** devuelve lo modificado desde el último `serverTime` (con 5 s de margen frente a relojes desincronizados) y la lista de IDs activos para reconciliar borrados.
3. **Conflictos:** Last-Write-Wins por `version` y, a igualdad, por `updated_at`, tanto en el cliente como en el servidor. Si el servidor tiene una versión más nueva, rechaza la entrante y la devuelve en `stale` para que el cliente la adopte.
4. **Disparadores:** cambios locales (debounce de 1 s), cada 30 s con la pestaña visible, al recuperar la conexión o el foco, y eventos SSE cuando el servidor es persistente (en Vercel el canal responde 204 y el cliente se queda con el sondeo).

### Aislamiento entre cuentas

Los IDs los genera el cliente y algunos son fijos (`compras`, `caducidades`, `cycle_day`…). En base de datos la clave primaria es `${userId}:${clientId}`, de modo que dos cuentas nunca comparten fila; hacia el cliente siempre se devuelve el ID original. Las filas antiguas con ID sin prefijo se siguen leyendo y actualizando si pertenecen al usuario.

## Autenticación

- Contraseñas con bcrypt (mínimo 8 caracteres) y migración transparente de contraseñas heredadas.
- JWT HS256 con caducidad de 30 días y renovación deslizante (cabecera `X-Refreshed-Token`). `JWT_SECRET` es obligatorio en producción.
- Cada token lleva una huella del hash de la contraseña (`pv`): al cambiarla o restablecerla, el resto de sesiones deja de valer y la actual recibe un token nuevo.
- Recuperación de contraseña con enlace firmado de 30 minutos y un solo uso (firmado con el hash actual de la contraseña), enviado por email mediante Resend.
- Límite de intentos por IP y por email en login y recuperación (en memoria, *best-effort* en serverless).
- Si la sesión caduca, la app pide volver a entrar pero conserva los cambios locales; si entra otra cuenta en el mismo dispositivo, se limpian los datos de la anterior.

## Avisos y calendario

- `shared/periodicity.js` es la única definición de «qué frecuencia tiene un recordatorio» (prefijo del título, `cycle_id`, lista o sección y su sección padre) y de qué rondas tocan cada día: las semanales en el día elegido, la mensual el primero de esos días del mes y la anual, el de enero. La usan la app (TypeScript, tipos en `periodicity.d.ts`) y el servidor.
- `server/notifications.js` decide qué avisos mandar a cada suscripción (función pura, probada en `tests/unit/notifications.test.js`): un resumen al día a la hora elegida y las alertas con hora, agrupadas. Lo ya hecho en su periodo no cuenta, con las fechas en la zona horaria del usuario.
- `/api/cron/notify` (Vercel Cron a diario y GitHub Actions cada 10 min, protegido con `CRON_SECRET`) carga tareas, listas, secciones y el día semanal sincronizado en `User.preferences.weeklyTasksDay`.
- `src/utils/calendar.ts` calcula el calendario (recordatorios con fecha, renovaciones previstas y rondas pendientes) sin React; la vista es `src/components/views/CalendarView.tsx`.

## Interfaz

- Componentes por dominio en `src/components`. La capa `src/styles/polish.css` se carga al final y unifica tipografía (Inter/SF), paleta clara y oscura estilo iOS, barra lateral y columna de lectura.
- `confirmDialog()` / `notify()` sustituyen a `window.confirm/alert` con diálogos accesibles propios.
- Iconos de lista centralizados en `src/constants/icons.ts` (acepta nombres heredados).

## Calidad

- `tests/unit` (Vitest): API completa contra un Prisma en memoria (`tests/support/memoryPrisma.js`), lógica de fusión, NLP, avisos y calendario.
- `tests/*.spec.ts` (Playwright): flujos de interfaz. En CI corren contra un PostgreSQL efímero, nunca contra producción.
