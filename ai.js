/* AI orqali CPM skrinshotlaridan mashina qo'shish (Google Gemini, 1-5 ta rasm). */
(function () {
  if (!window.GarajAdminAuthed) return;
  const api = window.GarajAPI;
  const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
  const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  const KEY_STORAGE = "garaj-market.gemini-key.v1";
  const MAX_IMAGES = 5;
  const backdrop = document.getElementById("ai-modal-backdrop");
  const keyInput = document.getElementById("ai-key");
  const fileInput = document.getElementById("ai-file");
  const preview = document.getElementById("ai-preview");
  const analyzeButton = document.getElementById("analyze-image");
  const errorBox = document.getElementById("ai-error");
  const resultBox = document.getElementById("ai-result");
  const resultsRoot = document.getElementById("ai-results");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  let images = [];
  let results = [];

  try { keyInput.value = localStorage.getItem(KEY_STORAGE) || ""; } catch (error) { /* storage band bo'lishi mumkin */ }

  function setModal(open) {
    backdrop.classList.toggle("hidden", !open);
    if (open) {
      images = []; results = [];
      fileInput.value = "";
      preview.classList.add("hidden"); preview.innerHTML = "";
      resultsRoot.innerHTML = "";
      resultBox.classList.add("hidden");
      errorBox.textContent = "";
      analyzeButton.disabled = true;
      try { localStorage.setItem(KEY_STORAGE, keyInput.value.trim()); } catch (error) { /* ignore */ }
    }
  }

  function setError(message) { errorBox.textContent = message; }

  function downscale(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Rasm formati tushunilmadi."));
        img.onload = () => {
          const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function extractJson(text) {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI javobida JSON topilmadi.");
    return JSON.parse(match[0]);
  }

  function clean(value, max) {
    return String(value ?? "").trim().slice(0, max);
  }

  function normalize(data) {
    const specs = {};
    const specMap = { carClass: 10, hp: 10, torque: 12, gears: 5, drive: 12, aspiration: 16, mileage: 16 };
    const rawSpecs = data.specs && typeof data.specs === "object" ? data.specs : {};
    Object.entries(specMap).forEach(([key, max]) => { const value = clean(rawSpecs[key], max); if (value) specs[key] = value; });
    if (specs.drive) specs.drive = specs.drive.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || specs.drive;
    if (specs.aspiration) specs.aspiration = /no turbo|atmosfer|aspir/i.test(specs.aspiration) ? "Atmosferik" : "Turbo";
    return {
      title: clean(data.title, 60),
      description: clean(data.description, 480),
      specs,
      tag: clean(data.tag, 16)
    };
  }

  const PROMPT = 'Bu rasm — Car Parking Multiplayer o‘yinidagi garaj skrinshoti. Vazifangiz:\n1. Markazdagi mashinani tanib oling: rusum, model, kuzov turi, taxminiy yil.\n2. O‘ng tomondagi paneldan texnik ma’lumotlarni o‘qing: HP, TORQUE (Nm), GEARS, CLASS (T2 kabi), DRIVING WHEEL (RWD/FWD/AWD), ASPIRATION (TURBO yoki NO TURBO), MILEAGE.\n3. Sotuv uchun qisqa o‘zbekcha tavsif yozing (2-3 jumla, 300 belgidan kam).\nFaqat quyidagi JSON formatda javob bering, boshqa hech narsa yozmang:\n{"title":"Honda Civic 5D 1998","description":"...","specs":{"carClass":"T2","hp":"183","torque":"160","gears":"5","drive":"RWD","aspiration":"NO TURBO","mileage":"0.0 KM"}}';

  async function callModel(model, key, base64) {
    const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      })
    });
    let message = `Gemini xatosi (${response.status})`;
    if (response.ok) {
      const payload = await response.json();
      const part = payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts && payload.candidates[0].content.parts[0];
      if (part && part.text) return { text: part.text };
      return { error: "AI bo‘sh javob qaytardi. Boshqa rasm bilan urinib ko‘ring." };
    }
    try {
      const details = await response.json();
      if (details.error && details.error.message) message = details.error.message.slice(0, 200);
    } catch (parseError) { /* keep default message */ }
    const busy = response.status === 503 || /high demand|overload|no capacity|try again later/i.test(message);
    if (busy) return { skip: "busy" };
    const retired = response.status === 404 || /no longer available|not found for this request|unsupported/i.test(message);
    if (retired) return { skip: "retired" };
    if (response.status === 400 || response.status === 403) message += " — API kalitni tekshiring.";
    return { error: message };
  }

  async function callBestModel(key, base64) {
    let sawBusy = false;
    for (const model of MODELS) {
      const attempt = await callModel(model, key, base64);
      if (attempt.text) return attempt;
      if (attempt.error) throw new Error(attempt.error);
      if (attempt.skip === "busy") sawBusy = true;
    }
    throw new Error(sawBusy
      ? "Gemini serveri hozir band — 1–2 daqiqadan so‘ng qayta urinib ko‘ring."
      : "Gemini modellari mavjud emas — sahifani yangilab qayta urinib ko‘ring.");
  }

  function syncFieldValues() {
    resultsRoot.querySelectorAll(".ai-card").forEach(card => {
      const index = Number(card.dataset.index);
      if (!results[index]) return;
      const price = card.querySelector(".ai-price"), stock = card.querySelector(".ai-stock");
      if (price) results[index].price = price.value;
      if (stock) results[index].stock = stock.value;
    });
  }

  function cardMarkup(result, index) {
    const head = `<div class="ai-card-head"><img src="${result.image}" alt="" /><b>${escapeHtml(result.data ? result.data.title : result.name)}</b>${result.saved ? '<span class="ai-card-status">Saqlandi ✓</span>' : ""}</div>`;
    if (result.error) return `<article class="ai-card failed" data-index="${index}">${head}<div class="ai-card-error">${escapeHtml(result.error)}</div></article>`;
    const specLabels = { carClass: "Sinf", hp: "Ot kuchi", torque: "Moment (Nm)", gears: "Uzatmalar", drive: "Yurish g'ildiragi", aspiration: "Motor", mileage: "Yurgan masofa" };
    const rows = Object.entries(result.data.specs).map(([key, value]) => `<div><dt>${specLabels[key] || escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`);
    const specs = rows.length ? `<dl class="detail-specs">${rows.join("")}</dl>` : "";
    const disabled = result.saved ? " disabled" : "";
    return `<article class="ai-card${result.saved ? " saved" : ""}" data-index="${index}">${head}${specs}<p class="ai-result-desc">${escapeHtml(result.data.description || "Tavsif yozilmadi.")}</p>
      <div class="ai-card-fields"><label>Narx (so‘m)<input type="number" class="ai-price" min="1000" step="1000" placeholder="150000" value="${escapeHtml(result.price || "")}"${disabled} /></label><label>Ombordagi soni<input type="number" class="ai-stock" min="0" step="1" value="${escapeHtml(result.stock || "1")}"${disabled} /></label></div>
      <div class="ai-card-error">${escapeHtml(result.saveError || "")}</div>
      <div class="ai-card-actions"><button type="button" class="cancel-button ai-edit"${disabled}>Formada tahrirlash</button><button type="button" class="primary-button ai-save"${disabled}>${result.saved ? "Saqlandi ✓" : "Saqlash ↗"}</button></div></article>`;
  }

  function renderResults() {
    syncFieldValues();
    resultsRoot.innerHTML = results.map(cardMarkup).join("");
    resultBox.classList.toggle("hidden", results.length === 0);
  }

  async function saveCard(index, card) {
    const result = results[index];
    if (!result || !result.data || result.saved) return;
    const price = Number(card.querySelector(".ai-price").value);
    const stock = Number(card.querySelector(".ai-stock").value);
    const errorNode = card.querySelector(".ai-card-error");
    if (!(price >= 1000)) { errorNode.textContent = "Narx kamida 1 000 so‘m bo‘lishi kerak."; return; }
    if (!(stock >= 0)) { errorNode.textContent = "Ombordagi sonni kiriting (0 yoki undan ko‘p)."; return; }
    errorNode.textContent = "";
    const button = card.querySelector(".ai-save");
    button.disabled = true; button.textContent = "Saqlanmoqda…";
    try {
      await api.createProduct({
        title: result.data.title, category: "car", price, oldPrice: 0, stock,
        tag: result.data.tag || "YANGI", description: result.data.description,
        image: result.image, specs: result.data.specs
      });
      result.saved = true; result.price = String(price); result.stock = String(stock);
      renderResults();
    } catch (error) {
      result.saveError = error.message || "Saqlashda xatolik yuz berdi.";
      renderResults();
    }
  }

  async function analyze() {
    const key = keyInput.value.trim();
    if (!key) return setError("Avval Gemini API kalitini kiriting.");
    if (!images.length) return setError("Avval skrinshot rasmlarni tanlang.");
    try { localStorage.setItem(KEY_STORAGE, key); } catch (error) { /* ignore */ }
    setError("");
    analyzeButton.disabled = true;
    results = [];
    resultBox.classList.remove("hidden");
    resultsRoot.innerHTML = "";
    try {
      for (let i = 0; i < images.length; i++) {
        analyzeButton.textContent = `Tahlil ${i + 1}/${images.length}…`;
        try {
          const response = await callBestModel(key, images[i].dataUrl.split(",")[1]);
          results.push({ data: normalize(extractJson(response.text)), image: images[i].dataUrl, name: images[i].name });
        } catch (error) {
          results.push({ error: error.message || "Tahlilda xatolik yuz berdi.", image: images[i].dataUrl, name: images[i].name });
        }
        renderResults();
      }
      if (results.every(result => result.error)) setError("Hech bir rasm tahlil qilinmadi — kalit va internetni tekshiring.");
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.innerHTML = 'Tahlil qilish <span>↗</span>';
    }
  }

  document.getElementById("open-ai-modal").addEventListener("click", () => setModal(true));
  document.getElementById("close-ai-modal").addEventListener("click", () => setModal(false));
  document.getElementById("cancel-ai-modal").addEventListener("click", () => setModal(false));
  backdrop.addEventListener("click", event => { if (event.target === backdrop) setModal(false); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") setModal(false); });
  keyInput.addEventListener("change", () => { try { localStorage.setItem(KEY_STORAGE, keyInput.value.trim()); } catch (error) { /* ignore */ } });

  fileInput.addEventListener("change", async () => {
    const files = [...(fileInput.files || [])];
    if (!files.length) return;
    setError("");
    if (files.length > MAX_IMAGES) setError(`Ko‘pi bilan ${MAX_IMAGES} ta rasm — birinchi ${MAX_IMAGES} tasi olindi.`);
    images = []; results = [];
    resultsRoot.innerHTML = "";
    resultBox.classList.add("hidden");
    analyzeButton.disabled = true;
    preview.classList.remove("hidden");
    preview.innerHTML = '<span class="ai-thumbs-loading">Rasmlar yuklanmoqda…</span>';
    for (const file of files.slice(0, MAX_IMAGES)) {
      try { images.push({ name: file.name, dataUrl: await downscale(file) }); }
      catch (error) { setError(`${file.name}: ${error.message}`); }
    }
    preview.innerHTML = images.length
      ? `<div class="ai-thumbs">${images.map(image => `<img src="${image.dataUrl}" alt="${escapeHtml(image.name)}" />`).join("")}</div><small class="field-hint">${images.length} ta rasm tanlandi</small>`
      : "";
    preview.classList.toggle("hidden", !images.length);
    analyzeButton.disabled = !images.length;
  });

  analyzeButton.addEventListener("click", analyze);

  resultsRoot.addEventListener("click", event => {
    const card = event.target.closest(".ai-card");
    if (!card) return;
    const index = Number(card.dataset.index);
    if (event.target.closest(".ai-save")) { saveCard(index, card); return; }
    if (event.target.closest(".ai-edit")) {
      const result = results[index];
      if (!result || !result.data || result.saved) return;
      window.dispatchEvent(new CustomEvent("ai:fill", { detail: { ...result.data, image: result.image } }));
      setModal(false);
    }
  });
})();