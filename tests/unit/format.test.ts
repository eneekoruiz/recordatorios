import { describe, it, expect } from 'vitest';
import { formatEuro } from '../../src/utils/format';

describe('formatEuro', () => {
  it('muestra siempre dos decimales y un único símbolo', () => {
    expect(formatEuro(10.1)).toBe('10,10\u00a0€');
    expect(formatEuro(1.2)).toBe('1,20\u00a0€');
    expect(formatEuro(59.99)).toBe('59,99\u00a0€');
  });

  it('no duplica el símbolo del euro', () => {
    expect(formatEuro(7.5).match(/€/g)).toHaveLength(1);
  });
});
