# Brief común — rediseño de «Recordatorios» (React PWA, español)

Repo: /home/user/recordatorios (rama de trabajo = origin/main reciente). NO edites el repo; solo lee.
Capturas del estado ACTUAL (datos representativos sembrados): /tmp/claude-0/-home-user-recordatorios/04c58fe8-9309-5878-b2ba-391d5d6dcfac/scratchpad/now/
  d-* = escritorio 1280×860, m-* = móvil 390×844. v-<vista> = pantallas; m-<modal> = modales.
  Vistas: smart_today (Hoy + resumen diario), smart_scheduled, smart_all, list_casa (lista con secciones Limpieza/Cocina),
  list_compras, list_trabajo, cycle_week/day/month (vistas por frecuencia), smart_calendar, ANALYTICS (estadísticas), TRASH.
  Modales: greeting (resumen diario modal), drawer (editor de tarea), section-menu, manage (gestionar listas), spotlight, ai, task-context.

## Lo que pide la dueña/el dueño (literal resumido)
Interfaz elegante, discreta y coherente inspirada en Apple. Que facilite ELEGIR qué hacer y COMPLETAR tareas.
Transparencias o esconderlo todo en desplegables NO es solución. Los «Detalles» genéricos del intento anterior no aportaban
nada; tampoco volver a mostrar todos los metadatos directamente.
Problemas: demasiada información compitiendo (duración, acumuladas, frecuencia y fecha correspondiente); mala jerarquía y
espacios desaprovechados (filas de tarea de 150–230 px de alto con una sola línea de título; cabeceras de sección enormes);
controles repetidos o pasos innecesarios (p. ej. menú de sección con «Marcar completadas (6)» y «Marcar todas como hechas»);
«la estética está rara».
Para cada dato: decidir si ayuda a actuar (visible), si merece aparecer discretamente, o si pertenece a la edición.
Conservar todas las funciones (se puede reorganizar su presentación, no eliminarlas). No inventar qué opciones se usan más
(no hay telemetría).
Estadísticas: distinguir frecuencia (diarias/semanales/mensuales), sección (limpieza, compras, categorías reales),
completadas, omitidas explícitamente y periodos cerrados sin completar (= omisiones INFERIDAS, sin atribuir decisión al
usuario). El periodo actual pendiente nunca cuenta como omitido.
Resumen diario: conectar historial con acciones concretas: qué sección quedó sin hacer la semana/mes pasado y permitir
retomarla, empezar por una tarea pequeña u omitir ese periodo. Omitir limpieza no omite compras ni altera el periodo actual.
Sin mensajes culpabilizadores ni explicaciones largas.
Reglas: hit areas ≥44px sin solaparse; nada de `transition: all`; radios concéntricos; cifras tabulares; contraste,
teclado, foco, movimiento reducido; Liquid Glass donde tenga sentido (navegación y controles), contenido legible.

## Observaciones del estado actual (verificadas en capturas)
- Fila de tarea: círculo, título (con «!!!» de prioridad), contador de subtareas «2 ⌄», botón (i) siempre visible,
  segunda línea muy separada con icono de repetición, reloj+duración, microbarra; separación vertical enorme.
- Cabecera de lista: título coloreado + pastilla «Duraciones» + contador grande a la derecha + «3 h 45 min ⌄» debajo;
  botón «Empezar (3 h 45 min)» amarillo + carpeta + «…» arriba.
- Vista Semanal: título + «3 h 18 min» + interruptor «Sin diarias» + navegador de semana en píldora a todo ancho +
  pastilla «0 de 13 hechas (i)» + separador; cada sección con duración, contador y chevron.
- Lista Casa: secciones aparecen plegadas, cada cabecera ocupa ~150px de alto, «2 h 45 min ⌄», «…», «6 ›».
- Hoy (móvil): la tarjeta de resumen diario ocupa toda la pantalla; las tareas de hoy quedan fuera de vista; cada grupo
  de recuperación tiene 4 botones («Empezar por una», «Omitir período», «Esta semana», «Ver historial») + «Ver estadísticas».
  Texto «¿Te apetece empezar por …? Basta con una.»
- Estadísticas: 4 tarjetas KPI (Racha, Esta semana 85%, Frecuencias al día 0%, Total histórico) que contradicen la
  rejilla de periodos (esta semana 0/13); la rejilla mezcla «omitidas» explícitas e inferidas en un único número;
  nota larga explicativa; selector de fecha nativo + select de sección; secciones como <details> con texto «0 hechas ·
  0 omitidas por ti · 4 pendientes».
- Saludo diario modal: duplica el contenido del banner de Hoy + «Por dónde empezar».
- Barra inferior «Nuevo recordatorio» flotante tipo glass; sidebar con tarjetas inteligentes coloreadas.

## Formato de salida para propuestas (JSON en el fichero que se te indique)
Array de objetos: {"id","perspective","title","mechanism" (qué cambia exactamente, concreto, implementable en web/React),
"surfaces" (lista de superficies afectadas), "visible" (qué se ve sin tocar), "discreet" (qué aparece atenuado/contextual),
"editing" (qué pasa a la edición), "evidence" (patrón Apple o razonamiento concreto; URL oficial si la conoces con certeza),
"risk", "verification" (cómo comprobarlo en navegador)}.
Las propuestas deben ser DISTINTAS entre sí (no variaciones cosméticas), concretas y compatibles con las restricciones.
