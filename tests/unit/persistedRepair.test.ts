import { describe, it, expect } from 'vitest';
import { sanitizePersistedCollections } from '../../src/utils/persistedStateValidation';

describe('registros guardados con un campo que esta versión no entiende', () => {
  it('una lista ordenada «Z-A» se queda tal cual', () => {
    const out = sanitizePersistedCollections({ lists: [{ id: 'l1', name: 'Recetas', sortMode: 'title_desc' }] });
    expect(out.quarantined).toBe(0);
    expect(out.state.lists).toEqual([{ id: 'l1', name: 'Recetas', sortMode: 'title_desc' }]);
  });

  it('un campo opcional desconocido se quita y el registro se conserva', () => {
    const out = sanitizePersistedCollections({
      lists: [{ id: 'l2', name: 'Recetas', listType: 'recipes', color: '#f00' }],
      tasks: { t1: { title: 'Lentejas', priority: 'urgente', weightLogs: [{ set: 1, weightKg: null }] } },
    });
    expect(out.quarantined).toBe(0);
    expect(out.repaired).toBe(2);
    expect(out.state.lists).toEqual([{ id: 'l2', name: 'Recetas', color: '#f00' }]);
    expect(out.state.tasks).toEqual({ t1: { title: 'Lentejas' } });
    expect(sanitizePersistedCollections({ tasks: { t2: { title: { x: 1 } } } }).quarantined).toBe(1);
  });

  it('sin lo imprescindible (nombre) sí se aparta', () => {
    expect(sanitizePersistedCollections({ lists: [{ id: 'l3' }] }).quarantined).toBe(1);
  });
});
