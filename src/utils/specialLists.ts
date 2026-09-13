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
