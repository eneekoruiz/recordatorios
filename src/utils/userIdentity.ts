// Nombre y email que se muestran en la interfaz, derivados de la sesión del propio usuario.

const read = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

export function getUserEmail(): string {
  return read('userEmail');
}

/** Nombre para saludos: el alias guardado o, si no hay, la parte local del email capitalizada. */
export function getUserDisplayName(): string {
  const stored = read('userName').trim();
  if (stored) return stored;
  const local = getUserEmail().split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
  if (!local) return '';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function getUserFirstName(): string {
  return getUserDisplayName().split(' ')[0] || '';
}
