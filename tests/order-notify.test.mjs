import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { validOrder, messageForOrder } from '../netlify/functions/order-notify.mjs';
const order = { id: '10', name: 'Test', contact: '@test', note: '', status: 'Yangi', items: [{ title: 'Coin', quantity: 2, price: 10000 }], total: 20000, createdAt: new Date().toISOString() };
test('stored order maps to correct quantities and total', () => { assert.equal(validOrder(order), true); assert.match(messageForOrder(order), /Coin ×2/); assert.match(messageForOrder(order), /20.?000/); });
test('cannot send negative quantities', () => { assert.equal(validOrder({ ...order, items: [{ title: 'Coin', quantity: -1, price: 10000 }] }), false); });
test('rejects another website', async () => { assert.equal((await handler(new Request('https://example.com', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }))).status, 403); });
test('requires saved contact and uses only stored content', async () => {
  const oldFetch = globalThis.fetch; const oldToken = process.env.TELEGRAM_BOT_TOKEN; process.env.TELEGRAM_BOT_TOKEN = 'test-only'; let calls = [];
  globalThis.fetch = async (url, options) => { calls.push([url, options]); return Response.json(calls.length === 1 ? order : { ok: true }); };
  try {
    const request = contact => new Request('https://example.com', { method: 'POST', headers: { origin: 'https://effortless-genie-6f498f.netlify.app' }, body: JSON.stringify({ orderId: '10', contact }) });
    assert.equal((await handler(request('@wrong'))).status, 403); assert.equal(calls.length, 1); calls = [];
    assert.equal((await handler(request('@test'))).status, 200); assert.equal(JSON.parse(calls[1][1].body).chat_id, '8247403538'); assert.match(JSON.parse(calls[1][1].body).text, /Coin ×2/);
  } finally { globalThis.fetch = oldFetch; if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = oldToken; }
});
