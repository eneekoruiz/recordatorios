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

/** Nombre guardado en este dispositivo (lo sincroniza el store como preferencia). */
export function readStoredDisplayName(): string {
  return read('userName').trim();
}

export function writeStoredDisplayName(name: string): void {
  try {
    if (name) localStorage.setItem('userName', name);
    else localStorage.removeItem('userName');
  } catch {
    /* sin almacenamiento: basta con el store */
  }
}

/**
 * Nombre para saludos: el que el usuario escribió (al crear la cuenta o en su perfil).
 * Si no hay, no se inventa a partir del email («eneko.r_94» no es un nombre).
 */
export function getUserDisplayName(): string {
  return readStoredDisplayName();
}

export function getUserFirstName(): string {
  return getUserDisplayName().split(' ')[0] || '';
}
