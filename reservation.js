const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

// Desktop DOM
const elTbody = document.getElementById("res-tbody");
const elCards = document.getElementById("res-cards");
const elStatus = document.getElementById("res-status-text");
const elError = document.getElementById("res-error-text");
const elToast = document.getElementById("toast");

// Loader DOM
const loaderEl = document.getElementById("global-loader");
const loaderTextEl = document.getElementById("global-loader-text");

const btnToday = document.getElementById("res-today");
const btnYesterday = document.getElementById("res-yesterday");
const btnAll = document.getElementById("res-all");
const inpDate = document.getElementById("res-date");
const btnApplyDate = document.getElementById("res-apply-date");

// desktop new
const btnAdd = document.getElementById("res-add");
const nConfirmed = document.getElementById("new-confirmed");
const nDate = document.getElementById("new-date");
const nTime = document.getElementById("new-time");
const nGuests = document.getElementById("new-guests");
const nPayment = document.getElementById("new-payment");
const nPrice = document.getElementById("new-price");
const nMenu = document.getElementById("new-menu");
const nFrom = document.getElementById("new-from");
const nEmail = document.getElementById("new-email");
const nPhone = document.getElementById("new-phone");
const nMenu2 = document.getElementById("new-menu2");

// mobile new
const mAdd = document.getElementById("m-res-add");
const mnConfirmed = document.getElementById("m-new-confirmed");
const mnDate = document.getElementById("m-new-date");
const mnTime = document.getElementById("m-new-time");
const mnGuests = document.getElementById("m-new-guests");
const mnPayment = document.getElementById("m-new-payment");
const mnPrice = document.getElementById("m-new-price");
const mnMenu = document.getElementById("m-new-menu");
const mnFrom = document.getElementById("m-new-from");
const mnEmail = document.getElementById("m-new-email");
const mnPhone = document.getElementById("m-new-phone");
const mnMenu2 = document.getElementById("m-new-menu2");

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

  // Enter to add
  [nDate,nTime,nGuests,nPayment,nPrice,nMenu,nFrom,nEmail,nPhone,nMenu2].forEach(inp => {
    inp?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addNew(collectNewDesktop(), clearNewDesktop); });
  });
  [mnDate,mnTime,mnGuests,mnPayment,mnPrice,mnMenu,mnFrom,mnEmail,mnPhone,mnMenu2].forEach(inp => {
    inp?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addNew(collectNewMobile(), clearNewMobile); });
  });

  if (inpDate) inpDate.valueAsDate = new Date();
  loadTodayWeek();
}

// Функция управления лоадером
function setLoading(on, text = "Завантаження…") {
  if (!loaderEl) return;
  loaderTextEl.textContent = text;
  loaderEl.classList.toggle("global-loader--hidden", !on);
  
  // Отключаем кнопки во время загрузки
  const buttons = [btnToday, btnYesterday, btnAll, btnApplyDate, btnAdd, mAdd];
  buttons.forEach(btn => {
    if (btn) btn.disabled = on;
  });
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

    elStatus.textContent = `Готово: ${label} — ${data.length}`;
  } catch (err) {
    console.error(err);
    setError(String(err.message || err));
    elStatus.textContent = "Помилка завантаження";
  } finally {
    isLoading = false;
    setLoading(false);
  }
}
function tdEditable(item, key, opts = {}) {
  const td = document.createElement("td");

  const inp = document.createElement("input");
  inp.className = "res-field";
  inp.value = item[key] ?? "";
  inp.placeholder = opts.placeholder || "";
  inp.inputMode = opts.inputMode || "text"; // "numeric" удобно для гостей
  if (opts.width) inp.style.width = opts.width;

  inp.addEventListener("blur", () => updateRow(item.row, { [key]: inp.value }, inp));
  td.appendChild(inp);
  return td;
}
/* ---------- DESKTOP (короткая строка + раскрывающиеся детали) ---------- */
/* ---------- DESKTOP: compact row + edit button ---------- */
function tdWhoCompact(item) {
  const td = document.createElement("td");

  const wrap = document.createElement("div");
  wrap.className = "res-who";

  const name = document.createElement("div");
  name.className = "res-who__name";
  name.textContent = item.from || "—";
  wrap.appendChild(name);

  const contacts = document.createElement("div");
  contacts.className = "res-who__contacts";

  if (item.email) {
    const a = document.createElement("a");
    a.href = `mailto:${String(item.email).trim()}`;
    a.textContent = String(item.email).trim();
    contacts.appendChild(a);
  }
  if (item.phone) {
    const p = String(item.phone).trim();
    const a = document.createElement("a");
    a.href = `tel:${p.replace(/\s+/g, "")}`;
    a.textContent = p;
    contacts.appendChild(a);
  }

  if (contacts.childNodes.length) wrap.appendChild(contacts);
  td.appendChild(wrap);
  return td;
}

function tdActionsEdit(item) {
  const td = document.createElement("td");
  td.className = "res-actions";

  const btn = document.createElement("button");
  btn.className = "res-expand";
  btn.type = "button";
  btn.textContent = "Редагувати";
  btn.addEventListener("click", () => toggleDetail(item.row, btn));

  td.appendChild(btn);
  return td;
}
function renderDesktop(data) {
  if (!elTbody) return;
  elTbody.innerHTML = "";

  if (!data.length) {
    elTbody.innerHTML = `<tr><td colspan="6" style="padding:14px;color:#6b7280;">Немає записів</td></tr>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    // MAIN ROW (compact)
    const tr = document.createElement("tr");
    tr.className = "res-main";
    tr.dataset.row = item.row;
    if (item.date === today) tr.classList.add("res-today");

    tr.appendChild(tdConfirmed(item));              // ✅ вернули 1 колонку
    tr.appendChild(tdText(item.date || ""));        // дата
    tr.appendChild(tdText(item.time || ""));        // время
    tr.appendChild(tdText(item.guests || ""));      // к-ть
    tr.appendChild(tdWhoCompact(item));             // от кого + контакты (компактно)
    tr.appendChild(tdActionsEdit(item));            // кнопка Редактировать

    elTbody.appendChild(tr);

    // DETAIL ROW (hidden)
    const dtr = document.createElement("tr");
    dtr.className = "res-detail";
    dtr.dataset.rowDetail = item.row;
    dtr.style.display = "none";

    const td = document.createElement("td");
    td.colSpan = 6;                                 // ✅ 6 колонок как в таблице
    td.appendChild(detailBlock(item));              // все поля редактируются внутри

    dtr.appendChild(td);
    elTbody.appendChild(dtr);
  }
}

function tdConfirmed(item) {
  const td = document.createElement("td");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "res-checkbox";
  cb.checked = !!item.confirmed;
  cb.addEventListener("change", () => updateRow(item.row, { confirmed: cb.checked }, cb));
  td.appendChild(cb);
  return td;
}

function tdText(v) {
  const td = document.createElement("td");
  td.textContent = (v ?? "").toString();
  return td;
}

function tdWhoEditable(item) {
  const td = document.createElement("td");

  const wrap = document.createElement("div");
  wrap.className = "res-who";

  const row1 = document.createElement("div");
  row1.style.display = "flex";
  row1.style.gap = "8px";
  row1.style.flexWrap = "wrap";

  const fromInp = document.createElement("input");
  fromInp.className = "res-field";
  fromInp.value = item.from ?? "";
  fromInp.placeholder = "Від кого";
  fromInp.style.minWidth = "180px";
  fromInp.addEventListener("blur", () => updateRow(item.row, { from: fromInp.value }, fromInp));

  const emailInp = document.createElement("input");
  emailInp.className = "res-field";
  emailInp.value = item.email ?? "";
  emailInp.placeholder = "Email";
  emailInp.style.minWidth = "180px";
  emailInp.addEventListener("blur", () => updateRow(item.row, { email: emailInp.value }, emailInp));

  const phoneInp = document.createElement("input");
  phoneInp.className = "res-field";
  phoneInp.value = item.phone ?? "";
  phoneInp.placeholder = "Телефон";
  phoneInp.style.minWidth = "160px";
  phoneInp.addEventListener("blur", () => updateRow(item.row, { phone: phoneInp.value }, phoneInp));

  row1.appendChild(fromInp);
  row1.appendChild(emailInp);
  row1.appendChild(phoneInp);

  wrap.appendChild(row1);
  td.appendChild(wrap);
  return td;
}

function tdActions(item) {
  const td = document.createElement("td");
  td.className = "res-actions";

  const btn = document.createElement("button");
  btn.className = "res-expand";
  btn.type = "button";
  btn.textContent = "Деталі";
  btn.addEventListener("click", () => toggleDetail(item.row, btn));

  td.appendChild(btn);
  return td;
}

function toggleDetail(row, btn) {
  const dtr = document.querySelector(`tr[data-row-detail="${row}"]`);
  if (!dtr) return;
  const isOpen = dtr.style.display !== "none";
  dtr.style.display = isOpen ? "none" : "table-row";
  btn.textContent = isOpen ? "Редагувати" : "Закрити";
}

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

grid.appendChild(detailField(item, "Від кого", "from", true));
grid.appendChild(detailField(item, "Email", "email", true));
grid.appendChild(detailField(item, "Телефон", "phone", true));
grid.appendChild(detailField(item, "Оплата", "payment", true));
grid.appendChild(detailField(item, "Меню", "menu"));
grid.appendChild(detailField(item, "Примітка", "menu2", true));

  const wrap = document.createElement("div");
  wrap.appendChild(top);
  wrap.appendChild(grid);
  return wrap;
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

/* ---------- MOBILE (карточки, всё читается) ---------- */
function renderMobile(data) {
  if (!elCards) return;
  elCards.innerHTML = "";

  if (!data.length) {
    elCards.innerHTML = `<div style="color:#6b7280;padding:10px;">Немає записів</div>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    const card = document.createElement("div");
    card.className = "res-card";
    if (item.date === today) card.classList.add("res-card--today");

    // ===== TOP (editable) =====
    const top = document.createElement("div");
    top.className = "res-card__top";

    const left = document.createElement("div");

    // editable fields (instead of text title/sub)
left.appendChild(mEdit(item, "date",   "Дата (15.12.2025)"));
left.appendChild(mEdit(item, "time",   "Час (18:30)"));
left.appendChild(mEdit(item, "guests", "К-ть (25)", "numeric"));
left.appendChild(mEdit(item, "from",   "Від кого"));

left.appendChild(mEdit(item, "email",  "Email"));
left.appendChild(mEdit(item, "phone",  "Телефон"));

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "res-checkbox";
    cb.checked = !!item.confirmed;
    cb.addEventListener("change", () => updateRow(item.row, { confirmed: cb.checked }, cb));

    top.appendChild(left);
    top.appendChild(cb);

    // ===== QUICK LINKS (optional) =====
    // показываем кнопки mail/tel, если заполнено
    const contacts = document.createElement("div");
    contacts.className = "res-card__contacts";

    const emailVal = String(item.email || "").trim();
    if (emailVal) {
      const a = document.createElement("a");
      a.href = `mailto:${emailVal}`;
      a.textContent = `✉ ${emailVal}`;
      contacts.appendChild(a);
    }

    const phoneVal = String(item.phone || "").trim();
    if (phoneVal) {
      const p = phoneVal.replace(/\s+/g, "");
      const a = document.createElement("a");
      a.href = `tel:${p}`;
      a.textContent = `📞 ${phoneVal}`;
      contacts.appendChild(a);
    }

    // ===== GRID (already editable) =====
    const grid = document.createElement("div");
    grid.className = "res-card__grid";
    grid.appendChild(mField(item, "Оплата", "payment"));
grid.appendChild(mField(item, "Ціна", "price"));
grid.appendChild(mField(item, "Меню", "menu"));
grid.appendChild(mField(item, "Примітка", "menu2"));

    card.appendChild(top);
    if (contacts.childNodes.length) card.appendChild(contacts);
    card.appendChild(grid);

    elCards.appendChild(card);
  }
}

/**
 * Mobile editable input with autosave on blur
 */
function mEdit(item, key, placeholder, inputMode = "text") {
  const inp = document.createElement("input");
  inp.className = "res-field";
  inp.value = item[key] ?? "";
  inp.placeholder = placeholder;
  inp.inputMode = inputMode;
  inp.style.marginTop = "6px";

  // autosave
  inp.addEventListener("blur", () => {
    const val = inp.value;
    updateRow(item.row, { [key]: val }, inp);

    // обновим item, чтобы mail/tel ссылки могли появиться после перерендера
    item[key] = val;
  });

  // Enter = blur (быстрее)
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") inp.blur();
  });

  return inp;
}

function mField(item, label, key) {
  const w = document.createElement("label");
  w.className = "res-df";

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

/* ---------- UPDATE / ADD ---------- */
async function updateRow(row, patch, focusEl) {
  const main = document.querySelector(`tr[data-row="${row}"]`);
  main?.classList.add("res-saving");
  setLoading(true, "Збереження…");

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateRow", row, data: patch })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Помилка збереження");
    toast("Збережено");
  } catch (err) {
    console.error(err);
    toast("Помилка збереження");
    focusEl?.focus?.();
  } finally {
    main?.classList.remove("res-saving");
    setLoading(false);
  }
}
async function addNew(data, clearFn) {
  const hasSomething = data.date || data.from || data.email || data.phone || data.guests;
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

    // reload current view
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
  nConfirmed.checked = false;
  nDate.value = ""; nTime.value = ""; nGuests.value = "";
  nFrom.value = ""; nEmail.value = ""; nPhone.value = "";
  nPayment.value = ""; nPrice.value = ""; nMenu.value = ""; nMenu2.value = "";
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
  mnConfirmed.checked = false;
  mnDate.value = ""; mnTime.value = ""; mnGuests.value = "";
  mnFrom.value = ""; mnEmail.value = ""; mnPhone.value = "";
  mnPayment.value = ""; mnPrice.value = ""; mnMenu.value = ""; mnMenu2.value = "";
}

/* ---------- helpers ---------- */
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