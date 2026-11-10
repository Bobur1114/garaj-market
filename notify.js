/* Telegram orqali yangi buyurtma xabarnomasi.
   DIQQAT: statik saytda token ochiq ko'rinadi — bu bot faqat xabar yuborish uchun ishlatilishi kerak. */
(function () {
  const TOKEN = "8716067657:AAGR1yuKZ1V1J2FV_N2KySMitporzbqUGCU";
  const CHAT_ID = "8247403538";
  const formatMoney = value => new Intl.NumberFormat("uz-UZ").format(Number(value) || 0);

  async function orderCreated(order) {
    if (!TOKEN || !CHAT_ID || !order) return;
    const lines = [
      `YANGI BUYURTMA #${order.id}`,
      `Mijoz: ${order.name}`,
      `Aloqa: ${order.contact}`,
      "",
      ...(order.items || []).map(item => `• ${item.title} ×${item.quantity} — ${formatMoney(item.price * item.quantity)} so‘m`)
    ];
    if (order.promo && order.promo.code) lines.push(`Promokod: ${order.promo.code} (−${formatMoney(order.promo.discount)} so‘m)`);
    lines.push("", `Jami: ${formatMoney(order.total)} so‘m`);
    if (order.note) lines.push(`Izoh: ${order.note}`);
    try {
      const products = await window.GarajAPI.getProducts();
      const low = products.filter(product => Number(product.stock) < 3 && (order.items || []).some(item => item.productId === product.id));
      if (low.length) lines.push("", "⚠ Ombor kam:", ...low.map(product => `• ${product.title} — ${Number(product.stock) > 0 ? Number(product.stock) + " ta qoldi" : "tugadi"}`));
    } catch (error) { /* Asosiy xabar baribir yuboriladi. */ }
    try {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join("\n") })
      });
    } catch (error) { /* xabar bormasa ham buyurtma qabul qilingan */ }
  }

  window.GarajNotify = { orderCreated };
})();