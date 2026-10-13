# Apple como listón de calidad — investigación (fuentes oficiales)

HIG base: `https://developer.apple.com/design/human-interface-guidelines/<página>` (texto extraído del JSON oficial de cada página, 2026-10-13). Las citas son literales. **UNVERIFIED** = no confirmado en una página oficial.

## 1. Recordatorios (iOS/macOS)

| Tema | Cita | URL |
|---|---|---|
| Botón (i) / detalles | "Tap a reminder, then tap the Edit Details button" · "Tap the Edit Details button to add even more details and customizations to your reminder, such as notes, a URL, and a priority." | support.apple.com/en-us/102484 |
| (i) solo informa | "Use an info button only to reveal more information about a row's content… doesn't support navigation" | HIG lists-and-tables |
| Subtareas | "Swipe right on a reminder, then tap Indent. The reminder becomes a subtask of the one above it." / "If you delete or move a main task, the subtasks are also deleted or moved." | 102484; guide/iphone/edit-and-organize-a-list-iph82596cb20/ios |
| Secciones | "Create a new section: Tap [More], tap New Section… Collapse a section: Tap [chevron]." · "You can also view the sections as columns" · "Removing a section will also delete the section's reminders." | iph82596cb20 |
| Completadas | "Completed items are hidden on your list." · "To unhide completed items, tap [More], then tap Show Completed." · "To delete the completed items, tap Clear." | guide/iphone/complete-and-remove-items-iph3fb74d597/ios |
| Contador de completadas (Mac) | "Scroll to the top of the list until you see the number of completed reminders, then click Show." | guide/reminders/view-reminder-lists-remnd854fc47/mac |
| Listas inteligentes | "Smart Lists give you a quick view of all your reminders from across your lists." | 119953 |

**UNVERIFIED** (por observación de la app, sin texto oficial): la fila muestra la fecha, la repetición, la ubicación y las etiquetas como una sola línea secundaria pequeña, en gris o rojo si está vencida; el (i) aparece solo en la fila seleccionada o en edición, no en todas las filas; las tarjetas de las listas inteligentes muestran un contador grande; el número de subtareas aparece junto a un chevron de despliegue.

## 2. HIG

- **Lists and tables**: "Keep item text succinct so row content is comfortable to read… consider… list item titles only, letting people choose an item to reveal its content in a detail view." "the grouped style uses headers, footers, and additional space to separate groups of data."
- **Disclosure controls**: "Use a disclosure control to hide details until they're relevant. Place controls that people are most likely to use at the top… with more advanced functionality hidden by default." "Place a disclosure button near the content that it shows and hides."
- **Menus**: "Prefer listing important or frequently used menu items first." "To help people visually distinguish such groups, use a separator." "Use submenus sparingly."
- **Context menus**: "you don't want more than about three groups in a context menu." Destructive items: "list them at the end of the menu and identify them as destructive." "people who use an app to perform a few simple actions may appreciate short contextual menus." Sobre la redundancia, solo hay un ejemplo: no mostrar los atajos de teclado ("it's redundant"). Una regla general contra la redundancia sería una inferencia.
- **Toolbars**: "Choose items deliberately to avoid overcrowding." "Only specify one primary action, and put it on the trailing side." "Try to include all actions in the toolbar if possible, and only add [a More] menu if you really need it." "prefer using the default monochromatic appearance of toolbars" cuando el contenido ya tiene color.
- **Sheets**: "presenting a simple task that they can complete before returning to the parent view." "Display only one sheet at a time." "If you provide a Done button, always pair it with a Cancel button."
- **Segmented controls**: "no more than about five segments on iPhone." "Don't assign actions to segments in a control that otherwise represents selection state." "Prefer using either text or images — not a mix."
- **Charts** (charting-data): "Keep a chart simple, letting people choose when they want additional details." "Descriptive text titles… can highlight actionable takeaways… a headline or summary… (Weather: 'Chance of light rain in the next hour')." "Prefer consistency across multiple charts." Health Trends: "the expanded version uses the same style, colors, marks, and annotations." Cada gráfico necesita etiquetas de accesibilidad.
- **Typography** (iOS, tamaño Large por defecto): Body 17/22, Callout 16/21, Subhead 15/20, Footnote 13/18, Caption1 12/16, Caption2 11/13, Headline 17 semibold, Title3 20/25, Large Title 34/41. Tamaño por defecto 17 pt, mínimo 11 pt. "Adjust font weight, size, and color as needed to emphasize important information." "avoid light font weights."
- **Color**: niveles label / secondaryLabel / tertiaryLabel ("A text label that contains secondary content"). "Avoid relying solely on color to… communicate essential information." "Apply color sparingly to the Liquid Glass material… Refrain from adding color to the background of multiple controls."
- **Layout**: "Order content by relative importance." "Group related items… use negative space, container shapes, or separator lines." "Use progressive disclosure… disclosure triangles, menus, or nested views." Las filas deben crecer con Dynamic Type.
- **Accessibility**: tamaño de control iOS 44×44 pt por defecto (28×28 como mínimo); contraste 4.5:1 para texto de hasta 17 pt. Con Reduce Motion, reducir "automatic and repetitive animations, including zooming, scaling, and peripheral motion."
- **Motion**: "Don't add motion for the sake of adding motion." "Aim for brevity and precision in feedback animations."
- **Writing**: "Check each word to be sure it needs to be there." "When labeling buttons… use a verb." "Avoid using we altogether." Errores: "avoid blame, and be clear about what someone can do." "Interjections like 'oops!'… can sound insincere." Estados vacíos: "Provide clear next steps… give them a button." "Favorites" en lugar de "Your Favorites".

## 3. Liquid Glass / Materials (iOS 26)

- "Liquid Glass forms a distinct functional layer for controls and navigation elements… that floats above the content layer."
- "Don't use Liquid Glass in the content layer… use Standard materials for elements in the content layer." Excepción: controles transitorios, como deslizadores o interruptores, mientras se usan.
- "Use Liquid Glass effects sparingly… Limit these effects to the most important functional elements."
- La variante regular "blurs and adjusts the luminosity… to maintain legibility"; la variante clear es solo para fondos con fotos o vídeo, con una capa de oscurecimiento del 35 % si el fondo es claro. Hay que respetar Reduce Transparency e Increase Contrast.
- Scroll edge: "Only use a scroll edge effect when a scroll view is behind floating interface elements. Scroll edge effects aren't decorative." "Apply one scroll edge effect per view." Se prefiere el estilo automático; hay que probar la legibilidad si se usa el estilo soft.

## 4. Resúmenes sin culpa (salud, actividad, tiempo de uso)

- Activity (support.apple.com/en-us/HT210343): "Your Apple Watch lets you know if you're on track or falling behind your Activity goals." Trends: "If an arrow points down, your 90 day average for that metric has started to decline." El texto describe el dato, no a la persona, y lo acompaña de un siguiente paso: "To help motivate you to turn the trend around, you'll receive coaching—'Walk an extra quarter of a mile a day.'" Trends compara un periodo reciente con una referencia: "last 90 days… to the last 365." Además, "Daily Coaching" se puede desactivar.
- Pausar los anillos: "Pause your Activity rings for a rest day, week, month, or more without affecting your award streak" (support.apple.com/en-us/121163, cita tomada del resultado de búsqueda; no se abrió la página). Es el equivalente a omitir un periodo de forma explícita sin penalización.
- Screen Time (guide/iphone/get-started-with-screen-time-iphbfa595995/ios): "a weekly report with an overview of the time you spend… your most used apps, how often you pick up… You can also view your summary by tapping a Screen Time Weekly Report notification." Es una visión general neutra con un valor de "Daily Average".
- Health Trends: la HIG de charting-data muestra gráficos de tendencia pequeños que se amplían conservando el mismo estilo. **UNVERIFIED**: las frases literales de Health Highlights, por ejemplo "On average, you…", no se comprobaron en ninguna página oficial.
