import { createElement, useEffect, useMemo, useState } from 'react';
import { Circle, CheckCircle2, Link2Off, ListChecks } from 'lucide-react';
import { apiUrl } from '../../sync/syncManager';
import { getListIcon } from '../../constants/icons';
import './SharedListView.css';

interface SharedPayload {
  list: { id: string; name: string; color?: string; icon?: string };
  tasks: Array<{ id: string; title: string; description?: string; status?: string; dueDate?: string; sectionId?: string; price?: number; quantity?: number; order?: number; created_at?: string }>;
  sections: Array<{ id: string; name: string; order?: number }>;
}

/** Vista pública de solo lectura para enlaces del tipo /?share=<token>. */
export function SharedListView({ token, onExit }: { token: string; onExit: () => void }) {
  const [data, setData] = useState<SharedPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/share/${encodeURIComponent(token)}`))
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'No se pudo cargar la lista');
        if (!cancelled) setData(body);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const groups = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));
    const sections = [...data.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const known = new Set(sections.map((s) => s.id));
    const out = [{ id: 'none', name: '', tasks: sorted.filter((t) => !t.sectionId || !known.has(t.sectionId)) }];
    for (const s of sections) out.push({ id: s.id, name: s.name, tasks: sorted.filter((t) => t.sectionId === s.id) });
    return out.filter((g) => g.tasks.length > 0);
  }, [data]);

  const color = data?.list.color || 'var(--accent-primary)';
  // Icono de la lista: un componente fijo del catálogo (createElement deja claro que no
  // se define en cada render, solo se elige cuál pintar).
  const icon = createElement(data ? getListIcon(data.list.icon) : ListChecks, { size: 20, color: '#fff' });
  const pending = data?.tasks.filter((t) => t.status !== 'completed').length ?? 0;

  return (
    <div className="shared-view">
      <main className="shared-card">
        {error ? (
          <div className="shared-empty">
            <Link2Off size={36} />
            <h1>Enlace no disponible</h1>
            <p>{error}. Puede que el propietario haya dejado de compartir esta lista.</p>
          </div>
        ) : !data ? (
          <div className="shared-empty"><p>Cargando lista…</p></div>
        ) : (
          <>
            <header className="shared-header">
              <span className="shared-icon" style={{ background: color }}>{icon}</span>
              <div>
                <h1 style={{ color }}>{data.list.name}</h1>
                <p>{pending} pendiente{pending === 1 ? '' : 's'} · Lista compartida de solo lectura</p>
              </div>
            </header>
            {groups.length === 0 && <p className="shared-muted">Esta lista está vacía.</p>}
            {groups.map((g) => (
              <section key={g.id} className="shared-section">
                {g.name && <h2>{g.name}</h2>}
                <ul>
                  {g.tasks.map((t) => {
                    const done = t.status === 'completed';
                    return (
                      <li key={t.id} className={done ? 'is-done' : ''}>
                        {done ? <CheckCircle2 size={20} color={color} /> : <Circle size={20} />}
                        <div>
                          <span className="shared-title">{t.title}</span>
                          {(t.description || t.dueDate || t.price) && (
                            <span className="shared-meta">
                              {[
                                t.dueDate && new Date(t.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
                                t.price != null && `${(t.price * (t.quantity || 1)).toFixed(2)} €`,
                                t.description,
                              ].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
        <button type="button" className="shared-cta" onClick={onExit}>Abrir Recordatorios</button>
      </main>
    </div>
  );
}
