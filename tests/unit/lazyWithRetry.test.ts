import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazyWithRetry } from '../../src/utils/lazyWithRetry';

const storageMock: Record<string, string> = {};
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); },
    key: () => null,
    length: 0
  } as any;
}

describe('lazyWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.sessionStorage.clear();
  });

  it('debe devolver el componente importado correctamente', async () => {
    const dummyComponent = () => null;
    const loader = vi.fn().mockResolvedValue({ default: dummyComponent });

    const LazyComp = lazyWithRetry(loader);
    expect(LazyComp).toBeDefined();
  });

  it('recupera componentes con exportación nombrada', async () => {
    const namedComponent = () => null;
    const loader = vi.fn().mockResolvedValue({ NamedView: namedComponent });

    const LazyComp = lazyWithRetry(loader, 'NamedView');
    expect(LazyComp).toBeDefined();
  });
});
