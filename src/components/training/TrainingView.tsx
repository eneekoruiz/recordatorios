import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, MoreHorizontal, Play, Plus } from 'lucide-react';
import { useTrainingStore } from '../../store/useTrainingStore';
import { useAppStore } from '../../store/useAppStore';
import type { Routine, RoutineSplit, TrainingDay } from '../../models/Training';
import { SPLIT_LABELS, buildRoutine } from '../../data/routineTemplates';
import { MUSCLE_LABELS } from '../../data/exerciseLibrary';
import { weeklyVolume } from '../../utils/strength';
import { fmtDuration } from '../../utils/patternEngine';
import { InsightCard } from './InsightCard';
import { RoutineEditor } from './RoutineEditor';
import { TrainingSession } from './TrainingSession';
import './Training.css';

const SPLITS: RoutineSplit[] = ['ppl', 'torso_pierna', 'full_body', 'five_day', 'custom'];
const fmtDate = (at: number) => new Date(at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');

export function TrainingView({ onBack }: { onBack: () => void }) {
  const routines = useTrainingStore((s) => s.routines);
  const sessions = useTrainingStore((s) => s.sessions);
  const activeSession = useTrainingStore((s) => s.activeSession);
  const store = useTrainingStore.getState;
  const userId = useAppStore((s) => s.userId);
  useEffect(() => { useTrainingStore.getState().ensureOwner(userId); }, [userId]);

  const [editing, setEditing] = useState<Routine | null>(null);
  const [running, setRunning] = useState<{ routine: Routine; day: TrainingDay; resume?: boolean } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const active = routines.find((r) => r.status === 'active');
  const saved = routines.filter((r) => r.status === 'saved' || r.status === 'paused');
  const archived = routines.filter((r) => r.status === 'archived');
  const volume = useMemo(() => Object.entries(weeklyVolume(sessions)).sort((a, b) => b[1] - a[1]), [sessions]);
  const maxVolume = Math.max(1, ...volume.map(([, v]) => v));
  const recent = [...sessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 5);
  const resumable = activeSession ? routines.find((r) => r.id === activeSession.routineId) : undefined;

  const create = (split: RoutineSplit) => {
    const routine = buildRoutine(split);
    // La primera rutina que se crea pasa a ser la que está en curso.
    const first = !routines.some((r) => r.status === 'active');
    store().addRoutine({ ...routine, status: first ? 'active' : 'saved' });
    setCreating(false);
    if (split === 'custom') setEditing({ ...routine, status: first ? 'active' : 'saved' });
  };

  const renderMenu = (r: Routine) => (
    <div className="tr-menu" role="menu">
      <button role="menuitem" type="button" onClick={() => { setEditing(r); setMenuFor(null); }}>Editar</button>
      <button role="menuitem" type="button" onClick={() => { setRenaming({ id: r.id, name: r.name }); setMenuFor(null); }}>Renombrar</button>
      <button role="menuitem" type="button" onClick={() => { store().duplicateRoutine(r.id); setMenuFor(null); }}>Duplicar</button>
      {r.status === 'active' && <button role="menuitem" type="button" onClick={() => { store().setRoutineStatus(r.id, 'paused'); setMenuFor(null); }}>Pausar</button>}
      {r.status !== 'archived' && <button role="menuitem" type="button" onClick={() => { store().setRoutineStatus(r.id, 'archived'); setMenuFor(null); }}>Archivar</button>}
      {r.status === 'archived' && <button role="menuitem" type="button" onClick={() => { store().setRoutineStatus(r.id, 'saved'); setMenuFor(null); }}>Recuperar</button>}
      {r.status === 'active' && !r.deload && <button role="menuitem" type="button" onClick={() => { store().updateRoutine(r.id, { deload: true }); setMenuFor(null); }}>Empezar semana de descarga</button>}
      {r.status === 'active' && r.deload && <button role="menuitem" type="button" onClick={() => { store().updateRoutine(r.id, { deload: false }); setMenuFor(null); }}>Terminar la descarga</button>}
      <button role="menuitem" type="button" className="is-danger" onClick={() => { if (window.confirm(`¿Borrar «${r.name}»? Se conservan tus sesiones ya hechas.`)) store().deleteRoutine(r.id); setMenuFor(null); }}>Borrar</button>
    </div>
  );

  return (
    <div className="tr-page">
      <header className="tr-page-head">
        <button type="button" className="tr-back" onClick={onBack}><ChevronLeft size={20} aria-hidden="true" /> Listas</button>
        <h1>Entrenamiento</h1>
      </header>

      {activeSession && resumable && (
        <section className="tr-resume" aria-label="Entrenamiento sin terminar">
          <div><strong>Entrenamiento sin terminar</strong><span>{activeSession.day.name}, {activeSession.sets.length} series hechas</span></div>
          <button type="button" className="tr-primary is-small" onClick={() => setRunning({ routine: resumable, day: activeSession.day, resume: true })}>Continuar</button>
          <button type="button" className="tr-quiet" onClick={() => store().setActiveSession(null)}>Descartar</button>
        </section>
      )}

      <InsightCard scope={['training']} />

      <h2 className="tr-h2">En curso</h2>
      {active ? (
        <section className="tr-card" aria-label="Rutina en curso">
          <div className="tr-card-head">
            <div><strong>{active.name}</strong>{(SPLIT_LABELS[active.split] !== active.name && !SPLIT_LABELS[active.split].startsWith(active.name)) || active.deload ? <span>{SPLIT_LABELS[active.split]}{active.deload ? ', semana de descarga' : ''}</span> : <span>{active.days.length} días</span>}</div>
            <div className="tr-menu-wrap">
              <button type="button" className="tr-icon" aria-label={`Opciones de ${active.name}`} aria-haspopup="menu" aria-expanded={menuFor === active.id} onClick={() => setMenuFor(menuFor === active.id ? null : active.id)}><MoreHorizontal size={20} aria-hidden="true" /></button>
              {menuFor === active.id && renderMenu(active)}
            </div>
          </div>
          <ul className="tr-daylist">
            {active.days.map((d, i) => {
              const isNext = i === active.nextDayIndex;
              return (
                <li key={d.id}>
                  <div className="tr-dayinfo"><strong>{d.name}</strong><span>{d.exercises.length} ejercicios{isNext ? ', te toca' : ''}</span></div>
                  <button type="button" className={isNext ? 'tr-primary is-small' : 'tr-quiet'} disabled={d.exercises.length === 0} onClick={() => setRunning({ routine: active, day: d })} aria-label={`Empezar ${d.name}`}>
                    <Play size={14} aria-hidden="true" /> Empezar
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="tr-card tr-empty-card">
          <p><strong>Sin rutina en curso</strong></p>
          <p className="tr-muted">Crea una a partir de un esquema o activa una guardada.</p>
        </section>
      )}

      <div className="tr-h2-row"><h2 className="tr-h2">Guardadas</h2><button type="button" className="tr-text-btn" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Nueva rutina</button></div>
      {saved.length === 0 && <p className="tr-muted tr-pad">Aquí van tus alternativas: otro esquema, una rutina de vacaciones…</p>}
      <ul className="tr-rows-list">
        {saved.map((r) => (
          <li key={r.id}>
            <div className="tr-dayinfo"><strong>{r.name}</strong><span>{SPLIT_LABELS[r.split]}{r.status === 'paused' ? ', pausada' : ''}</span></div>
            <button type="button" className="tr-quiet" onClick={() => store().setRoutineStatus(r.id, 'active')}>Activar</button>
            <div className="tr-menu-wrap">
              <button type="button" className="tr-icon" aria-label={`Opciones de ${r.name}`} aria-haspopup="menu" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}><MoreHorizontal size={20} aria-hidden="true" /></button>
              {menuFor === r.id && renderMenu(r)}
            </div>
          </li>
        ))}
      </ul>

      {volume.length > 0 && (
        <>
          <h2 className="tr-h2">Series esta semana</h2>
          <ul className="tr-volume">
            {volume.map(([muscle, sets]) => (
              <li key={muscle}><span>{MUSCLE_LABELS[muscle as keyof typeof MUSCLE_LABELS]}</span><div aria-hidden="true"><i style={{ width: `${(sets / maxVolume) * 100}%` }} /></div><span className="tr-num">{Number.isInteger(sets) ? sets : sets.toFixed(1).replace('.', ',')}</span></li>
            ))}
          </ul>
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="tr-h2">Últimas sesiones</h2>
          <ul className="tr-rows-list">
            {recent.map((s) => (
              <li key={s.id}>
                <div className="tr-dayinfo"><strong>{s.dayName}</strong><span>{fmtDate(s.endedAt)}, {fmtDuration(s.durationSec)}{s.prs.length ? `, ${s.prs.length} ${s.prs.length === 1 ? 'récord' : 'récords'}` : ''}</span></div>
                <span className="tr-num">{s.tonnageKg.toLocaleString('es-ES')} kg</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {archived.length > 0 && (
        <details className="tr-archived">
          <summary>Archivadas ({archived.length})</summary>
          <ul className="tr-rows-list">
            {archived.map((r) => (
              <li key={r.id}><div className="tr-dayinfo"><strong>{r.name}</strong></div>
                <div className="tr-menu-wrap"><button type="button" className="tr-icon" aria-label={`Opciones de ${r.name}`} aria-haspopup="menu" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}><MoreHorizontal size={20} aria-hidden="true" /></button>{menuFor === r.id && renderMenu(r)}</div></li>
            ))}
          </ul>
        </details>
      )}

      {creating && (
        <div className="tr-sheet-backdrop" onClick={() => setCreating(false)}>
          <div className="tr-sheet" role="dialog" aria-label="Nueva rutina" onClick={(e) => e.stopPropagation()}>
            <h3>Nueva rutina</h3>
            <p className="tr-muted">Elige un esquema de partida; luego puedes cambiar días y ejercicios.</p>
            <ul className="tr-list">{SPLITS.map((s) => <li key={s}><button type="button" onClick={() => create(s)}><span>{SPLIT_LABELS[s]}</span></button></li>)}</ul>
            <button type="button" className="tr-quiet" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {renaming && (
        <div className="tr-sheet-backdrop" onClick={() => setRenaming(null)}>
          <form className="tr-sheet" role="dialog" aria-label="Renombrar rutina" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (renaming.name.trim()) store().updateRoutine(renaming.id, { name: renaming.name.trim() }); setRenaming(null); }}>
            <h3>Renombrar rutina</h3>
            <input className="tr-search" autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={60} aria-label="Nombre de la rutina" />
            <button type="submit" className="tr-primary">Guardar</button>
            <button type="button" className="tr-quiet" onClick={() => setRenaming(null)}>Cancelar</button>
          </form>
        </div>
      )}
      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} onSave={(r) => { store().updateRoutine(r.id, r); setEditing(null); }} />}
      {running && <TrainingSession routine={running.routine} day={running.day} resume={running.resume ? activeSession : null} onClose={() => setRunning(null)} />}
    </div>
  );
}
