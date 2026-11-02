import { describe, it, expect } from 'vitest';
import { roomKeyOf, roomSectionId, ROOM_ANY_FREQUENCY_PREFIX } from '../../src/utils/limpiezaRooms';
import type { ListSection } from '../../src/models/Task';

describe('estancias de Limpieza', () => {
  it('reconoce la estancia por nombre o por identificador canónico', () => {
    expect(roomKeyOf('Para terminar')).toBe('para_terminar');
    expect(roomKeyOf('sec_limp_semanal_para_empezar')).toBe('para_empezar');
    expect(roomKeyOf('sec_limp_mensual_hab')).toBe('habitacion');
    expect(roomKeyOf('Baño')).toBe('bano');
    expect(roomKeyOf(`${ROOM_ANY_FREQUENCY_PREFIX}cocina`)).toBe('cocina');
    expect(roomKeyOf('Semanales')).toBeNull();
  });

  it('usa la sección guardada si existe y, si no, la canónica con su frecuencia', () => {
    const sections = [
      { id: 'sec_limpieza_semanal', listId: 'limpieza', name: 'Semanales' },
      { id: 'mi_cocina', listId: 'limpieza', name: 'Cocina', parentId: 'sec_limpieza_semanal' },
    ] as ListSection[];
    expect(roomSectionId('week', 'cocina', sections, 'limpieza')).toBe('mi_cocina');
    expect(roomSectionId('week', 'para_terminar', sections, 'limpieza')).toBe('sec_limp_semanal_para_terminar');
    // Una mensual nunca cae en la estancia semanal.
    expect(roomSectionId('month', 'cocina', sections, 'limpieza')).toBe('sec_limp_mensual_cocina');
    expect(roomSectionId('day', 'habitacion', [], 'limpieza')).toBe('sec_limp_diaria_hab');
  });
});
