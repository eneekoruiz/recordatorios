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
 * Determina si una lista o vista corresponde a una lista de rutinas periódicas (Limpieza, Quehaceres, Care).
 */
export function isRoutineList(listIdOrView?: string | null, list?: CustomList | null): boolean {
  if (!listIdOrView && !list) return false;
  const cleanId = (listIdOrView || '').replace(/^list_/, '').toLowerCase();
  if (cleanId === 'limpieza' || cleanId === 'quehaceres' || cleanId === 'care') return true;
  if (list) {
    if (list.id === 'limpieza' || list.id === 'quehaceres' || list.id === 'care') return true;
    const cleanName = (list.name || '').toLowerCase();
    if (cleanName === 'limpieza' || cleanName === 'quehaceres' || cleanName.includes('quehacer') || cleanName === 'care' || cleanName.includes('cuidado') || cleanName.includes('skincare')) return true;
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
      s.id === `sec_limpieza_${req.root === 'diari' ? 'diaria' : req.root === 'seman' ? 'semanal' : req.root === 'mensu' ? 'mensual' : 'anual'}` ||
      s.name.toLowerCase().includes(req.root) ||
      (req.root === 'diari' && s.name.toLowerCase().includes('recurrent'))
    );
    if (!exists) {
      addSection({
        id: req.id,
        listId,
        name: req.name,
        order: req.order
      });
    }
  });
}

/**
 * Clasifica una tarea de limpieza en su estancia correspondiente (Cocina, Baño, Habitación, Pasillo / Entrada, Balcón, General).
 */
export function getRoomForCleaningTask(title?: string | null): 'Cocina' | 'Baño' | 'Habitación' | 'Pasillo / Entrada' | 'Balcón' | 'General' {
  if (!title) return 'General';
  const t = title.toLowerCase();

  // Cocina
  if (
    t.includes('plato') || t.includes('lavavajillas') || t.includes('vitro') ||
    t.includes('fregadero') || t.includes('cocina') || t.includes('microondas') ||
    t.includes('bayeta') || t.includes('escurreplatos') || t.includes('horno') ||
    t.includes('campana') || t.includes('despensa') || t.includes('frigorífico') ||
    t.includes('frigo') || t.includes('congelador') || t.includes('electrodoméstico') ||
    t.includes('encimera') || t.includes('fuegos') || t.includes('fregona') ||
    t.includes('cubo de basura') || t.includes('basura')
  ) {
    return 'Cocina';
  }

  // Baño
  if (
    t.includes('lavabo') || t.includes('baño') || t.includes('bano') || t.includes('ducha') ||
    t.includes('inodoro') || t.includes('toalla') || t.includes('toallero') ||
    t.includes('cepillo de diente') || t.includes('portacepillos') ||
    t.includes('jabonera') || t.includes('bandejita') || t.includes('rebosadero') ||
    t.includes('desagüe') || t.includes('mampara') || t.includes('alcachofa') ||
    t.includes('anti-humedad') || t.includes('antihumedad') || t.includes('azulejo') ||
    t.includes('váter') || t.includes('vater') || t.includes('bidet') || t.includes('bidé') ||
    (t.includes('espejo') && !t.includes('entrada') && !t.includes('recibidor'))
  ) {
    return 'Baño';
  }

  // Habitación
  if (
    t.includes('cama') || t.includes('colchón') || t.includes('colchon') ||
    t.includes('canapé') || t.includes('canape') || t.includes('almohada') ||
    t.includes('edredón') || t.includes('edredon') || t.includes('sábana') ||
    t.includes('sabana') || t.includes('mesilla') || t.includes('escritorio') ||
    t.includes('armario de ropa') || t.includes('ropa de temporada') ||
    t.includes('armario a fondo') || t.includes('habitación') || t.includes('habitacion') ||
    t.includes('cortina') || t.includes('estor') || t.includes('ropa sucia') ||
    t.includes('cesto') || t.includes('manta') || t.includes('funda')
  ) {
    return 'Habitación';
  }

  // Pasillo / Entrada
  if (
    t.includes('entrada') || t.includes('pasillo') || t.includes('zapatero') ||
    t.includes('zapatilla') || t.includes('puerta de entrada') || t.includes('puerta principal') ||
    t.includes('perchero') || t.includes('espejo de entrada') || t.includes('recibidor') ||
    t.includes('felpudo')
  ) {
    return 'Pasillo / Entrada';
  }

  // Balcón
  if (
    t.includes('balcón') || t.includes('balcon') || t.includes('barandilla') ||
    t.includes('maceta') || t.includes('exterior') || t.includes('terraza') ||
    t.includes('toldo')
  ) {
    return 'Balcón';
  }

  // General
  return 'General';
}

/**
 * Inicializa y asegura las 4 secciones estándar de Limpieza: Diarias, Semanales, Mensuales, Anuales,
 * así como sus subgrupos/subsecciones de estancia (Cocina, Baño, Habitación, etc.) para mantener la organización.
 */
export function ensureLimpiezaSections(
  listId: string,
  sections: ListSection[],
  addSection: (sec: ListSection) => void,
  updateSection?: (id: string, updates: Partial<ListSection>) => void
): void {
  ensureRoutineSections(listId, sections, addSection);

  const currentSections = sections.filter(s => s.listId === listId && !s.deleted_at);
  const rootDiaria = currentSections.find(s => s.id === 'sec_limpieza_diaria' || s.id === 'sec_limp_diaria' || (!s.parentId && s.name.toLowerCase().includes('diari')));
  const rootSemanal = currentSections.find(s => s.id === 'sec_limpieza_semanal' || s.id === 'sec_limp_semanal' || (!s.parentId && s.name.toLowerCase().includes('seman')));
  const rootMensual = currentSections.find(s => s.id === 'sec_limpieza_mensual' || s.id === 'sec_limp_mensual' || (!s.parentId && s.name.toLowerCase().includes('mensu')));
  const rootAnual = currentSections.find(s => s.id === 'sec_limpieza_anual' || s.id === 'sec_limp_anual' || (!s.parentId && s.name.toLowerCase().includes('anual')));

  const roomDefs = [
    { freq: 'diaria', parentId: rootDiaria?.id || 'sec_limpieza_diaria', rooms: ['Cocina', 'Baño', 'Habitación', 'Pasillo / Entrada', 'General'] },
    { freq: 'semanal', parentId: rootSemanal?.id || 'sec_limpieza_semanal', rooms: ['Cocina', 'Baño', 'Habitación', 'Pasillo / Entrada', 'Balcón', 'General'] },
    { freq: 'mensual', parentId: rootMensual?.id || 'sec_limpieza_mensual', rooms: ['Cocina', 'Baño', 'Habitación', 'Pasillo / Entrada', 'Balcón', 'General'] },
    { freq: 'anual', parentId: rootAnual?.id || 'sec_limpieza_anual', rooms: ['Cocina', 'Baño', 'Habitación', 'Pasillo / Entrada', 'Balcón', 'General'] },
  ];

  roomDefs.forEach(def => {
    def.rooms.forEach((roomName, idx) => {
      const roomSlug = roomName === 'Pasillo / Entrada' ? 'pasillo' :
                       roomName === 'Habitación' ? 'hab' :
                       roomName === 'Baño' ? 'bano' :
                       roomName === 'Balcón' ? 'balcon' :
                       roomName === 'Cocina' ? 'cocina' : 'general';
      const secId = `sec_limp_${def.freq}_${roomSlug}`;
      const existing = currentSections.find(s => s.id === secId || s.name.toLowerCase() === roomName.toLowerCase() && (s.parentId === def.parentId || s.parentId === def.parentId.replace('sec_limpieza_', 'sec_limp_')));
      if (!existing) {
        addSection({
          id: secId,
          listId,
          parentId: def.parentId,
          name: roomName,
          order: idx
        });
      } else if (existing.parentId !== def.parentId && updateSection) {
        updateSection(existing.id, { parentId: def.parentId });
      }
    });
  });
}

