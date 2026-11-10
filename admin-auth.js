/* Admin kirish qulfi. Parol ochiq matnda saqlanmaydi (SHA-256), kirish sessiya davomida eslab qolinadi. */
(function () {
  const FLAG = "garaj-market.admin-auth.v1";
  const HASH = "7de53cf657da848963be4fda0b9010231f6df1bb0088967f50865a61cd152ba6";
  let authed = false;
  try { authed = sessionStorage.getItem(FLAG) === "1"; } catch (error) { /* qulflangan holatda qoladi */ }
  window.GarajAdminAuthed = authed;
  if (authed) { document.body.classList.remove("admin-locked"); return; }

  const form = document.getElementById("auth-form");
  const input = document.getElementById("auth-password");
  const errorBox = document.getElementById("auth-error");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    if (hex === HASH) {
      try { sessionStorage.setItem(FLAG, "1"); } catch (error) { /* ignore */ }
      location.reload();
    } else {
      errorBox.textContent = "Parol noto‘g‘ri. Qayta urinib ko‘ring.";
      input.select();
    }
  });
  input.focus();
})();