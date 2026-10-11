# Task contract: quiet, discoverable reminder UI

User request: There are too many visible elements: accumulated routines,
duration, the corresponding day and options. Investigate how Apple communicates
these through UI. Generate 100 different ideas from different person/product
perspectives, pit them against each other until one wins, and apply the winning
approach to improve order, discretion, visual quality and ease of use.

Context: React/TypeScript reminder app in
`C:/Users/User/Desktop/ENEKO/recordatorios`. Main files:
- `src/components/layout/main/MainPageHeader.tsx`
- `src/components/layout/main/MainSectionHeader.tsx`
- `src/components/layout/main/MainGlassHeader.tsx`
- `src/components/layout/main/CycleRoutineStatusCard.tsx`
- `src/components/tasks/card/TaskMetaBadges.tsx`
- `src/components/tasks/TaskCard.tsx`
- `src/styles/polish.css`, `src/styles/liquid-glass.css`

Constraints: Preserve business logic, hooks, backend calls, all existing options,
all data and callback semantics. No deleting features for aesthetics. Retain
existing E2E selector contracts where feasible; explicit interaction updates may
open intentional disclosure. Touch targets minimum 44px. Semantic keyboard and
screen-reader access, visible focus, no hover-only access, no overflow at 320px
and 375px. Scoped transitions, reduced motion, coherent typography and restrained
glass. Follow actual list/section/task context and historical reference dates.

Evidence: no control usage telemetry found in src/package.json. Priorities must
be task-value hypotheses, not claims about measured frequency. Routine analytics
are completion history, not UI usage statistics. Synthetic personas are not
user research. Apple sources:
- https://developer.apple.com/design/human-interface-guidelines/layout
- https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- https://developer.apple.com/design/human-interface-guidelines/context-menus
- https://support.apple.com/en-us/102484

Acceptance: visually reduce competing header/task signals while keeping action
scope and time context understandable. Every preserved control remains available
through an obvious, accessible route. Verify estimates, accumulated scope,
period selection, edit metadata, section menus and task completion. Inspect
before/after mobile and desktop. Run repository validation and focused E2E.

Tournament: exactly 100 distinct proposals; 99 individually recorded matches;
seven elimination rounds. Batched generation is explicitly 100 ideas, not 100
independent model agents. Anonymous judges cannot evaluate their own candidates.
Rubric: preservation30, usefulness25, robustness20, specificity15, clarity10.
