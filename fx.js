/* Garaj Market — fx.js: scroll-reveal, count-up, ripple, tilt, cart-fly, mobil menyu, avto-yangilash */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isAdmin = document.body.classList.contains("admin-page");
  document.documentElement.classList.add("fx");

  /* scroll progress + header + to-top + scrollspy */
  const bar = document.createElement("div"); bar.className = "scroll-progress"; document.body.appendChild(bar);
  const header = $(".shop-header");
  let toTop = null;
  if (!isAdmin) {
    toTop = document.createElement("button"); toTop.className = "to-top"; toTop.setAttribute("aria-label", "Tepaga"); toTop.textContent = "↑";
    toTop.onclick = () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); document.body.appendChild(toTop);
  }
  const spy = isAdmin
    ? { links: [], cls: "selected", ids: [] }
    : { links: $$(".main-nav a, .mobile-menu a"), cls: "active", ids: ["market", "how", "help"] };
  let ticking = false, lockUntil = 0;
  spy.links.forEach(a => a.addEventListener("click", () => { lockUntil = Date.now() + 900; spy.links.forEach(l => l.classList.toggle(spy.cls, l === a)); setTimeout(onScroll, 950); }));
  function onScroll() {
    ticking = false;
    const h = document.documentElement, y = h.scrollTop;
    bar.style.transform = `scaleX(${Math.min(1, y / ((h.scrollHeight - h.clientHeight) || 1))})`;
    if (header) header.classList.toggle("scrolled", y > 40);
    if (toTop) toTop.classList.toggle("show", y > 600);
    let current = spy.ids[0], best = -1e9;
    if (Date.now() < lockUntil) return;
    spy.ids.forEach(id => { const el = document.getElementById(id); if (!el) return; const t = el.getBoundingClientRect().top; if (t < innerHeight * 0.3 && t > best) { best = t; current = id; } });
    if (isAdmin && y < 80) current = "overview";
    if (isAdmin && innerHeight + y >= h.scrollHeight - 4 && y > 80) current = "orders-admin";
    if (!isAdmin && innerHeight + y >= h.scrollHeight - 4) current = "help";
    spy.links.forEach(a => a.classList.toggle(spy.cls, a.getAttribute("href") === "#" + current));
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll); onScroll();

  /* scroll reveal */
  const targets = ".trust-strip>div,.section-heading,.catalog-tools,.how-intro,.steps article,.help-banner,.shop-footer,.stat-card,.admin-panel,.admin-note,.api-connection,.welcome-bar";
  const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { const t = e.target; t.classList.add("in"); io.unobserve(t); setTimeout(() => { t.classList.remove("reveal", "in"); t.style.removeProperty("--d"); }, 1500 + (parseInt(t.style.getPropertyValue("--d")) || 0)); } }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }) : null;
  $$(targets).forEach(el => {
    if (!io) return;
    const sibs = [...el.parentElement.children].filter(c => c.matches(targets));
    el.style.setProperty("--d", Math.max(0, sibs.indexOf(el)) * 90 + "ms");
    el.classList.add("reveal"); io.observe(el);
  });

  /* count-up for admin stats */
  const nf = new Intl.NumberFormat("uz-UZ");
  function countUp(el) {
    let busy = false, prev = 0;
    const node = () => (el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null);
    const run = () => {
      if (busy) return;
      const n = node(); if (!n) return;
      const raw = n.nodeValue.replace(/\D/g, ""); if (raw === "") return;
      const to = Number(raw), from = prev; if (to === from) return;
      const tail = (n.nodeValue.match(/\s*$/) || [""])[0]; prev = to; busy = true;
      if (reduce) { busy = false; return; }
      const t0 = performance.now(), dur = 900;
      (function step(t) {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        const cur = node(); if (cur) cur.nodeValue = nf.format(Math.round(from + (to - from) * e)) + tail;
        if (p < 1) requestAnimationFrame(step); else busy = false;
      })(t0);
    };
    new MutationObserver(run).observe(el, { childList: true, characterData: true, subtree: true }); run();
  }
  ["stat-products", "stat-orders", "stat-stock", "stat-revenue"].forEach(id => { const el = document.getElementById(id); if (el) countUp(el); });
  ["side-order-count", "new-count-chip", "side-products-count"].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    new MutationObserver(() => { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }).observe(el, { childList: true, characterData: true, subtree: true });
  });

  /* ripple */
  document.addEventListener("click", e => {
    const b = e.target.closest("button, .primary-button, .secondary-button, .add-button"); if (!b || b.disabled || reduce) return;
    const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height), s = document.createElement("span");
    s.className = "ripple"; s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 650);
  });

  if (isAdmin) {
    /* avtomatik yangilanish: yangi buyurtmalar o'zi ko'rinadi */
    setInterval(() => { if (!document.hidden) window.dispatchEvent(new CustomEvent("mockapi:change")); }, 20000);
    return;
  }

  /* skeleton yuklanish */
  const grid = $("#product-grid");
  if (grid && !grid.children.length) grid.innerHTML = '<div class="skeleton"></div>'.repeat(4);

  /* 3D tilt */
  if (grid && matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce) {
    grid.addEventListener("mousemove", e => {
      const c = e.target.closest(".product-card"); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.classList.add("tilting"); c.style.setProperty("--ry", x * 10 + "deg"); c.style.setProperty("--rx", -y * 10 + "deg");
    });
    grid.addEventListener("mouseout", e => { const c = e.target.closest(".product-card"); if (c && !c.contains(e.relatedTarget)) { c.classList.remove("tilting"); c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); } });
  }

  /* savatga uchib boradigan nuqta + savat tebranishi */
  const cartBtn = $("#cart-open");
  grid && grid.addEventListener("click", e => {
    const add = e.target.closest("[data-add]"); if (!add || reduce || !cartBtn) return;
    const a = add.getBoundingClientRect(), c = cartBtn.getBoundingClientRect(), dot = document.createElement("div");
    dot.className = "fly-dot"; dot.style.left = a.left + a.width / 2 - 8 + "px"; dot.style.top = a.top + a.height / 2 - 8 + "px"; document.body.appendChild(dot);
    requestAnimationFrame(() => { dot.style.transform = `translate(${c.left + c.width / 2 - a.left - a.width / 2}px,${c.top + c.height / 2 - a.top - a.height / 2}px) scale(.3)`; dot.style.opacity = ".4"; });
    setTimeout(() => dot.remove(), 800);
  });
  const count = $("#cart-count");
  if (count && cartBtn) new MutationObserver(() => { cartBtn.classList.remove("bump"); void cartBtn.offsetWidth; cartBtn.classList.add("bump"); }).observe(count, { childList: true, characterData: true, subtree: true });

  /* mobil menyu */
  const nav = $(".main-nav"), actions = $(".header-actions");
  if (nav && actions && header) {
    const btn = document.createElement("button"); btn.className = "menu-trigger"; btn.setAttribute("aria-label", "Menyu"); btn.textContent = "☰";
    const menu = document.createElement("nav"); menu.className = "mobile-menu"; menu.innerHTML = nav.innerHTML; header.appendChild(menu); actions.appendChild(btn);
    const set = open => { menu.classList.toggle("open", open); btn.textContent = open ? "✕" : "☰"; };
    btn.onclick = () => set(!menu.classList.contains("open"));
    menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
    addEventListener("resize", () => { if (innerWidth > 600) set(false); });
  }
})();