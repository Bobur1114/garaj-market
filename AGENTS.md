# Architecture
- Send Telegram order notifications through the same-origin Netlify function; server-only credentials prevent public token exposure.
- Resolve notification details from the saved MockAPI order, not browser-provided prices or text, to keep notifications tied to stored orders.
