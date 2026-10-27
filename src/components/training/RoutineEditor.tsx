import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X, ChevronDown } from 'lucide-react';
import type { PlannedExercise, Routine, TrainingDay } from '../../models/Training';
import { EXERCISE_LIBRARY, MUSCLE_LABELS, alternativesFor, getExercise } from '../../data/exerciseLibrary';
import { newId, plannedFrom } from '../../data/routineTemplates';
import { fmtDuration } from '../../utils/patternEngine';
import { Stepper } from './Stepper';
import './Training.css';

const summary = (e: PlannedExercise) =>
  `${e.sets} × ${e.repMin}–${e.repMax}${e.rir !== undefined ? `, RIR ${e.rir}` : ''}, descanso ${fmtDuration(e.restSec)}`;

/** Editor de una rutina: nombre, días y ejercicios con su prescripción. Los cambios se aplican al pulsar «Listo». */
export function RoutineEditor({ routine, onSave, onClose }: { routine: Routine; onSave: (r: Routine) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Routine>(() => structuredClone(routine));
  const [dayIndex, setDayIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const day = draft.days[Math.min(dayIndex, draft.days.length - 1)];

  const patchDay = (fn: (d: TrainingDay) => TrainingDay) =>
    setDraft((r) => ({ ...r, days: r.days.map((d) => (d.id === day.id ? fn(d) : d)) }));
  const patchExercise = (id: string, patch: Partial<PlannedExercise>) =>
    patchDay((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const move = (index: number, delta: number) =>
    patchDay((d) => {
      const list = [...d.exercises];
      const target = index + delta;
      if (target < 0 || target >= list.length) return d;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...d, exercises: list };
    });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISE_LIBRARY.filter((e) => !q || e.name.toLowerCase().includes(q) || MUSCLE_LABELS[e.primary].toLowerCase().includes(q)).slice(0, 40);
  }, [query]);

  return (
    <div className="tr-screen" role="dialog" aria-modal="true" aria-label="Editar rutina">
      <header className="tr-topbar">
        <button type="button" className="tr-text-btn" onClick={onClose}>Cancelar</button>
        <div className="tr-topbar-title"><strong>Editar rutina</strong></div>
        <button type="button" className="tr-text-btn is-strong" onClick={() => onSave({ ...draft, name: draft.name.trim() || 'Mi rutina', nextDayIndex: Math.min(draft.nextDayIndex, Math.max(0, draft.days.length - 1)) })}>Listo</button>
      </header>
      <div className="tr-screen-body tr-edit">
        <label className="tr-field">
          <span>Nombre</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
        </label>

        <div className="tr-days" role="tablist" aria-label="Días">
          {draft.days.map((d, i) => (
            <button key={d.id} type="button" role="tab" aria-selected={i === dayIndex} className={i === dayIndex ? 'is-on' : ''} onClick={() => { setDayIndex(i); setOpenId(null); }}>{d.name}</button>
          ))}
          <button type="button" className="tr-day-add" onClick={() => {
            const d: TrainingDay = { id: newId('day'), name: `Día ${draft.days.length + 1}`, exercises: [] };
            setDraft({ ...draft, days: [...draft.days, d] });
            setDayIndex(draft.days.length);
          }} aria-label="Añadir día"><Plus size={16} aria-hidden="true" /></button>
        </div>

        {day && (
          <>
            <div className="tr-day-head">
              <label className="tr-field">
                <span>Nombre del día</span>
                <input value={day.name} onChange={(e) => patchDay((d) => ({ ...d, name: e.target.value }))} maxLength={40} />
              </label>
              {draft.days.length > 1 && (
                <button type="button" className="tr-quiet is-danger" onClick={() => {
                  setDraft({ ...draft, days: draft.days.filter((d) => d.id !== day.id) });
                  setDayIndex(0);
                }}><Trash2 size={16} aria-hidden="true" /> Quitar día</button>
              )}
            </div>

            <ul className="tr-exlist">
              {day.exercises.map((e, i) => {
                const open = openId === e.id;
                const def = getExercise(e.exerciseId);
                return (
                  <li key={e.id} className={open ? 'is-open' : ''}>
                    <button type="button" className="tr-exrow" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open}>
                      <span className="tr-exname">{e.name}</span>
                      <span className="tr-exsum">{summary(e)}</span>
                      <ChevronDown size={16} aria-hidden="true" className="tr-chev" />
                    </button>
                    {open && (
                      <div className="tr-exedit">
                        {def && <p className="tr-muted">{MUSCLE_LABELS[def.primary]}{def.secondary.length ? `, también ${def.secondary.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(' y ')}` : ''}. {def.kind}, {def.equipment.replace('_', ' ')}.</p>}
                        <div className="tr-grid">
                          <Stepper label="Series" value={e.sets} onChange={(v) => patchExercise(e.id, { sets: v })} min={1} max={12} />
                          <Stepper label="Rep. mín." value={e.repMin} onChange={(v) => patchExercise(e.id, { repMin: v, repMax: Math.max(e.repMax, v) })} min={1} max={50} />
                          <Stepper label="Rep. máx." value={e.repMax} onChange={(v) => patchExercise(e.id, { repMax: Math.max(v, e.repMin) })} min={1} max={50} />
                          <Stepper label="RIR" value={e.rir ?? 0} onChange={(v) => patchExercise(e.id, { rir: v })} min={0} max={5} />
                          <Stepper label="Descanso entre series" value={e.restSec} onChange={(v) => patchExercise(e.id, { restSec: v })} step={15} min={15} max={900} unit="s" />
                          <Stepper label="Descanso al cambiar de ejercicio" value={e.transitionRestSec} onChange={(v) => patchExercise(e.id, { transitionRestSec: v })} step={15} min={0} max={900} unit="s" />
                        </div>
                        {alternativesFor(e.exerciseId, e.alternativeIds).length > 0 && (
                          <p className="tr-muted">Alternativas: {alternativesFor(e.exerciseId, e.alternativeIds).slice(0, 4).map((a) => a.name).join(', ')}.</p>
                        )}
                        <div className="tr-exactions">
                          <button type="button" className="tr-quiet" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={16} aria-hidden="true" /> Subir</button>
                          <button type="button" className="tr-quiet" onClick={() => move(i, 1)} disabled={i === day.exercises.length - 1}><ArrowDown size={16} aria-hidden="true" /> Bajar</button>
                          <button type="button" className="tr-quiet is-danger" onClick={() => patchDay((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== e.id) }))}><Trash2 size={16} aria-hidden="true" /> Quitar</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {day.exercises.length === 0 && <p className="tr-muted tr-empty">Este día no tiene ejercicios todavía.</p>}
            <button type="button" className="tr-add" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" /> Añadir ejercicio</button>
          </>
        )}
      </div>

      {adding && (
        <div className="tr-sheet-backdrop" onClick={() => setAdding(false)}>
          <div className="tr-sheet tr-sheet-tall" role="dialog" aria-label="Añadir ejercicio" onClick={(e) => e.stopPropagation()}>
            <div className="tr-sheet-head"><h3>Añadir ejercicio</h3><button type="button" className="tr-icon" onClick={() => setAdding(false)} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button></div>
            <input className="tr-search" autoFocus placeholder="Buscar por nombre o músculo" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar ejercicio" />
            <ul className="tr-list">
              {results.map((def) => (
                <li key={def.id}><button type="button" onClick={() => { patchDay((d) => ({ ...d, exercises: [...d.exercises, plannedFrom(def.id)] })); setAdding(false); setQuery(''); }}>
                  <span>{def.name}</span><span className="tr-muted">{MUSCLE_LABELS[def.primary]}</span></button></li>
              ))}
              {query.trim() && !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()) && (
                <li><button type="button" onClick={() => { patchDay((d) => ({ ...d, exercises: [...d.exercises, plannedFrom(newId('custom'), { name: query.trim() })] })); setAdding(false); setQuery(''); }}>
                  <span>Crear «{query.trim()}»</span><span className="tr-muted">Personalizado</span></button></li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
