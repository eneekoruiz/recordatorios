# Puente de canales de Recordatorios

Estado: backend y flujo de vinculación del modal implementados para pruebas locales. **Ningún canal externo está certificado como conectado.** No se registra otro bot de Telegram ni se envían mensajes. La pantalla permite comprobar vínculo, generar código de Telegram y revocar; WhatsApp solo permite consulta y revocación hasta disponer de recepción real.

## Identidad y contrato

La sesión JWT existente autoriza exclusivamente estas rutas de cuenta:

| Ruta | Resultado |
| --- | --- |
| `GET /api/channels` | `accountId`, configuración del puente, vínculo y permisos. La UI verifica la identidad antes de mostrar estado. `externalVerified` siempre es `false`; una variable configurada no acredita un bot operativo. |
| `POST /api/channels/telegram/link` | Código aleatorio de 256 bits, válido diez minutos. Se guarda solo su hash. Regenerar revoca el vínculo anterior. |
| `DELETE /api/channels/telegram` | Revoca exclusivamente el canal de esa cuenta. |

Se admite `whatsapp` con el mismo contrato, deshabilitado sin su secreto de servicio. No se almacenan JWT ni contraseñas en los vínculos. Un cambio de `sessionVersion` de la cuenta invalida códigos y vínculos anteriores.

Helen debe validar su transporte antes de llamar al puente: privado, remitente igual al chat y usuario en su allowlist para Telegram; webhook oficial firmado y número receptor esperado para WhatsApp. Nunca debe obtener `subject` del texto, del modelo ni de una petición pública sin autenticar.

Las rutas de servicio requieren `Authorization: Bearer <secreto>` independiente por canal (`TELEGRAM_BRIDGE_SECRET` o `WHATSAPP_BRIDGE_SECRET`, mínimo 32 caracteres). Usar secretos aleatorios distintos al JWT; HTTPS al conectar equipos. Estos valores se configuran en el entorno del servidor y en el transporte autorizado, nunca en el navegador ni en Git. Rotarlos cambia el hash de actor e invalida los vínculos existentes.

```http
POST /api/channel-bridge/telegram/redeem
Authorization: Bearer <secreto de servicio>
Content-Type: application/json

{"subject":"123456","code":"<64 caracteres hexadecimales>"}
```

La consumición se hace con actualización condicional atómica; la identidad de canal es única entre cuentas. Una carrera o un código ya consumido no transfiere el vínculo.

```http
POST /api/channel-bridge/telegram/operations
Authorization: Bearer <secreto de servicio>
Content-Type: application/json

{"subject":"123456","eventId":"<update_id estable>","operation":"write","payload":{"mutations":[{"id":"task-channel-1","expectedVersion":null,"patch":{"text":"Comprar leche"}}]}}
```

Para consultar, `operation: "read"` sin `payload`. La respuesta usa exactamente la proyección de `/api/helen/sync`. Modificar/completar usa `expectedVersion` de esa lectura; una versión antigua produce `conflicts`. Los permisos son fijos `tasks:read` y `tasks:write`: no se aceptan `userId`, modo, comandos de sistema, URLs, finanzas ni MCP. La misma función existente valida y aplica las tareas; no hay una segunda implementación.

`eventId` identifica el evento del proveedor, estable ante reintentos. No generar un UUID nuevo por cada intento. La clave de recibo incluye la generación del vínculo. Un evento repetido devuelve el recibo persistido; otro contenido con el mismo identificador devuelve 409. Una ejecución simultánea o un recibo no confirmado devuelve 202 `{uncertain:true}` y no repite escrituras. Un error puede llegar tras una aplicación parcial del lote: consultar las tareas antes de crear una operación nueva; no interpretar 202/503 como éxito total. Los recibos se conservan mientras exista el vínculo y se eliminan por cascada al revocarlo en PostgreSQL.

Revocar impide nuevas operaciones; una operación ya autorizada en curso puede terminar. Los límites HTTP existentes también protegen generación y consumo. Una avería de persistencia no activa una alternativa en memoria para identidades o deduplicación.

## Activación pendiente

1. Revisar y aplicar en una base de pruebas la migración preparada `20261104160000_channel_links`; comprobar unicidad, cascadas y concurrencia con PostgreSQL real. No se ha aplicado a ninguna base real.
2. Conectar las llamadas anteriores al Telegram privado existente en Helen y a su interpretación de tareas. El adaptador `telegramPrivateActor` verifica fixtures de identidad; todavía no está cableado al bot existente. Mantener su allowlist y no sustituir sus controles de identidad.
3. La pantalla ya consume estas rutas: comprobar vínculo, generar comando `/recordatorios vincular <código>` para el chat privado de Telegram y revocar. El código solo vive en memoria, caduca a los diez minutos y se descarta al cambiar de cuenta o cerrar el modal. Verificar el recorrido completo contra el bot autorizado antes de declarar conexión externa.
4. Para WhatsApp, confirmar con la cuenta su elegibilidad, app Meta, portfolio empresarial, WABA, número, permisos y presupuesto antes de configurar el webhook público. No se han solicitado ni leído credenciales. El módulo `channelTransport.ts` implementa y prueba HMAC sobre bytes originales y el desafío GET; todavía no existe receptor HTTP de WhatsApp ni intérprete conectado. No copiar el cuerpo parseado para verificar la firma.
5. Hacer una prueba de extremo a extremo autorizada y sin datos sensibles antes de declarar un canal operativo. Audios, notificaciones salientes y finanzas por WhatsApp quedan pendientes; no hay transcripción, envío ni costes de proveedor en estas pruebas.

## Fuentes primarias consultadas el 4 de noviembre de 2026

- [Telegram Bot API](https://core.telegram.org/bots/api): `setWebhook` admite `secret_token`; el proveedor lo entrega en `X-Telegram-Bot-Api-Secret-Token`. Helen debe verificar ese valor si usa webhook; su receptor actual por polling no necesita otro webhook.
- [Documentación Meta de verificación de webhooks](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/): desafío `hub.challenge` y firma `x-hub-signature-256`. El SDK está archivado: se usa solo para contrastar el protocolo; no se instala ni se basa la implementación en ese SDK. La página moderna de Developers devolvió 429 en esta consulta.
- [Colección oficial de Meta de Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api): portfolio, WABA, número empresarial y token con los permisos aplicables. Revisar los permisos concretos de la app antes de activar; un token de prueba no acredita acceso permanente.
- [Precios oficiales](https://whatsappbusiness.com/products/platform-pricing/): se cobra por mensaje entregado, según mercado y categoría; mensajes de servicio en respuesta al usuario tienen ventana de 24 horas. No se fija un precio en código ni se promete coste cero para salientes.
- [Política Business vigente](https://whatsappbusiness.com/policy/), actualizada el 23/09/2026: consentimiento, baja, plantillas aprobadas fuera de la ventana de servicio y vías de asistencia. Compartir número con finanzas exige además separación de permisos e intención; no está implementado en este puente.
- [Términos de WhatsApp Business](https://www.whatsapp.com/legal/business-solution-terms): contienen condiciones específicas para proveedores de IA y excepciones territoriales; no se asume que un asistente general sea elegible ni se declara un veto universal. Verificar las condiciones aplicables al número y cuenta antes de lanzar Helen por WhatsApp.
