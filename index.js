// index.js — только для главной панели (index.html)
// Показывает: Сьогодні (слева) и Завтра (справа) для Admin

const SCHEDULE_API_URL =
  "https://script.google.com/macros/s/AKfycbw_uswtYYaimbBJytiHAdcwjbvv2rujyBt2Rrc9jlBHoYQ358F7vi8OvvQEhTptODNZ8g/exec";

// у Admin у тебя 3 колонки
const ADMIN_COLS = 3;

// кэш на месяц (чтобы не грузить два раза)
let _cache = null;

document.addEventListener("DOMContentLoaded", () => {
  // сегодня + завтра
  loadDutyAdminsForOffset(0, "duty-admin-today");
  loadDutyAdminsForOffset(1, "duty-admin-tomorrow");
});

/* =========================
   MAIN
========================= */

async function loadDutyAdminsForOffset(dayOffset, targetId){
  const hostEl = document.getElementById(targetId);
  if (!hostEl) return;

  try {
    const targetDate = addDays(new Date(), dayOffset);
    const month = formatMonthParam(targetDate);

    // грузим rows только если месяц поменялся или кэша нет
    if (!_cache || _cache.month !== month) {
      const data = await jsonp(`${SCHEDULE_API_URL}?action=list&month=${month}`);
      _cache = { month, rows: (data && data.rows) ? data.rows : [] };
    }

    const rows = _cache.rows;
    const targetISO = toISODate(targetDate);

    const dayRows = rows
      .map(r => ({
        date: String(r.date || "").trim(),
        time: normalizeTime(r.time),
        admin: Array.isArray(r.admin) ? r.admin : [],
      }))
      .filter(r => r.date === targetISO && r.time)
      .sort((a,b) => (a.time || "").localeCompare(b.time || ""));

    if (!dayRows.length) {
      hostEl.textContent = (dayOffset === 0) ? "Немає чергового сьогодні" : "Немає чергового завтра";
      hideDutyNote();
      return;
    }

    // name -> [times]
    const map = new Map();
    dayRows.forEach(r => {
      for (let i = 0; i < ADMIN_COLS; i++){
        const n = String(r.admin[i] || "").trim();
        if (!n) continue;
        if (!map.has(n)) map.set(n, []);
        map.get(n).push(r.time);
      }
    });

    if (!map.size) {
      hostEl.textContent = (dayOffset === 0) ? "Немає чергового сьогодні" : "Немає чергового завтра";
      hideDutyNote();
      return;
    }

    // build lines
    const lines = [];
    for (const [name, times] of map.entries()){
      times.sort((a,b) => a.localeCompare(b));
      const intervals = buildIntervalsFromTimes(times);
      lines.push({ name, text: intervals.join(", ") });
    }

    // вывод: каждый человек отдельным блоком
    hostEl.innerHTML = lines.map(x =>
      `<div style="margin-bottom:8px;">
         <strong>${escapeHtml(x.name)}</strong><br>
         <span>${escapeHtml(x.text)}</span>
       </div>`
    ).join("");

    hideDutyNote();
  } catch (e) {
    console.error("loadDutyAdminsForOffset error:", e);
    hostEl.textContent = "Помилка завантаження";
    hideDutyNote();
  }
}

function hideDutyNote(){
  // убираем "Інформація завантажується…" только в карточке админа
  const adminCard = document.querySelector(".dashboard-module");
  if (!adminCard) return;
  const note = adminCard.querySelector(".module-note");
  if (note) note.style.display = "none";
}

/* =========================
   Helpers
========================= */

function addDays(date, days){
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function pad2(n){ return String(n).padStart(2, "0"); }

function toISODate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function formatMonthParam(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}

function normalizeTime(raw){
  if (raw === null || raw === undefined) return "";

  if (raw instanceof Date) {
    return `${pad2(raw.getHours())}:${pad2(raw.getMinutes())}`;
  }

  if (typeof raw === "number" && isFinite(raw)) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  const s = String(raw).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${pad2(parseInt(m[1], 10))}:${m[2]}`;
  return s;
}

// ["09:00","10:00","11:00","21:00","22:00"] => ["09:00–11:00","21:00–22:00"]
function buildIntervalsFromTimes(times){
  const res = [];
  let start = times[0];
  let prev  = times[0];

  for (let i = 1; i < times.length; i++){
    const cur = times[i];

    const prevH = parseInt(prev.slice(0,2), 10);
    const curH  = parseInt(cur.slice(0,2), 10);

    if (curH === prevH + 1) {
      prev = cur;
    } else {
      res.push(`${start}–${prev}`);
      start = cur;
      prev = cur;
    }
  }
  res.push(`${start}–${prev}`);
  return res;
}

// JSONP (GET без CORS)
function jsonp(url){
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cb}`;

    window[cb] = (data) => {
      try { resolve(data); } finally {
        delete window[cb];
        script.remove();
      }
    };

    script.onerror = () => {
      delete window[cb];
      script.remove();
      reject(new Error("JSONP load failed"));
    };

    document.body.appendChild(script);
  });
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}