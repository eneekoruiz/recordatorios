import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scopedId, toClientPayload } from './syncUtils.js';
import { getTaskPeriodicity, routineRoundsOn } from '../shared/periodicity.js';

const execAsync = promisify(exec);

// MCP (Model Context Protocol) Server implementation
// Implements JSON-RPC 2.0 endpoints for tools, resources, and prompts

export const MCP_TOOLS = [
  {
    name: 'ensure_essential_routines',
    description: 'Garantiza que las rutinas esenciales del usuario estén creadas en el sistema sin duplicar: 1) Chequeo preventivo médico y dental anual, 2) Revisión anual de seguro dental y pólizas, 3) Respaldo final de curso de Egela / Moodle fijado para junio.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'manage_app_mode',
    description: 'Gestiona o consulta el modo estacional de la aplicación (normal, examenes, vacaciones). En "examenes", prioriza entregas académicas/TFG/estudio y silencia o suaviza rutinas domésticas. En "vacaciones", pausa avisos académicos y mantiene hábitos ligeros y descanso. En "normal", todas las rutinas operan equilibradas.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set'],
          description: 'Acción a realizar: "get" para consultar el modo actual, "set" para cambiar de modo.'
        },
        mode: {
          type: 'string',
          enum: ['normal', 'examenes', 'vacaciones'],
          description: 'Modo a activar (requerido si action="set")'
        },
        until: {
          type: 'string',
          description: 'Fecha límite opcional en formato ISO (ej: "2026-06-30") hasta la que dura el modo.'
        },
        reason: {
          type: 'string',
          description: 'Motivo o contexto del cambio de modo (ej: "Convocatoria de exámenes", "Vacaciones de verano")'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'run_system_maintenance',
    description: 'Ejecuta o audita tareas técnicas de mantenimiento del sistema: winget (comprobar o actualizar software), purga de caché/temporales, auditoría de instalables antiguos en descargas, y revisión de estado Git / alertas Dependabot.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['winget_check', 'winget_upgrade', 'clean_temp_cache', 'clean_downloads', 'git_dependabot_audit'],
          description: 'Acción de mantenimiento a ejecutar'
        },
        dryRun: {
          type: 'boolean',
          description: 'Si es true (por defecto), solo audita e informa sin borrar ni modificar nada'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'get_stats',
    description: 'Obtiene estadísticas completas y métricas en tiempo real: total de tareas, completadas, pendientes, vencidas, para hoy, tasa de cumplimiento, resumen de listas de compras y alertas de caducidad.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_periodic_routines',
    description: 'Obtiene las rutinas y recordatorios periódicos (diarios, semanales, mensuales y anuales), clasificando tareas que la IA puede asistir o automatizar (actualizaciones, winget, egela, software, copias de seguridad) frente a tareas físicas/manuales (limpieza, compras, hogar) sobre las que la IA debe preguntar al usuario.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['all', 'day', 'week', 'month', 'year'],
          description: 'Filtrar por periodicidad: day (diarias), week (semanales), month (mensuales), year (anuales), all (todas)'
        },
        includeCompleted: {
          type: 'boolean',
          description: 'Si es true incluye también tareas ya completadas en su periodo'
        },
        includePaused: {
          type: 'boolean',
          description: 'Si es true incluye también tareas pausadas o archivadas de etapas anteriores'
        }
      }
    }
  },
  {
    name: 'manage_routine_status',
    description: 'Pausa, reactiva o archiva una tarea o rutina periódica para etapas cambiantes (ej. terminar una carrera, mudanza o cambio de estudios/trabajo), conservando todo el historial de ejecuciones, scripts y notas sin borrarla.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del recordatorio' },
        title: { type: 'string', description: 'Título aproximado del recordatorio' },
        action: { type: 'string', enum: ['pause', 'resume', 'archive'], description: 'Acción a realizar: pause (desactivar temporalmente), resume (reactivar), archive (archivar permanentemente)' },
        reason: { type: 'string', description: 'Motivo o contexto (ej: "Fin de grado en la EHU", "Cambio de vivienda", "Curso superado")' }
      },
      required: ['action']
    }
  },
  {
    name: 'attach_task_playbook',
    description: 'Guarda o actualiza las instrucciones paso a paso, script o procedimiento (Playbook/Skill) que la IA debe seguir para ejecutar o verificar esta tarea (ej: comandos para descargar Egela/Moodle, comprobaciones con Playwright o Google Drive).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del recordatorio' },
        title: { type: 'string', description: 'Título del recordatorio si no se tiene el ID' },
        playbook: { type: 'string', description: 'Instrucciones paso a paso, comandos de consola o procedimiento para que la IA lo ejecute o asista' },
        verificationMethod: { type: 'string', description: 'Método de verificación (ej: "Playwright", "Drive check", "winget cli", "manual")' }
      },
      required: ['playbook']
    }
  },
  {
    name: 'log_routine_execution',
    description: 'Registra una ejecución de una rutina en el historial técnico de la tarea (qué se descargó, qué se verificó, errores o notas de legibilidad) y opcionalmente la marca como completada.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID del recordatorio' },
        title: { type: 'string', description: 'Título del recordatorio' },
        notes: { type: 'string', description: 'Detalle de la ejecución (ej: "Descargados 24 PDFs de Egela EHU, comprobados con Playwright y respaldados en Drive")' },
        status: { type: 'string', enum: ['ok', 'partial', 'failed'], description: 'Resultado de la ejecución' },
        markCompleted: { type: 'boolean', description: 'Si es true, marca la tarea como completada para el periodo actual' }
      },
      required: ['notes']
    }
  },
  {
    name: 'suggest_periodic_best_practices',
    description: 'Obtiene un catálogo de buenas prácticas y rutinas periódicas recomendadas (académicas, mantenimiento de software, finanzas, hogar y salud) con playbooks listos para que la IA se las proponga al usuario.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'academic', 'software', 'finance', 'home'],
          description: 'Categoría de buenas prácticas a consultar'
        }
      }
    }
  },
  {
    name: 'complete_reminder',
    description: 'Marca uno o varios recordatorios como completados inmediatamente, buscándolos por su ID o por su título (coincidencia exacta o aproximada).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID exacto del recordatorio a completar' },
        title: { type: 'string', description: 'Título del recordatorio (si no se conoce el ID)' }
      }
    }
  },
  {
    name: 'list_lists',
    description: 'Obtiene las listas y carpetas de recordatorios del usuario para saber dónde organizar tareas.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_list',
    description: 'Crea una nueva lista de recordatorios con un nombre, color e icono opcional.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la lista (ej: "Viaje a Roma", "Reforma Casa")' },
        color: { type: 'string', description: 'Color hexadecimal o nombre CSS (ej: "#007aff", "#ff9500")' },
        icon: { type: 'string', description: 'Nombre del icono (ej: "plane", "home", "shopping-cart")' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_reminders',
    description: 'Crea uno o varios recordatorios estructurados en las listas del usuario basándose en sus instrucciones.',
    inputSchema: {
      type: 'object',
      properties: {
        reminders: {
          type: 'array',
          description: 'Lista de recordatorios a crear',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título claro y conciso del recordatorio' },
              description: { type: 'string', description: 'Notas adicionales o detalles' },
              listName: { type: 'string', description: 'Nombre de la lista destino sugerida (ej: "Compras", "Inbox")' },
              listId: { type: 'string', description: 'ID de la lista destino si se conoce' },
              dueDate: { type: 'string', description: 'Fecha y hora límite en formato ISO 8601' },
              timeOfDay: { type: 'string', enum: ['morning', 'afternoon', 'night'], description: 'Franja horaria: morning (mañana), afternoon (tarde), night (noche)' },
              price: { type: 'number', description: 'Precio o presupuesto asociado en euros (si aplica)' },
              quantity: { type: 'number', description: 'Cantidad de unidades (opcional)' },
              priority: { type: 'string', enum: ['none', 'low', 'medium', 'high'], description: 'Nivel de prioridad' },
              cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'], description: 'Frecuencia de recurrencia si es periódica' }
            },
            required: ['title']
          }
        }
      },
      required: ['reminders']
    }
  },
  {
    name: 'query_reminders',
    description: 'Busca recordatorios existentes del usuario para verificar tareas pendientes o evitar duplicados.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda' },
        listId: { type: 'string', description: 'Filtrar por ID de lista opcional' }
      }
    }
  },
  {
    name: 'group_reminders',
    description: 'Agrupa múltiples recordatorios bajo un recordatorio principal padre (creándolo si no existe), asignando subtareas con precio unitario, cantidad y ciclo para calcular el total acumulado.',
    inputSchema: {
      type: 'object',
      properties: {
        parentTitle: { type: 'string', description: 'Título del recordatorio padre (ej: "Productos de belleza")' },
        parentId: { type: 'string', description: 'ID del recordatorio padre si ya existe' },
        listName: { type: 'string', description: 'Nombre de la lista donde agrupar (ej: "compra", "Inbox")' },
        listId: { type: 'string', description: 'ID de la lista destino si se conoce' },
        sectionId: { type: 'string', description: 'ID de la sección destino si se conoce' },
        cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'], description: 'Frecuencia de recurrencia para el grupo' },
        childTaskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs de recordatorios existentes que deben convertirse en subtareas del padre'
        },
        items: {
          type: 'array',
          description: 'Detalles de las subtareas a asociar o actualizar con precio y cantidad',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID de la tarea existente si se conoce' },
              title: { type: 'string', description: 'Título de la subtarea' },
              price: { type: 'number', description: 'Precio unitario en euros' },
              quantity: { type: 'number', description: 'Cantidad de unidades' },
              cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'] }
            },
            required: ['title']
          }
        }
      },
      required: ['parentTitle']
    }
  },
  {
    name: 'update_reminders',
    description: 'Actualiza uno o más recordatorios existentes (precio, cantidad, lista, sección, ciclo, subtarea/padre, título, estado, descripción).',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID del recordatorio a actualizar' },
              title: { type: 'string', description: 'Nuevo título (opcional)' },
              price: { type: 'number', description: 'Precio unitario en euros (opcional)' },
              quantity: { type: 'number', description: 'Cantidad de unidades (opcional)' },
              parentId: { type: 'string', description: 'ID del recordatorio padre (o vacío para desanidar)' },
              sectionId: { type: 'string', description: 'ID de la sección destino' },
              cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'], description: 'Ciclo de recurrencia' },
              listId: { type: 'string', description: 'ID de la lista destino' },
              status: { type: 'string', enum: ['pending', 'completed'] },
              description: { type: 'string', description: 'Notas o descripción' }
            },
            required: ['id']
          }
        }
      },
      required: ['updates']
    }
  }
];

const rpcResult = (id: string | number | null, data: unknown) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
});
const rpcError = (id: string | number | null, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

const VALID_PRIORITIES = new Set(['none', 'low', 'medium', 'high']);
const VALID_TIMES = new Set(['morning', 'afternoon', 'night']);
const VALID_CYCLES = new Set(['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year']);
const cleanString = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const cleanNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** ¿Anidar `childId` bajo `parentId` crearía un ciclo (o una auto-referencia)? */
const wouldCycle = (tasks: any[], childId: string, parentId: string) => {
  const byId = new Map(tasks.map((t: any) => [t.id, t]));
  const seen = new Set();
  for (let cur = parentId; cur && !seen.has(cur); cur = byId.get(cur)?.parentId) {
    if (cur === childId) return true;
    seen.add(cur);
  }
  return false;
};
const hasTitle = (t: any) => typeof t?.title === 'string' && t.title.trim() !== '';
const isSettingsList = (l: any) => typeof l?.id === 'string' && l.id.startsWith('user_preferences_');
const BEST_PRACTICES_CATALOG = [
  {
    category: 'academic',
    title: '[M] Descargar y verificar apuntes de Egela / Moodle',
    cycle: 'cycle_month',
    listName: 'estudios',
    description: 'Descargar todo el material lectivo, comprobar con scripts/Playwright que los PDFs y diapositivas sean legibles y respaldar en Drive.',
    playbook: '1. Iniciar sesión en Egela/Moodle de la universidad. 2. Identificar nuevos archivos subidos por el profesorado. 3. Descargar a la carpeta local de la asignatura. 4. Comprobar que no haya archivos corruptos o de 0 bytes. 5. Sincronizar en Google Drive o nube de respaldo.',
    frequencyAdvice: 'Mensual durante el curso, y antes de finalizar cada cuatrimestre.'
  },
  {
    category: 'academic',
    title: '[A] Respaldo final de curso de Egela / Moodle en junio',
    cycle: 'cycle_year',
    listName: 'estudios',
    description: 'Descarga completa de todos los módulos, trabajos entregados, calificaciones y foros antes del cierre anual de actas en junio.',
    playbook: '1. Volcado en ZIP de todas las asignaturas finalizadas en la UPV/EHU. 2. Verificar integridad con scripts/Playwright. 3. Subir copia organizada a Google Drive y pausar la rutina con manage_routine_status al terminar los estudios.',
    frequencyAdvice: 'Anual (fijada en junio al terminar el curso escolar).'
  },
  {
    category: 'software',
    title: '[S] Actualización de aplicaciones con winget upgrade all',
    cycle: 'cycle_week',
    listName: 'mantenimiento',
    description: 'Actualizar todo el software instalado en el sistema con winget para aplicar parches de seguridad y estabilidad.',
    playbook: 'Ejecutar `winget upgrade --all` en la terminal de PowerShell con privilegios normales o de administrador si alguna app lo requiere.',
    frequencyAdvice: 'Semanal (sábados o domingos).'
  },
  {
    category: 'software',
    title: '[S] Mantenimiento Git y revisión de alertas Dependabot',
    cycle: 'cycle_week',
    listName: 'mantenimiento',
    description: 'Comprobar el estado de ramas locales, cambios sin commitear y fusionar o revisar PRs de seguridad abiertas por Dependabot.',
    playbook: '1. Ejecutar `git status` en repositorios locales. 2. Comprobar PRs de Dependabot con `gh pr list --search "dependabot"` o en GitHub. 3. Pasar tests y mergear parches de dependencias.',
    frequencyAdvice: 'Semanal.'
  },
  {
    category: 'software',
    title: '[M] Limpieza de caché, temporales y dependencias huérfanas',
    cycle: 'cycle_month',
    listName: 'mantenimiento',
    description: 'Limpiar paquetes huérfanos de node_modules / pip / uv, cachés de desarrollo y temporales del sistema para liberar espacio.',
    playbook: '1. Comprobar espacio en disco. 2. Ejecutar limpieza de npm cache, pip cache y temporales %TEMP%. 3. Verificar repositorios con `git status` y subir cambios pendientes.',
    frequencyAdvice: 'Mensual.'
  },
  {
    category: 'software',
    title: '[M] Purga de descargas antiguas y optimización de instalables',
    cycle: 'cycle_month',
    listName: 'mantenimiento',
    description: 'Analizar la carpeta de Descargas para eliminar instaladores (.exe, .msi, .iso, .zip) de más de 30 días y vaciar temporales.',
    playbook: '1. Revisar carpeta Downloads y eliminar instaladores obsoletos. 2. Purgar caché de paquetes y temporales de Windows. 3. Comprobar espacio libre en disco.',
    frequencyAdvice: 'Mensual.'
  },
  {
    category: 'finance',
    title: '[M] Auditoría mensual de suscripciones y cargos bancarios',
    cycle: 'cycle_month',
    listName: 'finanzas',
    description: 'Revisar extractos de cuentas y tarjetas para detectar suscripciones no utilizadas o renovaciones accidentales.',
    playbook: '1. Comprobar movimientos bancarios del mes. 2. Cotejar con la lista de Caducidades y suscripciones de la app. 3. Cancelar de inmediato cualquier servicio que no se vaya a usar el próximo mes.',
    frequencyAdvice: 'Mensual (primeros días de mes tras el cobro de nómina/ingresos).'
  },
  {
    category: 'finance',
    title: '[A] Revisión anual de seguro dental y pólizas de salud',
    cycle: 'cycle_year',
    listName: 'finanzas',
    description: 'Revisar coberturas odontológicas, seguro médico estudiantil y servicios contratados antes de la renovación automática.',
    playbook: '1. Comprobar cuadro dental y coberturas vigentes. 2. Revisar si la tarifa se actualiza o hay descuentos universitarios/jóvenes. 3. Notificar cambios o bajas con 1 mes de preaviso legal.',
    frequencyAdvice: 'Anual.'
  },
  {
    category: 'health',
    title: '[A] Chequeo preventivo médico y dental anual',
    cycle: 'cycle_year',
    listName: 'salud',
    description: 'Cita con el médico de atención primaria para analítica rutinaria y revisión odontológica preventiva con limpieza dental.',
    playbook: '1. Pedir cita médica previa para analítica de rutina. 2. Pedir cita con el dentista para revisión general e higiene bucal. 3. Anotar fecha de próxima revisión en la app.',
    frequencyAdvice: 'Anual.'
  },
  {
    category: 'home',
    title: '[M] Limpieza profunda de filtros y electrodomésticos',
    cycle: 'cycle_month',
    listName: 'limpieza',
    description: 'Limpiar filtros de la campana extractora, filtro de lavadora, lavavajillas y aire acondicionado.',
    playbook: '1. Desmontar filtros de grasa de la campana y lavar en lavavajillas o con desengrasante. 2. Purgar filtro inferior de la lavadora. 3. Limpiar filtro del lavavajillas.',
    frequencyAdvice: 'Mensual.'
  }
];

export function classifyCleaningRoom(title?: string | null): string {
  if (!title) return 'General';
  const t = title.toLowerCase();

  // Cocina
  if (
    /plato|lavavaj|vitro|fregadero|cocina|microondas|bayeta|escurreplatos|horno|campana|despensa|frigo|congelador|electrodom|encimera|fuegos|fregona|basura/i.test(t)
  ) {
    return 'Cocina';
  }

  // Baño
  if (
    /lavabo|baño|bano|ducha|inodoro|toalla|toallero|cepillo.*diente|portacepillos|jabonera|rebosadero|desagüe|mampara|alcachofa|azulejo|váter|vater|bidet|bidé|espejo/i.test(t)
  ) {
    return 'Baño';
  }

  // Habitación
  if (
    /cama|colch[oó]n|canap[eé]|almohada|s[aá]bana|funda|edred[oó]n|armario|mesilla|escritorio|habitaci[oó]n|dormitorio/i.test(t)
  ) {
    return 'Habitación';
  }

  // Pasillo / Entrada
  if (/pasillo|recibidor|entrada|felpudo|zapatero/i.test(t)) {
    return 'Pasillo / Entrada';
  }

  // Balcón
  if (/balc[oó]n|terraza|tendedero|plantas?|regar/i.test(t)) {
    return 'Balcón';
  }

  return 'General';
}

function classifyPeriodicTask(task: any, activeMode?: { mode?: string; until?: string; reason?: string }) {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();

  const isWinget = /winget\b|upgrade\s+all|actualiz.*(app|aplicaci|programa|software)/i.test(text);
  const isEgela = /egela\b|moodle\b|aula\s+virtual\b|universidad\b|campus\b|ehu\b|asignatura\b|apuntes\b|grado\b|master\b|tfg\b|dif\b|examen|entrega|evaluaci|estudio|clase/i.test(text);
  const isBackup = /backup\b|copia.*seguridad\b|dump\b/i.test(text);
  const isGit = /\bgit\b|commit\b|push\b|repo\b|pull\s+request|dependabot/i.test(text);
  const isCache = /cach[eé]|temporales|temp\b|disco\b|descargas/i.test(text);
  const isReviewBills = /factura|suscripci|banco|tarjeta|cuota/i.test(text);
  const isHealth = /chequeo|m[eé]dico|dental|dentista|an[aá]lisis|revisi[oó]n\s+anual|salud/i.test(text);

  const isTechnical = isWinget || isEgela || isBackup || isGit || isCache || isReviewBills || Boolean(task.playbook);

  let suggestedAction = task.playbook || '';
  let commandSnippet: string | undefined;
  if (!suggestedAction) {
    if (isWinget) {
      commandSnippet = 'winget upgrade --all';
      suggestedAction = 'Ejecutar actualización masiva de paquetes en terminal.';
    } else if (isEgela) {
      suggestedAction = 'Descargar y respaldar apuntes de Egela/Moodle, verificar que los PDFs y archivos sean legibles (vía scripts/Playwright) y guardar copia en Google Drive antes del cierre de actas.';
    } else if (isBackup) {
      suggestedAction = 'Verificar copias de seguridad de datos y repositorios.';
    } else if (isGit) {
      commandSnippet = 'git status && gh pr list --search "dependabot"';
      suggestedAction = 'Comprobar repositorios y revisar PRs/alertas de Dependabot.';
    } else if (isCache) {
      suggestedAction = 'Revisar espacio en disco, purgar temporales y limpiar instaladores antiguos de Descargas.';
    } else if (isReviewBills) {
      suggestedAction = 'Revisar cargos bancarios periódicos y suscripciones.';
    } else if (isHealth) {
      suggestedAction = 'Pedir cita para analítica médica preventiva y revisión odontológica anual.';
    }
  }

  const isPhysical = /limpi|freg|barr|aspir|colada|lavador|planch|orden|cama|s[aá]bana|compra|super|ba[nñ]o|cocina|planta|regar|filtro|basura|recicl/i.test(text);
  const isPaused = task.status === 'paused' || task.status === 'archived' || Boolean(task.isPaused);

  let pausedByMode = false;
  let isPriorityInMode = false;
  let modeNote: string | undefined;

  const currentMode = activeMode?.mode || 'normal';
  if (currentMode === 'examenes') {
    if (isEgela) {
      isPriorityInMode = true;
      modeNote = 'Prioridad alta en Modo Exámenes (estudio y entregas académicas)';
    } else if (isPhysical) {
      pausedByMode = true;
      modeNote = 'Pausado temporalmente por Modo Exámenes (foco en entregas)';
    }
  } else if (currentMode === 'vacaciones') {
    if (isEgela) {
      pausedByMode = true;
      modeNote = 'Pausado temporalmente por Modo Vacaciones (descanso activo)';
    }
  }

  return {
    isTechnical,
    canAiAssist: isTechnical && !isPaused && !pausedByMode,
    requiresUserConfirmation: !isTechnical || isPhysical,
    suggestedAction: suggestedAction || (isPhysical ? 'Preguntar al usuario si ya lo ha realizado para marcarlo como completado.' : 'Asistir al usuario según sus indicaciones.'),
    commandSnippet,
    suggestedQuestion: (!isTechnical || isPhysical) && !isPaused && !pausedByMode
      ? `¿Has podido hacer "${task.title}"? Dímelo y lo marco como completado.`
      : undefined,
    playbook: task.playbook || undefined,
    verificationMethod: task.verificationMethod || undefined,
    isPaused,
    pausedReason: task.pausedReason || task.archivedReason || undefined,
    executionLogs: Array.isArray(task.executionLogs) ? task.executionLogs : undefined,
    pausedByMode,
    isPriorityInMode,
    modeNote,
  };
}

async function computeStats(prisma: any, userId: string) {
  const [taskRows, listRows] = await Promise.all([
    prisma.task.findMany({ where: { userId, deletedAt: null } }),
    prisma.list.findMany({ where: { userId, deletedAt: null } }),
  ]);

  const tasks = taskRows.map((r: any) => toClientPayload(userId, r));
  const lists = listRows.map((r: any) => toClientPayload(userId, r)).filter((l: any) => !isSettingsList(l));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let dueToday = 0;

  for (const t of tasks) {
    const isCompleted = t.status === 'completed';
    if (isCompleted) {
      completed++;
    } else {
      pending++;
      if (t.dueDate) {
        const dueTime = new Date(t.dueDate).getTime();
        if (dueTime < todayStart) overdue++;
        else if (dueTime <= todayEnd) dueToday++;
      }
    }
  }

  const shoppingTasks = tasks.filter((t: any) => {
    const cat = String(t.categoryId || '').toLowerCase();
    return cat === 'compra' || cat === 'compras' || cat.includes('compra');
  });
  const shoppingPending = shoppingTasks.filter((t: any) => t.status !== 'completed');
  const shoppingEstimatedCost = shoppingPending.reduce((sum: number, t: any) => {
    const price = typeof t.price === 'number' ? t.price : 0;
    const qty = typeof t.quantity === 'number' && t.quantity > 0 ? t.quantity : 1;
    return sum + (price * qty);
  }, 0);

  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  return {
    total,
    completed,
    pending,
    overdue,
    dueToday,
    completionRate: `${rate}%`,
    shopping: {
      totalItems: shoppingTasks.length,
      pendingItems: shoppingPending.length,
      estimatedCostEuros: Math.round(shoppingEstimatedCost * 100) / 100,
    },
    listsSummary: lists.map((l: any) => {
      const listTasks = tasks.filter((t: any) => t.categoryId === l.id);
      return {
        id: l.id,
        name: l.name,
        total: listTasks.length,
        pending: listTasks.filter((t: any) => t.status !== 'completed').length,
        completed: listTasks.filter((t: any) => t.status === 'completed').length,
      };
    })
  };
}

async function computePeriodicRoutines(prisma: any, userId: string, period = 'all', includeCompleted = false, includePaused = false) {
  const [taskRows, sectionRows, listRows, userRow] = await Promise.all([
    prisma.task.findMany({ where: { userId, deletedAt: null } }),
    prisma.listSection.findMany({ where: { userId, deletedAt: null } }),
    prisma.list.findMany({ where: { userId, deletedAt: null } }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }),
  ]);

  const tasks = taskRows.map((r: any) => toClientPayload(userId, r));
  const sections = sectionRows.map((r: any) => toClientPayload(userId, r));
  const lists = listRows.map((r: any) => toClientPayload(userId, r)).filter((l: any) => !isSettingsList(l));

  const now = new Date();
  const weeklyDay = (userRow?.preferences as any)?.weeklyTasksDay ?? 6;
  const currentRounds = routineRoundsOn({
    month: now.getMonth() + 1,
    day: now.getDate(),
    weekday: now.getDay()
  }, weeklyDay);

  const rawActiveMode = (userRow?.preferences as any)?.activeMode;
  let activeMode = { mode: 'normal' };
  if (rawActiveMode && typeof rawActiveMode === 'object' && rawActiveMode.mode) {
    if (rawActiveMode.until && new Date(rawActiveMode.until).getTime() < Date.now()) {
      activeMode = { mode: 'normal' };
    } else {
      activeMode = rawActiveMode;
    }
  }

  const periodicTasks = [];

  for (const t of tasks) {
    const isPaused = t.status === 'paused' || t.status === 'archived' || Boolean(t.isPaused);
    if (!includePaused && isPaused) continue;
    if (!includeCompleted && t.status === 'completed') continue;
    const periodicity = getTaskPeriodicity(t, sections, lists);
    if (!periodicity) continue;
    if (period !== 'all' && periodicity !== period) continue;

    const classification = classifyPeriodicTask(t, activeMode);
    const isDueToday = Boolean((currentRounds as any)[periodicity]);

    periodicTasks.push({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      periodicity,
      isDueToday,
      ...classification,
    });
  }

  const technicalTasks = periodicTasks.filter((t) => t.isTechnical && !t.isPaused && !t.pausedByMode);
  const manualTasks = periodicTasks.filter((t) => (!t.isTechnical || t.requiresUserConfirmation) && !t.isPaused && !t.pausedByMode);
  const pausedTasks = periodicTasks.filter((t) => t.isPaused || t.pausedByMode);

  // 1. Limpieza: Tareas existentes en la app (sin crear duplicadas) agrupadas por estancia
  const limpiezaTasks = tasks.filter((t: any) => {
    const cat = String(t.categoryId || '').toLowerCase();
    const title = String(t.title || '').toLowerCase();
    return cat.includes('limpieza') || cat.includes('quehacer') || /fregar|barrer|aspirar|planchar|limpiar|colada|lavar\s+platos|vitro/i.test(title);
  });

  const roomsMap: Record<string, { total: number; completed: number; pending: number; pendingTasks: { id: string; title: string }[] }> = {
    'Cocina': { total: 0, completed: 0, pending: 0, pendingTasks: [] },
    'Baño': { total: 0, completed: 0, pending: 0, pendingTasks: [] },
    'Habitación': { total: 0, completed: 0, pending: 0, pendingTasks: [] },
    'Pasillo / Entrada': { total: 0, completed: 0, pending: 0, pendingTasks: [] },
    'Balcón': { total: 0, completed: 0, pending: 0, pendingTasks: [] },
    'General': { total: 0, completed: 0, pending: 0, pendingTasks: [] },
  };

  for (const lt of limpiezaTasks) {
    const room = classifyCleaningRoom(lt.title);
    const target = roomsMap[room] || roomsMap['General'];
    target.total++;
    if (lt.status === 'completed') {
      target.completed++;
    } else {
      target.pending++;
      target.pendingTasks.push({ id: lt.id, title: lt.title });
    }
  }

  const limpiezaPendingRooms = Object.entries(roomsMap).filter(([, data]) => data.pending > 0);
  const limpiezaQuestions = activeMode.mode === 'examenes'
    ? ['Modo Exámenes activo: las tareas de limpieza no críticas están silenciadas para que te concentres en los estudios y entregas.']
    : limpiezaPendingRooms.map(([room, data]) => {
        const sampleTitles = data.pendingTasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ');
        const more = data.pendingTasks.length > 3 ? ` y ${data.pendingTasks.length - 3} más` : '';
        return `¿Has limpiado ya ${room.toLowerCase()} (${sampleTitles}${more})? Si lo has hecho, confírmamelo y las marco como completadas.`;
      });

  // 2. Compra: Artículos existentes pendientes y coste total estimado
  const shoppingTasks = tasks.filter((t: any) => {
    const cat = String(t.categoryId || '').toLowerCase();
    return cat === 'compra' || cat === 'compras' || cat.includes('compra');
  });
  const shoppingPending = shoppingTasks.filter((t: any) => t.status !== 'completed');
  const shoppingPendingCost = shoppingPending.reduce((sum: number, t: any) => {
    const price = typeof t.price === 'number' ? t.price : 0;
    const qty = typeof t.quantity === 'number' && t.quantity > 0 ? t.quantity : 1;
    return sum + (price * qty);
  }, 0);
  const shoppingQuestion = shoppingPending.length > 0
    ? `En tu lista de compra tienes ${shoppingPending.length} artículos pendientes (total estimado: ${Math.round(shoppingPendingCost * 100) / 100}€). ¿Has hecho ya la compra para marcarlos?`
    : 'Tu lista de compra está al día o vacía.';

  // 3. Caducidades y suscripciones existentes
  const caducidadesTasks = tasks.filter((t: any) => {
    const cat = String(t.categoryId || '').toLowerCase();
    const title = String(t.title || '').toLowerCase();
    return cat.includes('caducidad') || cat.includes('suscrip') || Boolean(t.price && t.subscriptionPeriod) || /suscripci|caducid/i.test(title);
  });
  const caducidadesActive = caducidadesTasks.filter((t: any) => t.status !== 'completed');
  const caducidadesMonthlyEst = caducidadesActive.reduce((sum: number, t: any) => {
    const price = typeof t.price === 'number' ? t.price : 0;
    if (t.subscriptionPeriod === 'year' || t.subscriptionPeriod === 'anual') {
      return sum + (price / 12);
    }
    return sum + price;
  }, 0);

  return {
    today: {
      date: now.toISOString().slice(0, 10),
      activeRoundsToday: {
        daily: currentRounds.day,
        weekly: currentRounds.week,
        monthly: currentRounds.month,
        annual: currentRounds.year,
      }
    },
    summary: `Hay ${periodicTasks.length} tareas periódicas (${technicalTasks.length} técnicas/automatizables, ${manualTasks.length} manuales y ${pausedTasks.length} pausadas/archivadas).`,
    actionableByAi: technicalTasks.map((t) => ({
      id: t.id,
      title: t.title,
      periodicity: t.periodicity,
      isDueToday: t.isDueToday,
      status: t.status,
      suggestedAction: t.suggestedAction,
      commandSnippet: t.commandSnippet,
      playbook: t.playbook,
    })),
    askUserChecklist: manualTasks.map((t) => ({
      id: t.id,
      title: t.title,
      periodicity: t.periodicity,
      isDueToday: t.isDueToday,
      status: t.status,
      questionForUser: t.suggestedQuestion,
      playbook: t.playbook,
    })),
    existingDomains: {
      limpieza: {
        total: limpiezaTasks.length,
        completed: limpiezaTasks.filter((t: any) => t.status === 'completed').length,
        pending: limpiezaTasks.filter((t: any) => t.status !== 'completed').length,
        byRoom: roomsMap,
        conversationalQuestions: limpiezaQuestions.length > 0
          ? limpiezaQuestions
          : ['¡Todas las tareas de limpieza están al día! No tienes nada pendiente por ahora.'],
      },
      compra: {
        total: shoppingTasks.length,
        completed: shoppingTasks.filter((t: any) => t.status === 'completed').length,
        pending: shoppingPending.length,
        estimatedCostEuros: Math.round(shoppingPendingCost * 100) / 100,
        pendingItems: shoppingPending.slice(0, 20).map((t: any) => ({
          id: t.id,
          title: t.title,
          price: t.price,
          quantity: t.quantity
        })),
        conversationalQuestion: shoppingQuestion,
      },
      caducidades: {
        total: caducidadesTasks.length,
        activeSubscriptions: caducidadesActive.length,
        estimatedMonthlyEuros: Math.round(caducidadesMonthlyEst * 100) / 100,
        activeItems: caducidadesActive.slice(0, 15).map((t: any) => ({
          id: t.id,
          title: t.title,
          price: t.price,
          dueDate: t.dueDate,
          subscriptionPeriod: t.subscriptionPeriod,
          autoRollover: t.autoRollover
        }))
      }
    },
    pausedOrArchived: pausedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      periodicity: t.periodicity,
      status: t.status,
      reason: t.pausedReason,
      playbook: t.playbook,
    })),
    activeMode: {
      mode: activeMode.mode,
      until: (activeMode as any).until,
      reason: (activeMode as any).reason,
      description: activeMode.mode === 'examenes'
        ? 'Modo Exámenes activo: entregas y estudio académico priorizados; quehaceres domésticos no críticos silenciados.'
        : activeMode.mode === 'vacaciones'
        ? 'Modo Vacaciones activo: tareas académicas silenciadas; descanso y hábitos ligeros activos.'
        : 'Modo Normal: todas las rutinas operando con normalidad.'
    },
    allPeriodicTasks: periodicTasks,
  };
}

export async function handleMcpRequest(reqBody: any, prisma: any, userId: string) {
  const { jsonrpc, id = null, method, params } = reqBody || {};

  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(id, -32600, 'Invalid Request: se requiere JSON-RPC 2.0');
  }

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'Recordatorios MCP Server', version: '1.2.0' },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };
  }

  if (method === 'resources/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources: [
          {
            uri: 'recordatorios://dashboard',
            name: 'Dashboard de Recordatorios y Estadísticas',
            description: 'Métricas clave en tiempo real: tareas para hoy, vencidas, tasa de cumplimiento y compras pendientes.',
            mimeType: 'application/json'
          },
          {
            uri: 'recordatorios://rutinas-hoy',
            name: 'Rutinas y Mantenimiento de Hoy',
            description: 'Lista de rutinas periódicas que tocan hoy divididas entre automatizables/técnicas y manuales.',
            mimeType: 'application/json'
          }
        ]
      }
    };
  }

  if (method === 'resources/read') {
    if (!userId) {
      return rpcError(id, -32001, 'Autenticación requerida para acceder a los recursos.');
    }
    const uri = params?.uri;
    if (uri === 'recordatorios://dashboard') {
      const stats = await computeStats(prisma, userId);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(stats, null, 2) }]
        }
      };
    }
    if (uri === 'recordatorios://rutinas-hoy') {
      const routines = await computePeriodicRoutines(prisma, userId, 'all', false);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(routines, null, 2) }]
        }
      };
    }
    return rpcError(id, -32602, `Recurso no encontrado: ${uri}`);
  }

  if (method === 'prompts/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        prompts: [
          {
            name: 'asistente_rutinas_y_mantenimiento',
            description: 'Asistente proactivo para revisar rutinas periódicas, ejecutar tareas técnicas (winget, egela) y preguntar por tareas domésticas o compras.',
            arguments: []
          }
        ]
      }
    };
  }

  if (method === 'prompts/get') {
    const promptName = params?.name;
    if (promptName === 'asistente_rutinas_y_mantenimiento') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          description: 'Instrucciones para el asistente sobre cómo gestionar el mantenimiento técnico y tareas físicas del usuario.',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Por favor, consulta mis recordatorios y rutinas periódicas con la herramienta get_periodic_routines y mis estadísticas con get_stats. Si hay tareas técnicas automatizables (como actualizar con winget upgrade --all, revisar el campus/Egela o backups), ejecuta o sugiéreme los comandos. Para tareas físicas de limpieza, compras u hogar, pregúntame amablemente si ya las he realizado y utiliza complete_reminder para marcarlas como completadas cuando te confirme.'
              }
            }
          ]
        }
      };
    }
    return rpcError(id, -32602, `Prompt no encontrado: ${promptName}`);
  }

  if (method !== 'tools/call') {
    return rpcError(id, -32601, `Método JSON-RPC no soportado: ${method}`);
  }

  const toolName = params?.name;
  const args = params?.arguments || {};
  if (!toolName) return rpcError(id, -32602, 'Falta el nombre de la herramienta en params.name');
  if (!MCP_TOOLS.some((t: any) => t.name === toolName)) return rpcError(id, -32601, `Herramienta no encontrada: ${toolName}`);
  if (!userId) {
    return rpcError(id, -32001, 'Autenticación requerida: envía "Authorization: Bearer <token>" de tu sesión.');
  }

  try {
    if (toolName === 'ensure_essential_routines') {
      const now = new Date();
      let juneYear = now.getFullYear();
      if (now.getMonth() > 5 || (now.getMonth() === 5 && now.getDate() > 30)) {
        juneYear += 1;
      }
      const juneDueDate = new Date(Date.UTC(juneYear, 5, 15, 12, 0, 0)).toISOString();

      const listRows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const userLists = listRows.map((r: any) => toClientPayload(userId, r)).filter((l: any) => !isSettingsList(l));
      const resolveListTarget = (targetName: string) => {
        const match = userLists.find((l: any) => {
          const n = String(l.name || '').toLowerCase();
          const id = String(l.id || '').toLowerCase();
          return n.includes(targetName) || id.includes(targetName);
        });
        return match ? match.id : 'inbox';
      };

      const taskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = taskRows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const targets = [
        {
          key: 'dental_checkup',
          title: '[A] Chequeo preventivo médico y dental anual',
          cycle: 'cycle_year',
          priority: 'medium',
          categoryId: resolveListTarget('salud'),
          description: 'Cita con el médico de atención primaria para analítica rutinaria y revisión odontológica preventiva con limpieza dental.',
          playbook: '1. Pedir cita médica previa para analítica de rutina. 2. Pedir cita con el dentista para revisión general e higiene bucal. 3. Anotar fecha de próxima revisión en la app.',
          verificationMethod: 'Cita médica / clínica dental',
          matcher: (t: any) => /chequeo.*(preventivo|m[eé]dico)|revisi[oó]n.*(dental|m[eé]dica)/i.test(t.title || ''),
        },
        {
          key: 'dental_insurance',
          title: '[A] Revisión anual de seguro dental y pólizas de salud',
          cycle: 'cycle_year',
          priority: 'medium',
          categoryId: resolveListTarget('finanz') || resolveListTarget('caducid'),
          description: 'Revisar coberturas odontológicas, seguro médico estudiantil y servicios contratados antes de la renovación automática.',
          playbook: '1. Comprobar cuadro dental y coberturas vigentes. 2. Revisar si la tarifa se actualiza o hay descuentos universitarios/jóvenes. 3. Notificar cambios o bajas con 1 mes de preaviso legal.',
          verificationMethod: 'Póliza y extracto bancario',
          matcher: (t: any) => /seguro.*dental|p[oó]liza.*(dental|salud)|revisi[oó]n.*seguro/i.test(t.title || ''),
        },
        {
          key: 'egela_backup',
          title: '[A] Respaldo final de curso de Egela / Moodle en junio',
          cycle: 'cycle_year',
          priority: 'high',
          categoryId: resolveListTarget('estudio'),
          dueDate: juneDueDate,
          description: 'Descargar todo el material lectivo, exámenes, entregas y notas de Egela (UPV/EHU) antes del cierre de actas en junio, comprobar integridad con scripts y respaldar en Google Drive.',
          playbook: '1. Descargar carpetas completas de asignaturas de Egela. 2. Verificar que los PDFs y diapositivas sean legibles y no estén corruptos. 3. Subir copia a Google Drive. 4. Pausar la rutina al graduarse con manage_routine_status.',
          verificationMethod: 'Playwright / Drive check',
          matcher: (t: any) => /(respaldo|backup).*(egela|moodle|curso).*junio|egela.*junio/i.test(t.title || ''),
        }
      ];

      const created = [];
      const alreadyExisting = [];
      const nowIso = now.toISOString();

      for (const def of targets) {
        const found = existingTasks.find(def.matcher);
        if (found) {
          alreadyExisting.push({
            id: found.id,
            title: found.title,
            status: found.status,
            cycle_id: found.cycle_id,
            dueDate: found.dueDate
          });
        } else {
          const newTaskId = randomUUID();
          const taskPayload = {
            id: newTaskId,
            user_id: userId,
            type: 'task',
            title: def.title,
            description: def.description,
            categoryId: def.categoryId,
            dueDate: def.dueDate,
            priority: def.priority,
            cycle_id: def.cycle,
            status: 'pending',
            playbook: def.playbook,
            verificationMethod: def.verificationMethod,
            version: 1,
            created_at: nowIso,
            updated_at: nowIso,
          };
          await prisma.task.create({
            data: {
              id: scopedId(userId, newTaskId),
              userId,
              payload: taskPayload
            }
          });
          created.push(taskPayload);
        }
      }

      return rpcResult(id, {
        success: true,
        summary: `Se aseguraron las rutinas esenciales: ${created.length} creadas nuevas, ${alreadyExisting.length} ya existentes sin duplicar.`,
        created,
        alreadyExisting,
      });
    }

    if (toolName === 'run_system_maintenance') {
      const action = cleanString(args.action, 50);
      const dryRun = args.dryRun !== false;

      if (!action) {
        return rpcError(id, -32602, 'La acción es obligatoria (winget_check, winget_upgrade, clean_temp_cache, clean_downloads, git_dependabot_audit)');
      }

      if (action === 'winget_check') {
        try {
          const { stdout, stderr } = await execAsync('winget upgrade', { timeout: 15000 });
          return rpcResult(id, { success: true, action, output: stdout || stderr });
        } catch (err: any) {
          const out = (err.stdout || '') + (err.stderr || '') || err.message;
          return rpcResult(id, {
            success: true,
            action,
            output: out,
            note: 'Si winget reporta paquetes actualizables, ejecuta con action: "winget_upgrade" y dryRun: false.'
          });
        }
      }

      if (action === 'winget_upgrade') {
        const plannedCommand = 'winget upgrade --all --accept-source-agreements --accept-package-agreements';
        if (dryRun) {
          return rpcResult(id, {
            success: true,
            action,
            dryRun: true,
            plannedCommand,
            message: 'Modo seguro (dryRun: true). Para ejecutar la actualización en segundo plano, pasa dryRun: false.'
          });
        }
        try {
          const { stdout, stderr } = await execAsync(plannedCommand, { timeout: 60000 });
          return rpcResult(id, { success: true, action, dryRun: false, output: stdout || stderr });
        } catch (err: any) {
          const out = (err.stdout || '') + (err.stderr || '') || err.message;
          return rpcResult(id, { success: false, action, dryRun: false, error: out });
        }
      }

      if (action === 'clean_temp_cache') {
        const tempDir = process.env.TEMP || os.tmpdir();
        let totalFiles = 0;
        let totalBytes = 0;
        let deletedFiles = 0;
        const nowMs = Date.now();
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

        if (fs.existsSync(tempDir)) {
          try {
            const entries = fs.readdirSync(tempDir);
            for (const entry of entries) {
              try {
                const fullPath = path.join(tempDir, entry);
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                  totalFiles++;
                  totalBytes += stat.size;
                  if (!dryRun && (nowMs - stat.mtimeMs > maxAgeMs)) {
                    try {
                      fs.unlinkSync(fullPath);
                      deletedFiles++;
                    } catch {}
                  }
                }
              } catch {}
            }
          } catch {}
        }

        const sizeMB = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
        return rpcResult(id, {
          success: true,
          action,
          dryRun,
          tempDir,
          totalFilesScanned: totalFiles,
          estimatedMB: sizeMB,
          deletedFiles: dryRun ? 0 : deletedFiles,
          message: dryRun
            ? `Se detectaron ${sizeMB} MB en temporales. Pasa dryRun: false para purgar archivos huérfanos de más de 7 días.`
            : `Purgados ${deletedFiles} archivos temporales antiguos con éxito.`
        });
      }

      if (action === 'clean_downloads') {
        const downloadsDir = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');
        const scannedInstallers: any[] = [];
        let totalBytes = 0;
        const nowMs = Date.now();
        const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
        const installerExtensions = new Set(['.exe', '.msi', '.iso', '.zip', '.tar.gz', '.dmg']);

        if (fs.existsSync(downloadsDir)) {
          try {
            const files = fs.readdirSync(downloadsDir);
            for (const f of files) {
              try {
                const ext = path.extname(f).toLowerCase();
                if (installerExtensions.has(ext)) {
                  const fullPath = path.join(downloadsDir, f);
                  const stat = fs.statSync(fullPath);
                  if (stat.isFile() && (nowMs - stat.mtimeMs > maxAgeMs)) {
                    totalBytes += stat.size;
                    scannedInstallers.push({
                      name: f,
                      sizeMB: Math.round((stat.size / (1024 * 1024)) * 10) / 10,
                      daysOld: Math.round((nowMs - stat.mtimeMs) / (24 * 60 * 60 * 1000))
                    });
                  }
                }
              } catch {}
            }
          } catch {}
        }

        const totalMB = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
        return rpcResult(id, {
          success: true,
          action,
          dryRun,
          downloadsDir,
          installerCount: scannedInstallers.length,
          reclaimableMB: totalMB,
          oldInstallers: scannedInstallers.slice(0, 10),
          message: scannedInstallers.length > 0
            ? `Hay ${scannedInstallers.length} instaladores antiguos (>30 días) ocupando ${totalMB} MB en Descargas.`
            : 'La carpeta de Descargas no tiene instaladores antiguos (>30 días).'
        });
      }

      if (action === 'git_dependabot_audit') {
        let uncommittedCount = 0;
        let statusSummary = '';
        try {
          const { stdout: statusOut } = await execAsync('git status --porcelain', { timeout: 5000 });
          const lines = statusOut.split('\n').filter(Boolean);
          uncommittedCount = lines.length;
          statusSummary = uncommittedCount === 0 ? 'Directorio de trabajo limpio' : `${uncommittedCount} archivos con cambios sin commitear`;
        } catch (err: any) {
          statusSummary = `No se pudo consultar estado Git: ${err.message}`;
        }

        let dependabotPrs: any[] = [];
        let ghAvailable = false;
        try {
          const { stdout: ghOut } = await execAsync('gh pr list --search "dependabot" --limit 10 --json number,title,state,url', { timeout: 10000 });
          dependabotPrs = JSON.parse(ghOut || '[]');
          ghAvailable = true;
        } catch {
          ghAvailable = false;
        }

        return rpcResult(id, {
          success: true,
          action,
          gitStatus: statusSummary,
          uncommittedFilesCount: uncommittedCount,
          ghCliAvailable: ghAvailable,
          dependabotPrsCount: dependabotPrs.length,
          dependabotPrs,
          message: dependabotPrs.length > 0
            ? `Tienes ${dependabotPrs.length} PRs de Dependabot pendientes en GitHub.`
            : (ghAvailable ? 'No hay PRs pendientes de Dependabot.' : 'Git auditado localmente. Para auditar PRs de Dependabot por terminal ejecuta `gh auth login`.')
        });
      }

      return rpcError(id, -32602, `Acción desconocida: ${action}`);
    }

    if (toolName === 'manage_app_mode') {
      const action = cleanString(args.action, 20);
      if (action !== 'get' && action !== 'set') {
        return rpcError(id, -32602, 'Acción no válida. Debe ser "get" o "set".');
      }

      const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
      const currentPrefs = (userRow?.preferences as any) || {};
      const rawActiveMode = currentPrefs.activeMode;
      let activeMode = { mode: 'normal' };
      if (rawActiveMode && typeof rawActiveMode === 'object' && rawActiveMode.mode) {
        if (rawActiveMode.until && new Date(rawActiveMode.until).getTime() < Date.now()) {
          activeMode = { mode: 'normal' };
        } else {
          activeMode = rawActiveMode;
        }
      }

      if (action === 'get') {
        return rpcResult(id, {
          activeMode,
          description: activeMode.mode === 'examenes'
            ? 'Modo Exámenes activo: entregas y estudio priorizados; quehaceres domésticos silenciados.'
            : activeMode.mode === 'vacaciones'
            ? 'Modo Vacaciones activo: tareas académicas silenciadas; descanso y hábitos ligeros activos.'
            : 'Modo Normal: todas las rutinas operando con normalidad.'
        });
      }

      const mode = cleanString(args.mode, 20);
      if (mode !== 'normal' && mode !== 'examenes' && mode !== 'vacaciones') {
        return rpcError(id, -32602, 'Modo no válido. Debe ser "normal", "examenes" o "vacaciones".');
      }

      const until = cleanString(args.until, 50) || undefined;
      const reason = cleanString(args.reason, 300) || undefined;
      const newMode = { mode, until, reason, updatedAt: new Date().toISOString() };

      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: `${userId}@local.app`,
          password: 'mcp-session-user',
          preferences: {
            activeMode: newMode,
            updated_at: new Date().toISOString()
          }
        },
        update: {
          preferences: {
            ...currentPrefs,
            activeMode: newMode,
            updated_at: new Date().toISOString()
          }
        }
      });

      return rpcResult(id, {
        success: true,
        previousMode: activeMode.mode,
        activeMode: newMode,
        message: mode === 'examenes'
          ? `Modo Exámenes activado${until ? ` hasta ${until}` : ''}. Se han priorizado las entregas/TFG y se han silenciado los quehaceres domésticos.`
          : mode === 'vacaciones'
          ? `Modo Vacaciones activado${until ? ` hasta ${until}` : ''}. Se han pausado los avisos académicos para tu descanso.`
          : 'Modo Normal activado. Todas las rutinas y recordatorios operan equilibrados.'
      });
    }

    if (toolName === 'get_stats') {
      const stats = await computeStats(prisma, userId);
      return rpcResult(id, stats);
    }

    if (toolName === 'get_periodic_routines') {
      const period = typeof args.period === 'string' ? args.period : 'all';
      const includeCompleted = Boolean(args.includeCompleted);
      const includePaused = Boolean(args.includePaused);
      const routines = await computePeriodicRoutines(prisma, userId, period, includeCompleted, includePaused);
      return rpcResult(id, routines);
    }

    if (toolName === 'manage_routine_status') {
      const targetId = cleanString(args.id, 200);
      const targetTitle = cleanString(args.title, 300)?.toLowerCase().trim();
      const action = cleanString(args.action, 50);
      const reason = cleanString(args.reason, 500);

      if (!targetId && !targetTitle) {
        return rpcError(id, -32602, 'Debes proporcionar id o título de la tarea a gestionar');
      }
      if (action !== 'pause' && action !== 'resume' && action !== 'archive') {
        return rpcError(id, -32602, 'Acción no válida. Usa pause, resume o archive');
      }

      const rows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const tasks = rows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      let task = null;
      if (targetId) {
        task = tasks.find((t: any) => t.id === targetId || t._rowId === targetId || scopedId(userId, t.id) === targetId);
      }
      if (!task && targetTitle) {
        task = tasks.find((t: any) => String(t.title || '').toLowerCase().trim() === targetTitle);
        if (!task) {
          task = tasks.find((t: any) => String(t.title || '').toLowerCase().includes(targetTitle));
        }
      }

      if (!task) {
        return rpcError(id, -32602, `No se encontró ningún recordatorio que coincida con "${targetId || targetTitle}"`);
      }

      const rowId = task._rowId || scopedId(userId, task.id);
      const now = new Date().toISOString();
      const updatedPayload = { ...task };

      if (action === 'pause') {
        updatedPayload.status = 'paused';
        updatedPayload.isPaused = true;
        updatedPayload.pausedReason = reason || 'Pausada por el usuario';
        updatedPayload.pausedAt = now;
      } else if (action === 'archive') {
        updatedPayload.status = 'archived';
        updatedPayload.isPaused = true;
        updatedPayload.archivedReason = reason || 'Archivada por fin de etapa';
        updatedPayload.archivedAt = now;
      } else if (action === 'resume') {
        updatedPayload.status = 'pending';
        updatedPayload.isPaused = false;
        updatedPayload.resumedAt = now;
      }

      updatedPayload.updated_at = now;
      updatedPayload.version = (task.version || 1) + 1;
      delete updatedPayload._rowId;

      await prisma.task.update({
        where: { id: rowId },
        data: { payload: updatedPayload, updatedAt: new Date() }
      });

      return rpcResult(id, { success: true, action, reminder: updatedPayload });
    }

    if (toolName === 'attach_task_playbook') {
      const targetId = cleanString(args.id, 200);
      const targetTitle = cleanString(args.title, 300)?.toLowerCase().trim();
      const playbook = cleanString(args.playbook, 4000);
      const verificationMethod = cleanString(args.verificationMethod, 100);

      if (!targetId && !targetTitle) {
        return rpcError(id, -32602, 'Debes proporcionar id o título de la tarea');
      }
      if (!playbook) {
        return rpcError(id, -32602, 'El playbook o procedimiento es obligatorio');
      }

      const rows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const tasks = rows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      let task = null;
      if (targetId) {
        task = tasks.find((t: any) => t.id === targetId || t._rowId === targetId || scopedId(userId, t.id) === targetId);
      }
      if (!task && targetTitle) {
        task = tasks.find((t: any) => String(t.title || '').toLowerCase().trim() === targetTitle);
        if (!task) {
          task = tasks.find((t: any) => String(t.title || '').toLowerCase().includes(targetTitle));
        }
      }

      if (!task) {
        return rpcError(id, -32602, `No se encontró ningún recordatorio que coincida con "${targetId || targetTitle}"`);
      }

      const rowId = task._rowId || scopedId(userId, task.id);
      const now = new Date().toISOString();
      const updatedPayload = {
        ...task,
        playbook,
        verificationMethod: verificationMethod || task.verificationMethod,
        updated_at: now,
        version: (task.version || 1) + 1,
      };
      delete updatedPayload._rowId;

      await prisma.task.update({
        where: { id: rowId },
        data: { payload: updatedPayload, updatedAt: new Date() }
      });

      return rpcResult(id, { success: true, reminder: updatedPayload });
    }

    if (toolName === 'log_routine_execution') {
      const targetId = cleanString(args.id, 200);
      const targetTitle = cleanString(args.title, 300)?.toLowerCase().trim();
      const notes = cleanString(args.notes, 2000);
      const logStatus = cleanString(args.status, 20) || 'ok';
      const markCompleted = args.markCompleted !== false;

      if (!targetId && !targetTitle) {
        return rpcError(id, -32602, 'Debes proporcionar id o título de la tarea');
      }
      if (!notes) {
        return rpcError(id, -32602, 'Las notas de ejecución son obligatorias');
      }

      const rows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const tasks = rows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      let task = null;
      if (targetId) {
        task = tasks.find((t: any) => t.id === targetId || t._rowId === targetId || scopedId(userId, t.id) === targetId);
      }
      if (!task && targetTitle) {
        task = tasks.find((t: any) => String(t.title || '').toLowerCase().trim() === targetTitle);
        if (!task) {
          task = tasks.find((t: any) => String(t.title || '').toLowerCase().includes(targetTitle));
        }
      }

      if (!task) {
        return rpcError(id, -32602, `No se encontró ningún recordatorio que coincida con "${targetId || targetTitle}"`);
      }

      const rowId = task._rowId || scopedId(userId, task.id);
      const now = new Date().toISOString();
      const existingLogs = Array.isArray(task.executionLogs) ? task.executionLogs : [];
      const updatedLogs = [...existingLogs, { date: now, notes, status: logStatus, timestamp: Date.now() }];
      const completionHistory = Array.isArray(task.completionHistory) ? [...task.completionHistory] : [];
      if (markCompleted) completionHistory.push(Date.now());

      const updatedPayload = {
        ...task,
        executionLogs: updatedLogs,
        completionHistory,
        status: markCompleted ? 'completed' : task.status,
        completed_at: markCompleted ? now : task.completed_at,
        updated_at: now,
        version: (task.version || 1) + 1,
      };
      delete updatedPayload._rowId;

      await prisma.task.update({
        where: { id: rowId },
        data: { payload: updatedPayload, updatedAt: new Date() }
      });

      return rpcResult(id, { success: true, logEntry: updatedLogs[updatedLogs.length - 1], reminder: updatedPayload });
    }

    if (toolName === 'suggest_periodic_best_practices') {
      const category = cleanString(args.category, 50) || 'all';
      const filtered = category === 'all'
        ? BEST_PRACTICES_CATALOG
        : BEST_PRACTICES_CATALOG.filter((b) => b.category === category);
      return rpcResult(id, { count: filtered.length, bestPractices: filtered });
    }

    if (toolName === 'complete_reminder') {
      const targetId = cleanString(args.id, 200);
      const targetTitle = cleanString(args.title, 300)?.toLowerCase().trim();

      if (!targetId && !targetTitle) {
        return rpcError(id, -32602, 'Debes proporcionar el id o el título del recordatorio a completar');
      }

      const rows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const tasks = rows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      let task = null;
      if (targetId) {
        task = tasks.find((t: any) => t.id === targetId || t._rowId === targetId || scopedId(userId, t.id) === targetId);
      }
      if (!task && targetTitle) {
        task = tasks.find((t: any) => String(t.title || '').toLowerCase().trim() === targetTitle && t.status !== 'completed');
        if (!task) {
          task = tasks.find((t: any) => String(t.title || '').toLowerCase().includes(targetTitle) && t.status !== 'completed');
        }
      }

      if (!task) {
        return rpcError(id, -32602, `No se encontró ningún recordatorio pendiente que coincida con "${targetId || targetTitle}"`);
      }

      const rowId = task._rowId || scopedId(userId, task.id);
      const now = new Date().toISOString();
      const updatedPayload = {
        ...task,
        status: 'completed',
        completed_at: now,
        updated_at: now,
        version: (task.version || 1) + 1,
      };
      delete updatedPayload._rowId;

      await prisma.task.update({
        where: { id: rowId },
        data: { payload: updatedPayload, updatedAt: new Date() }
      });

      return rpcResult(id, { success: true, reminder: updatedPayload });
    }

    if (toolName === 'list_lists') {
      const rows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const lists = rows.map((r: any) => toClientPayload(userId, r)).filter((l: any) => !isSettingsList(l));
      return rpcResult(id, { lists: lists.map(({ id: lid, name, color, icon, parentId, isFolder }: any) => ({ id: lid, name, color, icon, parentId, isFolder })) });
    }

    if (toolName === 'create_list') {
      const name = cleanString(args.name, 120);
      if (!name) return rpcError(id, -32602, 'El nombre de la lista es obligatorio');
      const now = new Date().toISOString();
      const clientId = `list_${randomUUID()}`;
      const payload = {
        id: clientId,
        name,
        color: cleanString(args.color, 32) || '#007aff',
        icon: cleanString(args.icon, 40) || 'list',
        created_at: now,
        updated_at: now,
      };
      await prisma.list.create({ data: { id: scopedId(userId, clientId), userId, payload } });
      return rpcResult(id, { success: true, list: payload });
    }

    if (toolName === 'create_reminders') {
      const reminders = Array.isArray(args.reminders) ? args.reminders.slice(0, 100) : [];
      if (reminders.length === 0) return rpcError(id, -32602, 'Debes enviar al menos un recordatorio');

      // Resolver listName -> id existente del usuario (por nombre, sin distinguir mayúsculas).
      const listRows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const userLists = listRows.map((r: any) => toClientPayload(userId, r)).filter((l: any) => !isSettingsList(l));
      const resolveList = (r: any) => {
        const explicit = cleanString(r.listId, 200);
        if (explicit && userLists.some((l: any) => l.id === explicit)) return explicit;
        const byName = cleanString(r.listName, 120)?.toLowerCase();
        const match = byName && userLists.find((l: any) => String(l.name || '').toLowerCase() === byName);
        return match ? match.id : 'inbox';
      };

      // Tareas activas existentes del usuario para evitar duplicados en el MCP
      const existingTaskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = existingTaskRows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const now = new Date().toISOString();
      const created = [];
      const ops = [];

      for (const r of reminders) {
        const title = cleanString(r?.title, 300);
        if (!title) continue;
        const catId = resolveList(r);
        const normTitle = title.toLowerCase().trim();

        // Evitar duplicados: si ya existe una tarea idéntica pendiente en la misma lista, actualizar en vez de duplicar
        const existingTask = existingTasks.find(
          (t: any) => t.status !== 'completed' && hasTitle(t) &&
                 String(t.categoryId || 'inbox') === String(catId) &&
                 String(t.title || '').toLowerCase().trim() === normTitle
        );

        const dueDate = r.dueDate && !Number.isNaN(new Date(r.dueDate).getTime()) ? new Date(r.dueDate).toISOString() : undefined;

        if (existingTask) {
          const rowId = existingTask._rowId || scopedId(userId, existingTask.id);
          const updatedPayload = {
            ...existingTask,
            dueDate: dueDate || existingTask.dueDate,
            price: cleanNumber(r.price) ?? existingTask.price,
            description: cleanString(r.description, 2000) || existingTask.description,
            updated_at: now,
            version: (existingTask.version || 1) + 1,
          };
          delete updatedPayload._rowId;
          created.push(updatedPayload);
          ops.push(
            prisma.task.update({
              where: { id: rowId },
              data: { payload: updatedPayload, updatedAt: new Date() },
            })
          );
          continue;
        }

        const task = {
          id: randomUUID(),
          user_id: userId,
          type: 'task',
          title,
          description: cleanString(r.description, 2000) || undefined,
          categoryId: catId,
          dueDate,
          timeOfDay: VALID_TIMES.has(r.timeOfDay) ? r.timeOfDay : undefined,
          price: cleanNumber(r.price),
          quantity: cleanNumber(r.quantity),
          priority: VALID_PRIORITIES.has(r.priority) ? r.priority : 'none',
          cycle_id: VALID_CYCLES.has(r.cycle) ? r.cycle : undefined,
          status: 'pending',
          version: 1,
          created_at: now,
          updated_at: now,
        };
        Object.keys(task).forEach((k) => (task as any)[k] === undefined && delete (task as any)[k]);
        created.push(task);
        ops.push(prisma.task.create({ data: { id: scopedId(userId, task.id), userId, payload: task } }));
      }
      if (created.length === 0) return rpcError(id, -32602, 'Ningún recordatorio tenía título');

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }
      return rpcResult(id, { success: true, count: created.length, reminders: created });
    }

    if (toolName === 'query_reminders') {
      const query = (cleanString(args.query, 200) || '').toLowerCase();
      const listId = cleanString(args.listId, 200);
      const rows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const tasks = rows
        .map((r: any) => toClientPayload(userId, r))
        .filter((t: any) => !query || String(t.title || '').toLowerCase().includes(query))
        .filter((t: any) => !listId || t.categoryId === listId)
        .slice(0, 200);
      return rpcResult(id, { count: tasks.length, tasks });
    }

    if (toolName === 'group_reminders') {
      const parentTitle = cleanString(args.parentTitle, 300);
      if (!parentTitle) return rpcError(id, -32602, 'El título del recordatorio padre es obligatorio');

      const listRows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const userLists = listRows.map((r: any) => toClientPayload(userId, r)).filter((l: any) => !isSettingsList(l));
      const resolveList = (lid: unknown, lname: unknown) => {
        const explicit = cleanString(lid, 200);
        if (explicit && userLists.some((l: any) => l.id === explicit)) return explicit;
        const byName = cleanString(lname, 120)?.toLowerCase();
        const match = byName && userLists.find((l: any) => String(l.name || '').toLowerCase() === byName);
        return match ? match.id : 'inbox';
      };

      const existingTaskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = existingTaskRows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const now = new Date().toISOString();
      const ops = [];
      const updatedChildren = [];

      // 1. Resolver o crear tarea padre
      let parentTask = null;
      if (args.parentId) {
        parentTask = existingTasks.find((t: any) => t.id === args.parentId || t._rowId === args.parentId || scopedId(userId, t.id) === args.parentId);
      }
      if (!parentTask) {
        const normParent = parentTitle.toLowerCase().trim();
        parentTask = existingTasks.find((t: any) => hasTitle(t) && String(t.title || '').toLowerCase().trim() === normParent && !t.parentId);
      }

      const cycle = VALID_CYCLES.has(args.cycle) ? args.cycle : undefined;
      const targetCat = resolveList(args.listId, args.listName || 'compra');
      const targetSec = cleanString(args.sectionId, 100);

      if (!parentTask) {
        const newParentId = randomUUID();
        parentTask = {
          id: newParentId,
          user_id: userId,
          type: 'task',
          title: parentTitle,
          categoryId: targetCat,
          sectionId: targetSec || (targetCat === 'compra' ? 'sec_compra_anuales' : undefined),
          cycle_id: cycle || 'cycle_year',
          status: 'pending',
          version: 1,
          created_at: now,
          updated_at: now,
        };
        ops.push(prisma.task.create({ data: { id: scopedId(userId, parentTask.id), userId, payload: parentTask } }));
      } else {
        const updatedParent = {
          ...parentTask,
          categoryId: targetCat || parentTask.categoryId,
          sectionId: targetSec || parentTask.sectionId,
          cycle_id: cycle || parentTask.cycle_id,
          updated_at: now,
          version: (parentTask.version || 1) + 1,
        };
        const rowId = parentTask._rowId || scopedId(userId, parentTask.id);
        delete updatedParent._rowId;
        parentTask = updatedParent;
        ops.push(prisma.task.update({
          where: { id: rowId },
          data: { payload: updatedParent, updatedAt: new Date() }
        }));
      }

      // 2. Agrupar childTaskIds
      const childIds = Array.isArray(args.childTaskIds) ? args.childTaskIds : [];
      for (const cid of childIds) {
        const existingChild = existingTasks.find((t: any) => t.id === cid || t._rowId === cid || scopedId(userId, t.id) === cid);
        if (existingChild && existingChild.id !== parentTask.id && !wouldCycle(existingTasks, existingChild.id, parentTask.id)) {
          const rowId = existingChild._rowId || scopedId(userId, existingChild.id);
          const updatedChild = {
            ...existingChild,
            parentId: parentTask.id,
            categoryId: parentTask.categoryId,
            sectionId: parentTask.sectionId,
            cycle_id: cycle || parentTask.cycle_id || existingChild.cycle_id,
            updated_at: now,
            version: (existingChild.version || 1) + 1,
          };
          delete updatedChild._rowId;
          updatedChildren.push(updatedChild);
          ops.push(prisma.task.update({
            where: { id: rowId },
            data: { payload: updatedChild, updatedAt: new Date() }
          }));
        }
      }

      // 3. Procesar items con precios y cantidades
      const items = Array.isArray(args.items) ? args.items : [];
      for (const item of items) {
        const itemTitle = cleanString(item.title, 300);
        if (!itemTitle) continue;
        const norm = itemTitle.toLowerCase().trim();

        // Buscar si ya existe: primero por ID o coincidencia exacta de título en la misma lista
        let existing = existingTasks.find((t: any) =>
          item.id && (t.id === item.id || t._rowId === item.id || scopedId(userId, t.id) === item.id)
        );
        if (!existing) {
          existing = existingTasks.find((t: any) =>
            hasTitle(t) &&
            String(t.categoryId || '') === String(parentTask.categoryId || '') &&
            String(t.title || '').toLowerCase().trim() === norm
          );
        }
        // Sin coincidencias difusas (global ni por prefijo): reasignar una tarea ajena por parecido
        // de título corrompe datos. Si no hay ID ni título exacto en la lista, se crea una nueva.

        const price = cleanNumber(item.price);
        const quantity = cleanNumber(item.quantity) || 1;
        const itemCycle = VALID_CYCLES.has(item.cycle) ? item.cycle : (cycle || parentTask.cycle_id);

        if (existing && existing.id !== parentTask.id) {
          const rowId = existing._rowId || scopedId(userId, existing.id);
          const updatedChild = {
            ...existing,
            parentId: parentTask.id,
            categoryId: parentTask.categoryId,
            sectionId: parentTask.sectionId,
            price: price !== undefined ? price : existing.price,
            quantity: quantity !== undefined ? quantity : existing.quantity,
            cycle_id: itemCycle || existing.cycle_id,
            updated_at: now,
            version: (existing.version || 1) + 1,
          };
          delete updatedChild._rowId;
          updatedChildren.push(updatedChild);
          ops.push(prisma.task.update({
            where: { id: rowId },
            data: { payload: updatedChild, updatedAt: new Date() }
          }));
        } else {
          const newChild = {
            id: randomUUID(),
            user_id: userId,
            type: 'task',
            title: itemTitle,
            parentId: parentTask.id,
            categoryId: parentTask.categoryId,
            sectionId: parentTask.sectionId,
            price,
            quantity,
            cycle_id: itemCycle,
            status: 'pending',
            version: 1,
            created_at: now,
            updated_at: now,
          };
          Object.keys(newChild).forEach((k) => (newChild as any)[k] === undefined && delete (newChild as any)[k]);
          updatedChildren.push(newChild);
          ops.push(prisma.task.create({
            data: { id: scopedId(userId, newChild.id), userId, payload: newChild }
          }));
        }
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }

      return rpcResult(id, {
        success: true,
        parent: parentTask,
        childrenCount: updatedChildren.length,
        children: updatedChildren
      });
    }

    if (toolName === 'update_reminders') {
      const updates = Array.isArray(args.updates) ? args.updates.slice(0, 100) : [];
      if (updates.length === 0) return rpcError(id, -32602, 'Debes enviar al menos un recordatorio para actualizar');

      const existingTaskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = existingTaskRows.map((r: any) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const now = new Date().toISOString();
      const ops = [];
      const updated = [];

      for (const u of updates) {
        const targetId = cleanString(u.id, 200);
        if (!targetId) continue;
        const task = existingTasks.find((t: any) => t.id === targetId || t._rowId === targetId || scopedId(userId, t.id) === targetId);
        if (!task) continue;

        const rowId = task._rowId || scopedId(userId, task.id);
        const updatedPayload = { ...task };
        if (u.title !== undefined) updatedPayload.title = cleanString(u.title, 300) || task.title;
        if (u.price !== undefined) updatedPayload.price = cleanNumber(u.price);
        if (u.quantity !== undefined) updatedPayload.quantity = cleanNumber(u.quantity);
        if (u.parentId !== undefined) {
          const wanted = cleanString(u.parentId, 200);
          if (!wanted) {
            updatedPayload.parentId = undefined;
          } else {
            // Solo se acepta un padre existente que no cree una auto-referencia ni un ciclo.
            const parent = existingTasks.find((t: any) => t.id === wanted || t._rowId === wanted || scopedId(userId, t.id) === wanted);
            if (parent && !wouldCycle(existingTasks, task.id, parent.id)) updatedPayload.parentId = parent.id;
          }
        }
        if (u.sectionId !== undefined) updatedPayload.sectionId = cleanString(u.sectionId, 100) || undefined;
        if (u.listId !== undefined) updatedPayload.categoryId = cleanString(u.listId, 200) || task.categoryId;
        if (u.cycle !== undefined && VALID_CYCLES.has(u.cycle)) updatedPayload.cycle_id = u.cycle;
        if (u.status !== undefined && (u.status === 'pending' || u.status === 'completed')) updatedPayload.status = u.status;
        if (u.description !== undefined) updatedPayload.description = cleanString(u.description, 2000);

        updatedPayload.updated_at = now;
        updatedPayload.version = (task.version || 1) + 1;
        delete updatedPayload._rowId;

        updated.push(updatedPayload);
        ops.push(prisma.task.update({
          where: { id: rowId },
          data: { payload: updatedPayload, updatedAt: new Date() }
        }));
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }

      return rpcResult(id, { success: true, count: updated.length, updated });
    }

    return rpcError(id, -32601, `Herramienta no encontrada: ${toolName}`);
  } catch (err) {
    console.error('MCP execution error:', err);
    return rpcError(id, -32000, 'Error interno ejecutando la herramienta MCP');
  }
}
