# Telegram order notifications

1. Revoke the token exposed in the initial public notify.js through BotFather and obtain its replacement. Removing it from the current file does not remove it from GitHub history.
2. In this site's Netlify configuration, add the replacement as TELEGRAM_BOT_TOKEN, available to Functions. Never add the token to website JavaScript.
3. Redeploy the website from main through Netlify, not a static folder upload: Functions must deploy as well.
4. Send /start to that bot from the admin Telegram account (ID 8247403538).
5. Submit a test order and confirm both the saved MockAPI order and the Telegram notification.

Orders remain in the existing MockAPI source. The function reads saved orders from the default configured endpoint and sends only stored contents. Custom browser-only MockAPI endpoints are not supported. Fresh orders with matching contact information are eligible. Successful delivery is marked on the saved record; errors are shown without discarding the order.

Run tests: node --test tests/order-notify.test.mjs
