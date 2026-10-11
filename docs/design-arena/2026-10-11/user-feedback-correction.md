# Correction after user review

The user rejected the generic Details disclosures as providing no useful function. This feedback supersedes the tournament's recommendation of a permanent Details trigger on every task; the bracket remains an archive of hypotheses, not evidence of user satisfaction.

Removed the nested Details/Information wrappers on tasks, sections and the page header. Existing duration breakdown buttons now open their modal directly. Task metadata remains directly actionable, with a compact recurrence icon and readable dates, time of day, duration and prices. The original task information button is visible on mobile and desktop; empty tasks have no added metadata row. Redundant Today dates use the existing editor for configuration, while exceptional dates remain visible.

All original callbacks and calculations are retained. The metadata editing regression, empty-row regression, section/list duration regressions and existing keyboard-focus checks were updated to verify the useful direct actions rather than mandate the rejected disclosure pattern.

Verification: 7 hierarchy browser checks passed, then 15 frequency/polish checks passed; the two task regressions were rerun at the final state (including 375px real 44px metadata targets) and passed. `npm run validate` passed 481 tests, TypeScript, lint and production build; lint retains the previously recorded RoutineAnalytics warning. The source action checker preserved 431 original bindings across 43 changed components. Monthly screenshots at 375px and 1280px showed no horizontal overflow.
