import { describe, it, expect } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderInlineMarkdown, stripInlineMarkdown } from '../../src/utils/inlineMarkdown';

const html = (text: string) => renderToStaticMarkup(createElement(Fragment, null, renderInlineMarkdown(text)));

describe('Markdown en línea del asistente y los resúmenes', () => {
  it('convierte **negrita** y *cursiva* en elementos, no en asteriscos', () => {
    expect(html('Tienes **3 tareas** y *una urgente*')).toBe('Tienes <strong>3 tareas</strong> y <em>una urgente</em>');
  });

  it('no interpreta HTML: el texto se escapa', () => {
    expect(html('**<img src=x onerror=alert(1)>**')).toBe('<strong>&lt;img src=x onerror=alert(1)&gt;</strong>');
  });

  it('deja intactos los asteriscos sueltos y los saltos de línea', () => {
    expect(html('2 * 3 = 6\nfin')).toBe('2 * 3 = 6\nfin');
  });

  it('stripInlineMarkdown quita las marcas para copiar o exportar', () => {
    expect(stripInlineMarkdown('✨ **Memoria de mayo:** *Cena*')).toBe('✨ Memoria de mayo: Cena');
  });
});
