interface SheetNavBarProps {
  title: string;
  /** Sin él, la barra solo muestra la acción principal (p. ej. «Listo» en paneles informativos). */
  onCancel?: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  /** Color del botón principal (por defecto, el acento de la app). */
  tint?: string;
  cancelLabel?: string;
  /** Texto de ayuda del botón principal. */
  confirmTitle?: string;
}

/**
 * Barra superior de las hojas de edición, como en las apps de Apple: «Cancelar» a la izquierda,
 * el título centrado y la acción principal a la derecha, siempre visible (sin desplazarse hasta el
 * final del formulario para guardar). Es la misma pauta que el editor de recordatorios.
 */
export function SheetNavBar({ title, onCancel, onConfirm, confirmLabel, confirmDisabled, tint, cancelLabel = 'Cancelar', confirmTitle }: SheetNavBarProps) {
  return (
    <div className="sheet-navbar">
      {onCancel ? (
        <button type="button" className="sheet-navbar-btn" onClick={onCancel}>
          {cancelLabel}
        </button>
      ) : <span aria-hidden="true" />}
      <h3 className="sheet-navbar-title" style={{ letterSpacing: '-0.02em', textWrap: 'balance' }}>{title}</h3>
      <button
        type="button"
        className="sheet-navbar-btn is-primary"
        onClick={onConfirm}
        disabled={confirmDisabled}
        title={confirmTitle}
        style={tint && !confirmDisabled ? { color: tint } : undefined}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
