import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskMetaBadges } from '../../src/components/tasks/card/TaskMetaBadges';
import type { TaskItem } from '../../src/models/Task';

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => unknown) => selector({ tasks: {}, listSections: [], showDuration: false, updateTask: vi.fn() }),
}));

describe('task metadata visibility with a redundant-date hint', () => {
  it.each([[-1, '#ff3b30'], [1, 'var(--text-tertiary)']])('keeps an exceptional date outside Details (%s days)', (offset, color) => {
    const due = new Date(); due.setDate(due.getDate() + Number(offset));
    const task: TaskItem = { id: 'exception', title: 'Fecha importante', status: 'pending', created_at: new Date().toISOString(), version: 1, user_id: 'guest', type: 'task', dueDate: due.toISOString() };
    const html = renderToStaticMarkup(createElement(TaskMetaBadges, { task, hideDueDate: true, dueDateColor: String(color), onEdit: vi.fn() }));
    const date = html.indexOf('title="Fecha de vencimiento');
    expect(date).toBeGreaterThan(-1);
    expect(date).toBeLessThan(html.indexOf('<details'));
  });

  it('keeps the redundant current date available inside Details', () => {
    const task: TaskItem = { id: 'current', title: 'Hoy', status: 'pending', created_at: new Date().toISOString(), version: 1, user_id: 'guest', type: 'task', dueDate: new Date().toISOString() };
    const html = renderToStaticMarkup(createElement(TaskMetaBadges, { task, hideDueDate: true, dueDateColor: '#007aff', onEdit: vi.fn() }));
    expect(html.indexOf('title="Fecha de vencimiento')).toBeGreaterThan(html.indexOf('<details'));
  });
});
