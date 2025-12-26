const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

// ===== elements =====
const elList   = document.getElementById("res-list");
const elStatus = document.getElementById("res-status-text");
const elError  = document.getElementById("res-error-text");

const loaderEl     = document.getElementById("global-loader");
const loaderTextEl = document.getElementById("global-loader-text");

const btnToday    = document.getElementById("res-today");
const btnTomorrow = document.getElementById("res-tomorrow");
const btnWeek     = document.getElementById("res-week");
const btnMonth    = document.getElementById("res-month");

let isLoading = false;
let allDataCache = [];
let currentMode = "today"; // today | tomorrow | week | month

init();

function init(){
  btnToday?.addEventListener("click",   () => { setActive(btnToday);    currentMode = "today";    render(); });
  btnTomorrow?.addEventListener("click",() => { setActive(btnTomorrow); currentMode = "tomorrow"; render(); });
  btnWeek?.addEventListener("click",    () => { setActive(btnWeek);     currentMode = "week";     render(); });
  btnMonth?.addEventListener("click",   () => { setActive(btnMonth);    currentMode = "month";    render(); });

  setActive(btnToday);
  fetchAll();
}

async function fetchAll(){
  if (isLoading) return;
  isLoading = true;
  setError("");
  setLoading(true, "Завантажую резервації…");

  try{
    const res = await fetch(WEBAPP_URL + "?action=getAll");
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error || "Помилка завантаження");
    allDataCache = Array.isArray(json.data) ? json.data : [];
    render();
  } catch(err){
    setError(String(err?.message || err));
    if (elStatus) elStatus.textContent = "Помилка завантаження";
  } finally{
    isLoading = false;
    setLoading(false);
  }
}

function render(){
  if (!elList) return;

  const base = Array.isArray(allDataCache) ? allDataCache : [];
  const now = new Date();

  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  const tomorrow0 = addDays(today0, 1);

  const endOfWeek = new Date(today0);
  endOfWeek.setDate(today0.getDate() + 6);
  endOfWeek.setHours(23,59,59,999);

  const endOfMonth = new Date(today0.getFullYear(), today0.getMonth()+1, 0, 23,59,59,999);

  // не показываем вчера/прошлые дни; не показываем all-day (нет времени)
  let filtered = base.filter(it => {
    const d = parseDDMMYYYY(it?.date);
    if (!d) return false;
    if (d < today0) return false;

    const min = toMin(it?.time);
    if (min === null) return false;

    if (currentMode === "today") return sameDay(d, today0);
    if (currentMode === "tomorrow") return sameDay(d, tomorrow0);
    if (currentMode === "week") return d >= today0 && d <= endOfWeek;
    if (currentMode === "month") return d >= today0 && d <= endOfMonth;
    return false;
  });

  filtered.sort((a,b)=>{
    const da = parseDDMMYYYY(a?.date)?.getTime() ?? 0;
    const db = parseDDMMYYYY(b?.date)?.getTime() ?? 0;
    if (da !== db) return da - db;
    return (toMin(a?.time) ?? 0) - (toMin(b?.time) ?? 0);
  });

  // статус/сводка
  const activeOnly = filtered.filter(x => !isCancelled_(x));
  const cancelledCount = filtered.length - activeOnly.length;
  const manualCount = activeOnly.filter(x => !isQuandoo_(x)).length;
  const quandooCount = activeOnly.length - manualCount;
  const guestsSum = activeOnly.reduce((s,x)=> s + (Number(x?.guests)||0), 0);

  const label =
    currentMode === "today" ? "Сьогодні" :
    currentMode === "tomorrow" ? "Завтра" :
    currentMode === "week" ? "Тиждень" :
    "Місяць";

  if (elStatus) {
    elStatus.textContent = `${label}: ${guestsSum} гостей • резервації: ${manualCount} ручн. / ${quandooCount} Quandoo` +
      (cancelledCount ? ` • скасовано: ${cancelledCount}` : "");
  }

  const nowMin = now.getHours()*60 + now.getMinutes();
  const nowStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const nowLine = `
    <div class="mini-now" aria-hidden="true">
      <span class="mini-now-dot"></span><span class="mini-now-line"></span><span class="mini-now-time">${nowStr}</span>
    </div>
  `;

  const renderRow = (item) => {
    const isQuandoo = isQuandoo_(item);
    const badge = isQuandoo ? "Quandoo" : "ручн.";
    const badgeCls = isQuandoo ? "bq" : "bm";

    const cancelled = isCancelled_(item);

    const name = formatName_(item?.from);
    const min = toMin(item?.time) ?? 0;

    // Past: только на Today, и только если прошло больше 10 минут
    const grace = 10;
    const past = (currentMode === "today") && (min < (nowMin - grace));

    const cls = ["mini-res-row", past ? "is-past" : "", cancelled ? "is-cancelled" : ""].filter(Boolean).join(" ");
    const cancelTag = cancelled ? `<span class="mini-res-cancel">Отменено</span>` : "";

    return `
      <div class="${cls}">
        <span class="mini-res-time">${escapeHtml(item?.time || "")}</span>
        <span class="mini-res-guests">${Number(item?.guests)||0}</span>
        <span class="mini-res-name">${escapeHtml(name || "—")}</span>
        <span class="mini-res-badge ${badgeCls}">${badge}</span>
        ${cancelTag}
      </div>
    `;
  };

  let html = "";

  if (!filtered.length) {
    html = `<div class="res-empty">Немає резервацій</div>` + (currentMode === "today" ? nowLine : "");
  } else if (currentMode === "today") {
    // вставляем линию "сейчас" между прошедшими/будущими
    const rows = filtered.map(x => ({...x, _min: toMin(x?.time)}));
    const splitIdx = rows.findIndex(r => (r._min ?? 0) > nowMin);

    if (splitIdx === -1) {
      html = rows.map(renderRow).join("") + nowLine;
    } else if (splitIdx === 0) {
      html = nowLine + rows.map(renderRow).join("");
    } else {
      html = rows.slice(0, splitIdx).map(renderRow).join("") + nowLine + rows.slice(splitIdx).map(renderRow).join("");
    }
  } else {
    // группируем по дате
    const groups = new Map();
    for (const item of filtered) {
      const k = String(item?.date || "").trim();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(item);
    }

    for (const [k, items] of groups.entries()) {
      html += `<div class="res-day-title">${escapeHtml(k)}</div>`;
      html += items.map(renderRow).join("");
    }
  }

  elList.innerHTML = html;
}

// ===== helpers =====
function setActive(btn){
  [btnToday, btnTomorrow, btnWeek, btnMonth].forEach(b => b?.classList.remove("is-active"));
  btn?.classList.add("is-active");
}

function setLoading(on, text){
  if (!loaderEl) return;
  if (typeof text === "string" && loaderTextEl) loaderTextEl.textContent = text;
  loaderEl.classList.toggle("global-loader--hidden", !on);
}

function setError(msg){
  if (!elError) return;
  if (!msg){
    elError.style.display = "none";
    elError.textContent = "";
  } else {
    elError.style.display = "inline";
    elError.textContent = msg;
  }
}

function toMin(t){
  const m = String(t||"").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1])*60 + Number(m[2]);
}

function parseDDMMYYYY(s){
  const m = String(s||"").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  const d = new Date(yy, mm-1, dd, 0,0,0,0);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date, days){
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a,b){
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function escapeHtml(s){
  const str = String(s ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isQuandoo_(it){
  const src = String(it?.source || it?.Source || it?.SOURCE || it?.from || "").trim();
  return /quandoo/i.test(src);
}

function isCancelled_(it){
  const status = String(it?.status || it?.STATUS || "").toLowerCase().trim();
  const cancelledFlag = String(it?.cancelled ?? "").toLowerCase().trim();
  return status === "cancelled" || status === "canceled" || cancelledFlag === "true";
}

function formatName_(raw){
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // Если формат "Фамилия, Имя" => "Фамилия Имя"
  const m = s.match(/^\s*([^,]+)\s*,\s*(.+)\s*$/);
  if (m) return `${m[1].trim()} ${m[2].trim()}`;
  return s;
}
