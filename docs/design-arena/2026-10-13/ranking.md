# Clasificación de las 100 propuestas

Se han generado 100 propuestas en cuatro lotes, cada uno escrito por un agente con un enfoque distinto:

- a001–a025: personas.
- b001–b025: producto e integridad de datos.
- c001–c025: accesibilidad e interacción.
- d001–d025: diseño visual.

Son 100 ideas, no 100 agentes. El texto completo está en `ideas.json` y el briefing común en `brief.md`. No hay datos de uso, así que ninguna decisión se apoya en «lo que más se usa».

## Criterios

Cada propuesta se valora frente a los mismos cinco criterios. Se ordenan por peso:

1. **Elegir y completar.** ¿Ayuda a decidir qué hacer y a marcarlo? Las capturas de partida muestran filas de 119 px CSS para una sola línea de título y un resumen diario que en móvil ocupa toda la pantalla.
2. **Los problemas que se pidieron resolver.** Información que compite, jerarquía, espacio desaprovechado, controles repetidos y estadísticas ambiguas.
3. **Restricciones.** Conservar funciones y reglas de negocio, áreas táctiles de 44 px sin solaparse, teclado, contraste y movimiento reducido.
4. **Riesgo.** Probabilidad de romper flujos, datos o pruebas existentes.
5. **Coste frente al beneficio dentro de este encargo.**

Las propuestas que contradicen la dirección elegida no se mezclan con ella solo por aprovechar más ideas.

## Dirección elegida: «Primero la lista: una fila, una línea, una acción»

Combina d001, d008, a001, c007, b010, c014, d013 y d014. Es la única dirección que responde a la vez a la queja principal (todo compite por la atención) y a la evidencia medida en el código.

- **Causa del espacio perdido.** Las filas y cabeceras crecen por cajas de 44 px de layout, no por contenido. El intento anterior convirtió cada metadato en un botón de 44 px de alto (`polish.css:2735`, `2736–2746` y `2783`).
- **Coherencia con el listón Apple.** Coincide con la investigación (`apple-research.md`):
  - Filas con títulos y como mucho una línea secundaria.
  - El editor se abre desde la fila.
  - Un único botón principal por pantalla.
  - Menús con unos tres grupos, sin duplicados y con las acciones destructivas al final.
  - Cristal solo en la capa de navegación.

### Qué se decide para cada dato

**Visible**, porque ayuda a actuar:

- título;
- fecha si está vencida, es de hoy con hora o es próxima;
- duración, cuando sirve para elegir algo corto;
- precio en listas de compra;
- avance de subtareas.

**Discreto**, en una sola línea secundaria gris:

- frecuencia (solo el glifo, y solo fuera de su propia vista);
- nombre de la lista (solo en listas inteligentes);
- notas (una línea).

**En la edición:** desgloses propio/subtareas, paralelo, momento del día, ubicación, URL y el resto de campos. Se llega desde el (i), tocando la fila y desde el menú contextual.

Tocar la línea secundaria sobre un dato abre el editor en ese campo. Así se conserva la acción directa del intento anterior, pero sin botones diminutos.

## Veredicto por bloque

| Bloque | Adoptadas | Injertadas, con el ajuste aplicado | Descartadas y motivo |
|---|---|---|---|
| **Fila de tarea** | d001, d008, a001, c007, d009, d007, c001, c002, c012, c013 | **a022:** se adopta el círculo de 44 px, no el de 56. **d010:** sangría de las subtareas más corta. **c024:** nivel de subtarea en el nombre accesible. | **a014:** el chip de fecha como botón vuelve a crear objetivos diminutos y menús anidados; reprogramar ya está en el menú contextual. **a025:** «!!!» es la notación de Apple y el texto para lectores de pantalla ya dice la prioridad; cambiarla quitaría lectura rápida. |
| **Cabeceras de sección** | a002, c020, d002, c003 | — | — |
| **Cabecera de página** | d013, c018, b020, c011 | **d006:** el título conserva el color de la lista, como en Recordatorios, pero oscurecido para cumplir AA. | **a004:** «Siguiente: X» compite con «Empezar» y deja de ser cierto en cuanto marcas algo. **d020:** el título grande que se pliega es un buen detalle, pero arriesga el scroll y las pruebas a cambio de poco; se deja como pendiente. |
| **Vistas de frecuencia** | a017, b018, d016, c017 | — | — |
| **Hoy y resumen diario** | b010, c014, d022, b011, b012, b013, b015, b016, b017, a005, a007 | **b014:** «Empezar» abre esa tarea en modo foco (Zen) en vez del editor, que era un paso de más. | **a006:** una tarjeta «Ahora» sería una tercera superficie compitiendo con el resumen y la lista. **a016:** reorganizar la Revisión semanal queda fuera del alcance; el resumen ya permite decidir por sección. |
| **Estadísticas** | b001, b002, b003, b004, b005, b006, b007, b008, b009, b021, b023, c021, c022, d023, a018, a019, a020 | **a008:** días con algo hecho como dato positivo, sin récord que se pueda perder. | **b022:** guardar la sección en cada marca exige cambiar el modelo y sincronizar historial; se documenta como limitación. **b024:** la racha por sección añade otra métrica antes de que las básicas sean coherentes. **b025:** el informe exportado se mantiene y se revisará aparte. |
| **Menús y acciones repetidas** | b019, c019, a023, a015 (solo la parte de duplicados) | — | Las otras duplicaciones encontradas en el inventario también se corrigen (ver `decision.md`). |
| **Accesibilidad e interacción** | c016, c025, c006, c015 (con la región de avisos ya existente) | **c008:** el (i) sigue visible y el menú contextual sigue accesible desde el teclado. | **c004 y c009** (filas con flechas, reordenar con teclado): buenas ideas, pero cambian mucho la interacción y las pruebas de arrastre; quedan pendientes. **c005 y a011:** los atajos ya existen; ampliarlos no resuelve la saturación. **a013:** el inspector lateral es un cambio de arquitectura. **a012:** agrupar por fecha es una función nueva. **a003:** cambiaría cómo se comporta marcar en las listas de compra (regla de negocio). **a009:** cambiaría qué tareas vencidas se muestran (regla de negocio). **a010:** el modo Zen ya existe. **a021:** un ajuste propio de tamaño de texto queda fuera; sí se garantiza que todo reorganiza bien con texto grande. **a024 y c023:** el editor se ordena, pero no se convierte en subpantallas. |
| **Sistema visual** | d003, d004, d005, d014, d015, d017, d018, d019, d012, d024, d011 | **d021:** solo transiciones concretas, siempre que no compitan con framer-motion. **d025:** se revisa el modo oscuro sin rediseñarlo. | — |

## Lo que no demuestra este ranking

Los veredictos son argumentos, no la preferencia medida de quienes usan la app. La comprobación real está en las capturas finales y en la revisión independiente, documentadas en `verification.md`.
