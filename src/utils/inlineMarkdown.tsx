import { Fragment, type ReactNode } from 'react';

// Negritas (**texto**) y cursivas (*texto*) de los textos que generan el asistente y los resúmenes.
// Se convierten en elementos de React (nunca en HTML), así que no hay riesgo de inyectar código.
const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

export function renderInlineMarkdown(text: string): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\n]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** El mismo texto sin las marcas, para copiarlo o exportarlo. */
export function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
}
