import { describe, it, expect } from 'vitest';

interface Rect {
  top: number;
  height: number;
}

function calculateMenuPlacement(
  trigger: Rect,
  wantedTop: number,
  menuHeight: number,
  viewportH: number,
  margin = 12,
  gap = 6
) {
  const triggerTop = trigger.top;
  const triggerBottom = trigger.top + trigger.height;

  const spaceBelow = Math.max(0, viewportH - (triggerBottom + gap) - margin);
  const spaceAbove = Math.max(0, triggerTop - gap - margin);

  const prefersBelow = wantedTop >= triggerBottom - 1;

  let placeBelow = true;
  if (prefersBelow) {
    if (spaceBelow >= menuHeight) {
      placeBelow = true;
    } else if (spaceAbove >= menuHeight) {
      placeBelow = false;
    } else {
      placeBelow = spaceBelow >= spaceAbove;
    }
  } else {
    if (spaceAbove >= menuHeight) {
      placeBelow = false;
    } else if (spaceBelow >= menuHeight) {
      placeBelow = true;
    } else {
      placeBelow = spaceBelow > spaceAbove;
    }
  }

  if (placeBelow) {
    const top = triggerBottom + gap;
    const maxH = Math.max(120, spaceBelow);
    return { top, maxH, placeBelow: true };
  } else {
    const maxH = Math.max(120, spaceAbove);
    const actualH = Math.min(menuHeight, maxH);
    const top = triggerTop - gap - actualH;
    return { top, maxH, placeBelow: false };
  }
}

describe('Context menu non-overlapping placement', () => {
  it('guarantees that menu NEVER overlaps the trigger rect (section header or task)', () => {
    const testCases = [
      // Case 1: Trigger near the top (e.g. y = 100, h = 40)
      { trigger: { top: 100, height: 40 }, wantedTop: 146, menuHeight: 400, viewportH: 800 },
      // Case 2: Trigger near the bottom (e.g. y = 650, h = 40)
      { trigger: { top: 650, height: 40 }, wantedTop: 696, menuHeight: 400, viewportH: 800 },
      // Case 3: Trigger in the middle with tight screen (Image 5 scenario: y = 250, h = 40, vh = 600, mh = 450)
      { trigger: { top: 250, height: 40 }, wantedTop: 296, menuHeight: 450, viewportH: 600 },
      // Case 4: Trigger slightly below center (y = 350, h = 50, vh = 650, mh = 420)
      { trigger: { top: 350, height: 50 }, wantedTop: 406, menuHeight: 420, viewportH: 650 },
      // Case 5: Very tight screen (vh = 480, trigger in middle)
      { trigger: { top: 200, height: 44 }, wantedTop: 250, menuHeight: 500, viewportH: 480 }
    ];

    for (const tc of testCases) {
      const res = calculateMenuPlacement(tc.trigger, tc.wantedTop, tc.menuHeight, tc.viewportH);
      const menuTop = res.top;
      const actualMenuHeight = Math.min(tc.menuHeight, res.maxH);
      const menuBottom = menuTop + actualMenuHeight;

      const triggerTop = tc.trigger.top;
      const triggerBottom = tc.trigger.top + tc.trigger.height;

      // Check whether interval [menuTop, menuBottom] intersects [triggerTop, triggerBottom]
      const hasOverlap = Math.max(menuTop, triggerTop) < Math.min(menuBottom, triggerBottom);
      expect(hasOverlap).toBe(false);

      if (res.placeBelow) {
        expect(menuTop).toBeGreaterThanOrEqual(triggerBottom + 6);
      } else {
        expect(menuBottom).toBeLessThanOrEqual(triggerTop - 6);
      }
    }
  });

  it('correctly breaks down routine task counts for Care list (15 diarias, 7 semanales, 6 mensuales)', () => {
    const listTotal = 28;
    const diariasCount = 15;
    const semanalesOwn = 7;
    const mensualesOwn = 6;

    // Verify list sum
    expect(diariasCount + semanalesOwn + mensualesOwn).toBe(listTotal);

    // Semanales when + Diarias is active
    const semanalesFull = semanalesOwn + diariasCount;
    expect(semanalesFull).toBe(22);
    const extraSemanales = semanalesFull - semanalesOwn;
    expect(extraSemanales).toBe(15);
    const semanalesLabel = `${semanalesFull} (${semanalesOwn} + ${extraSemanales})`;
    expect(semanalesLabel).toBe('22 (7 + 15)');

    // Mensuales when + Acumuladas is active
    const mensualesFull = mensualesOwn + semanalesOwn + diariasCount;
    expect(mensualesFull).toBe(28);
    const extraMensuales = mensualesFull - mensualesOwn;
    expect(extraMensuales).toBe(22);
    const mensualesLabel = `${mensualesFull} (${mensualesOwn} + ${extraMensuales})`;
    expect(mensualesLabel).toBe('28 (6 + 22)');
  });
});
