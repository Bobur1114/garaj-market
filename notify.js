/* Secrets live only in the Netlify function environment. */
(function () {
  function warn(message) {
    const modal = document.querySelector('.order-modal-body');
    const node = document.createElement('p');
    node.className = 'form-error'; node.setAttribute('role', 'alert'); node.textContent = message;
    if (modal) modal.appendChild(node);
    else { const toast = document.getElementById('toast'); if (toast) { toast.textContent = message; toast.classList.add('show'); } }
  }
  async function orderCreated(order) {
    const button = document.querySelector('#checkout-form button[type=submit]');
    if (button) button.disabled = true;
    try {
      if (!order || !order.id || !order.contact) throw new Error('Buyurtma aniqlanmadi.');
      const response = await fetch('/.netlify/functions/order-notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: String(order.id), contact: String(order.contact) }), signal: AbortSignal.timeout(25000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Telegram’ga xabar yetib bormadi.');
      return true;
    } catch (error) {
      warn('Buyurtma saqlandi, lekin Telegram’ga xabar yuborilmadi. ' + (error.message || ''));
      return false;
    } finally { if (button) button.disabled = false; }
  }
  window.GarajNotify = { orderCreated };
})();
