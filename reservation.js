const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

const elTbody  = document.getElementById("res-tbody");
const elCards  = document.getElementById("res-cards");
const elStatus = document.getElementById("res-status-text");
const elError  = document.getElementById("res-error-text");
const elToast  = document.getElementById("toast");

const loaderEl     = document.getElementById("global-loader");
const loaderTextEl = document.getElementById("global-loader-text");

const btnToday     = document.getElementById("res-today");
const btnWeek      = document.getElementById("res-week");
const btnAll       = document.getElementById("res-all");
const inpDate      = document.getElementById("res-date");
const btnApplyDate = document.getElementById("res-apply-date");

// new manual
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

let isLoading = false;
let allDataCache = [];
let currentMode = "today";

init();

function init() {
  if (inpDate) inpDate.valueAsDate = new Date();

  btnToday?.addEventListener("click", () => { setActive(btnToday); currentMode="today"; renderFiltered(); });
  btnWeek?.addEventListener("click", () => { setActive(btnWeek);  currentMode="week";  renderFiltered(); });
  btnAll?.addEventListener("click", () => { setActive(btnAll);   currentMode="all";   renderFiltered(); });

  btnApplyDate?.addEventListener("click", () => {
    // По кнопке “Показати” логично показывать неделю от выбранной даты
    setActive(btnWeek);
    currentMode="week";
    renderFiltered();
  });

  btnAdd?.addEventListener("click", () => addNewManual());

  // Enter add
  [nDate,nTime,nGuests,nFrom,nEmail,nPhone].forEach(inp=>{
    inp?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") addNewManual(); });
  });

  setActive(btnToday);
  fetchAllOnce();
}

function setActive(btn) {
  [btnToday, btnWeek, btnAll].forEach(b => b?.classList.remove("is-active"));
  btn?.classList.add("is-active");
}

function setLoading(on, text = "Завантаження…") {
  if (!loaderEl) return;
  loaderTextEl.textContent = text;
  loaderEl.classList.toggle("global-loader--hidden", !on);
  [btnToday, btnWeek, btnAll, btnApplyDate, btnAdd].forEach(b => { if (b) b.disabled = on; });
}

async function fetchAllOnce() {
  if (isLoading) return;
  isLoading = true;
  setError("");
  setLoading(true, "Завантажую резервації…");

  try {
    const res = await fetch(WEBAPP_URL + "?action=getAll");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Помилка завантаження");
    allDataCache = Array.isArray(json.data) ? json.data : [];
    renderFiltered();
  } catch (err) {
    setError(String(err.message || err));
    elStatus.textContent = "Помилка завантаження";
  } finally {
    isLoading = false;
    setLoading(false);
  }
}

function renderFiltered() {
  const base = allDataCache;
  const today = todayDDMMYYYY();
  const picked = inpDate?.value ? toDDMMYYYY(inpDate.value) : today;

  let filtered = base;

  if (currentMode === "today") {
    filtered = base.filter(x => x?.date === today);
  } else if (currentMode === "week") {
    const range = weekRangeMonSun(picked);
    filtered = base.filter(x => {
      const d = parseDDMMYYYY(x?.date);
      if (!d) return false;
      return d >= range.start && d <= range.end;
    });
  }

  const activeOnly = filtered.filter(x => !isCancelled_(x));
  const cancelledCount = filtered.length - activeOnly.length;
  const manualCount = activeOnly.filter(x => !isQuandoo_(x)).length;
  const quandooCount = activeOnly.filter(x => isQuandoo_(x)).length;

  const label =
    currentMode === "today" ? `Сьогодні (${today})` :
    currentMode === "week" ? `Тиждень (${picked})` :
    `Усі`;

  elStatus.textContent =
    `Готово: ${label} — ${activeOnly.length} (ручн. ${manualCount} / Quandoo ${quandooCount})` +
    (cancelledCount ? ` · скасовано: ${cancelledCount}` : "");

  renderDesktop(filtered);
  renderMobile(filtered);
}

/* ================== DESKTOP RENDER ================== */

function renderDesktop(data) {
  if (!elTbody) return;
  elTbody.innerHTML = "";

  if (!data.length) {
    elTbody.innerHTML = `<tr><td colspan="6" style="padding:14px;color:#6b7280;">Немає записів</td></tr>`;
    return;
  }

  const today = todayDDMMYYYY();

  for (const item of data) {
    const readonly = !!item.readonly || isQuandoo_(item);
    const cancelled = isCancelled_(item);

    const tr = document.createElement("tr");
    tr.className = "res-main";
    tr.dataset.row = item.row ?? "";

    if (item.date === today) tr.classList.add("res-today");
    if (isQuandoo_(item)) tr.classList.add("res-source-quandoo");
    if (cancelled) tr.classList.add("res-cancelled");

    tr.appendChild(tdConfirmed(item, { readonly, cancelled }));
    tr.appendChild(tdText(item.date));
    tr.appendChild(tdText(item.time));
    tr.appendChild(tdText(item.guests));
    tr.appendChild(tdWho(item));
    tr.appendChild(tdActions(item, { readonly }));

    elTbody.appendChild(tr);

    // detail row только для manual
    if (!readonly) {
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

function tdActions(item, { readonly }) {
  const td = document.createElement("td");
  td.className = "col-actions";

  if (readonly) {
    td.innerHTML = `<span class="res-readonly">readonly</span>`;
    return td;
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "res-details-btn";
  btn.textContent = "Редагувати";
  btn.addEventListener("click", () => toggleDetail(item.row));

  td.appendChild(btn);
  return td;
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
  } else {
    cb.addEventListener("change", () => updateRow(item.row, { confirmed: cb.checked }, cb));
  }

  td.appendChild(cb);

  if (opts.cancelled) {
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

function splitQuandooName_(raw) {
  const s = String(raw || "").trim();
  if (!s) return { name: "—", note: "" };
  const cut = s.split(/\s+(TELEFON|EMAIL|BEREICH|OFFERS|NOTIZ|RES)\b/i)[0].trim();
  const note = (cut && cut.length < s.length) ? s.replace(cut, "").trim() : "";
  return { name: cut || s, note };
}

function tdWho(item) {
  const td = document.createElement("td");
  td.className = "col-who";

  const wrap = document.createElement("div");
  wrap.className = "res-who";

  const src = String(item.source || "").toLowerCase();
  const isQuandoo = src === "quandoo";
  const cancelled = isCancelled_(item);

  const parsed = isQuandoo ? splitQuandooName_(item.from) : { name: (item.from ?? "—"), note: "" };

  // compact top line (name + badges + details button for quandoo notes)
  const top = document.createElement("div");
  top.className = "res-who__top";

  const left = document.createElement("div");
  left.className = "res-who__left";

  const name = document.createElement("div");
  name.className = "res-who__name";
  name.textContent = (parsed.name ?? "—").toString();

  const badges = document.createElement("div");
  badges.className = "res-badges-line";

  if (src) {
    const b = document.createElement("span");
    b.className = "res-badge" + (isQuandoo ? " res-badge--quandoo" : " res-badge--manual");
    b.textContent = isQuandoo ? "Quandoo" : "ручн.";
    badges.appendChild(b);
  }
  if (item.status) {
    const b = document.createElement("span");
    b.className = "res-badge res-badge--status";
    b.textContent = String(item.status).toLowerCase();
    badges.appendChild(b);
  }
  if (cancelled) {
    const b = document.createElement("span");
    b.className = "res-badge res-badge--cancelled";
    b.textContent = "скасовано";
    badges.appendChild(b);
  }

  left.appendChild(name);
  left.appendChild(badges);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "res-details-btn";
  btn.textContent = "Деталі";

  // details block (contacts + quandoo note)
  const details = document.createElement("div");
  details.className = "res-who__details";

  const contacts = document.createElement("div");
  contacts.className = "res-who__contacts";
  let hasDetails = false;

  if (item.email) {
    const a = document.createElement("a");
    a.href = `mailto:${String(item.email).trim()}`;
    a.textContent = String(item.email).trim();
    contacts.appendChild(a);
    hasDetails = true;
  }
  if (item.phone) {
    const a = document.createElement("a");
    const phone = String(item.phone).trim();
    a.href = `tel:${phone.replace(/\s+/g, "")}`;
    a.textContent = phone;
    contacts.appendChild(a);
    hasDetails = true;
  }
  if (contacts.childNodes.length) details.appendChild(contacts);

  if (isQuandoo && parsed.note) {
    const txt = document.createElement("div");
    txt.className = "res-details__text";
    txt.textContent = parsed.note;
    details.appendChild(txt);
    hasDetails = true;
  }

  if (!hasDetails) {
    btn.style.display = "none";
  } else {
    btn.addEventListener("click", () => {
      const open = details.classList.toggle("is-open");
      btn.textContent = open ? "Сховати" : "Деталі";
    });
  }

  top.appendChild(left);
  top.appendChild(btn);

  wrap.appendChild(top);
  wrap.appendChild(details);

  td.appendChild(wrap);
  return td;
}

/* ================== MANUAL EDIT DETAIL ================== */

function detailBlock(item) {
  const box = document.createElement("div");
  box.className = "res-detailbox";

  box.innerHTML = `
    <div class="res-detailbox__title">Редагування (manual)</div>
    <div class="res-detailbox__grid">
      ${df("Дата", "date", item.date)}
      ${df("Час", "time", item.time)}
      ${df("К-ть", "guests", item.guests)}
      ${df("Ціна", "price", item.price)}
      ${df("Оплата", "payment", item.payment)}
      ${df("Меню", "menu", item.menu)}
      ${df("Примітка", "menu2", item.menu2, true)}
      ${df("Від кого", "from", item.from, true)}
      ${df("Email", "email", item.email, true)}
      ${df("Телефон", "phone", item.phone, true)}
    </div>
    <div class="res-detailbox__hint">Змінив поле → клікнув в інше місце = збереглося.</div>
  `;

  // bind blur saves
  box.querySelectorAll("input[data-k]").forEach(inp => {
    inp.addEventListener("blur", () => {
      const key = inp.getAttribute("data-k");
      updateRow(item.row, { [key]: inp.value }, inp);
    });
  });

  return box;
}

function df(label, key, value, span2=false) {
  const v = escapeHtml(value ?? "");
  return `
    <label class="res-df ${span2 ? "span-2" : ""}">
      <span>${escapeHtml(label)}</span>
      <input class="res-field" data-k="${escapeAttr(key)}" value="${v}">
    </label>
  `;
}

/* ================== MOBILE (readonly-ish) ================== */
function renderMobile(data) {
  if (!elCards) return;
  elCards.innerHTML = "";

  if (!data.length) {
    elCards.innerHTML = `<div style="color:#6b7280;padding:10px;">Немає записів</div>`;
    return;
  }

  for (const item of data) {
    const src = String(item.source || "").toLowerCase();
    const isQuandoo = src === "quandoo";
    const cancelled = isCancelled_(item);

    const parsed = isQuandoo ? splitQuandooName_(item.from) : { name: (item.from ?? "—"), note: "" };

    const card = document.createElement("div");
    card.className = "res-card";
    if (cancelled) card.classList.add("res-cancelled");

    // badges
    const badges = [];
    badges.push(`<span class="res-badge ${isQuandoo ? "res-badge--quandoo" : "res-badge--manual"}">${isQuandoo ? "Quandoo" : "ручн."}</span>`);
    if (item.status) badges.push(`<span class="res-badge res-badge--status">${escapeHtml(String(item.status).toLowerCase())}</span>`);
    if (cancelled) badges.push(`<span class="res-badge res-badge--cancelled">скасовано</span>`);

    card.innerHTML = `
      <div class="res-card__top">
        <div style="min-width:0;">
          <div class="res-card__title">${escapeHtml(parsed.name || "—")}</div>
          <div class="res-card__meta">
            ${escapeHtml(item.date || "")} · ${escapeHtml(item.time || "")} · ${escapeHtml(String(item.guests || ""))}
          </div>
          <div class="res-card__meta">
            ${item.email ? `<a href="mailto:${escapeAttr(item.email)}">${escapeHtml(item.email)}</a>` : ""}
            ${item.phone ? ` · <a href="tel:${escapeAttr(String(item.phone).replace(/\s+/g,""))}">${escapeHtml(item.phone)}</a>` : ""}
          </div>
        </div>

        <div class="res-card__badges">
          ${badges.join("")}
        </div>
      </div>

      ${!isQuandoo ? buildMobileManualEditor_(item) : ""}
    `;

    // handlers (manual only)
    if (!isQuandoo) {
      const btnEdit = card.querySelector("[data-act='edit']");
      const btnSave = card.querySelector("[data-act='save']");
      const btnCancel = card.querySelector("[data-act='cancel']");
      const editBox = card.querySelector(".res-m-edit");

      btnEdit?.addEventListener("click", () => {
        editBox.classList.toggle("is-open");
      });

      btnCancel?.addEventListener("click", () => {
        editBox.classList.remove("is-open");
      });

      btnSave?.addEventListener("click", async () => {
        const patch = {
          confirmed: !!card.querySelector("[data-f='confirmed']")?.checked,
          date: card.querySelector("[data-f='date']")?.value ?? "",
          time: card.querySelector("[data-f='time']")?.value ?? "",
          guests: card.querySelector("[data-f='guests']")?.value ?? "",
          from: card.querySelector("[data-f='from']")?.value ?? "",
          email: card.querySelector("[data-f='email']")?.value ?? "",
          phone: card.querySelector("[data-f='phone']")?.value ?? ""
        };

        await updateRow(item.row, patch, btnSave);
        editBox.classList.remove("is-open");
        await fetchAllOnce();
      });
    }

    elCards.appendChild(card);
  }
}

function buildMobileManualEditor_(item){
  return `
    <div class="res-m-actions">
      <button class="res-m-btn" type="button" data-act="edit">Редагувати</button>
    </div>

    <div class="res-m-edit">
      <div class="res-m-grid">
        <label class="res-df">
          <span>Підтв.</span>
          <input type="checkbox" class="res-checkbox" data-f="confirmed" ${item.confirmed ? "checked" : ""}>
        </label>

        <label class="res-df">
          <span>К-ть</span>
          <input class="res-field" data-f="guests" value="${escapeAttr(item.guests ?? "")}">
        </label>

        <label class="res-df">
          <span>Дата</span>
          <input class="res-field" data-f="date" value="${escapeAttr(item.date ?? "")}">
        </label>

        <label class="res-df">
          <span>Час</span>
          <input class="res-field" data-f="time" value="${escapeAttr(item.time ?? "")}">
        </label>

        <label class="res-df span-2">
          <span>Від кого</span>
          <input class="res-field" data-f="from" value="${escapeAttr(item.from ?? "")}">
        </label>

        <label class="res-df span-2">
          <span>Email</span>
          <input class="res-field" data-f="email" value="${escapeAttr(item.email ?? "")}">
        </label>

        <label class="res-df span-2">
          <span>Телефон</span>
          <input class="res-field" data-f="phone" value="${escapeAttr(item.phone ?? "")}">
        </label>
      </div>

      <div class="res-m-actions">
        <button class="res-m-btn" type="button" data-act="save">Зберегти</button>
        <button class="res-m-btn" type="button" data-act="cancel">Скасувати</button>
      </div>
    </div>
  `;
}
/* ================== WRITE API (manual) ================== */

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
    // обновим локальный кеш одной строкой (чтобы не перезагружать всё)
    allDataCache = allDataCache.map(x => (x.row === row ? { ...x, ...patch } : x));
  } catch (err) {
    console.error(err);
    toast("Помилка ❌");
  } finally {
    el?.classList.remove("res-saving");
  }
}

async function addNewManual() {
  const data = {
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

    // очистка
    if (nConfirmed) nConfirmed.checked = false;
    [nDate,nTime,nGuests,nPayment,nPrice,nMenu,nFrom,nEmail,nPhone,nMenu2].forEach(i=>{ if(i) i.value=""; });

    // перезагрузим все (чтобы не гадать row)
    await fetchAllOnce();
  } catch (err) {
    console.error(err);
    toast("Не додалося ❌");
  } finally {
    setLoading(false);
  }
}

/* ================== HELPERS ================== */

function isQuandoo_(x){
  return String(x?.source || "").toLowerCase() === "quandoo";
}
function isCancelled_(x){
  return !!x?.cancelled || String(x?.status || "").toLowerCase() === "cancelled";
}

function setError(msg) {
  if (!msg) { elError.style.display = "none"; elError.textContent = ""; return; }
  elError.style.display = "inline";
  elError.textContent = msg;
}

function toast(msg) {
  elToast.textContent = msg;
  elToast.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (elToast.style.display = "none"), 2000);
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

function parseDDMMYYYY(s) {
  const m = String(s || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 0, 0, 0);
}

function weekRangeMonSun(ddmmyyyy) {
  const d0 = parseDDMMYYYY(ddmmyyyy) || new Date();
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g, "&quot;"); }