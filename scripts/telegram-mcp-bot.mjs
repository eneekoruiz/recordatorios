/**
 * Bridge / Bot de Telegram para Recordatorios mediante MCP.
 * 
 * Uso:
 *   TELEGRAM_BOT_TOKEN="tu_token_de_botfather" \
 *   REMINDERS_TOKEN="tu_jwt_token_de_recordatorios" \
 *   REMINDERS_URL="http://localhost:3001/api/mcp" \
 *   node scripts/telegram-mcp-bot.mjs
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const REMINDERS_URL = process.env.REMINDERS_URL || 'http://localhost:3001/api/mcp';
const USER_TOKEN = process.env.REMINDERS_TOKEN;

if (!BOT_TOKEN || !USER_TOKEN) {
  console.log('ℹ️ Para ejecutar este bot necesitas configurar:');
  console.log('   TELEGRAM_BOT_TOKEN="tu_token"');
  console.log('   REMINDERS_TOKEN="tu_jwt_token"');
  console.log('   REMINDERS_URL="http://localhost:3001/api/mcp" (opcional)');
}

async function callMcp(toolName, args = {}) {
  const res = await fetch(REMINDERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${USER_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(data.result.content[0].text);
}

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}

async function handleMessage(chatId, text) {
  const trimmed = text.trim();

  if (trimmed === '/start') {
    return `👋 *Asistente de Recordatorios Activo*
Comandos disponibles:
• \`/rutinas\` — Ver rutinas periódicas de hoy (Egela, winget, limpieza, etc.)
• \`/stats\` — Estadísticas en tiempo real
• \`/hecho <tarea>\` — Marcar una tarea completada
• \`/pausar <tarea>\` — Desactivar una rutina de etapa finalizada
• \`/sugerencias\` — Buenas prácticas periódicas recomendadas
O escribe el nombre de cualquier recordatorio para buscarlo.`;
  }

  if (trimmed === '/rutinas') {
    const routines = await callMcp('get_periodic_routines', { period: 'all', includePaused: false });
    let msg = `📅 *Rutinas Periódicas*\n\n`;

    if (routines.actionableByAi.length > 0) {
      msg += `💻 *Asistibles por Software / Técnicas:*\n`;
      for (const t of routines.actionableByAi) {
        msg += `• *${t.title}* (${t.periodicity})\n  _${t.suggestedAction}_\n`;
        if (t.commandSnippet) msg += `  \`${t.commandSnippet}\`\n`;
      }
      msg += `\n`;
    }

    if (routines.askUserChecklist.length > 0) {
      msg += `🧹 *Tareas Físicas / Hogar:*\n`;
      for (const t of routines.askUserChecklist) {
        msg += `• *${t.title}* (${t.periodicity})\n  ${t.questionForUser || ''}\n`;
      }
    }

    return msg;
  }

  if (trimmed === '/stats') {
    const stats = await callMcp('get_stats');
    return `📊 *Estadísticas en Tiempo Real*
• Total tareas: *${stats.total}*
• Completadas: *${stats.completed}* (${stats.completionRate})
• Pendientes: *${stats.pending}* (Vencidas: ${stats.overdue}, Para hoy: ${stats.dueToday})
• Compras pendientes: *${stats.shopping.pendingItems}* (~${stats.shopping.estimatedCostEuros} €)`;
  }

  if (trimmed.startsWith('/hecho')) {
    const query = trimmed.replace('/hecho', '').trim();
    if (!query) return '⚠️ Indica el nombre de la tarea. Ejemplo: `/hecho winget upgrade`';
    const res = await callMcp('complete_reminder', { title: query });
    return `✅ ¡Hecho! He marcado como completada: *${res.reminder.title}*`;
  }

  if (trimmed.startsWith('/pausar')) {
    const query = trimmed.replace('/pausar', '').trim();
    if (!query) return '⚠️ Indica la tarea a pausar. Ejemplo: `/pausar Egela`';
    const res = await callMcp('manage_routine_status', { title: query, action: 'pause', reason: 'Pausada desde Telegram' });
    return `⏸️ Rutina pausada: *${res.reminder.title}*. Se mantiene todo su historial y playbook para el futuro sin molestarte ahora.`;
  }

  if (trimmed === '/sugerencias') {
    const suggestions = await callMcp('suggest_periodic_best_practices', { category: 'all' });
    let msg = `💡 *Buenas Prácticas Periódicas Recomendadas:*\n\n`;
    for (const b of suggestions.bestPractices.slice(0, 4)) {
      msg += `• *${b.title}* [${b.category}]\n  _${b.description}_\n  Frecuencia: ${b.frequencyAdvice}\n\n`;
    }
    return msg;
  }

  // Búsqueda por texto
  const found = await callMcp('query_reminders', { query: trimmed });
  if (found.count === 0) return `No encontré tareas con "${trimmed}". Usa /rutinas o /stats.`;
  return `🔍 Encontradas ${found.count} tareas:\n` + found.tasks.slice(0, 5).map(t => `• ${t.title} [${t.status}]`).join('\n');
}

// Bucle de polling simple si se ejecuta con token
if (BOT_TOKEN && USER_TOKEN) {
  console.log('🚀 Telegram MCP Bot escuchando...');
  let offset = 0;
  async function poll() {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (msg?.text && msg.chat?.id) {
            try {
              const reply = await handleMessage(msg.chat.id, msg.text);
              await sendTelegram(msg.chat.id, reply);
            } catch (err) {
              await sendTelegram(msg.chat.id, `❌ Error: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
    setTimeout(poll, 1000);
  }
  poll();
}

export { handleMessage, callMcp };
