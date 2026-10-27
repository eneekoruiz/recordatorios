import { Minus, Plus } from 'lucide-react';

/** Campo numérico con − y + de 44 px: el teclado del móvil estorba entre series. */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 9999, unit, decimals = 0, id }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; decimals?: number; id?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(decimals || 1).replace('.', ',');
  return (
    <div className="tr-stepper" role="group" aria-label={label}>
      <button type="button" className="tr-stepper-btn" onClick={() => onChange(clamp(value - step))} aria-label={`Quitar ${step}${unit ? ` ${unit}` : ''} a ${label}`}><Minus size={18} aria-hidden="true" /></button>
      <label className="tr-stepper-field">
        <span className="tr-stepper-label">{label}</span>
        <input
          id={id} inputMode="decimal" value={shown}
          onChange={(e) => { const n = parseFloat(e.target.value.replace(',', '.')); if (!Number.isNaN(n)) onChange(clamp(n)); }}
          onFocus={(e) => e.target.select()} aria-label={label}
        />
        {unit && <span className="tr-stepper-unit">{unit}</span>}
      </label>
      <button type="button" className="tr-stepper-btn" onClick={() => onChange(clamp(value + step))} aria-label={`Sumar ${step}${unit ? ` ${unit}` : ''} a ${label}`}><Plus size={18} aria-hidden="true" /></button>
    </div>
  );
}
