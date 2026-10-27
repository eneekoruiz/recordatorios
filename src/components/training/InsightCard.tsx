import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useTrainingStore } from '../../store/useTrainingStore';
import { visibleInsights } from '../../utils/patternEngine';
import type { PatternInsight } from '../../models/Training';
import { HapticService } from '../../services/HapticService';

/**
 * Una sugerencia a la vez, con la pregunta concreta y tres respuestas: aceptar la aplica, «Ahora no» la
 * calla 30 días y «Más tarde» la trae de vuelta en 3. Se muestra donde tiene sentido (entrenamiento,
 * fin de una lista, Hoy).
 */
export function InsightCard({ scope, className }: { scope?: PatternInsight['scope'][]; className?: string }) {
  const insights = useTrainingStore((s) => s.insights);
  const decide = useTrainingStore((s) => s.decideInsight);
  const [now] = useState(() => Date.now());
  const insight = visibleInsights(insights, now).find((i) => !scope || scope.includes(i.scope));
  if (!insight) return null;
  const act = (decision: 'accept' | 'dismiss' | 'later') => {
    HapticService.selection();
    decide(insight.id, decision);
  };
  return (
    <section className={`insight-card ${className ?? ''}`} role="region" aria-label="Sugerencia" data-testid="insight-card">
      <div className="insight-card-head">
        <Lightbulb size={16} aria-hidden="true" />
        <span>Sugerencia</span>
      </div>
      <p className="insight-card-text">{insight.message}</p>
      <div className="insight-card-actions">
        <button type="button" className="insight-btn is-primary" onClick={() => act('accept')}>Aceptar</button>
        <button type="button" className="insight-btn" onClick={() => act('later')}>Más tarde</button>
        <button type="button" className="insight-btn" onClick={() => act('dismiss')}>Ahora no</button>
      </div>
    </section>
  );
}
