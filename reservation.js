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
function setLoading(on, text = "Загрузка…") {
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
  await load("?action=todayWeek", "Сегодня + 7 дней");
}
async function loadYesterday() {
  currentMode = "yesterday";
  await load("?action=getYesterday", "Вчера");
}
async function loadAll() {
  currentMode = "all";
  await load("?action=getAll", "Все");
}
async function loadByDateInput() {
  if (!inpDate?.value) return toast("Выбери дату");
  const ddmmyyyy = toDDMMYYYY(inpDate.value);
  currentMode = "date";
  await load(`?action=getByDate&date=${encodeURIComponent(ddmmyyyy)}`, ddmmyyyy);
}

async function load(query, label) {
  if (isLoading) return;
  isLoading = true;
  setError("");
  setLoading(true, `Загружаю: ${label}…`);

  try {
    elStatus.textContent = `Загружаю: ${label}…`;
    const res = await fetch(WEBAPP_URL + query);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Ошибка загрузки");

    const data = Array.isArray(json.data) ? json.data : [];
    renderDesktop(data);
    renderMobile(data);

    elStatus.textContent = `Готово: ${label} — ${data.length}`;
  } catch (err) {
    console.error(err);
    setError(String(err.message || err));
    elStatus.textContent = "Ошибка загрузки";
  } finally {
    isLoading = false;
    setLoading(false);
  }
}

/* ---------- DESKTOP (короткая строка + раскрывающиеся детали) ---------- */
function renderDesktop(data) {
  if (!elTbody) return;
  elTbody.innerHTML = "";

  if (!data.length) {
    elTbody.innerHTML = `<tr><td colspan="6" style="padding:14px;color:#6b7280;">Нет записей</td></tr>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    // MAIN ROW
    const tr = document.createElement("tr");
    tr.className = "res-main";
    tr.dataset.row = item.row;
    if (item.date === today) tr.classList.add("res-today");

    tr.appendChild(tdConfirmed(item));
    tr.appendChild(tdText(item.date));
    tr.appendChild(tdText(item.time));
    tr.appendChild(tdText(item.guests));

    tr.appendChild(tdWho(item));
    tr.appendChild(tdActions(item));

    elTbody.appendChild(tr);

    // DETAIL ROW (hidden)
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

function tdWho(item) {
  const td = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "res-who";

  const name = document.createElement("div");
  name.className = "res-who__name";
  name.textContent = item.from || "—";

  const contacts = document.createElement("div");
  contacts.className = "res-who__contacts";

  if (item.email) {
    const a = document.createElement("a");
    a.href = `mailto:${String(item.email).trim()}`;
    a.textContent = `✉ ${String(item.email).trim()}`;
    contacts.appendChild(a);
  }
  if (item.phone) {
    const p = String(item.phone).trim();
    const a = document.createElement("a");
    a.href = `tel:${p.replace(/\s+/g,"")}`;
    a.textContent = `📞 ${p}`;
    contacts.appendChild(a);
  }

  wrap.appendChild(name);
  if (contacts.childNodes.length) wrap.appendChild(contacts);
  td.appendChild(wrap);
  return td;
}

function tdActions(item) {
  const td = document.createElement("td");
  td.className = "res-actions";

  const btn = document.createElement("button");
  btn.className = "res-expand";
  btn.type = "button";
  btn.textContent = "Детали";
  btn.addEventListener("click", () => toggleDetail(item.row, btn));

  td.appendChild(btn);
  return td;
}

function toggleDetail(row, btn) {
  const dtr = document.querySelector(`tr[data-row-detail="${row}"]`);
  if (!dtr) return;
  const isOpen = dtr.style.display !== "none";
  dtr.style.display = isOpen ? "none" : "table-row";
  btn.textContent = isOpen ? "Детали" : "Скрыть";
}

function detailBlock(item) {
  const top = document.createElement("div");
  top.className = "res-detail__top";

  const title = document.createElement("div");
  title.className = "res-detail__title";
  title.textContent = `Редактирование (row ${item.row})`;

  top.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "res-detail__grid";

  grid.appendChild(detailField(item, "Дата", "date"));
  grid.appendChild(detailField(item, "Время", "time"));
  grid.appendChild(detailField(item, "К-ть", "guests"));
  grid.appendChild(detailField(item, "Цена", "price"));

  grid.appendChild(detailField(item, "От кого", "from", true));
  grid.appendChild(detailField(item, "Email", "email", true));
  grid.appendChild(detailField(item, "Телефон", "phone", true));
  grid.appendChild(detailField(item, "Оплата", "payment", true));
  grid.appendChild(detailField(item, "Меню", "menu"));
  grid.appendChild(detailField(item, "Примечание", "menu2", true));

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
    elCards.innerHTML = `<div style="color:#6b7280;padding:10px;">Нет записей</div>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    const card = document.createElement("div");
    card.className = "res-card";
    if (item.date === today) card.classList.add("res-card--today");

    const top = document.createElement("div");
    top.className = "res-card__top";

    const left = document.createElement("div");
    const t = document.createElement("div");
    t.className = "res-card__title";
    t.textContent = `${item.date || "—"} ${item.time || ""} • ${item.guests || ""} чел.`;

    const sub = document.createElement("div");
    sub.className = "res-card__sub";
    sub.textContent = item.from || "—";

    left.appendChild(t);
    left.appendChild(sub);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "res-checkbox";
    cb.checked = !!item.confirmed;
    cb.addEventListener("change", () => updateRow(item.row, { confirmed: cb.checked }, cb));

    top.appendChild(left);
    top.appendChild(cb);

    const contacts = document.createElement("div");
    contacts.className = "res-card__contacts";
    if (item.email) {
      const a = document.createElement("a");
      a.href = `mailto:${String(item.email).trim()}`;
      a.textContent = `✉ ${String(item.email).trim()}`;
      contacts.appendChild(a);
    }
    if (item.phone) {
      const p = String(item.phone).trim();
      const a = document.createElement("a");
      a.href = `tel:${p.replace(/\s+/g,"")}`;
      a.textContent = `📞 ${p}`;
      contacts.appendChild(a);
    }

    const grid = document.createElement("div");
    grid.className = "res-card__grid";
    grid.appendChild(mField(item, "Оплата", "payment"));
    grid.appendChild(mField(item, "Цена", "price"));
    grid.appendChild(mField(item, "Меню", "menu"));
    grid.appendChild(mField(item, "Примечание", "menu2"));

    card.appendChild(top);
    if (contacts.childNodes.length) card.appendChild(contacts);
    card.appendChild(grid);

    elCards.appendChild(card);
  }
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
  setLoading(true, "Сохранение…");

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateRow", row, data: patch })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Ошибка сохранения");
    toast("Сохранено");
  } catch (err) {
    console.error(err);
    toast("Ошибка сохранения");
    focusEl?.focus?.();
  } finally {
    main?.classList.remove("res-saving");
    setLoading(false);
  }
}

async function addNew(data, clearFn) {
  const hasSomething = data.date || data.from || data.email || data.phone || data.guests;
  if (!hasSomething) return toast("Заполни хотя бы дату/контакт");

  setLoading(true, "Добавление…");
  
  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "add", data })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Ошибка добавления");

    toast("Добавлено ✅");
    clearFn?.();

    // reload current view
    if (currentMode === "todayWeek") await loadTodayWeek();
    else if (currentMode === "yesterday") await loadYesterday();
    else if (currentMode === "date") await loadByDateInput();
    else await loadAll();
  } catch (err) {
    console.error(err);
    toast("Не добавилось ❌");
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