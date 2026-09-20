// Utilidades puras del motor de sincronización (testeables sin base de datos).
//
// Los IDs que genera el cliente (p. ej. 'compras', 'caducidades', 'task_onboarding_1')
// no son únicos entre usuarios. Para que dos cuentas nunca compartan fila, la clave
// primaria en base de datos es `${userId}:${clientId}`. Las filas antiguas (creadas
// antes de este cambio con el ID "crudo") se siguen leyendo y actualizando si
// pertenecen al usuario.

export const MAX_ID_LENGTH = 200;

export const scopedId = (userId, clientId) => `${userId}:${clientId}`;

export const clientIdOf = (userId, rowId) => {
  const prefix = `${userId}:`;
  return rowId.startsWith(prefix) ? rowId.slice(prefix.length) : rowId;
};

export const isValidClientId = (id) =>
  typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH;

const toTime = (value) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Last-Write-Wins en el servidor: decide si el payload entrante debe sobrescribir
 * al almacenado. Gana la versión más alta; a igual versión, el updated_at más reciente.
 * Así un dispositivo con datos antiguos nunca pisa cambios más nuevos de otro.
 */
export const shouldApplyIncoming = (incoming, existing) => {
  if (!existing) return true;
  const inV = Number(incoming?.version) || 0;
  const exV = Number(existing?.version) || 0;
  if (inV !== exV) return inV > exV;
  return toTime(incoming?.updated_at) >= toTime(existing?.updated_at);
};

export const parseDeletedAt = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Normaliza el payload que devolvemos al cliente: id de cliente + deleted_at coherente. */
export const toClientPayload = (userId, row) => {
  const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  payload.id = clientIdOf(userId, row.id);
  if (row.deletedAt && !payload.deleted_at) {
    payload.deleted_at = new Date(row.deletedAt).toISOString();
  }
  if (Array.isArray(row.sharedLinks)) {
    payload.isShared = row.sharedLinks.length > 0;
  }
  return payload;
};

/** Elimina campos exclusivamente locales antes de persistir. */
export const sanitizePayload = (item) => {
  const clean = { ...item };
  delete clean._is_dirty;
  return clean;
};
