/* Shared REST-style mock API: browser storage by default, MockAPI.io when configured. */
(function () {
  const STORAGE_KEY = "garaj-market.mock-api.v1";
  const CONFIG_KEY = "garaj-market.mock-api.config.v1";
  const SEED_KEY = "garaj-market.mock-api.seeded-url.v1";
  const DEFAULT_PRODUCTS_URL = "https://6adfa8388e42963c8d5e43a5.mockapi.io/akkaunt-coin-oyinvaltalari";
  const initialProducts = [];

  function readStore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.orders)) return { ...parsed, promos: Array.isArray(parsed.promos) ? parsed.promos : [] };
      }
    } catch (error) { /* Use initial demo data when storage is unavailable or malformed. */ }
    return { products: initialProducts, orders: [], promos: [] };
  }
  let state = readStore();
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function readConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved === null) return { productsUrl: DEFAULT_PRODUCTS_URL, ordersUrl: "" };
      return JSON.parse(saved);
    }
    catch (error) { return {}; }
  }
  function emitChange() {
    window.dispatchEvent(new CustomEvent("mockapi:change", { detail: { products: clone(state.products), orders: clone(state.orders), config: readConfig() } }));
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* Keep the in-memory demo usable. */ }
    emitChange();
  }
  function later(value) { return new Promise(resolve => window.setTimeout(() => resolve(clone(value)), 110)); }
  function makeId(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }
  function endpointUrl(base, id) { return `${String(base).replace(/\/$/, "")}/${encodeURIComponent(id)}`; }
  function sameEndpoint(left, right) { return String(left || "").replace(/\/$/, "") === String(right || "").replace(/\/$/, ""); }
  function asArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }
  function isProduct(item) { return !!(item && String(item.title || "").trim() && ["account", "coin", "currency", "car"].includes(item.category)); }
  function isOrder(item) { return !!(item && String(item.name || "").trim() && String(item.status || "").trim()); }
  function isPromo(item) { return !!(item && String(item.code || "").trim() && ["percent", "fixed"].includes(item.type)); }
  function normalizePromo(item) {
    return { ...item, id: String(item.id), code: String(item.code || "").toUpperCase(), type: item.type === "fixed" ? "fixed" : "percent", value: Number(item.value) || 0, active: item.active !== false && item.active !== "false", uses: Number(item.uses) || 0, maxUses: Number(item.maxUses) || 0, createdAt: item.createdAt || new Date().toISOString() };
  }
  function normalizeProduct(item) {
    let specs = item.specs;
    if (typeof specs === "string") { try { specs = JSON.parse(specs); } catch (error) { specs = {}; } }
    if (!specs || typeof specs !== "object" || Array.isArray(specs)) specs = {};
    const image = /^(https?:\/\/\S+|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]{0,900000})$/i.test(String(item.image || "")) ? String(item.image) : "";
    return { ...item, specs, image, oldPrice: Number(item.oldPrice) || 0, id: String(item.id), title: String(item.title || ""), category: item.category || "account", description: item.description || "", price: Number(item.price) || 0, stock: Number(item.stock) || 0, tag: item.tag || "YANGI", visual: item.visual || (item.category === "coin" ? "coins" : item.category === "currency" ? "cash" : item.category === "car" ? "car" : "premium"), featured: Number(item.featured) || 99 };
  }
  function normalizeOrder(item) {
    let items = item.items;
    if (typeof items === "string") { try { items = JSON.parse(items); } catch (error) { items = []; } }
    let promo = item.promo;
    if (typeof promo === "string") { try { promo = JSON.parse(promo); } catch (error) { promo = null; } }
    return { ...item, id: String(item.id), name: item.name || "Mijoz", contact: item.contact || "", note: item.note || "", items: Array.isArray(items) ? items : [], promo: promo && typeof promo === "object" ? promo : null, total: Number(item.total) || 0, status: item.status || "Yangi", createdAt: item.createdAt || item.created_at || new Date().toISOString() };
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { "Accept": "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
    if (!response.ok) {
      let details = "";
      try { details = await response.text(); } catch (error) { /* Ignore response body parsing errors. */ }
      throw new Error(`MockAPI ${response.status}${details ? `: ${details.slice(0, 100)}` : ""}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async function remoteList(url) { return asArray(await request(url)); }
  function packSpecs(record) { return record && record.specs && typeof record.specs === "object" ? { ...record, specs: JSON.stringify(record.specs) } : record; }
  async function postRecord(url, record) { return request(url, { method: "POST", body: JSON.stringify(packSpecs(record)) }); }
  async function putRecord(url, record) { return request(endpointUrl(url, record.id), { method: "PUT", body: JSON.stringify(packSpecs(record)) }); }
  async function seedEmptyProductResource(url, rows) {
    if (rows.length || localStorage.getItem(SEED_KEY) === url) return rows;
    localStorage.setItem(SEED_KEY, url);
    try {
      for (const product of initialProducts) {
        const { id, ...record } = product;
        await postRecord(url, { ...record, name: "", contact: "", note: "", items: [], total: 0, status: "", createdAt: new Date().toISOString() });
      }
      emitChange();
      return await remoteList(url);
    } catch (error) {
      if (localStorage.getItem(SEED_KEY) === url) localStorage.removeItem(SEED_KEY);
      throw error;
    }
  }

  const api = {
    getConfig() { return clone(readConfig()); },
    async configure(input) {
      const productsUrl = String(input.productsUrl || "").trim().replace(/\/$/, "");
      const ordersUrl = String(input.ordersUrl || "").trim().replace(/\/$/, "");
      if (ordersUrl && !productsUrl) throw new Error("Avval mahsulotlar endpointini kiriting.");
      if (productsUrl && !/^https?:\/\//i.test(productsUrl)) throw new Error("Mahsulotlar URL’i http:// yoki https:// bilan boshlanishi kerak.");
      if (ordersUrl && !/^https?:\/\//i.test(ordersUrl)) throw new Error("Buyurtmalar URL’i http:// yoki https:// bilan boshlanishi kerak.");
      const config = { productsUrl, ordersUrl };
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (error) { throw new Error("API sozlamasini brauzerda saqlab bo‘lmadi."); }
      emitChange();
      if (productsUrl) {
        await api.getProducts();
        await api.getOrders();
      }
      return config;
    },
    async useLocalDemo() {
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ productsUrl: "", ordersUrl: "" })); } catch (error) { /* Ignore storage failures. */ }
      state = readStore(); emitChange(); return later({ ok: true });
    },
    async getProducts() {
      const config = readConfig();
      if (config.productsUrl) {
        let rows = await remoteList(config.productsUrl);
        const products = rows.filter(isProduct).map(normalizeProduct);
        return products.sort((a, b) => a.featured - b.featured);
      }
      return later(state.products.slice().sort((a, b) => (a.featured || 99) - (b.featured || 99)));
    },
    async getOrders() {
      const config = readConfig();
      if (config.productsUrl) {
        const url = config.ordersUrl || config.productsUrl;
        const rows = await remoteList(url);
        const orders = rows.filter(isOrder).map(normalizeOrder);
        return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return later(state.orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    },
    async createProduct(input) {
      const config = readConfig();
      if (config.productsUrl) {
        const product = { ...input, price: Number(input.price), stock: Number(input.stock), featured: Number(input.featured) || Date.now() };
        const record = !config.ordersUrl || sameEndpoint(config.productsUrl, config.ordersUrl)
          ? { ...product, name: "", contact: "", note: "", items: [], total: 0, status: "", createdAt: new Date().toISOString() }
          : product;
        const created = await postRecord(config.productsUrl, record);
        emitChange(); return normalizeProduct(created);
      }
      const product = { ...input, id: makeId("gm"), visual: input.category === "coin" ? "coins" : input.category === "currency" ? "cash" : input.category === "car" ? "car" : "premium", featured: Date.now() };
      state.products.unshift(product); persist(); return later(product);
    },
    async updateProduct(id, input) {
      const config = readConfig();
      if (config.productsUrl) {
        const current = (await api.getProducts()).find(item => item.id === String(id));
        if (!current) throw new Error("Mahsulot topilmadi.");
        const saved = await putRecord(config.productsUrl, { ...current, ...input, id: current.id });
        emitChange(); return normalizeProduct(saved || { ...current, ...input });
      }
      const product = state.products.find(item => item.id === id);
      if (!product) throw new Error("Mahsulot topilmadi.");
      Object.assign(product, input); persist(); return later(product);
    },
    specRows(product) {
      const s = product.specs || {}, rows = [];
      [["level", "Daraja"], ["cars", "Mashinalar soni"], ["money", "Pul / balans"], ["amount", "Miqdor"], ["carClass", "Sinf"], ["hp", "Ot kuchi"], ["torque", "Moment (Nm)"], ["gears", "Uzatmalar"], ["drive", "Yurish g'ildiragi"], ["aspiration", "Motor"], ["mileage", "Yurgan masofa"], ["platform", "Platforma"], ["loginType", "Kirish usuli"], ["deliveryTime", "Yetkazish vaqti"]].forEach(([k, label]) => { if (s[k]) rows.push([label, String(s[k])]); });
      return rows;
    },
    specList(product) {
      const s = product.specs || {}, out = [];
      if (s.level) out.push("Daraja " + s.level); if (s.cars) out.push(s.cars + " ta mashina"); if (s.money) out.push("Pul: " + s.money);
      if (s.amount) out.push("Miqdor: " + s.amount); if (s.carClass) out.push(s.carClass + " sinf"); if (s.hp) out.push(s.hp + " HP"); if (s.torque) out.push(s.torque + " Nm");
      if (s.gears) out.push(s.gears + " uzatma"); if (s.drive) out.push(String(s.drive).toUpperCase()); if (s.aspiration) out.push(/no turbo|atmosfer|aspir/i.test(String(s.aspiration)) ? "Atmosferik" : "Turbo"); if (s.mileage) out.push("Yurgani: " + s.mileage); if (s.platform) out.push(s.platform); if (s.deliveryTime) out.push("⏱ " + s.deliveryTime);
      return out;
    },
    async deleteProduct(id) {
      const config = readConfig();
      if (config.productsUrl) { await request(endpointUrl(config.productsUrl, id), { method: "DELETE" }); emitChange(); return { ok: true }; }
      state.products = state.products.filter(product => product.id !== id); persist(); return later({ ok: true });
    },
    async adjustStock(id, amount) {
      const config = readConfig();
      if (config.productsUrl) {
        const product = (await api.getProducts()).find(item => item.id === String(id));
        if (!product) return null;
        const updated = { ...product, stock: Math.max(0, Number(product.stock || 0) + Number(amount || 0)) };
        const saved = await putRecord(config.productsUrl, updated); emitChange(); return normalizeProduct(saved || updated);
      }
      const product = state.products.find(item => item.id === id);
      if (product) product.stock = Math.max(0, Number(product.stock || 0) + amount);
      persist(); return later(product || null);
    },
    async getPromos() {
      const config = readConfig();
      if (config.productsUrl) return (await remoteList(config.productsUrl)).filter(isPromo).map(normalizePromo);
      return later(state.promos);
    },
    async findPromo(code) {
      const wanted = String(code || "").trim().toUpperCase();
      if (!wanted) return null;
      return (await api.getPromos()).find(promo => promo.code === wanted) || null;
    },
    promoDiscount(promo, subtotal) {
      if (!promo) return 0;
      const amount = promo.type === "fixed" ? Number(promo.value) : Math.round(Number(subtotal) * Number(promo.value) / 100);
      return Math.max(0, Math.min(amount, Number(subtotal) || 0));
    },
    async createPromo(input) {
      const code = String(input.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error("Kod 3–20 ta harf/raqamdan iborat bo‘lsin (masalan, CPM10).");
      if (await api.findPromo(code)) throw new Error("Bu kod allaqachon mavjud.");
      const type = input.type === "fixed" ? "fixed" : "percent";
      const value = Number(input.value);
      if (type === "percent" && !(value >= 1 && value <= 90)) throw new Error("Foiz 1 dan 90 gacha bo‘lsin.");
      if (type === "fixed" && !(value >= 1000)) throw new Error("Chegirma kamida 1 000 so‘m bo‘lsin.");
      const promo = { code, type, value, active: true, uses: 0, maxUses: Math.max(0, Number(input.maxUses) || 0), createdAt: new Date().toISOString() };
      const config = readConfig();
      if (config.productsUrl) {
        const record = !config.ordersUrl || sameEndpoint(config.productsUrl, config.ordersUrl)
          ? { ...promo, name: "", contact: "", note: "", items: [], total: 0, status: "" }
          : promo;
        const created = await postRecord(config.productsUrl, record);
        emitChange(); return normalizePromo(created);
      }
      promo.id = makeId("PRM"); state.promos.unshift(promo); persist(); return later(promo);
    },
    async updatePromo(id, changes) {
      const config = readConfig();
      if (config.productsUrl) {
        const raw = (await remoteList(config.productsUrl)).find(row => String(row.id) === String(id) && isPromo(row));
        if (!raw) throw new Error("Promokod topilmadi.");
        const saved = await putRecord(config.productsUrl, { ...raw, ...changes });
        emitChange(); return normalizePromo(saved || { ...raw, ...changes });
      }
      const promo = state.promos.find(item => item.id === id);
      if (!promo) throw new Error("Promokod topilmadi.");
      Object.assign(promo, changes); persist(); return later(promo);
    },
    async deletePromo(id) {
      const config = readConfig();
      if (config.productsUrl) { await request(endpointUrl(config.productsUrl, id), { method: "DELETE" }); emitChange(); return { ok: true }; }
      state.promos = state.promos.filter(item => item.id !== id); persist(); return later({ ok: true });
    },
    async createOrder(input) {
      const config = readConfig();
      let promo = null;
      if (input.promoCode) {
        promo = await api.findPromo(input.promoCode);
        if (!promo || !promo.active) throw new Error("Promokod faol emas.");
        if (promo.maxUses > 0 && promo.uses >= promo.maxUses) throw new Error("Promokod ishlatish limiti tugagan.");
      }
      if (config.productsUrl) {
        const products = await api.getProducts();
        const orderItems = input.items.map(item => {
          const product = products.find(candidate => candidate.id === String(item.productId));
          if (!product || product.stock < item.quantity) throw new Error("Mahsulot omborda yetarli emas.");
          return { product, quantity: Number(item.quantity), line: { productId: product.id, title: product.title, quantity: Number(item.quantity), price: product.price } };
        });
        const changed = [];
        try {
          for (const row of orderItems) {
            await putRecord(config.productsUrl, { ...row.product, stock: row.product.stock - row.quantity });
            changed.push(row.product);
          }
          const subtotal = orderItems.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
          const discount = api.promoDiscount(promo, subtotal);
          const order = { name: input.name, contact: input.contact, note: input.note || "", items: orderItems.map(row => row.line), total: subtotal - discount, promo: promo ? { code: promo.code, discount } : null, status: "Yangi", createdAt: new Date().toISOString() };
          const record = !config.ordersUrl || sameEndpoint(config.productsUrl, config.ordersUrl)
            ? { ...order, title: "", category: "", description: "", price: 0, stock: 0, tag: "", visual: "", featured: 0, oldPrice: 0, image: "", specs: "" }
            : order;
          const saved = await postRecord(config.ordersUrl || config.productsUrl, record);
          if (promo) { try { await api.updatePromo(promo.id, { uses: promo.uses + 1 }); } catch (promoError) { /* Buyurtma qabul qilingan, hisoblagich keyinroq yangilanadi. */ } }
          emitChange(); return normalizeOrder(saved);
        } catch (error) {
          for (const product of changed.reverse()) {
            try { await putRecord(config.productsUrl, product); } catch (rollbackError) { /* Preserve the original order error. */ }
          }
          throw error;
        }
      }
      const items = input.items.map(item => {
        const product = state.products.find(p => p.id === item.productId);
        if (!product || product.stock < item.quantity) throw new Error("Mahsulot omborda yetarli emas.");
        product.stock -= item.quantity;
        return { productId: product.id, title: product.title, quantity: item.quantity, price: product.price };
      });
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discount = api.promoDiscount(promo, subtotal);
      const order = { id: makeId("ORD"), name: input.name, contact: input.contact, note: input.note || "", items, total: subtotal - discount, promo: promo ? { code: promo.code, discount } : null, status: "Yangi", createdAt: new Date().toISOString() };
      if (promo) { const live = state.promos.find(item => item.id === promo.id); if (live) live.uses += 1; }
      state.orders.unshift(order); persist(); return later(order);
    },
    async updateOrder(id, status) {
      const config = readConfig();
      if (config.productsUrl) {
        const url = config.ordersUrl || config.productsUrl;
        const order = (await remoteList(url)).find(row => String(row.id) === String(id));
        if (!order) return null;
        const saved = await putRecord(url, { ...order, status }); emitChange(); return normalizeOrder(saved || { ...order, status });
      }
      const order = state.orders.find(item => item.id === id);
      if (order) order.status = status;
      persist(); return later(order || null);
    },
    async cancelOrder(id) {
      const config = readConfig();
      if (config.productsUrl) {
        const url = config.ordersUrl || config.productsUrl;
        const raw = (await remoteList(url)).find(row => String(row.id) === String(id) && isOrder(row));
        if (!raw) throw new Error("Buyurtma topilmadi.");
        const order = normalizeOrder(raw);
        if (order.status !== "Yangi") throw new Error("Faqat yangi buyurtmani bekor qilish mumkin.");
        const saved = await putRecord(url, { ...raw, status: "Bekor qilindi" });
        const products = await api.getProducts();
        for (const item of order.items) {
          const product = products.find(candidate => candidate.id === String(item.productId));
          if (!product) continue;
          try { await putRecord(config.productsUrl, { ...product, stock: Number(product.stock || 0) + Number(item.quantity || 0) }); } catch (stockError) { /* Holat bekor qilindi — ombor qo'lda to'g'irlanadi. */ }
        }
        emitChange(); return normalizeOrder(saved || { ...order, status: "Bekor qilindi" });
      }
      const order = state.orders.find(item => item.id === id);
      if (!order) throw new Error("Buyurtma topilmadi.");
      if (order.status !== "Yangi") throw new Error("Faqat yangi buyurtmani bekor qilish mumkin.");
      order.status = "Bekor qilindi";
      for (const item of order.items) {
        const product = state.products.find(candidate => candidate.id === item.productId);
        if (product) product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
      }
      persist(); return later(order);
    },
    async resetDemo() { state = { products: clone(initialProducts), orders: [], promos: [] }; persist(); return later({ ok: true }); }
  };

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) state = readStore();
    if (event.key === STORAGE_KEY || event.key === CONFIG_KEY) emitChange();
  });
  window.GarajAPI = api;
})();