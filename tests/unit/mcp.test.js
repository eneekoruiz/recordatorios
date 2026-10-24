import { describe, it, expect, beforeEach } from 'vitest';
import { handleMcpRequest } from '../../server/mcp.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';

const U = 'u1';
let prisma;

const addTask = (id, payload = {}) =>
  prisma.task.create({ data: { id: `${U}:${id}`, userId: U, payload: { id, title: id, categoryId: 'inbox', status: 'pending', version: 1, ...payload } } });
const call = async (name, args) => {
  const res = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, prisma, U);
  return res.result ? JSON.parse(res.result.content[0].text) : res;
};
const payloadOf = async (id) => (await prisma.task.findMany({ where: { userId: U } })).find((r) => r.id === `${U}:${id}`).payload;

describe('MCP — integridad de datos', () => {
  beforeEach(() => {
    prisma = createMemoryPrisma();
  });

  it('group_reminders no reasigna una tarea con título vacío', async () => {
    await addTask('vacia', { title: '' });
    const out = await call('group_reminders', { parentTitle: 'Desayuno', items: [{ title: 'Leche' }] });
    expect(out.children).toHaveLength(1);
    expect(out.children[0].title).toBe('Leche');
    expect((await payloadOf('vacia')).parentId).toBeUndefined();
  });

  it('group_reminders no reasigna tareas por parecido de título (prefijo ni otra lista)', async () => {
    await addTask('almendras', { title: 'Leche de almendras', categoryId: 'compra' });
    await addTask('otra', { title: 'Leche', categoryId: 'trabajo' });
    const out = await call('group_reminders', { parentTitle: 'Desayuno', listName: 'compra', items: [{ title: 'Leche' }] });
    expect(out.children).toHaveLength(1);
    expect(out.children[0].id).not.toBe('otra');
    expect((await payloadOf('almendras')).parentId).toBeUndefined();
    expect((await payloadOf('otra')).parentId).toBeUndefined();
  });

  it('group_reminders sigue reutilizando una tarea con el mismo título exacto en la lista', async () => {
    await addTask('leche', { title: 'Leche', categoryId: 'inbox' });
    const out = await call('group_reminders', { parentTitle: 'Desayuno', listId: 'inbox', items: [{ title: 'leche', price: 2 }] });
    expect(out.children[0].id).toBe('leche');
    expect((await payloadOf('leche')).price).toBe(2);
  });

  it('group_reminders no crea ciclos con childTaskIds', async () => {
    await addTask('padre');
    await addTask('hijo', { parentId: 'padre' });
    const out = await call('group_reminders', { parentTitle: 'hijo', parentId: 'hijo', childTaskIds: ['padre'] });
    expect(out.success).toBe(true);
    expect((await payloadOf('padre')).parentId).toBeUndefined();
  });

  it('update_reminders rechaza auto-referencias, ciclos y padres inexistentes', async () => {
    await addTask('a');
    await addTask('b', { parentId: 'a' });
    await call('update_reminders', { updates: [{ id: 'a', parentId: 'a' }, { id: 'a', parentId: 'b' }, { id: 'b', parentId: 'no-existe' }] });
    expect((await payloadOf('a')).parentId).toBeUndefined();
    expect((await payloadOf('b')).parentId).toBe('a');
  });

  it('update_reminders acepta un padre válido y permite desanidar', async () => {
    await addTask('a');
    await addTask('b');
    await call('update_reminders', { updates: [{ id: 'b', parentId: 'a' }] });
    expect((await payloadOf('b')).parentId).toBe('a');
    await call('update_reminders', { updates: [{ id: 'b', parentId: '' }] });
    expect((await payloadOf('b')).parentId).toBeUndefined();
  });

  it('create_reminders no fusiona con una tarea de título vacío', async () => {
    await addTask('vacia', { title: '' });
    const out = await call('create_reminders', { reminders: [{ title: '  ' }, { title: 'Nueva' }] });
    expect(out.count).toBe(1);
    expect((await payloadOf('vacia')).title).toBe('');
  });

  it('get_stats devuelve métricas en tiempo real, compras y tasa de cumplimiento', async () => {
    await addTask('t1', { title: 'Tarea 1', status: 'completed' });
    await addTask('t2', { title: 'Tarea 2', status: 'pending' });
    await addTask('c1', { title: 'Manzanas', categoryId: 'compra', price: 3.5, quantity: 2, status: 'pending' });

    const stats = await call('get_stats', {});
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(2);
    expect(stats.shopping.pendingItems).toBe(1);
    expect(stats.shopping.estimatedCostEuros).toBe(7);
  });

  it('get_periodic_routines clasifica tareas técnicas frente a manuales para la IA', async () => {
    // Tarea técnica periódica semanal
    await addTask('w1', { title: '[S] Actualizar aplicaciones con winget upgrade all', cycle_id: 'cycle_week' });
    // Tarea técnica periódica mensual
    await addTask('e1', { title: '[M] Actualizar el egela y revisar entregas', cycle_id: 'cycle_month' });
    // Tarea física periódica semanal
    await addTask('l1', { title: '[S] Limpieza general y fregar suelos', cycle_id: 'cycle_week' });

    const out = await call('get_periodic_routines', { period: 'all' });
    expect(out.actionableByAi).toHaveLength(2);
    expect(out.actionableByAi.some((t) => t.title.includes('winget') && t.commandSnippet === 'winget upgrade --all')).toBe(true);
    expect(out.actionableByAi.some((t) => t.title.includes('egela'))).toBe(true);

    expect(out.askUserChecklist).toHaveLength(1);
    expect(out.askUserChecklist[0].title).toContain('Limpieza');
    expect(out.askUserChecklist[0].questionForUser).toContain('¿Has podido hacer');
  });

  it('complete_reminder completa recordatorios por id o por título', async () => {
    await addTask('winget_task', { title: 'winget upgrade --all semanal', status: 'pending' });

    // Completar por búsqueda aproximada de título
    const resTitle = await call('complete_reminder', { title: 'winget upgrade' });
    expect(resTitle.success).toBe(true);
    expect(resTitle.reminder.status).toBe('completed');
    expect((await payloadOf('winget_task')).status).toBe('completed');

    // Completar por id
    await addTask('limp_task', { title: 'Limpiar filtros de la campana', status: 'pending' });
    const resId = await call('complete_reminder', { id: 'limp_task' });
    expect(resId.success).toBe(true);
    expect((await payloadOf('limp_task')).status).toBe('completed');
  });

  it('resources/read y prompts/get devuelven contexto y plantillas correctamente', async () => {
    await addTask('dash_task', { title: 'Tarea dashboard' });

    const resDash = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'recordatorios://dashboard' } }, prisma, U);
    expect(resDash.result.contents[0].uri).toBe('recordatorios://dashboard');
    const parsedStats = JSON.parse(resDash.result.contents[0].text);
    expect(parsedStats.total).toBeGreaterThanOrEqual(1);

    const resPrompt = await handleMcpRequest({ jsonrpc: '2.0', id: 3, method: 'prompts/get', params: { name: 'asistente_rutinas_y_mantenimiento' } }, prisma, U);
    expect(resPrompt.result.messages[0].content.text).toContain('get_periodic_routines');
  });

  it('manage_routine_status permite pausar, archivar y reanudar tareas de etapas cambiantes sin perder datos', async () => {
    await addTask('egela_ehu', {
      title: '[M] Descargar apuntes y material de Egela EHU',
      cycle_id: 'cycle_month',
      status: 'pending'
    });

    // Pausar porque terminó la etapa académica
    const pauseRes = await call('manage_routine_status', {
      title: 'Egela EHU',
      action: 'pause',
      reason: 'Graduado en la EHU, ya no necesito descargar cada mes'
    });
    expect(pauseRes.success).toBe(true);
    expect(pauseRes.reminder.status).toBe('paused');
    expect(pauseRes.reminder.isPaused).toBe(true);

    // Comprobar que en rutinas activas no aparece
    const activeRoutines = await call('get_periodic_routines', { period: 'all', includePaused: false });
    expect(activeRoutines.actionableByAi.some((t) => t.id === 'egela_ehu')).toBe(false);

    // Comprobar que con includePaused: true sí aparece en el registro histórico
    const allRoutines = await call('get_periodic_routines', { period: 'all', includePaused: true });
    expect(allRoutines.pausedOrArchived.some((t) => t.id === 'egela_ehu')).toBe(true);
    expect(allRoutines.pausedOrArchived[0].reason).toContain('Graduado en la EHU');

    // Reactivar si vuelve a estudiar
    const resumeRes = await call('manage_routine_status', {
      id: 'egela_ehu',
      action: 'resume'
    });
    expect(resumeRes.reminder.status).toBe('pending');
    expect(resumeRes.reminder.isPaused).toBe(false);
  });

  it('attach_task_playbook y log_routine_execution registran procedimientos técnicos y notas de ejecución', async () => {
    await addTask('ehu_playwright', {
      title: '[M] Backup Egela Moodle con Playwright',
      cycle_id: 'cycle_month',
      status: 'pending'
    });

    // Adjuntar instrucciones paso a paso
    const playbookText = '1. Iniciar sesión en Egela con credenciales. 2. Correr script Playwright para descargar PDFs. 3. Subir a Google Drive.';
    const attachRes = await call('attach_task_playbook', {
      title: 'Backup Egela',
      playbook: playbookText,
      verificationMethod: 'Playwright & Google Drive'
    });
    expect(attachRes.success).toBe(true);
    expect(attachRes.reminder.playbook).toBe(playbookText);
    expect(attachRes.reminder.verificationMethod).toBe('Playwright & Google Drive');

    // Registrar ejecución técnica
    const logRes = await call('log_routine_execution', {
      id: 'ehu_playwright',
      notes: 'Ejecutado script Playwright. 18 PDFs descargados y verificados como legibles. Copia en Drive OK.',
      status: 'ok',
      markCompleted: true
    });
    expect(logRes.success).toBe(true);
    expect(logRes.reminder.status).toBe('completed');
    expect(logRes.reminder.executionLogs).toHaveLength(1);
    expect(logRes.reminder.executionLogs[0].notes).toContain('18 PDFs descargados');
  });

  it('suggest_periodic_best_practices devuelve catálogo de rutinas recomendadas', async () => {
    const all = await call('suggest_periodic_best_practices', { category: 'all' });
    expect(all.count).toBeGreaterThanOrEqual(5);

    const academic = await call('suggest_periodic_best_practices', { category: 'academic' });
    expect(academic.bestPractices.some((b) => b.title.includes('Egela') || b.title.includes('Moodle'))).toBe(true);

    const software = await call('suggest_periodic_best_practices', { category: 'software' });
    expect(software.bestPractices.some((b) => b.title.includes('winget'))).toBe(true);
  });

  it('get_periodic_routines incluye existingDomains (limpieza por habitaciones, compra, caducidades)', async () => {
    // Tareas existentes de limpieza asignadas a cocina y baño
    await addTask('l_cocina', { title: 'Limpiar vitrocerámica y campana', categoryId: 'limpieza' });
    await addTask('l_bano', { title: 'Limpiar mampara de ducha', categoryId: 'limpieza' });
    await addTask('l_hecho', { title: 'Barrer cocina', categoryId: 'limpieza', status: 'completed' });

    // Tareas existentes de compras
    await addTask('c_leche', { title: 'Leche entera', categoryId: 'compra', price: 1.15, quantity: 3 });

    // Tareas existentes de caducidades
    await addTask('cad_sub', { title: 'Spotify Premium', categoryId: 'caducidades', price: 10.99, subscriptionPeriod: 'month' });

    const out = await call('get_periodic_routines', { period: 'all' });
    expect(out.existingDomains).toBeDefined();

    // Limpieza
    expect(out.existingDomains.limpieza.total).toBe(3);
    expect(out.existingDomains.limpieza.completed).toBe(1);
    expect(out.existingDomains.limpieza.pending).toBe(2);
    expect(out.existingDomains.limpieza.byRoom['Cocina'].pendingTasks).toHaveLength(1);
    expect(out.existingDomains.limpieza.byRoom['Cocina'].pendingTasks[0].title).toContain('vitrocerámica');
    expect(out.existingDomains.limpieza.byRoom['Baño'].pendingTasks).toHaveLength(1);
    expect(out.existingDomains.limpieza.byRoom['Baño'].pendingTasks[0].title).toContain('mampara');
    expect(out.existingDomains.limpieza.conversationalQuestions.length).toBeGreaterThan(0);

    // Compra
    expect(out.existingDomains.compra.pending).toBe(1);
    expect(out.existingDomains.compra.estimatedCostEuros).toBe(3.45);
    expect(out.existingDomains.compra.conversationalQuestion).toContain('compra');

    // Caducidades
    expect(out.existingDomains.caducidades.total).toBe(1);
    expect(out.existingDomains.caducidades.activeSubscriptions).toBe(1);
    expect(out.existingDomains.caducidades.estimatedMonthlyEuros).toBe(10.99);
  });

  it('ensure_essential_routines crea chequeo médico/dental, seguro dental y respaldo de junio sin duplicar', async () => {
    const firstCall = await call('ensure_essential_routines', {});
    expect(firstCall.success).toBe(true);
    expect(firstCall.created).toHaveLength(3);
    expect(firstCall.alreadyExisting).toHaveLength(0);

    const egela = firstCall.created.find((t) => t.title.includes('junio'));
    expect(egela).toBeDefined();
    expect(egela.dueDate).toMatch(/-\d{2}-\d{2}T/);
    expect(egela.dueDate).toContain('-06-15');
    expect(egela.cycle_id).toBe('cycle_year');

    const dental = firstCall.created.find((t) => t.title.includes('Chequeo preventivo'));
    expect(dental).toBeDefined();
    expect(dental.cycle_id).toBe('cycle_year');

    // Segunda llamada: debe detectar que ya existen y NO duplicar nada
    const secondCall = await call('ensure_essential_routines', {});
    expect(secondCall.success).toBe(true);
    expect(secondCall.created).toHaveLength(0);
    expect(secondCall.alreadyExisting).toHaveLength(3);
  });

  it('run_system_maintenance audita temporales, descargas y estado Git de forma segura', async () => {
    // Auditoría de temporales en modo dryRun
    const tempRes = await call('run_system_maintenance', { action: 'clean_temp_cache', dryRun: true });
    expect(tempRes.success).toBe(true);
    expect(tempRes.dryRun).toBe(true);
    expect(tempRes.tempDir).toBeDefined();

    // Auditoría de descargas en modo dryRun
    const downRes = await call('run_system_maintenance', { action: 'clean_downloads', dryRun: true });
    expect(downRes.success).toBe(true);
    expect(downRes.dryRun).toBe(true);
    expect(downRes.downloadsDir).toBeDefined();

    // Auditoría de Git / Dependabot
    const gitRes = await call('run_system_maintenance', { action: 'git_dependabot_audit' });
    expect(gitRes.success).toBe(true);
    expect(gitRes.gitStatus).toBeDefined();
    expect(typeof gitRes.uncommittedFilesCount).toBe('number');
  });

  it('manage_app_mode permite consultar y cambiar entre modo normal, exámenes y vacaciones modulando rutinas', async () => {
    // 1. Consulta inicial: debe devolver modo normal por defecto
    const initial = await call('manage_app_mode', { action: 'get' });
    expect(initial.activeMode.mode).toBe('normal');

    // 2. Insertar tareas: una académica y una de limpieza
    await addTask('uni_task', { title: '[S] Revisar entregas de Moodle / Egela y TFG', cycle_id: 'cycle_week' });
    await addTask('clean_task', { title: '[S] Limpieza general y fregar suelos', cycle_id: 'cycle_week' });

    // En modo normal, ambas están en sus listas normales
    const normalRoutines = await call('get_periodic_routines', { period: 'all' });
    expect(normalRoutines.activeMode.mode).toBe('normal');
    expect(normalRoutines.askUserChecklist.some((t) => t.id === 'clean_task')).toBe(true);

    // 3. Activar Modo Exámenes
    const setExamenes = await call('manage_app_mode', {
      action: 'set',
      mode: 'examenes',
      until: '2027-06-30',
      reason: 'Convocatoria de exámenes finales y entrega de TFG',
    });
    expect(setExamenes.success).toBe(true);
    expect(setExamenes.activeMode.mode).toBe('examenes');
    expect(setExamenes.activeMode.until).toBe('2027-06-30');

    // Comprobar que en Modo Exámenes la limpieza pasa a estar silenciada/pausada
    const examRoutines = await call('get_periodic_routines', { period: 'all' });
    expect(examRoutines.activeMode.mode).toBe('examenes');
    // clean_task no debe incomodar en askUserChecklist
    expect(examRoutines.askUserChecklist.some((t) => t.id === 'clean_task')).toBe(false);
    expect(examRoutines.pausedOrArchived.some((t) => t.id === 'clean_task')).toBe(true);
    // uni_task es prioritaria en modo exámenes
    const academic = examRoutines.actionableByAi.find((t) => t.id === 'uni_task');
    expect(academic).toBeDefined();

    // 4. Activar Modo Vacaciones
    const setVacaciones = await call('manage_app_mode', {
      action: 'set',
      mode: 'vacaciones',
      reason: 'Vacaciones de verano',
    });
    expect(setVacaciones.success).toBe(true);
    expect(setVacaciones.activeMode.mode).toBe('vacaciones');

    // En Modo Vacaciones, las tareas académicas quedan pausadas
    const vacRoutines = await call('get_periodic_routines', { period: 'all' });
    expect(vacRoutines.activeMode.mode).toBe('vacaciones');
    expect(vacRoutines.pausedOrArchived.some((t) => t.id === 'uni_task')).toBe(true);
    expect(vacRoutines.actionableByAi.some((t) => t.id === 'uni_task')).toBe(false);

    // 5. Volver a Modo Normal
    const setNormal = await call('manage_app_mode', { action: 'set', mode: 'normal' });
    expect(setNormal.success).toBe(true);
    expect(setNormal.activeMode.mode).toBe('normal');
  });
});
