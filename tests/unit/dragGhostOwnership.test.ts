// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createDragGhost } from '../../src/utils/dragDrop';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('cleans old drag ghosts without letting an old owner remove the current one', () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  const source = document.createElement('div');
  document.body.append(source);
  const old = createDragGhost(source, 10);
  const current = createDragGhost(source, 20);
  const currentElement = document.querySelector('[data-drag-ghost]');
  expect(currentElement).not.toBeNull();
  old.remove();
  expect(currentElement?.isConnected).toBe(true);
  expect(document.querySelectorAll('[data-drag-ghost]')).toHaveLength(1);
  current.remove();
  current.remove();
  expect(document.querySelectorAll('[data-drag-ghost]')).toHaveLength(0);
});
