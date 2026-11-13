import { describe, it, expect } from 'vitest';
import { humanizeInternalName, formatSectionTitle } from '../../src/utils/sectionRoutine';

describe('nunca se enseña un identificador interno', () => {
  it('traduce ids de frecuencia y estancia', () => {
    expect(humanizeInternalName('sec_limpieza_mensual')).toBe('Mensuales');
    expect(humanizeInternalName('sec_limp_semanal_cocina')).toBe('Cocina · Semanales');
    expect(formatSectionTitle('sec_limpieza_semanal')).toBe('Semanales');
    expect(humanizeInternalName('3f2a1b4c-1234-4abc-9def-0123456789ab')).toBe('Sin sección');
  });
  it('un nombre puesto por alguien no se toca', () => {
    expect(humanizeInternalName('Día 1: Tren Superior A')).toBe('Día 1: Tren Superior A');
    expect(humanizeInternalName('mis_recetas')).toBe('mis_recetas');
  });
});
