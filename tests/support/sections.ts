import type { Locator } from '@playwright/test';

/** Las secciones empiezan desplegadas; si alguien las plegó, se despliegan. Idempotente. */
export async function expandSection(header: Locator) {
  const expand = header.getByRole('button', { name: 'Desplegar sección', exact: true });
  if (await expand.count()) await expand.first().click();
}
