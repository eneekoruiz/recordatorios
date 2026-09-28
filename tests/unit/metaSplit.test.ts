import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetaSplit } from '../../src/components/ui/MetaSplit';

const render = (props: Parameters<typeof MetaSplit>[0]) => renderToStaticMarkup(createElement(MetaSplit, props));

describe('MetaSplit — cifra + microbarra', () => {
  const parts = [
    { id: 'own', value: 60, text: '1 h', color: '#007aff', tone: 'solid' as const },
    { id: 'acc', value: 15, text: '15 min', color: '#ff9500', tone: 'striped' as const },
  ];

  it('pinta una barra con un segmento por parte, proporcional y con su tono', () => {
    const html = render({ label: '~1 h 15 min', parts, description: 'desc' });
    expect(html).toContain('meta-split__seg--solid');
    expect(html).toContain('meta-split__seg--striped');
    expect(html).toContain('flex-grow:60');
    expect(html).toContain('flex-grow:15');
  });

  it('el desglose numérico va en el DOM (se revela con hover/foco) y el resumen en aria-label/title', () => {
    const html = render({ label: '~1 h 15 min', parts, description: '1 h propias + 15 min acumuladas' });
    expect(html).toContain('1 h');
    expect(html).toContain('aria-label="1 h propias + 15 min acumuladas"');
    expect(html).toContain('title="1 h propias + 15 min acumuladas"');
    expect(html).toContain('tabindex="0"');
  });

  it('sin partes solo muestra la cifra (sin ruido)', () => {
    const html = render({ label: '84,00 €', parts: [], description: 'Subtotal' });
    expect(html).not.toContain('meta-split__bar');
    expect(html).not.toContain('meta-split__parts');
  });

  it('ignora partes vacías y con una sola parte no repite el desglose', () => {
    const html = render({ label: 'x', parts: [{ ...parts[0] }, { id: 'z', value: 0, text: '0', color: '#000' }], description: 'd' });
    expect(html.match(/meta-split__seg /g)?.length ?? 0).toBe(1);
    expect(html).not.toContain('meta-split__parts');
  });
});
