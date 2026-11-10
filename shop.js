(function () {
  const api = window.GarajAPI;
  const productGrid = document.getElementById("product-grid");
  const emptyProducts = document.getElementById("empty-products");
  const filterRoot = document.getElementById("category-filters");
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  const cart = new Map();
  let products = [];
  let category = "all";
  let searchText = "";
  let sort = "featured";
  let toastTimer;
  let loadError = false;
  let appliedPromo = null;
  let hashHandled = false;
  const CONTACT_URL = "https://t.me/+998945431172";
  const CART_KEY = "garaj-market.cart.v1";
  const FAVS_KEY = "garaj-market.favs.v1";
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || "[]")); } catch (error) { /* Bo'sh ro'yxat bilan boshlanadi. */ }

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatMoney = value => new Intl.NumberFormat("uz-UZ").format(Number(value) || 0);
  const formatDate = value => new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const categoryName = key => ({ account: "AKKAUNT", coin: "COINLAR", currency: "O‘YIN VALYUTASI", car: "MASHINA" }[key] || "MAHSULOT");
  const validImage = value => /^(https?:\/\/\S+|data:image\/(jpeg|png|webp);base64,)/i.test(String(value || ""));
  const chipsMarkup = product => { const list = api.specList(product).slice(0, 3); return list.length ? `<div class="spec-chips">${list.map(text => `<span>${escapeHtml(text)}</span>`).join("")}</div>` : ""; };
  const oldPriceMarkup = product => product.oldPrice > product.price ? `<span class="old-price">${formatMoney(product.oldPrice)} so‘m <b>-${Math.round((1 - product.price / product.oldPrice) * 100)}%</b></span>` : "";
  const symbols = { garage: "✦", premium: "♛", coins: "◉", cash: "＄", car: "⬢" };

  function toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("show"), 2600);
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify([...cart.entries()])); } catch (error) { /* Saqlash imkonisiz ham savat ishlaydi. */ }
  }
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(saved)) return;
      cart.clear();
      for (const entry of saved) {
        if (Array.isArray(entry) && typeof entry[0] === "string" && Number(entry[1]) > 0) cart.set(entry[0], Math.floor(Number(entry[1])));
      }
    } catch (error) { /* Bo'sh savat bilan boshlanadi. */ }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAVS_KEY, JSON.stringify([...favorites])); } catch (error) { /* Ignore. */ }
  }
  function updateFavCount() {
    const node = document.getElementById("fav-count");
    if (node) node.textContent = favorites.size;
  }
  function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveFavorites();
    document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(button => {
      const active = favorites.has(id);
      button.classList.toggle("active", active);
      button.textContent = active ? "♥" : "♡";
    });
    updateFavCount();
    if (category === "favs") renderProducts();
  }

  function visibleProducts() {
    let list = products.filter(product => (category === "all" || (category === "favs" ? favorites.has(product.id) : product.category === category)) &&
      (!searchText || `${product.title} ${product.description} ${categoryName(product.category)}`.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())));
    if (sort === "price-low") list = list.slice().sort((a, b) => a.price - b.price);
    if (sort === "price-high") list = list.slice().sort((a, b) => b.price - a.price);
    return list;
  }

  function visualMarkup(product) {
    const visual = ["garage", "premium", "coins", "cash", "car"].includes(product.visual) ? product.visual : product.category === "coin" ? "coins" : product.category === "currency" ? "cash" : product.category === "car" ? "car" : "premium";
    const decoration = visual === "coins" ? '<span class="coin-stack"><i></i><i></i><i></i></span>' : visual === "cash" ? '<span class="cash-stack"></span>' : "";
    const photo = validImage(product.image) ? `<img class="product-photo" src="${escapeHtml(product.image)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-img');this.remove()">` : "";
    const label = visual === "coins" ? "COIN" : visual === "cash" ? "CASH" : visual === "car" ? "CAR" : "GARAGE";
    const fav = favorites.has(product.id);
    return `<div class="product-visual ${visual}${photo ? " has-img" : ""}">${photo}<span class="product-tag">${escapeHtml(product.tag || "TAVSIYA")}</span><button class="fav-button${fav ? " active" : ""}" data-fav="${escapeHtml(product.id)}" aria-label="Sevimlilarga qo‘shish">${fav ? "♥" : "♡"}</button><span class="visual-ring"></span><div class="visual-plate"><span class="visual-glyph">${symbols[visual] || "✦"}</span>${decoration}</div><span class="visual-label">CPM · ${label}</span></div>`;
  }

  function renderProducts() {
    const visible = visibleProducts();
    productGrid.innerHTML = visible.map(product => `<article class="product-card" data-id="${escapeHtml(product.id)}">
      ${visualMarkup(product)}
      <div class="product-info"><div class="product-type">${categoryName(product.category)}</div><h3 class="product-name">${escapeHtml(product.title)}</h3><p class="product-description">${escapeHtml(product.description)}</p>${chipsMarkup(product)}
      <div class="product-bottom"><div><span class="price-label">NARXI</span>${oldPriceMarkup(product)}<span class="product-price">${formatMoney(product.price)} <small>so‘m</small></span></div><button class="add-cart" data-add="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.title)} savatga qo‘shish" ${product.stock < 1 ? "disabled" : ""}>＋</button></div>
      <div class="stock-note${product.stock > 0 && product.stock < 3 ? " low" : ""}">${product.stock > 0 ? (product.stock < 3 ? `⚠ Kam qoldi — ${product.stock} ta` : `Omborda ${product.stock} ta bor`) : "Hozircha tugagan"}</div></div></article>`).join("");
    emptyProducts.textContent = loadError ? "Mahsulotlarni yuklab bo‘lmadi. Internetni tekshirib, sahifani yangilang." : !products.length ? "Hozircha mahsulotlar qo‘shilmagan." : category === "favs" && !favorites.size ? "Sevimlilar hozircha bo‘sh. Kartadagi ♡ belgisini bosing." : searchText ? "Qidiruv bo‘yicha hech narsa topilmadi." : "Bu bo‘limda hozircha mahsulot yo‘q. Boshqa turini tanlang.";
    emptyProducts.classList.toggle("hidden", visible.length > 0);
    productGrid.classList.toggle("hidden", visible.length === 0);
    const allFilter = filterRoot.querySelector('[data-filter="all"] span');
    allFilter.textContent = String(products.length).padStart(2, "0");
  }

  function cartEntries() {
    return [...cart.entries()].map(([id, quantity]) => ({ product: products.find(product => product.id === id), id, quantity })).filter(entry => entry.product);
  }

  function syncPromoUi() {
    const input = document.getElementById("promo-input");
    const apply = document.getElementById("promo-apply");
    const message = document.getElementById("promo-message");
    if (appliedPromo) {
      input.disabled = true;
      apply.classList.add("hidden");
      message.className = "promo-message ok";
      message.innerHTML = `<span>${escapeHtml(appliedPromo.code)} qo‘llandi</span><button type="button" id="promo-remove" aria-label="Promokodni olib tashlash">×</button>`;
    } else {
      input.disabled = false;
      apply.classList.remove("hidden");
      message.className = "promo-message";
      message.textContent = "";
    }
  }

  function renderCart() {
    const entries = cartEntries();
    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    if (!entries.length) appliedPromo = null;
    const discount = appliedPromo ? api.promoDiscount(appliedPromo, subtotal) : 0;
    const total = subtotal - discount;
    document.getElementById("cart-count").textContent = count;
    document.getElementById("drawer-count").textContent = `(${count})`;
    document.getElementById("cart-total").textContent = `${formatMoney(total)} so‘m`;
    const discountRow = document.getElementById("drawer-discount");
    discountRow.classList.toggle("hidden", !discount);
    if (discount) {
      document.getElementById("discount-code").textContent = appliedPromo.code;
      document.getElementById("discount-amount").textContent = `−${formatMoney(discount)} so‘m`;
    }
    const empty = entries.length === 0;
    document.getElementById("cart-empty").classList.toggle("hidden", !empty);
    document.getElementById("checkout-form").classList.toggle("hidden", empty);
    document.getElementById("drawer-total").classList.toggle("hidden", empty);
    syncPromoUi();
    document.getElementById("cart-items").innerHTML = entries.map(({ product, id, quantity }) => `<div class="cart-line"><div class="cart-thumb">${symbols[product.visual] || "✦"}</div><div><b>${escapeHtml(product.title)}</b><small>${formatMoney(product.price)} so‘m / dona</small><div class="quantity-control"><button data-quantity="${escapeHtml(id)}" data-delta="-1" aria-label="Kamaytirish">−</button><span>${quantity}</span><button data-quantity="${escapeHtml(id)}" data-delta="1" aria-label="Ko‘paytirish" ${quantity >= product.stock ? "disabled" : ""}>＋</button></div></div><div><span class="cart-line-price">${formatMoney(product.price * quantity)}</span><button class="remove-item" data-remove="${escapeHtml(id)}" aria-label="Olib tashlash">×</button></div></div>`).join("");
    if (!loadError) saveCart();
  }

  function setDrawer(open) {
    drawer.classList.toggle("open", open);
    overlay.classList.toggle("hidden", !open);
    window.requestAnimationFrame(() => overlay.classList.toggle("show", open));
    drawer.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  }

  filterRoot.addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    category = button.dataset.filter;
    filterRoot.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
    renderProducts();
  });

  function addToCart(id) {
    const product = products.find(item => item.id === id);
    if (!product || product.stock < 1) return false;
    const current = cart.get(product.id) || 0;
    if (current >= product.stock) { toast("Ombordagi mavjud soniga yetdingiz."); return false; }
    cart.set(product.id, current + 1); renderCart(); toast(`${product.title} savatga qo‘shildi`); return true;
  }
  const detailBackdrop = document.createElement("div");
  detailBackdrop.className = "detail-backdrop hidden";
  detailBackdrop.innerHTML = '<section class="detail-modal" role="dialog" aria-modal="true"></section>';
  document.body.appendChild(detailBackdrop);
  const detail = detailBackdrop.firstElementChild;
  function setDetail(open) { detailBackdrop.classList.toggle("hidden", !open); document.body.style.overflow = open ? "hidden" : ""; }
  function openDetail(id) {
    const product = products.find(item => item.id === id); if (!product) return;
    const rows = api.specRows(product);
    const related = products.filter(item => item.category === product.category && item.id !== product.id).slice(0, 4);
    const relatedGlyphs = { account: "✦", coin: "◉", currency: "＄", car: "⬢" };
    const relatedMarkup = related.length ? `<div class="related-block"><div class="related-title">O‘XSHASH MAHSULOTLAR</div><div class="related-grid">${related.map(item => `<button type="button" class="related-card" data-related="${escapeHtml(item.id)}"><span class="related-glyph">${relatedGlyphs[item.category] || "✦"}</span><b>${escapeHtml(item.title)}</b><small>${formatMoney(item.price)} so‘m</small></button>`).join("")}</div></div>` : "";
    detail.innerHTML = `<button class="close-button detail-close" data-close aria-label="Yopish">×</button>${visualMarkup(product)}<div class="detail-body"><div class="product-type">${categoryName(product.category)}</div><h2>${escapeHtml(product.title)}</h2><div class="detail-price">${oldPriceMarkup(product)}<b>${formatMoney(product.price)} <small>so‘m</small></b></div>${rows.length ? `<dl class="detail-specs">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : ""}<p class="detail-desc">${escapeHtml(product.description)}</p><div class="stock-note${product.stock > 0 && product.stock < 3 ? " low" : ""}">${product.stock > 0 ? (product.stock < 3 ? `⚠ Kam qoldi — ${product.stock} ta` : `Omborda ${product.stock} ta bor`) : "Hozircha tugagan"}</div><button class="primary-button full-button" data-detail-add="${escapeHtml(product.id)}" ${product.stock < 1 ? "disabled" : ""}>Savatga qo‘shish <span>＋</span></button><button type="button" class="share-button" data-share="${escapeHtml(product.id)}">↗ Havolani nusxalash</button>${relatedMarkup}</div>`;
    setDetail(true);
  }
  detailBackdrop.addEventListener("click", event => {
    const fav = event.target.closest("[data-fav]");
    if (fav) { toggleFavorite(fav.dataset.fav); return; }
    const related = event.target.closest("[data-related]");
    if (related) { openDetail(related.dataset.related); return; }
    const share = event.target.closest("[data-share]");
    if (share) {
      const link = location.href.split("#")[0] + "#mahsulot=" + encodeURIComponent(share.dataset.share);
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast("Havola nusxalandi — do‘stlaringizga yuboring!")).catch(() => toast("Havolani nusxalab bo‘lmadi."));
      return;
    }
    const add = event.target.closest("[data-detail-add]");
    if (add) { if (addToCart(add.dataset.detailAdd)) setDetail(false); return; }
    if (event.target === detailBackdrop || event.target.closest("[data-close]")) setDetail(false);
  });
  function openFromHash() {
    const match = location.hash.match(/mahsulot=([^&]+)/);
    if (!match) return;
    let wanted = "";
    try { wanted = decodeURIComponent(match[1]); } catch (error) { return; }
    const product = products.find(item => item.id === wanted);
    if (product) openDetail(product.id);
  }
  window.addEventListener("hashchange", openFromHash);
  document.addEventListener("keydown", event => { if (event.key === "Escape") setDetail(false); });
  productGrid.addEventListener("click", event => {
    const favButton = event.target.closest("[data-fav]");
    if (favButton) { toggleFavorite(favButton.dataset.fav); return; }
    const addButton = event.target.closest("[data-add]");
    if (addButton) { addToCart(addButton.dataset.add); return; }
    const card = event.target.closest(".product-card");
    if (card && card.dataset.id) openDetail(card.dataset.id);
  });

  document.getElementById("cart-items").addEventListener("click", event => {
    const quantityButton = event.target.closest("[data-quantity]");
    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) cart.delete(removeButton.dataset.remove);
    if (quantityButton) {
      const id = quantityButton.dataset.quantity;
      const product = products.find(item => item.id === id);
      const next = (cart.get(id) || 0) + Number(quantityButton.dataset.delta);
      if (next < 1) cart.delete(id);
      else if (product && next <= product.stock) cart.set(id, next);
    }
    renderCart();
  });

  document.getElementById("cart-open").addEventListener("click", () => setDrawer(true));
  document.getElementById("cart-close").addEventListener("click", () => setDrawer(false));
  overlay.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", event => { if (event.key === "Escape") setDrawer(false); });
  document.getElementById("sort-products").addEventListener("change", event => { sort = event.target.value; renderProducts(); });
  const searchBox = document.getElementById("header-search");
  document.getElementById("search-trigger").addEventListener("click", () => {
    searchBox.classList.toggle("hidden");
    if (searchBox.classList.contains("hidden")) { searchText = ""; searchBox.value = ""; renderProducts(); }
    else searchBox.focus();
  });
  searchBox.addEventListener("input", () => { searchText = searchBox.value.trim(); renderProducts(); document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" }); });

  document.getElementById("promo-apply").addEventListener("click", async () => {
    const input = document.getElementById("promo-input");
    const message = document.getElementById("promo-message");
    const code = input.value.trim();
    if (!code) { message.className = "promo-message error"; message.textContent = "Promokodni kiriting."; return; }
    const button = document.getElementById("promo-apply");
    button.disabled = true;
    try {
      const promo = await api.findPromo(code);
      if (!promo) throw new Error("Bunday promokod topilmadi.");
      if (!promo.active) throw new Error("Promokod faol emas.");
      if (promo.maxUses > 0 && promo.uses >= promo.maxUses) throw new Error("Promokod ishlatish limiti tugagan.");
      appliedPromo = promo;
      renderCart();
    } catch (error) {
      message.className = "promo-message error";
      message.textContent = error.message || "Promokod tekshirishda xatolik.";
    } finally { button.disabled = false; }
  });
  document.getElementById("promo-input").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); document.getElementById("promo-apply").click(); }
  });
  document.getElementById("promo-message").addEventListener("click", event => {
    if (!event.target.closest("#promo-remove")) return;
    appliedPromo = null;
    document.getElementById("promo-input").value = "";
    renderCart();
  });

  const orderBackdrop = document.createElement("div");
  orderBackdrop.className = "detail-backdrop hidden";
  orderBackdrop.innerHTML = '<section class="detail-modal order-modal" role="dialog" aria-modal="true"></section>';
  document.body.appendChild(orderBackdrop);
  const orderModal = orderBackdrop.firstElementChild;
  function setOrderModal(open) { orderBackdrop.classList.toggle("hidden", !open); document.body.style.overflow = open ? "hidden" : ""; }

  function showOrderSuccess(order) {
    orderModal.innerHTML = `<button class="close-button detail-close" data-close aria-label="Yopish">×</button><div class="order-modal-body"><div class="success-seal">✓</div><div class="product-type">BUYURTMA QABUL QILINDI</div><h2>Rahmat, ${escapeHtml(order.name)}!</h2><p class="order-modal-text">Sotuvchi tez orada <b>${escapeHtml(order.contact)}</b> orqali bog‘lanadi. Buyurtma raqamini saqlab qo‘ying — holatini shu raqam bilan tekshirishingiz mumkin.</p><div class="order-id-row"><b>${escapeHtml(order.id)}</b><button type="button" class="copy-id" data-copy="${escapeHtml(order.id)}">Nusxalash</button></div><div class="order-success-total"><span>Jami</span><b>${formatMoney(order.total)} so‘m</b></div><button class="primary-button full-button" data-track="${escapeHtml(order.id)}" data-contact="${escapeHtml(order.contact)}">Buyurtmani kuzatish <span>↗</span></button></div>`;
    setOrderModal(true);
  }

  function showTracking(id = "", contact = "") {
    orderModal.innerHTML = `<button class="close-button detail-close" data-close aria-label="Yopish">×</button><div class="order-modal-body"><div class="product-type">BUYURTMA HOLATI</div><h2>Buyurtmani kuzatish</h2><p class="order-modal-text">Buyurtma raqami va buyurtmada qoldirgan aloqangizni kiriting.</p><form id="track-form" class="track-form"><label>Buyurtma raqami<input name="id" value="${escapeHtml(id)}" placeholder="Masalan, ORD-8F3K2A" autocomplete="off" required /></label><label>Aloqa (telegram yoki telefon)<input name="contact" value="${escapeHtml(contact)}" placeholder="@username yoki +998…" autocomplete="off" required /></label><div class="form-error track-error" id="track-error" role="alert"></div><button class="primary-button full-button" type="submit">Tekshirish <span>↗</span></button></form><div id="track-result"></div></div>`;
    setOrderModal(true);
    if (!id) window.setTimeout(() => orderModal.querySelector('[name="id"]').focus(), 40);
  }

  orderModal.addEventListener("click", event => {
    const copy = event.target.closest("[data-copy]");
    if (copy) {
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(() => { copy.textContent = "Nusxalandi ✓"; }).catch(() => {});
      return;
    }
    const track = event.target.closest("[data-track]");
    if (track) { showTracking(track.dataset.track, track.dataset.contact || ""); return; }
    if (event.target.closest("[data-close]")) setOrderModal(false);
  });
  orderBackdrop.addEventListener("click", event => { if (event.target === orderBackdrop) setOrderModal(false); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") setOrderModal(false); });
  document.getElementById("track-open").addEventListener("click", () => showTracking());

  orderModal.addEventListener("submit", async event => {
    const formEl = event.target.closest("form#track-form");
    if (!formEl) return;
    event.preventDefault();
    const data = new FormData(formEl);
    const id = String(data.get("id") || "").trim();
    const contact = String(data.get("contact") || "").trim();
    const errorBox = document.getElementById("track-error");
    const result = document.getElementById("track-result");
    const button = formEl.querySelector("button[type=submit]");
    errorBox.textContent = ""; result.innerHTML = ""; button.disabled = true;
    try {
      const all = await api.getOrders();
      const norm = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const order = all.find(item => item.id.toLowerCase() === id.toLowerCase() && norm(item.contact) === norm(contact));
      if (!order) throw new Error("Buyurtma topilmadi yoki aloqa mos emas. Raqam va aloqani tekshiring.");
      const statusClass = order.status === "Bajarildi" ? "done" : order.status === "Bekor qilindi" ? "cancelled" : "new";
      const statusNote = order.status === "Yangi" ? "Sotuvchi tez orada siz bilan bog‘lanadi." : order.status === "Bajarildi" ? "Buyurtma yakunlangan. Xaridingiz uchun rahmat!" : "Buyurtma bekor qilingan. Savollar bo‘lsa, biz bilan bog‘laning.";
      result.innerHTML = `<div class="track-card"><div class="track-head"><b>${escapeHtml(order.id)}</b><span class="status-pill ${statusClass}">${escapeHtml(order.status)}</span></div><div class="track-date">${formatDate(order.createdAt)}</div><div class="track-items">${order.items.map(item => `<div><span>${escapeHtml(item.title)} ×${item.quantity}</span><b>${formatMoney(item.price * item.quantity)} so‘m</b></div>`).join("")}</div>${order.promo && order.promo.code ? `<div class="track-promo">Promokod: ${escapeHtml(order.promo.code)} (−${formatMoney(order.promo.discount)} so‘m)</div>` : ""}<div class="track-total"><span>Jami</span><b>${formatMoney(order.total)} so‘m</b></div><div class="track-note">${statusNote}</div></div>`;
    } catch (error) { errorBox.textContent = error.message || "Tekshirishda xatolik yuz berdi."; }
    finally { button.disabled = false; }
  });

  document.getElementById("checkout-form").addEventListener("submit", async event => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get("name") || "").trim();
    const contact = String(form.get("contact") || "").trim();
    const items = cartEntries().map(entry => ({ productId: entry.id, quantity: entry.quantity }));
    try {
      const order = await api.createOrder({ name, contact, note: String(form.get("note") || "").trim(), items, promoCode: appliedPromo ? appliedPromo.code : "" });
      if (window.GarajNotify) window.GarajNotify.orderCreated(order);
      appliedPromo = null;
      cart.clear(); formEl.reset(); renderCart(); setDrawer(false); showOrderSuccess(order);
    } catch (error) { toast(error.message || "Buyurtmani saqlashda xatolik yuz berdi."); }
  });

  async function refresh() {
    try {
      products = await api.getProducts(); loadError = false;
      for (const [id, quantity] of [...cart.entries()]) {
        const product = products.find(item => item.id === id);
        if (!product || product.stock < 1) cart.delete(id);
        else if (quantity > product.stock) cart.set(id, product.stock);
      }
      renderProducts(); renderCart();
      if (!hashHandled) { hashHandled = true; openFromHash(); }
    }
    catch (error) { products = []; loadError = true; renderProducts(); renderCart(); toast(error.message || "MockAPI endpointiga ulanib bo‘lmadi."); }
  }
  const contact = document.getElementById("help-contact");
  if (contact && CONTACT_URL) { contact.href = CONTACT_URL; contact.classList.remove("hidden"); }
  window.addEventListener("mockapi:change", () => refresh());
  loadCart();
  updateFavCount();
  refresh();
})();