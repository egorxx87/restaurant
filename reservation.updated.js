/* =========================================================
   RESERVATIONS PAGE
   - Manual sheet (Аркуш1) via Apps Script WEBAPP_URL
   - Quandoo_Import sheet via SAME WEBAPP_URL (readonly)
   - Cancelled Quandoo: excluded from totals, shown as badge
   ========================================================= */

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

// Desktop DOM
const elTbody  = document.getElementById("res-tbody");
const elCards  = document.getElementById("res-cards");
const elStatus = document.getElementById("res-status-text");
const elError  = document.getElementById("res-error-text");
const elToast  = document.getElementById("toast");

// Loader DOM
const loaderEl     = document.getElementById("global-loader");
const loaderTextEl = document.getElementById("global-loader-text");

const btnToday     = document.getElementById("res-today");
const btnYesterday = document.getElementById("res-yesterday");
const btnAll       = document.getElementById("res-all");
const inpDate      = document.getElementById("res-date");
const btnApplyDate = document.getElementById("res-apply-date");

// desktop new
const btnAdd      = document.getElementById("res-add");
const nConfirmed  = document.getElementById("new-confirmed");
const nDate       = document.getElementById("new-date");
const nTime       = document.getElementById("new-time");
const nGuests     = document.getElementById("new-guests");
const nPayment    = document.getElementById("new-payment");
const nPrice      = document.getElementById("new-price");
const nMenu       = document.getElementById("new-menu");
const nFrom       = document.getElementById("new-from");
const nEmail      = document.getElementById("new-email");
const nPhone      = document.getElementById("new-phone");
const nMenu2      = document.getElementById("new-menu2");

// optional mobile form
const mAdd        = document.getElementById("m-res-add");
const mnConfirmed = document.getElementById("m-new-confirmed");
const mnDate      = document.getElementById("m-new-date");
const mnTime      = document.getElementById("m-new-time");
const mnGuests    = document.getElementById("m-new-guests");
const mnPayment   = document.getElementById("m-new-payment");
const mnPrice     = document.getElementById("m-new-price");
const mnMenu      = document.getElementById("m-new-menu");
const mnFrom      = document.getElementById("m-new-from");
const mnEmail     = document.getElementById("m-new-email");
const mnPhone     = document.getElementById("m-new-phone");
const mnMenu2     = document.getElementById("m-new-menu2");

let currentMode = "todayWeek";
let isLoading = false;

init();

function init() {
  btnToday?.addEventListener("click", loadTodayWeek);
  btnYesterday?.addEventListener("click", loadYesterday);
  btnAll?.addEventListener("click", loadAll);
  btnApplyDate?.addEventListener("click", loadByDateInput);

  btnAdd?.addEventListener("click", () => addNew(collectNewDesktop(), clearNewDesktop));
  mAdd?.addEventListener("click", () => addNew(collectNewMobile(), clearNewMobile));

  [nDate,nTime,nGuests,nPayment,nPrice,nMenu,nFrom,nEmail,nPhone,nMenu2].forEach(inp => {
    inp?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addNew(collectNewDesktop(), clearNewDesktop); });
  });
  [mnDate,mnTime,mnGuests,mnPayment,mnPrice,mnMenu,mnFrom,mnEmail,mnPhone,mnMenu2].forEach(inp => {
    inp?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addNew(collectNewMobile(), clearNewMobile); });
  });

  if (inpDate) inpDate.valueAsDate = new Date();
  loadTodayWeek();
}

function setLoading(on, text = "Завантаження…") {
  if (!loaderEl) return;
  loaderTextEl.textContent = text;
  loaderEl.classList.toggle("global-loader--hidden", !on);

  const buttons = [btnToday, btnYesterday, btnAll, btnApplyDate, btnAdd, mAdd];
  buttons.forEach(btn => { if (btn) btn.disabled = on; });
}

async function loadTodayWeek() {
  currentMode = "todayWeek";
  await load("?action=todayWeek", "Сьогодні + 7 днів");
}
async function loadYesterday() {
  currentMode = "yesterday";
  await load("?action=getYesterday", "Вчора");
}
async function loadAll() {
  currentMode = "all";
  await load("?action=getAll", "Усі");
}
async function loadByDateInput() {
  if (!inpDate?.value) return toast("Обери дату");
  const ddmmyyyy = toDDMMYYYY(inpDate.value);
  currentMode = "date";
  await load(`?action=getByDate&date=${encodeURIComponent(ddmmyyyy)}`, ddmmyyyy);
}

async function load(query, label) {
  if (isLoading) return;
  isLoading = true;
  setError("");
  setLoading(true, `Завантажую: ${label}…`);

  try {
    elStatus.textContent = `Завантажую: ${label}…`;
    const res = await fetch(WEBAPP_URL + query);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Помилка завантаження");

    const data = Array.isArray(json.data) ? json.data : [];
    renderDesktop(data);
    renderMobile(data);

    const meta = json.meta || {};
    const manualCount   = meta.manualCount ?? null;
    const quandooCount  = meta.quandooCount ?? null;
    const cancelled     = meta.cancelledCount ?? 0;

    let suffix = `— ${data.length}`;
    if (manualCount != null && quandooCount != null) {
      suffix = `— ${data.length} (ручн. ${manualCount} / Quandoo ${quandooCount})`;
      if (cancelled) suffix += ` · скасовано: ${cancelled}`;
    }

    elStatus.textContent = `Готово: ${label} ${suffix}`;
  } catch (err) {
    console.error(err);
    setError(String(err.message || err));
    elStatus.textContent = "Помилка завантаження";
  } finally {
    isLoading = false;
    setLoading(false);
  }
}

/* ===== Desktop render ===== */

function renderDesktop(data) {
  if (!elTbody) return;
  elTbody.innerHTML = "";

  if (!data.length) {
    elTbody.innerHTML = `<tr><td colspan="6" style="padding:14px;color:#6b7280;">Немає записів</td></tr>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    const isReadonly  = !!item.readonly;
    const isQuandoo   = (String(item.source || "").toLowerCase() === "quandoo");
    const isCancelled = !!item.cancelled;

    const tr = document.createElement("tr");
    tr.className = "res-main";
    tr.dataset.row = item.row ?? "";

    if (item.date === today) tr.classList.add("res-today");
    if (isQuandoo) tr.classList.add("res-source-quandoo");
    if (isCancelled) tr.classList.add("res-cancelled");

    tr.appendChild(tdConfirmed(item, { readonly: isReadonly }));
    tr.appendChild(tdText(item.date));
    tr.appendChild(tdText(item.time));
    tr.appendChild(tdText(item.guests));
    tr.appendChild(tdWho(item));

    const tdAct = document.createElement("td");
    tdAct.className = "col-actions";
    if (!isReadonly) {
      const wrap = document.createElement("div");
      wrap.className = "res-actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "res-expand";
      btn.textContent = "Редагувати";
      btn.addEventListener("click", () => toggleDetail(item.row));
      wrap.appendChild(btn);
      tdAct.appendChild(wrap);
    } else {
      tdAct.innerHTML = `<span class="res-readonly">readonly</span>`;
    }

    tr.appendChild(tdAct);
    elTbody.appendChild(tr);

    if (!isReadonly) {
      const dtr = document.createElement("tr");
      dtr.className = "res-detail";
      dtr.dataset.rowDetail = item.row;
      dtr.style.display = "none";

      const td = document.createElement("td");
      td.colSpan = 6;
      td.appendChild(detailBlock(item));
      dtr.appendChild(td);
      elTbody.appendChild(dtr);
    }
  }
}

function toggleDetail(row) {
  const dtr = document.querySelector(`tr.res-detail[data-row-detail="${row}"]`);
  if (!dtr) return;
  dtr.style.display = (dtr.style.display === "none" || !dtr.style.display) ? "table-row" : "none";
}

function tdConfirmed(item, opts = {}) {
  const td = document.createElement("td");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "res-checkbox";
  cb.checked = !!item.confirmed;

  if (opts.readonly) {
    cb.disabled = true;
    cb.title = "Readonly (Quandoo)";
  } else {
    cb.addEventListener("change", () => updateRow(item.row, { confirmed: cb.checked }, cb));
  }

  td.appendChild(cb);

  if (item.cancelled) {
    const b = document.createElement("span");
    b.className = "res-badge res-badge--cancelled";
    b.textContent = "скасовано";
    td.appendChild(b);
  }

  return td;
}

function tdText(v) {
  const td = document.createElement("td");
  td.textContent = (v ?? "").toString();
  return td;
}

function tdWho(item) {
  const td = document.createElement("td");
  td.className = "col-who";

  const wrap = document.createElement("div");
  wrap.className = "res-who";

  const name = document.createElement("div");
  name.className = "res-who__name";
  name.textContent = (item.from ?? "—").toString();

  const src = String(item.source || "").toLowerCase();
  if (src) {
    const badge = document.createElement("span");
    badge.className = "res-badge" + (src === "quandoo" ? " res-badge--quandoo" : " res-badge--manual");
    badge.textContent = (src === "quandoo") ? "Quandoo" : "ручн.";
    name.appendChild(document.createTextNode(" "));
    name.appendChild(badge);
  }

  if (item.status) {
    const st = String(item.status).toLowerCase();
    const badge = document.createElement("span");
    badge.className = "res-badge res-badge--status";
    badge.textContent = st;
    name.appendChild(document.createTextNode(" "));
    name.appendChild(badge);
  }

  const contacts = document.createElement("div");
  contacts.className = "res-who__contacts";

  if (item.email) {
    const a = document.createElement("a");
    a.href = `mailto:${String(item.email).trim()}`;
    a.textContent = String(item.email).trim();
    contacts.appendChild(a);
  }
  if (item.phone) {
    const a = document.createElement("a");
    const phone = String(item.phone).trim();
    a.href = `tel:${phone.replace(/\s+/g,"")}`;
    a.textContent = phone;
    contacts.appendChild(a);
  }
  if (!contacts.childNodes.length) {
    const s = document.createElement("span");
    s.textContent = "—";
    contacts.appendChild(s);
  }

  wrap.appendChild(name);
  wrap.appendChild(contacts);
  td.appendChild(wrap);
  return td;
}

/* ===== Details (manual only) ===== */

function detailBlock(item) {
  const top = document.createElement("div");
  top.className = "res-detail__top";

  const title = document.createElement("div");
  title.className = "res-detail__title";
  title.textContent = `Редагування (row ${item.row})`;

  top.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "res-detail__grid";

  grid.appendChild(detailField(item, "Дата", "date"));
  grid.appendChild(detailField(item, "Час", "time"));
  grid.appendChild(detailField(item, "К-ть", "guests"));
  grid.appendChild(detailField(item, "Ціна", "price"));
  grid.appendChild(detailField(item, "Оплата", "payment"));
  grid.appendChild(detailField(item, "Меню", "menu"));
  grid.appendChild(detailField(item, "Примітка", "menu2", true));
  grid.appendChild(detailField(item, "Від кого", "from", true));
  grid.appendChild(detailField(item, "Email", "email", true));
  grid.appendChild(detailField(item, "Телефон", "phone", true));

  const box = document.createElement("div");
  box.className = "res-detail__box";
  box.appendChild(top);
  box.appendChild(grid);
  return box;
}

function detailField(item, label, key, span2=false) {
  const w = document.createElement("label");
  w.className = "res-df" + (span2 ? " span-2" : "");

  const s = document.createElement("span");
  s.textContent = label;

  const inp = document.createElement("input");
  inp.className = "res-field";
  inp.value = item[key] ?? "";
  inp.addEventListener("blur", () => updateRow(item.row, { [key]: inp.value }, inp));

  w.appendChild(s);
  w.appendChild(inp);
  return w;
}

/* ===== Mobile render ===== */

function renderMobile(data) {
  if (!elCards) return;
  elCards.innerHTML = "";

  if (!data.length) {
    elCards.innerHTML = `<div style="color:#6b7280;padding:10px;">Немає записів</div>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    const isReadonly  = !!item.readonly;
    const isQuandoo   = (String(item.source || "").toLowerCase() === "quandoo");
    const isCancelled = !!item.cancelled;

    const card = document.createElement("div");
    card.className = "res-card";
    if (item.date === today) card.classList.add("res-today");
    if (isQuandoo) card.classList.add("res-source-quandoo");
    if (isCancelled) card.classList.add("res-cancelled");

    const top = document.createElement("div");
    top.className = "res-card__top";

    const left = document.createElement("div");
    left.className = "res-card__left";

    if (isReadonly) {
      left.appendChild(mText(item, "date", "Дата"));
      left.appendChild(mText(item, "time", "Час"));
      left.appendChild(mText(item, "guests", "К-ть"));
      left.appendChild(mText(item, "from", "Від кого"));
      left.appendChild(mText(item, "email", "Email"));
      left.appendChild(mText(item, "phone", "Телефон"));
    } else {
      left.appendChild(mEdit(item, "date",   "Дата (15.12.2025)"));
      left.appendChild(mEdit(item, "time",   "Час (18:30)"));
      left.appendChild(mEdit(item, "guests", "К-ть (25)", "numeric"));
      left.appendChild(mEdit(item, "from",   "Від кого"));
      left.appendChild(mEdit(item, "email",  "Email"));
      left.appendChild(mEdit(item, "phone",  "Телефон"));
    }

    const right = document.createElement("div");
    right.className = "res-card__right";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "res-checkbox";
    cb.checked = !!item.confirmed;

    if (isReadonly) cb.disabled = true;
    else cb.addEventListener("change", () => updateRow(item.row, { confirmed: cb.checked }, cb));

    right.appendChild(cb);

    if (isCancelled) {
      const b = document.createElement("span");
      b.className = "res-badge res-badge--cancelled";
      b.textContent = "скасовано";
      right.appendChild(b);
    }

    top.appendChild(left);
    top.appendChild(right);

    const footer = document.createElement("div");
    footer.className = "res-card__footer";

    const src = String(item.source || "").toLowerCase();
    if (src) {
      const badge = document.createElement("span");
      badge.className = "res-badge" + (src === "quandoo" ? " res-badge--quandoo" : " res-badge--manual");
      badge.textContent = (src === "quandoo") ? "Quandoo" : "ручн.";
      footer.appendChild(badge);
    }
    if (item.status) {
      const b = document.createElement("span");
      b.className = "res-badge res-badge--status";
      b.textContent = String(item.status).toLowerCase();
      footer.appendChild(b);
    }

    card.appendChild(top);
    card.appendChild(footer);
    elCards.appendChild(card);
  }
}

function mText(item, key, label) {
  const w = document.createElement("div");
  w.className = "m-row";
  const a = document.createElement("div");
  a.className = "m-label";
  a.textContent = label;
  const b = document.createElement("div");
  b.className = "m-value";
  b.textContent = String(item[key] ?? "—");
  w.appendChild(a);
  w.appendChild(b);
  return w;
}

function mEdit(item, key, ph, inputMode="text") {
  const w = document.createElement("label");
  w.className = "m-edit";
  const inp = document.createElement("input");
  inp.className = "res-field";
  inp.value = item[key] ?? "";
  inp.placeholder = ph;
  inp.inputMode = inputMode;
  inp.addEventListener("blur", () => updateRow(item.row, { [key]: inp.value }, inp));
  w.appendChild(inp);
  return w;
}

/* ===== Writes (manual only) ===== */

async function updateRow(row, patch, el) {
  if (!row) return;
  try {
    el?.classList.add("res-saving");
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateRow", row, data: patch })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Помилка оновлення");
    toast("Збережено ✅");
  } catch (err) {
    console.error(err);
    toast("Помилка ❌");
  } finally {
    el?.classList.remove("res-saving");
  }
}

async function addNew(data, clearFn) {
  const hasSomething = data.date || data.time || data.email || data.phone || data.guests;
  if (!hasSomething) return toast("Заповни хоча б дату/контакт");

  setLoading(true, "Додавання…");

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "add", data })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Помилка додавання");

    toast("Додано ✅");
    clearFn?.();

    if (currentMode === "todayWeek") await loadTodayWeek();
    else if (currentMode === "yesterday") await loadYesterday();
    else if (currentMode === "date") await loadByDateInput();
    else await loadAll();
  } catch (err) {
    console.error(err);
    toast("Не додалося ❌");
  } finally {
    setLoading(false);
  }
}

function collectNewDesktop() {
  return {
    confirmed: !!nConfirmed?.checked,
    date: (nDate?.value || "").trim(),
    time: (nTime?.value || "").trim(),
    guests: (nGuests?.value || "").trim(),
    from: (nFrom?.value || "").trim(),
    email: (nEmail?.value || "").trim(),
    phone: (nPhone?.value || "").trim(),
    payment: (nPayment?.value || "").trim(),
    price: (nPrice?.value || "").trim(),
    menu: (nMenu?.value || "").trim(),
    menu2: (nMenu2?.value || "").trim()
  };
}
function clearNewDesktop() {
  if (nConfirmed) nConfirmed.checked = false;
  if (nDate) nDate.value = "";
  if (nTime) nTime.value = "";
  if (nGuests) nGuests.value = "";
  if (nFrom) nFrom.value = "";
  if (nEmail) nEmail.value = "";
  if (nPhone) nPhone.value = "";
  if (nPayment) nPayment.value = "";
  if (nPrice) nPrice.value = "";
  if (nMenu) nMenu.value = "";
  if (nMenu2) nMenu2.value = "";
}
function collectNewMobile() {
  return {
    confirmed: !!mnConfirmed?.checked,
    date: (mnDate?.value || "").trim(),
    time: (mnTime?.value || "").trim(),
    guests: (mnGuests?.value || "").trim(),
    from: (mnFrom?.value || "").trim(),
    email: (mnEmail?.value || "").trim(),
    phone: (mnPhone?.value || "").trim(),
    payment: (mnPayment?.value || "").trim(),
    price: (mnPrice?.value || "").trim(),
    menu: (mnMenu?.value || "").trim(),
    menu2: (mnMenu2?.value || "").trim()
  };
}
function clearNewMobile() {
  if (mnConfirmed) mnConfirmed.checked = false;
  if (mnDate) mnDate.value = "";
  if (mnTime) mnTime.value = "";
  if (mnGuests) mnGuests.value = "";
  if (mnFrom) mnFrom.value = "";
  if (mnEmail) mnEmail.value = "";
  if (mnPhone) mnPhone.value = "";
  if (mnPayment) mnPayment.value = "";
  if (mnPrice) mnPrice.value = "";
  if (mnMenu) mnMenu.value = "";
  if (mnMenu2) mnMenu2.value = "";
}

/* ===== Helpers ===== */

function setError(msg) {
  if (!msg) { elError.style.display = "none"; elError.textContent = ""; return; }
  elError.style.display = "inline";
  elError.textContent = msg;
}

function toast(msg) {
  elToast.textContent = msg;
  elToast.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (elToast.style.display = "none"), 2200);
}

function toDDMMYYYY(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}
