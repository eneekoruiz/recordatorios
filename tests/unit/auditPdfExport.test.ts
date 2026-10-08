// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { exportReportToPdf } from '../../src/utils/pdfExport';

afterEach(() => vi.restoreAllMocks());

const popup = () => {
  const target = { document: document.implementation.createHTMLDocument(), print: vi.fn(), onload: null };
  vi.spyOn(window, 'open').mockReturnValue(target as unknown as Window);
  return target;
};
const payload = '<img id="injected" src="x" onerror="opener.hacked=true"> & "test"';

it('prints every report field as literal text, without injected elements', () => {
  const target = popup();
  exportReportToPdf({ title: payload, subtitle: payload, stats: [{ label: payload, value: payload }],
    items: [{ title: payload, notes: payload, category: payload, dueDate: payload }] });
  expect(target.document.querySelectorAll('#injected, script, img')).toHaveLength(0);
  expect(target.document.querySelector('h1')!.textContent).toBe(payload);
  expect(target.document.querySelector('.task-note')!.textContent).toBe(payload);
  expect(target.document.querySelector('.date-cell')!.textContent).toBe(payload);
  expect(target.document.title).toBe(`${payload} — Recordatorios`);
});

it('keeps raw text and line breaks literal in the printed report', () => {
  const target = popup();
  exportReportToPdf({ title: 'Informe', rawText: `${payload}\n\nSegunda línea` });
  expect(target.document.querySelectorAll('#injected, script, img')).toHaveLength(0);
  expect(target.document.querySelector('.raw-content')!.textContent).toContain(`${payload}\n\nSegunda línea`);
});
