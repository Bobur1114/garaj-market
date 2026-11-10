const ORDERS_URL = 'https://6adfa8388e42963c8d5e43a5.mockapi.io/akkaunt-coin-oyinvaltalari';
const ADMIN_ID = '8247403538';
const SITE = 'https://effortless-genie-6f498f.netlify.app';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const short = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validOrder(order) {
  return order && short(order.id, 80) && short(order.name, 100) && short(order.contact, 100) && typeof order.note === 'string' && order.note.length <= 1000 && Array.isArray(order.items) && order.items.length > 0 && order.items.length <= 50 && order.items.every(item => short(item.title, 200) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 1000 && Number.isFinite(item.price) && item.price >= 0) && Number.isFinite(order.total) && order.total >= 0;
}
export function messageForOrder(order) {
  const money = value => new Intl.NumberFormat('uz-UZ').format(value);
  const lines = [`YANGI BUYURTMA #${order.id}`, `Mijoz: ${order.name}`, `Aloqa: ${order.contact}`, '', ...order.items.map(item => `• ${item.title} ×${item.quantity} — ${money(item.price * item.quantity)} so‘m`)];
  if (order.promo?.code && Number.isFinite(order.promo.discount)) lines.push(`Promokod: ${String(order.promo.code).slice(0, 20)} (−${money(order.promo.discount)} so‘m)`);
  lines.push('', `Jami: ${money(order.total)} so‘m`);
  if (order.note) lines.push(`Izoh: ${order.note}`);
  return lines.join('\n').slice(0, 4096);
}
export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { ok: false });
  if (request.headers.get('origin') !== SITE) return json(403, { ok: false });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return json(503, { ok: false, error: 'Telegram xabarnomasi hali sozlanmagan.' });
  let data;
  try { const text = await request.text(); if (text.length > 2048) return json(413, { ok: false }); data = JSON.parse(text); } catch { return json(400, { ok: false }); }
  if (!short(data?.orderId, 80) || !/^[A-Za-z0-9_-]+$/.test(data.orderId) || !short(data?.contact, 100)) return json(400, { ok: false });
  try {
    const saved = await fetch(`${ORDERS_URL}/${encodeURIComponent(data.orderId)}`, { signal: AbortSignal.timeout(10000) });
    if (!saved.ok) return json(404, { ok: false, error: 'Saqlangan buyurtma topilmadi.' });
    const order = await saved.json();
    if (typeof order.items === 'string') { try { order.items = JSON.parse(order.items); } catch { return json(400, { ok: false }); } }
    if (typeof order.promo === 'string') { try { order.promo = JSON.parse(order.promo); } catch { order.promo = null; } }
    order.id = String(order.id); order.note = order.note || '';
    if (!validOrder(order) || order.contact !== data.contact || order.status !== 'Yangi') return json(403, { ok: false });
    const age = Date.now() - Date.parse(order.createdAt);
    if (!Number.isFinite(age) || age < -60000 || age > 15 * 60 * 1000) return json(403, { ok: false });
    if (order.telegramNotifiedAt) return json(200, { ok: true });
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ADMIN_ID, text: messageForOrder(order) }), signal: AbortSignal.timeout(10000) });
    const result = await res.json();
    if (!res.ok || result.ok !== true) { console.error('Telegram notification failed', res.status, result.error_code); return json(502, { ok: false, error: 'Telegram’ga xabar yetib bormadi.' }); }
    const marked = await fetch(`${ORDERS_URL}/${encodeURIComponent(order.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telegramNotifiedAt: new Date().toISOString() }), signal: AbortSignal.timeout(10000) });
    if (!marked.ok) console.error('Notification delivery marker could not be saved', marked.status);
    return json(200, { ok: true });
  } catch { return json(502, { ok: false, error: 'Telegram xabarnomasini yuborishda muammo.' }); }
}
