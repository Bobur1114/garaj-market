(function () {
  if (!window.GarajAdminAuthed) return;
  const api = window.GarajAPI;
  const formatMoney = value => new Intl.NumberFormat("uz-UZ").format(Number(value) || 0);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const labels = { account: "Akkaunt", coin: "Coin", currency: "Valyuta", car: "Mashina" };
  let products = [];
  let orders = [];
  let promos = [];
  let orderFilter = "all";
  let orderSearch = "";
  let toastTimer;

  function toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("show"), 2500);
  }

  function formatDate(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function renderProducts() {
    document.getElementById("stat-products").textContent = products.length;
    const inStock = products.filter(p => Number(p.stock) > 0).length;
    document.getElementById("stat-products-note").textContent = products.length ? `${inStock} tasi omborda bor` : "Hali mahsulot qo‘shilmagan";
    document.getElementById("stat-stock").textContent = products.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const stockValue = products.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.price || 0), 0);
    document.getElementById("stat-stock-note").innerHTML = `<b>${formatMoney(stockValue)} so‘m</b> umumiy qiymat`;
    document.getElementById("side-products-count").textContent = String(products.length).padStart(2, "0");
    document.getElementById("products-foot-count").textContent = `${products.length} ta mahsulot`;
    const tbody = document.getElementById("admin-products");
    tbody.innerHTML = products.map(product => `<tr>
      <td><div class="item-cell"><span class="mini-product">${product.image ? `<img src="${escapeHtml(product.image)}" alt="" onerror="this.remove()">` : product.category === "coin" ? "◉" : product.category === "currency" ? "＄" : product.category === "car" ? "⬢" : "✦"}</span><span class="item-text"><b title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</b><small>${escapeHtml(api.specList(product).slice(0, 3).join(" · ")) || "Tafsilot kiritilmagan"}</small></span></div></td>
      <td><span class="table-type">${labels[product.category] || "Mahsulot"}</span></td><td><span class="table-price">${formatMoney(product.price)}</span></td>
      <td><div class="stock-control"><button data-stock="${escapeHtml(product.id)}" data-delta="-1" aria-label="Omborni kamaytirish">−</button><span>${Number(product.stock) || 0}</span><button data-stock="${escapeHtml(product.id)}" data-delta="1" aria-label="Omborni oshirish">＋</button></div></td>
      <td><span class="stock-pill ${(Number(product.stock) || 0) < 3 ? "low" : ""}">${Number(product.stock) > 0 ? "Faol" : "Tugagan"}</span></td><td class="row-actions"><button class="edit-product" data-copy-product="${escapeHtml(product.id)}" aria-label="Nusxalash" title="Nusxalash">⧉</button><button class="edit-product" data-edit="${escapeHtml(product.id)}" aria-label="Tahrirlash">✎</button><button class="delete-product" data-delete="${escapeHtml(product.id)}" aria-label="Mahsulotni o‘chirish">×</button></td>
    </tr>`).join("");
    if (!products.length) tbody.innerHTML = '<tr><td colspan="6" class="empty-table">Hozircha mahsulot yo‘q. Yangi mahsulot qo‘shing.</td></tr>';
  }

  function renderOrders() {
    const newOrders = orders.filter(order => order.status === "Yangi").length;
    document.getElementById("stat-orders").textContent = orders.length;
    document.getElementById("stat-new-orders").textContent = `${newOrders} ta`;
    document.getElementById("side-order-count").textContent = newOrders;
    document.getElementById("new-count-chip").textContent = `${newOrders} yangi`;
    const done = orders.filter(order => order.status === "Bajarildi");
    document.getElementById("stat-revenue").innerHTML = `${formatMoney(done.reduce((sum, order) => sum + Number(order.total || 0), 0))} <em>so‘m</em>`;
    document.getElementById("stat-revenue-note").textContent = done.length ? `${done.length} ta bajarilgan buyurtmadan` : "Hali bajarilgan buyurtma yo‘q";
        const shown = orders.filter(o => (orderFilter === "all" || o.status === orderFilter) && (!orderSearch || `${o.id} ${o.name} ${o.contact}`.toLocaleLowerCase().includes(orderSearch)));
    document.getElementById("orders-empty").classList.toggle("hidden", shown.length > 0);
    document.getElementById("admin-orders").innerHTML = shown.map(order => {
      const detail = order.items.map(item => `${escapeHtml(item.title)} ×${item.quantity}`).join(", ");
      const promoLine = order.promo && order.promo.code ? `<div class="order-promo">Promokod: <b>${escapeHtml(order.promo.code)}</b> · −${formatMoney(order.promo.discount)} so‘m</div>` : "";
      const statusClass = order.status === "Bajarildi" ? "done" : order.status === "Bekor qilindi" ? "cancelled" : "";
      const actions = order.status === "Yangi" ? `<span class="order-actions"><button class="complete-order" data-complete="${escapeHtml(order.id)}">Bajarildi ✓</button><button class="cancel-order" data-cancel="${escapeHtml(order.id)}">Bekor ✕</button></span>` : order.status === "Bajarildi" ? "<small>Yakunlandi ✓</small>" : "<small>Bekor qilingan</small>";
      return `<article class="order-row"><div class="order-top"><b>${escapeHtml(order.id)}</b><span class="status-pill ${statusClass}">${escapeHtml(order.status)}</span></div><div class="order-customer">${escapeHtml(order.name)} <span style="font-weight:500;color:#8b8c7c">· ${escapeHtml(order.contact)}</span></div><div class="order-detail"><span>${detail}</span><strong>${formatMoney(order.total)} so‘m</strong></div>${promoLine}<div class="order-bottom"><small>${formatDate(order.createdAt)}</small>${actions}</div></article>`;
    }).join("");
  }

  function renderOverview() {
    const cats = [["account", "Akkaunt"], ["coin", "Coin"], ["currency", "O‘yin valyutasi"], ["car", "Mashina"]];
    const max = Math.max(1, ...cats.map(([k]) => products.filter(p => p.category === k).reduce((s, p) => s + Number(p.stock || 0), 0)));
    document.getElementById("cat-bars").innerHTML = !products.length ? '<div class="low-empty" style="color:#858678">Hali mahsulot yo‘q.</div>' : cats.map(([k, name]) => {
      const list = products.filter(p => p.category === k), stock = list.reduce((s, p) => s + Number(p.stock || 0), 0);
      return `<div class="bar-row"><span>${name} <small>${list.length} ta mahsulot</small></span><div class="bar-track"><i style="width:${Math.round(stock / max * 100)}%"></i></div><b>${stock}</b></div>`;
    }).join("");
    const low = products.filter(p => Number(p.stock) < 3).sort((x, y) => x.stock - y.stock);
    document.getElementById("low-stock").innerHTML = low.length ? low.map(p => `<div class="low-row"><b>${escapeHtml(p.title)}</b><span class="stock-pill low">${Number(p.stock) > 0 ? p.stock + " ta qoldi" : "Tugagan"}</span></div>`).join("") : `<div class="low-empty" style="${products.length ? "" : "color:#858678"}">${products.length ? "✓ Hamma mahsulot yetarli." : "Hali mahsulot yo‘q."}</div>`;
  }
  function renderPromos() {
    document.getElementById("side-promo-count").textContent = promos.filter(promo => promo.active).length;
    document.getElementById("promos-empty").classList.toggle("hidden", promos.length > 0);
    document.getElementById("promo-list").innerHTML = promos.map(promo => `<div class="promo-item${promo.active ? "" : " off"}"><span class="promo-code">${escapeHtml(promo.code)}</span><span class="promo-value">${promo.type === "percent" ? promo.value + "%" : formatMoney(promo.value) + " so‘m"}</span><span class="promo-uses">${promo.uses}${promo.maxUses ? " / " + promo.maxUses : ""} marta ishlatilgan</span><button type="button" class="stock-pill${promo.active ? "" : " low"}" data-promo-toggle="${escapeHtml(promo.id)}">${promo.active ? "Faol" : "O‘chiq"}</button><button type="button" class="delete-product" data-promo-delete="${escapeHtml(promo.id)}" aria-label="Promokodni o‘chirish">×</button></div>`).join("");
  }
  function renderStats() {
    const done = orders.filter(order => order.status === "Bajarildi");
    const revenue = done.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const avg = done.length ? Math.round(revenue / done.length) : 0;
    const rate = orders.length ? Math.round(done.length / orders.length * 100) : 0;
    const cancelled = orders.filter(order => order.status === "Bekor qilindi").length;
    document.getElementById("stats-summary").innerHTML = [["Jami tushum", `${formatMoney(revenue)} so‘m`, `${done.length} ta bajarilgan`], ["O‘rtacha chek", `${formatMoney(avg)} so‘m`, "bajarilgan buyurtmalar"], ["Bajarilish", `${rate}%`, `${orders.length} ta buyurtmadan`], ["Bekor qilingan", `${cancelled} ta`, "ombor qaytarilgan"]].map(([label, value, note]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span></div><strong>${value}</strong><small>${note}</small></article>`).join("");
    const days = [...Array(7)].map((_, i) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - i)); return day; });
    const sums = days.map(day => done.filter(order => { const date = new Date(order.createdAt); return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate(); }).reduce((sum, order) => sum + Number(order.total || 0), 0));
    const max = Math.max(1, ...sums);
    document.getElementById("sales-chart").innerHTML = days.map((day, i) => `<div class="sales-bar"><span class="sales-value">${sums[i] ? formatMoney(sums[i]) : ""}</span><div class="sales-track"><i style="height:${Math.round(sums[i] / max * 100)}%"></i></div><span class="sales-day">${new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short" }).format(day)}</span></div>`).join("");
    const sold = new Map();
    done.forEach(order => order.items.forEach(item => {
      const key = item.productId || item.title;
      const current = sold.get(key) || { title: item.title, qty: 0, sum: 0 };
      current.qty += Number(item.quantity) || 0;
      current.sum += (Number(item.price) || 0) * (Number(item.quantity) || 0);
      sold.set(key, current);
    }));
    const top = [...sold.values()].sort((a, b) => b.sum - a.sum).slice(0, 5);
    document.getElementById("top-products").innerHTML = top.length ? top.map((item, i) => `<div class="top-row"><span class="top-rank">${i + 1}</span><b>${escapeHtml(item.title)}</b><span class="top-qty">${item.qty} dona</span><strong>${formatMoney(item.sum)} so‘m</strong></div>`).join("") : '<div class="low-empty" style="color:#858678">Hali sotuv yo‘q.</div>';
  }
  function renderAll() { renderProducts(); renderOrders(); renderOverview(); renderPromos(); renderStats(); }
  const views = { overview: ["SAVDO NAZORATI", "Umumiy ko‘rinish"], products: ["KATALOG NAZORATI", "Mahsulotlar"], orders: ["SO‘NGGI FAOLLIK", "Buyurtmalar"], promos: ["AKSIYALAR", "Promokodlar"], stats: ["TAHLIL", "Statistika"] };
  function showView() {
    const name = views[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("hidden", v.dataset.view !== name));
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("selected", a.dataset.nav === name));
    document.getElementById("view-eyebrow").textContent = views[name][0];
    document.getElementById("view-title").textContent = views[name][1];
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", showView);
  document.getElementById("order-filters").addEventListener("click", event => {
    const b = event.target.closest("[data-of]"); if (!b) return;
    orderFilter = b.dataset.of;
    document.querySelectorAll("#order-filters .chip").forEach(c => c.classList.toggle("active", c === b));
    renderOrders();
  });
  document.getElementById("order-search").addEventListener("input", event => {
    orderSearch = event.target.value.trim().toLocaleLowerCase();
    renderOrders();
  });
  function setApiStatus(mode, message) {
    const live = document.getElementById("live-indicator");
    if (live) { live.className = `live-indicator ${mode}`; live.innerHTML = `<i></i> ${mode === "connected" ? "MockAPI ulangan" : mode === "error" ? "Ulanish yo‘q" : "Demo ombor (brauzer)"}`; }
    const status = document.getElementById("api-connection-status");
    const chip = document.getElementById("api-mode-chip");
    if (!status || !chip) return;
    status.className = `api-connection-status ${mode}`;
    status.innerHTML = `<i></i> ${escapeHtml(message)}`;
    chip.textContent = mode === "connected" ? "MockAPI.io" : mode === "error" ? "ulanish xatosi" : "local demo";
  }
  async function refresh() {
    const config = api.getConfig();
    try {
      const [nextProducts, nextOrders, nextPromos] = await Promise.all([api.getProducts(), api.getOrders(), api.getPromos()]);
      products = nextProducts; orders = nextOrders; promos = nextPromos; renderAll();
      setApiStatus(config.productsUrl ? "connected" : "local", config.productsUrl ? "Endpoint ulandi" : "Demo API");
      return true;
    } catch (error) {
      setApiStatus("error", error.message || "Endpointga ulanib bo‘lmadi");
      ["stat-products", "stat-orders", "stat-stock", "stat-revenue"].forEach(id => { document.getElementById(id).textContent = "—"; });
      toast(error.message || "MockAPI endpointiga ulanib bo‘lmadi.");
      return false;
    }
  }

  const backdrop = document.getElementById("product-modal-backdrop");
  const form = document.getElementById("product-form");
  const validImage = value => /^(https?:\/\/\S+|data:image\/(jpeg|png|webp);base64,)/i.test(value);
  function syncGroups() {
    const category = form.elements.category.value;
    form.querySelectorAll(".spec-group").forEach(group => group.classList.toggle("hidden", !group.dataset.group.split(" ").includes(category)));
  }
  function setPreview() {
    const value = form.elements.image.value.trim(), box = document.getElementById("img-preview");
    box.classList.toggle("hidden", !value);
    if (!value) { box.innerHTML = ""; return; }
    box.innerHTML = validImage(value) ? `<img src="${escapeHtml(value)}" alt="">` : "<span>Havola http:// yoki https:// bilan boshlanishi kerak</span>";
    const img = box.querySelector("img");
    if (img) img.onerror = () => { box.innerHTML = "<span>Rasm yuklanmadi — havolani tekshiring</span>"; };
  }
  function setCount() { document.getElementById("desc-count").textContent = `${form.elements.description.value.length} / 500`; }
  function setModal(open, product) {
    if (open) {
      form.reset(); form.elements.stock.value = "1"; form.elements.id.value = "";
      document.getElementById("form-error").textContent = "";
      if (product) {
        form.elements.id.value = product.id;
        ["title", "category", "tag", "price", "stock", "description", "image"].forEach(key => { form.elements[key].value = product[key] ?? ""; });
        form.elements.oldPrice.value = product.oldPrice > 0 ? product.oldPrice : "";
        Object.entries(product.specs || {}).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
      }
      document.getElementById("modal-title").textContent = product ? "Mahsulotni tahrirlash" : "Mahsulot qo‘shish";
      document.getElementById("modal-eyebrow").textContent = product ? "MAVJUD MAHSULOT" : "KATALOGNI YANGILASH";
      syncGroups(); setPreview(); setCount();
    }
    backdrop.classList.toggle("hidden", !open);
    if (open) window.setTimeout(() => form.elements.title.focus(), 40);
  }
  document.getElementById("open-product-modal").addEventListener("click", () => setModal(true));
  window.addEventListener("ai:fill", event => {
    const data = event.detail || {};
    setModal(true);
    form.elements.category.value = "car";
    syncGroups();
    form.elements.title.value = data.title || "";
    form.elements.description.value = data.description || "";
    form.elements.image.value = data.image || "";
    if (data.tag) form.elements.tag.value = data.tag;
    Object.entries(data.specs || {}).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    setPreview(); setCount();
    form.elements.title.focus();
  });
  document.getElementById("close-product-modal").addEventListener("click", () => setModal(false));
  document.getElementById("cancel-product-modal").addEventListener("click", () => setModal(false));
  backdrop.addEventListener("click", event => { if (event.target === backdrop) setModal(false); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") setModal(false); });
  form.elements.category.addEventListener("change", syncGroups);
  form.elements.image.addEventListener("input", setPreview);
  form.elements.description.addEventListener("input", setCount);

  const imageFile = document.getElementById("product-image-file");
  imageFile.addEventListener("change", () => {
    const file = imageFile.files && imageFile.files[0];
    imageFile.value = "";
    if (!file) return;
    const errorBox = document.getElementById("form-error");
    if (!file.type.startsWith("image/")) { errorBox.textContent = "Faqat rasm faylini tanlang."; return; }
    if (file.size > 10 * 1024 * 1024) { errorBox.textContent = "Rasm 10 MB dan kichik bo‘lsin."; return; }
    const reader = new FileReader();
    reader.onerror = () => { errorBox.textContent = "Rasmni o‘qib bo‘lmadi."; };
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => { errorBox.textContent = "Rasm formati tushunilmadi."; };
      img.onload = () => {
        const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        form.elements.image.value = canvas.toDataURL("image/jpeg", 0.85);
        errorBox.textContent = "";
        setPreview();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form), errorBox = document.getElementById("form-error");
    const val = name => String(data.get(name) || "").trim();
    const category = val("category"), price = Number(val("price")), oldPrice = Number(val("oldPrice")) || 0, stock = Number(val("stock"));
    const fail = message => { errorBox.textContent = message; };
    if (!val("title")) return fail("Mahsulot nomini kiriting.");
    if (!(price >= 1000)) return fail("Narx kamida 1 000 so‘m bo‘lishi kerak.");
    if (oldPrice && oldPrice <= price) return fail("Eski narx hozirgi narxdan katta bo‘lishi kerak.");
    if (!(stock >= 0) || val("stock") === "") return fail("Ombordagi sonni kiriting (0 yoki undan ko‘p).");
    if (!val("description")) return fail("Mahsulot tavsifini yozing.");
    if (val("image") && !validImage(val("image"))) return fail("Rasm havolasi http:// yoki https:// bilan boshlanishi kerak.");
    const specs = {};
    (category === "account" ? ["level", "cars", "money", "platform", "loginType"] : category === "car" ? ["carClass", "hp", "torque", "gears", "drive", "aspiration", "mileage"] : ["amount"]).concat(["deliveryTime"]).forEach(key => { if (val(key)) specs[key] = val(key); });
    const payload = { title: val("title"), category, price, oldPrice, stock, tag: val("tag") || "YANGI", description: val("description"), image: val("image"), specs };
    const id = val("id"), button = document.getElementById("save-product");
    errorBox.textContent = ""; button.disabled = true;
    try {
      if (id) await api.updateProduct(id, payload); else await api.createProduct(payload);
      setModal(false); await refresh(); toast(id ? "Mahsulot yangilandi." : "Mahsulot do‘konga qo‘shildi.");
    } catch (error) { fail(error.message || "Saqlashda xatolik yuz berdi."); }
    finally { button.disabled = false; }
  });

  document.getElementById("admin-products").addEventListener("click", async event => {
    const stockButton = event.target.closest("[data-stock]");
    const deleteButton = event.target.closest("[data-delete]");
    const editButton = event.target.closest("[data-edit]");
    const copyButton = event.target.closest("[data-copy-product]");
    if (copyButton) {
      const item = products.find(p => p.id === copyButton.dataset.copyProduct);
      if (!item) return;
      try {
        await api.createProduct({ title: (item.title + " (nusxa)").slice(0, 60), category: item.category, price: item.price, oldPrice: item.oldPrice, stock: item.stock, tag: item.tag, description: item.description, image: item.image, specs: item.specs });
        await refresh(); toast("Mahsulot nusxalandi — yangisini tahrirlashingiz mumkin.");
      } catch (error) { toast(error.message || "Nusxalashda xatolik."); }
      return;
    }
    if (editButton) { const item = products.find(p => p.id === editButton.dataset.edit); if (item) setModal(true, item); return; }
    if (stockButton) {
      try { await api.adjustStock(stockButton.dataset.stock, Number(stockButton.dataset.delta)); await refresh(); }
      catch (error) { toast(error.message || "Ombor sonini saqlashda xatolik."); }
    }
    if (deleteButton) {
      const product = products.find(item => item.id === deleteButton.dataset.delete);
      if (!product || !window.confirm(`“${product.title}” mahsulotini o‘chirasizmi?`)) return;
      try { await api.deleteProduct(product.id); await refresh(); toast("Mahsulot o‘chirildi."); }
      catch (error) { toast(error.message || "Mahsulotni o‘chirishda xatolik."); }
    }
  });
  document.getElementById("admin-orders").addEventListener("click", async event => {
    const cancelButton = event.target.closest("[data-cancel]");
    if (cancelButton) {
      const order = orders.find(item => item.id === cancelButton.dataset.cancel);
      if (!order || !window.confirm(`#${order.id} buyurtmani bekor qilasizmi? Mahsulotlar omborga qaytariladi.`)) return;
      try { await api.cancelOrder(order.id); await refresh(); toast("Buyurtma bekor qilindi, ombor qaytarildi."); }
      catch (error) { toast(error.message || "Buyurtmani bekor qilishda xatolik."); }
      return;
    }
    const button = event.target.closest("[data-complete]");
    if (!button) return;
    try { await api.updateOrder(button.dataset.complete, "Bajarildi"); await refresh(); toast("Buyurtma bajarildi deb belgilandi."); }
    catch (error) { toast(error.message || "Buyurtma holatini saqlashda xatolik."); }
  });

  function downloadCsv(filename, rows) {
    const csv = "﻿" + rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  document.getElementById("export-orders").addEventListener("click", () => {
    const rows = [["ID", "Sana", "Mijoz", "Aloqa", "Mahsulotlar", "Promokod", "Chegirma (so'm)", "Jami (so'm)", "Holat", "Izoh"]];
    orders.forEach(order => rows.push([order.id, new Date(order.createdAt).toLocaleString("uz-UZ"), order.name, order.contact, order.items.map(item => `${item.title} x${item.quantity}`).join("; "), order.promo ? order.promo.code : "", order.promo ? order.promo.discount : 0, order.total, order.status, order.note]));
    downloadCsv(`buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast("Buyurtmalar CSV fayli yuklandi.");
  });
  document.getElementById("export-products").addEventListener("click", () => {
    const rows = [["ID", "Nomi", "Tur", "Narx (so'm)", "Eski narx", "Ombor", "Teg", "Tavsif"]];
    products.forEach(product => rows.push([product.id, product.title, labels[product.category] || product.category, product.price, product.oldPrice || "", product.stock, product.tag, product.description]));
    downloadCsv(`mahsulotlar-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast("Mahsulotlar CSV fayli yuklandi.");
  });
  document.getElementById("promo-form").addEventListener("submit", async event => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const data = new FormData(formEl);
    const button = formEl.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await api.createPromo({ code: data.get("code"), type: data.get("type"), value: data.get("value"), maxUses: data.get("maxUses") });
      formEl.reset(); await refresh(); toast("Promokod qo‘shildi.");
    } catch (error) { toast(error.message || "Promokod qo‘shishda xatolik."); }
    finally { button.disabled = false; }
  });
  document.getElementById("promo-list").addEventListener("click", async event => {
    const toggle = event.target.closest("[data-promo-toggle]");
    const remove = event.target.closest("[data-promo-delete]");
    if (toggle) {
      const promo = promos.find(item => item.id === toggle.dataset.promoToggle);
      if (!promo) return;
      try { await api.updatePromo(promo.id, { active: !promo.active }); await refresh(); toast(promo.active ? "Promokod o‘chirildi." : "Promokod faollashtirildi."); }
      catch (error) { toast(error.message || "Saqlashda xatolik."); }
    }
    if (remove) {
      const promo = promos.find(item => item.id === remove.dataset.promoDelete);
      if (!promo || !window.confirm(`“${promo.code}” promokodini o‘chirasizmi?`)) return;
      try { await api.deletePromo(promo.id); await refresh(); toast("Promokod o‘chirildi."); }
      catch (error) { toast(error.message || "O‘chirishda xatolik."); }
    }
  });
  document.getElementById("sync-button").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.classList.add("rotating"); const ok = await refresh();
    window.setTimeout(() => button.classList.remove("rotating"), 350);
    if (ok) toast("Ma’lumotlar yangilandi.");
  });
  window.addEventListener("mockapi:change", () => refresh());

  const now = new Date();
  document.getElementById("today-date").innerHTML = `${new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "long", year: "numeric" }).format(now).toLocaleUpperCase()} <span>⌄</span>`;
  showView();
  refresh();
})();