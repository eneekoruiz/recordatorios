// Envío de emails transaccionales mediante la API HTTP de Resend (https://resend.com).
// Si no hay RESEND_API_KEY configurada, isMailConfigured() devuelve false y el
// servidor lo comunica de forma explícita en lugar de fingir que ha enviado algo.

export const isMailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendPasswordResetEmail(to, resetUrl) {
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c1c1e">
    <h1 style="font-size:22px;margin:0 0 12px">Restablece tu contraseña</h1>
    <p style="font-size:15px;line-height:1.5;color:#3a3a3c">Hemos recibido una solicitud para cambiar la contraseña de tu cuenta de Recordatorios. El enlace caduca en 30 minutos y solo funciona una vez.</p>
    <p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="background:#007aff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">Elegir nueva contraseña</a></p>
    <p style="font-size:13px;color:#8e8e93">Si no has sido tú, ignora este mensaje: tu contraseña no cambiará.</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: 'Restablece tu contraseña de Recordatorios',
      html,
      text: `Restablece tu contraseña (caduca en 30 minutos): ${resetUrl}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend respondió ${res.status}: ${body.slice(0, 200)}`);
  }
}
