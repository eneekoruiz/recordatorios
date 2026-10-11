# Independent review — 2026-10-11

Reviewer: independent disclosure critic. No implementation edits were made during this evaluation. This is an independent check of i004, not a new tournament selection.

## Evidence and limits

Used Playwright Chromium headless against http://127.0.0.1:5182 in two new browser contexts: 1280×900 and 390×844. All **/api/** requests were aborted. Each context used local guest identity and its own browser storage, with a synthetic routines list and one pending 25-minute task due yesterday. No real account, integration, message or backend mutation was used.

Captured list, expanded task Details, task drawer, Manage Lists and edit-list configuration in each viewport (10 screenshots total). Inspected the desktop list and the mobile list, expanded details, task drawer, management and configuration screenshots visually. The JSON file records actual text/overflow observations. The first attempt double-clicked a task without opening its editor; this was corrected by opening Details and activating the duration button. These are representative checks, not exhaustive application-wide live testing.

The served bundle identified during this review was dist/assets/index-DW5j-Ms2.js, timestamp 2026-10-11 16:42:54 local. The parent reports later source revisions awaiting the next build. Screenshots therefore document that available compiled build; source findings below are explicitly separate. A rebuilding server can change assets after this snapshot. No claim is made that source-only focus/label fixes have all passed live.

## Findings

1. **Pass, live:** a genuinely overdue date remained immediately visible as red “10 oct” in both list viewports. Duration/day-part were behind a clear Details disclosure. Expanding it exposed 25 min and Mañana, and activating duration reached the editor. No horizontal document overflow was detected on either list. This supports the winner’s exception-led information hierarchy for this fixture; it does not prove all date-context comparisons.

2. **Medium, live:** Manage Lists successfully hides organization commands behind named Options, but a separate disclosure row creates roughly 120px cards at 390px. Only around three and a half rows fit above the persistent footer. This removes command clutter at the cost of substantial scroll effort. Consider keeping Options on the name/count row when it fits, with an actual wrapping fallback. Preserve all five commands and checkbox hit area. Evidence: independent-mobile-manage.png.

3. **Medium, live:** opening the task through its duration reveals the entire Date/time group, placing date, time, day-part and four preventive alert presets before duration. On mobile the initial screenshot stops at preventive alerts and duration is below the fold. The edit route works, but the clicked field is not brought into view. Consider focusing/scrolling the duration subsection on that edit hint without deleting or rearranging scheduling business behavior. Evidence: independent-mobile-task.png and observed dialog text.

4. **Pass with scope limit, live:** list configuration puts name/type first, Color and Icon behind disclosures, and options below. This is a meaningful reduction of default appearance choices. Save/cancel remain visible. No save was performed. The screenshot does not establish accessibility of expanded appearance choices.

5. **Medium, source only:** the winner promises stable explicit Details at every scope, but TaskMetaBadges renders Details only when optional.length > 0; MainSectionHeader requires durationNode or priceNode; MainPageHeader requires nonzero duration/cost/breakdown. Tasks with no optional metadata therefore lack that route. A separate task-info button exists, so this is a discoverability/contract gap, not demonstrated loss of editing. Either implement a consistent empty-details edit route or explicitly narrow the winner’s promise. Do not add hidden duplicate controls.

6. **Source improvement, not live certified:** useModalFocus adds enabled/visible target filtering, top-layer Escape handling, portal-select delegation and trigger restoration. This addresses several prior audit findings. Later source also adds named drawer fields and semantic account commands. These changes require the fresh-build keyboard, nested-select and modal tests; screenshot appearance alone cannot verify them.

## Verification still needed on final build

Keyboard Tab/Shift+Tab containment and trigger return; nested CustomSelect Escape closing only the popup; native disclosure keyboard behavior; 320px and large-text reflow; empty-metadata and mixed/inherited/historical date contexts; all preserved row-management commands. Credential-dependent security, AI and integration operations remain untested and should use mocks rather than real changes.

Artifacts: independent-observations.json, independent-live.mjs and independent-{desktop,mobile}-{list,task-details,task,manage,config}.png in this directory.

