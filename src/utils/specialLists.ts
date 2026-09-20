import type { CustomList, ListSection } from '../models/Task';

/**
 * Determina si una lista o vista corresponde a la lista especial de Caducidades y Suscripciones.
 * Evalúa tanto el ID, el tipo especial, como coincidencias de nombre.
 */
export function isCaducidadesList(listIdOrView?: string | null, list?: CustomList | null): boolean {
  if (!listIdOrView && !list) return false;
  
  const cleanId = (listIdOrView || '').replace(/^list_/, '').toLowerCase();
  if (cleanId === 'caducidades') return true;
  
  if (list) {
    if (list.specialType === 'caducidades') return true;
    if (list.id === 'caducidades') return true;
    
    const cleanName = (list.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
      
    if (
      cleanName.includes('caducidad') ||
      cleanName.includes('caducidades') ||
      cleanName.includes('suscripcion') ||
      cleanName.includes('suscripciones') ||
      cleanName.includes('vencimiento')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Determina si una lista o vista corresponde a la lista especial de Qué he hecho (Bitácora de vida).
 * Evalúa tanto el ID, el tipo especial, como coincidencias de nombre.
 */
export function isQueHeHechoList(listIdOrView?: string | null, list?: CustomList | null): boolean {
  if (!listIdOrView && !list) return false;

  const cleanId = (listIdOrView || '').replace(/^list_/, '').toLowerCase();
  if (cleanId === 'que_he_hecho' || cleanId === 'quehehecho') return true;

  if (list) {
    if (list.specialType === 'que_he_hecho') return true;
    if (list.id === 'que_he_hecho') return true;

    const cleanName = (list.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      cleanName.includes('que he hecho') ||
      cleanName.includes('quehehecho') ||
      cleanName.includes('bitacora') ||
      cleanName.includes('vivencias') ||
      cleanName.includes('diario')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Inicializa las secciones predefinidas de Caducidades si aún no existen para una lista dada.
 */
export function ensureCaducidadesSections(
  listId: string, 
  sections: ListSection[], 
  addSection: (sec: ListSection) => void
): void {
  const currentSections = sections.filter(s => s.listId === listId && !s.deleted_at);

  const hasTarjetas = currentSections.some(s => 
    s.id === 'sec_tarjetas' || 
    s.id === `sec_tarjetas_${listId}` ||
    /tarjeta|documento|banco/i.test(s.name)
  );

  const hasSuscripciones = currentSections.some(s => 
    s.id === 'sec_suscripciones' || 
    s.id === `sec_suscripciones_${listId}` ||
    /suscrip|servicio|recurrente/i.test(s.name)
  );

  if (!hasTarjetas) {
    addSection({
      id: listId === 'caducidades' ? 'sec_tarjetas' : `sec_tarjetas_${listId}`,
      listId,
      name: 'Tarjetas y Documentos',
      order: 0
    });
  }

  if (!hasSuscripciones) {
    addSection({
      id: listId === 'caducidades' ? 'sec_suscripciones' : `sec_suscripciones_${listId}`,
      listId,
      name: 'Suscripciones',
      order: 1
    });
  }
}

/**
 * Determina si una lista o vista corresponde a la lista de Limpieza.
 */
export function isLimpiezaList(listIdOrView?: string | null, list?: CustomList | null): boolean {
  if (!listIdOrView && !list) return false;
  const cleanId = (listIdOrView || '').replace(/^list_/, '').toLowerCase();
  if (cleanId === 'limpieza') return true;
  if (list) {
    if (list.id === 'limpieza') return true;
    const cleanName = (list.name || '').toLowerCase();
    if (cleanName === 'limpieza') return true;
  }
  return false;
}

/**
 * Determina si una lista o vista corresponde a una lista de rutinas periódicas (Limpieza, Quehaceres).
 */
export function isRoutineList(listIdOrView?: string | null, list?: CustomList | null): boolean {
  if (!listIdOrView && !list) return false;
  const cleanId = (listIdOrView || '').replace(/^list_/, '').toLowerCase();
  if (cleanId === 'limpieza' || cleanId === 'quehaceres') return true;
  if (list) {
    if (list.id === 'limpieza' || list.id === 'quehaceres') return true;
    const cleanName = (list.name || '').toLowerCase();
    if (cleanName === 'limpieza' || cleanName === 'quehaceres' || cleanName.includes('quehacer')) return true;
  }
  return false;
}

/**
 * Asegura las 4 secciones unificadas estándar de rutinas (Diarias, Semanales, Mensuales, Anuales)
 * tanto para Limpieza como para Quehaceres y cualquier otra lista de tareas periódicas.
 */
export function ensureRoutineSections(
  listId: string,
  sections: ListSection[],
  addSection: (sec: ListSection) => void
): void {
  const currentSections = sections.filter(s => s.listId === listId && !s.deleted_at);
  const required = [
    { id: `sec_${listId}_diaria`, name: 'Diarias', order: 0, root: 'diari' },
    { id: `sec_${listId}_semanal`, name: 'Semanales', order: 1, root: 'seman' },
    { id: `sec_${listId}_mensual`, name: 'Mensuales', order: 2, root: 'mensu' },
    { id: `sec_${listId}_anual`, name: 'Anuales', order: 3, root: 'anual' },
  ];

  required.forEach(req => {
    const exists = currentSections.some(s => 
      s.id === req.id || 
      s.id === `sec_limpieza_${req.root}` ||
      s.name.toLowerCase().includes(req.root) ||
      (req.root === 'diari' && s.name.toLowerCase().includes('recurrent'))
    );
    if (!exists) {
      addSection({
        id: listId === 'limpieza' ? `sec_limpieza_${req.root}` : req.id,
        listId,
        name: req.name,
        order: req.order
      });
    }
  });
}

/**
 * Inicializa y asegura las 4 secciones estándar de Limpieza: Diarias, Semanales, Mensuales, Anuales.
 */
export function ensureLimpiezaSections(
  listId: string,
  sections: ListSection[],
  addSection: (sec: ListSection) => void
): void {
  ensureRoutineSections(listId, sections, addSection);
}

