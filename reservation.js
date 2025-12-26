const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

function menuBadgeHtml(menuRaw) {
  const v = String(menuRaw || "").trim();
  const key = v.toLowerCase();

  // если в колонке G пусто → желтая кнопка "Меню ?"
  if (!v) {
    return `<span class="mini-res-menu mini-res-menu--unknown">Меню ?</span>`;
  }

  // если написано "немає / нема / нет / no" → ничего не показываем
  if (["немає", "нема", "нет", "no", "none"].includes(key)) {
    return "";
  }

  // если есть любой текст (например "меню") → зеленая кнопка "Меню"
  return `<span class="mini-res-menu mini-res-menu--yes">Меню</span>`;
}
// оставь свой реальный URL как был у тебя в файле

const ACTIVE_MINUTES = 10; // бронь "активна" ещё 10 минут после времени

/* ================== DOM ================== */
const elDays   = document.getElementById("res-days");
const elStatus = document.getElementById("res-status-text");
const elError  = document.getElementById("res-error-text");
const elToast  = document.getElementById("toast");
const nowLine  = document.getElementById("res-nowline");

const loaderEl     = document.getElementById("global-loader");
const loaderTextEl = document.getElementById("global-loader-text");

const tabToday    = document.getElementById("tab-today");
const tabTomorrow = document.getElementById("tab-tomorrow");
const tabWeek     = document.getElementById("tab-week");
const tabMonth    = document.getElementById("tab-month");

const btnAdd = document.getElementById("res-add");
const nConfirmed = document.getElementById("new-confirmed");
const nDate = document.getElementById("new-date");
const nTime = document.getElementById("new-time");
const nGuests = document.getElementById("new-guests");
const nFrom = document.getElementById("new-from");
const nEmail = document.getElementById("new-email");
const nPhone = document.getElementById("new-phone");
const nNote = document.getElementById("new-note");

// modal
const modal = document.getElementById("edit-modal");
const mClose = document.getElementById("edit-close");
const mCancel = document.getElementById("edit-cancel");
const mSave = document.getElementById("edit-save");
const eConfirmed = document.getElementById("edit-confirmed");
const eDate = document.getElementById("edit-date");
const eTime = document.getElementById("edit-time");
const eGuests = document.getElementById("edit-guests");
const eFrom = document.getElementById("edit-from");
const eEmail = document.getElementById("edit-email");
const ePhone = document.getElementById("edit-phone");
const eNote = document.getElementById("edit-note");

let cache = [];
let mode = "today";
let editRowId = null;

/* ================== INIT ================== */
init();

function init(){
  tabToday?.addEventListener("click", ()=> setMode("today", tabToday));
  tabTomorrow?.addEventListener("click", ()=> setMode("tomorrow", tabTomorrow));
  tabWeek?.addEventListener("click", ()=> setMode("week", tabWeek));
  tabMonth?.addEventListener("click", ()=> setMode("month", tabMonth));

  btnAdd?.addEventListener("click", addManual);

  // enter = add
  [nDate,nTime,nGuests,nFrom,nEmail,nPhone,nNote].forEach(inp=>{
    inp?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") addManual(); });
  });

  mClose?.addEventListener("click", closeModal);
  mCancel?.addEventListener("click", closeModal);
  modal?.querySelector(".res-modal__backdrop")?.addEventListener("click", closeModal);

  setMode("today", tabToday);
  fetchAll();
}

/* ================== MODE ================== */
function setMode(m, btn){
  mode = m;
  [tabToday, tabTomorrow, tabWeek, tabMonth].forEach(b=>b?.classList.remove("is-active"));
  btn?.classList.add("is-active");
  render();
}

/* ================== LOAD ================== */
async function fetchAll(){
  setError("");
  setLoading(true, "Завантажую резервації…");
  try{
    const res = await fetch(WEBAPP_URL + "?action=getAll");
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || "Помилка завантаження");
    cache = Array.isArray(json.data) ? json.data : [];
    render();
  }catch(err){
    setError(String(err.message || err));
    elStatus.textContent = "Помилка завантаження";
  }finally{
    setLoading(false);
  }
}

/* ================== FILTER RULES ================== */
/**
 * - Не показываем прошлые дни (вчера и раньше)
 * - Не показываем записи без корректной даты dd.mm.yyyy
 * - Не показываем без времени HH:MM (all-day / multi-day)
 */
function normalizeAndKeep(x){
  const date = String(x?.date||"").trim();
  const time = String(x?.time||"").trim();

  if(!isDDMMYYYY(date)) return null;
  if(!isHHMM(time)) return null;

  const dt = toDateTime(date, time);
  if(!dt) return null;

  // только сегодня и будущее (без вчера)
  const startToday = new Date();
  startToday.setHours(0,0,0,0);
  if(dt < startToday) return null;

  return { ...x, _dt: dt };
}

function rangeForMode(){
  const start = new Date();
  start.setHours(0,0,0,0);

  const end = new Date(start);
  if(mode==="today"){
    end.setDate(end.getDate());
    end.setHours(23,59,59,999);
  }else if(mode==="tomorrow"){
    start.setDate(start.getDate()+1);
    end.setDate(end.getDate()+1);
    end.setHours(23,59,59,999);
  }else if(mode==="week"){
    end.setDate(end.getDate()+6);
    end.setHours(23,59,59,999);
  }else{ // month
    end.setDate(end.getDate()+29);
    end.setHours(23,59,59,999);
  }
  return { start, end };
}
function menuBadgeHtml(menuRaw) {
  const v = String(menuRaw || "").trim();
  const key = v.toLowerCase();

  if (!v) {
    return `<span class="mini-res-menu mini-res-menu--unknown">Меню ?</span>`;
  }

  if (["немає", "нема", "нет", "no", "none"].includes(key)) {
    return "";
  }

  return `<span class="mini-res-menu mini-res-menu--yes">Меню</span>`;
}
/* ================== RENDER ================== */
function render(){
  if(!elDays) return;

  const { start, end } = rangeForMode();

  // normalize + filter
  const rows = cache
    .map(normalizeAndKeep)
    .filter(Boolean)
    .filter(x => x._dt >= start && x._dt <= end)
    .sort((a,b)=> a._dt - b._dt);

  // group by day
  const byDay = new Map();
  for(const r of rows){
    const key = ddmmyyyyFromDate(r._dt);
    if(!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(r);
  }

  // status text
  const active = rows.filter(r => !isCancelled(r));
  const manual = active.filter(r => !isQuandoo(r)).length;
  const quandoo = active.filter(r => isQuandoo(r)).length;

  const label =
    mode==="today" ? "Сьогодні" :
    mode==="tomorrow" ? "Завтра" :
    mode==="week" ? "Тиждень" : "Місяць";

  elStatus.textContent = `${label}: ${active.length} (ручн. ${manual} / Quandoo ${quandoo})`;

  // render days
  elDays.innerHTML = "";

  if(byDay.size === 0){
    elDays.innerHTML = `<div style="color:#6b7280;padding:10px;">Немає резервацій</div>`;
    setNowLine(false);
    return;
  }

  for(const [day, list] of byDay.entries()){
    const activeDay = list.filter(r => !isCancelled(r));
    const sumGuests = activeDay.reduce((acc,r)=> acc + (toInt(r.guests)||0), 0);
    const manualDay = activeDay.filter(r=>!isQuandoo(r)).length;
    const quandooDay = activeDay.filter(r=>isQuandoo(r)).length;

    const dayEl = document.createElement("div");
    dayEl.className = "res-day";

    dayEl.innerHTML = `
      <div class="res-day__head">
        <div class="res-day__title">${escapeHtml(day)}</div>
        <div class="res-day__totals">Гостей: ${sumGuests} · ручн. ${manualDay} · Quandoo ${quandooDay}</div>
      </div>
      <div class="res-list"></div>
    `;

    const listEl = dayEl.querySelector(".res-list");

    for(const item of list){
      listEl.appendChild(renderItem(item));
    }

    elDays.appendChild(dayEl);
  }

  // now line only in today mode
  if(mode==="today"){
    positionNowLine();
  }else{
    setNowLine(false);
  }
}

function renderItem(item){
  const isQ = isQuandoo(item);
  const cancelled = isCancelled(item);

  const dt = item._dt;
  const past = isPast(dt, ACTIVE_MINUTES);

  const srcBadge = isQ ? `<span class="res-badge res-badge--quandoo">Quandoo</span>`
                       : `<span class="res-badge res-badge--manual">ручн.</span>`;

  const cancelBadge = cancelled ? `<span class="res-badge res-badge--cancelled">Отменено</span>` : "";

  const { shortName, rest } = isQ ? splitQuandoo(item.from) : { shortName: (item.from||"—"), rest:"" };

  const wrap = document.createElement("div");
  wrap.className = "res-item";
  if(past) wrap.classList.add("is-past");
  if(cancelled) wrap.classList.add("is-cancelled");

  // details block only for quandoo extra
  const hasDetails = isQ && rest;

  wrap.innerHTML = `
    <div style="min-width:0; width:100%;">
      <div class="res-item__left">
        <div class="res-time">${escapeHtml(hhmm(dt))}</div>
        <div class="res-meta">${escapeHtml(String(item.guests||""))} гостей</div>
        <div class="res-item__name">${escapeHtml(shortName || "—")}</div>
      </div>

      ${hasDetails ? `<div class="res-details">${escapeHtml(rest)}</div>` : ``}
    </div>

    <div class="res-item__right">
      ${srcBadge}
      ${cancelBadge}
      ${hasDetails ? `<button class="res-btn" type="button" data-act="more">Подробнее</button>` : ``}
      ${(!isQ) ? `<button class="res-btn" type="button" data-act="edit">Ред.</button>` : ``}
    </div>
  `;

  // handlers
  if(hasDetails){
    const btnMore = wrap.querySelector('[data-act="more"]');
    const det = wrap.querySelector(".res-details");
    btnMore?.addEventListener("click", ()=>{
      const open = det.classList.toggle("is-open");
      btnMore.textContent = open ? "Скрыть" : "Подробнее";
    });
  }

  if(!isQ){
    const btnEdit = wrap.querySelector('[data-act="edit"]');
    btnEdit?.addEventListener("click", ()=> openEdit(item));
  }

  return wrap;
}

/* ================== NOW LINE ================== */
function setNowLine(show){
  if(!nowLine) return;
  nowLine.style.display = show ? "block" : "none";
}

function positionNowLine(){
  // Линию ставим по текущему времени среди сегодняшних элементов
  setNowLine(true);

  // если сегодня нет списка — спрячем
  const firstDay = elDays?.querySelector(".res-day");
  if(!firstDay){ setNowLine(false); return; }

  // линия должна быть внутри board (absolute)
  const boardRect = document.querySelector(".res-board")?.getBoundingClientRect();
  if(!boardRect){ setNowLine(false); return; }

  const now = new Date();
  const items = [...document.querySelectorAll(".res-day:first-child .res-item")];
  if(items.length === 0){ setNowLine(false); return; }

  // найдём первый элемент, который позже now
  let target = null;
  for(const el of items){
    const timeText = el.querySelector(".res-time")?.textContent || "";
    const dt = toDateTime(ddmmyyyyFromDate(now), timeText.trim());
    if(dt && dt >= now){ target = el; break; }
  }

  const boardTop = boardRect.top + window.scrollY;

  let y;
  if(!target){
    // если все раньше — линия внизу списка
    const last = items[items.length-1].getBoundingClientRect();
    y = (last.bottom + window.scrollY) - boardTop;
  }else{
    const r = target.getBoundingClientRect();
    y = (r.top + window.scrollY) - boardTop;
  }

  nowLine.style.top = `${Math.max(10, y)}px`;
}

window.addEventListener("scroll", ()=> { if(mode==="today") positionNowLine(); }, { passive:true });
window.addEventListener("resize", ()=> { if(mode==="today") positionNowLine(); });

/* ================== EDIT MODAL (manual) ================== */
function openEdit(item){
  editRowId = item.row;

  eConfirmed.checked = !!item.confirmed;
  eDate.value = String(item.date||"");
  eTime.value = String(item.time||"");
  eGuests.value = String(item.guests||"");
  eFrom.value = String(item.from||"");
  eEmail.value = String(item.email||"");
  ePhone.value = String(item.phone||"");
  eNote.value = String(item.note||item.menu2||"");

  modal.classList.remove("res-modal--hidden");
  modal.setAttribute("aria-hidden", "false");

  mSave.onclick = async ()=>{
    const patch = {
      confirmed: !!eConfirmed.checked,
      date: (eDate.value||"").trim(),
      time: (eTime.value||"").trim(),
      guests: (eGuests.value||"").trim(),
      from: (eFrom.value||"").trim(),
      email: (eEmail.value||"").trim(),
      phone: (ePhone.value||"").trim(),
      note: (eNote.value||"").trim(),
    };
    await updateRow(editRowId, patch, mSave);
    closeModal();
    await fetchAll();
  };
}

function closeModal(){
  editRowId = null;
  modal.classList.add("res-modal--hidden");
  modal.setAttribute("aria-hidden", "true");
}

/* ================== WRITE API ================== */
async function updateRow(row, patch, el){
  if(!row) return;
  try{
    setLoading(true, "Зберігаю…");
    const res = await fetch(WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action:"updateRow", row, data: patch })
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || "Помилка оновлення");
    toast("Збережено ✅");
  }catch(err){
    console.error(err);
    toast("Помилка ❌");
  }finally{
    setLoading(false);
  }
}

async function addManual(){
  const data = {
    confirmed: !!nConfirmed.checked,
    date: (nDate.value||"").trim(),
    time: (nTime.value||"").trim(),
    guests: (nGuests.value||"").trim(),
    from: (nFrom.value||"").trim(),
    email: (nEmail.value||"").trim(),
    phone: (nPhone.value||"").trim(),
    note: (nNote.value||"").trim(),
  };

  if(!data.date || !data.time) return toast("Потрібні дата і час");
  if(!isDDMMYYYY(data.date)) return toast("Дата має бути dd.mm.yyyy");
  if(!isHHMM(data.time)) return toast("Час має бути HH:MM");

  try{
    setLoading(true, "Додаю…");
    const res = await fetch(WEBAPP_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action:"add", data })
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || "Не додалося");

    toast("Додано ✅");
    nConfirmed.checked = false;
    [nDate,nTime,nGuests,nFrom,nEmail,nPhone,nNote].forEach(i=> i.value="");
    await fetchAll();
  }catch(err){
    console.error(err);
    toast("Не додалося ❌");
  }finally{
    setLoading(false);
  }
}

/* ================== HELPERS ================== */
function isQuandoo(x){
  return String(x?.source||"").toLowerCase() === "quandoo";
}
function isCancelled(x){
  return !!x?.cancelled || String(x?.status||"").toLowerCase() === "cancelled";
}

function splitQuandoo(raw){
  const s = String(raw||"").trim();
  if(!s) return { shortName:"—", rest:"" };

  // имя = первые два слова
  const parts = s.split(/\s+/);
  const shortName = parts.slice(0,2).join(" ");

  const rest = parts.length > 2 ? parts.slice(2).join(" ") : "";
  return { shortName, rest };
}

function isPast(dt, activeMinutes){
  const now = new Date();
  const grace = new Date(dt.getTime() + activeMinutes*60000);
  return grace < now;
}

function toInt(v){
  const n = Number(String(v||"").replace(/[^\d]/g,""));
  return Number.isFinite(n) ? n : 0;
}

function isDDMMYYYY(s){
  return /^(\d{2})\.(\d{2})\.(\d{4})$/.test(String(s||"").trim());
}
function isHHMM(s){
  return /^(\d{1,2}):(\d{2})$/.test(String(s||"").trim());
}

function toDateTime(ddmmyyyy, hhmmStr){
  const m = String(ddmmyyyy||"").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const t = String(hhmmStr||"").match(/^(\d{1,2}):(\d{2})$/);
  if(!m || !t) return null;
  const d = Number(m[1]), mo = Number(m[2])-1, y=Number(m[3]);
  const h = Number(t[1]), mi=Number(t[2]);
  return new Date(y, mo, d, h, mi, 0, 0);
}

function ddmmyyyyFromDate(d){
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function hhmm(d){
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function setLoading(on, text="Завантаження…"){
  if(!loaderEl) return;
  loaderTextEl.textContent = text;
  loaderEl.classList.toggle("global-loader--hidden", !on);
  // чтобы не тыкали 100 раз
  [tabToday,tabTomorrow,tabWeek,tabMonth,btnAdd,mSave].forEach(b=>{ if(b) b.disabled = on; });
}

function setError(msg){
  if(!msg){ elError.style.display="none"; elError.textContent=""; return; }
  elError.style.display="inline";
  elError.textContent = msg;
}

function toast(msg){
  elToast.textContent = msg;
  elToast.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> elToast.style.display="none", 2000);
}

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}