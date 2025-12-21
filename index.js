// index.js — dashboard (today + tomorrow)

// ====== SCHEDULE (same as schedule.html) ======
const SCHEDULE_API_URL =
  "https://script.google.com/macros/s/AKfycbw_uswtYYaimbBJytiHAdcwjbvv2rujyBt2Rrc9jlBHoYQ358F7vi8OvvQEhTptODNZ8g/exec";

// ====== RESERVATIONS (same as reservation.html) ======
// ВСТАВЬ сюда ПОЛНЫЙ URL из reservation.js (без "...")
const RESERVATION_API_URL =
  "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

// sheet columns count for admin duty (left block)
const ADMIN_COLS = 3;

// cache for schedule month
let _schedCache = null;

document.addEventListener("DOMContentLoaded", () => {
  // duty admins (today/tomorrow)
  loadDutyAdminsForOffset(0, "duty-admin-today");
  loadDutyAdminsForOffset(1, "duty-admin-tomorrow");

  // reservations today/tomorrow
  loadReservationsSummary(0);
  loadReservationsSummary(1);

  // schedule today/tomorrow (NO admins, only Kellner/Küche/Reinigung)
  loadScheduleSummary(0);
  loadScheduleSummary(1);
});

/* =========================
   DUTY ADMINS (as you have)
========================= */

async function loadDutyAdminsForOffset(dayOffset, targetId){
  const hostEl = document.getElementById(targetId);
  if (!hostEl) return;

  try {
    const targetDate = addDays(new Date(), dayOffset);
    const month = formatMonthParam(targetDate);

    if (!_schedCache || _schedCache.month !== month){
      const data = await jsonp(`${SCHEDULE_API_URL}?action=list&month=${month}`);
      _schedCache = { month, rows: (data && data.rows) ? data.rows : [] };
    }

    const rows = _schedCache.rows;
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

    const map = new Map();
    dayRows.forEach(r => {
      for (let i=0; i<ADMIN_COLS; i++){
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

    const lines = [];
    for (const [name, times] of map.entries()){
      times.sort((a,b)=>a.localeCompare(b));
      const intervals = buildIntervalsFromTimes(times);
      lines.push({ name, text: intervals.join(", ") });
    }

    hostEl.innerHTML = lines.map(x =>
      `<div style="margin-bottom:8px;">
         <strong>${escapeHtml(x.name)}</strong><br>
         <span>${escapeHtml(x.text)}</span>
       </div>`
    ).join("");

    hideDutyNote();
  } catch (e) {
    console.error(e);
    hostEl.textContent = "Помилка завантаження";
    hideDutyNote();
  }
}

function hideDutyNote(){
  const adminCard = document.querySelector(".dashboard-module");
  if (!adminCard) return;
  const note = adminCard.querySelector(".module-note");
  if (note) note.style.display = "none";
}

/* =========================
   RESERVATIONS (today/tomorrow)
   shows: total guests + times list
========================= */

async function loadReservationsSummary(dayOffset){
  const guestsEl = document.getElementById(dayOffset === 0 ? "res-today-guests" : "res-tomorrow-guests");
  const timesEl  = document.getElementById(dayOffset === 0 ? "res-today-times"  : "res-tomorrow-times");
  if (!guestsEl || !timesEl) return;

  // if url not set
  if (!RESERVATION_API_URL || RESERVATION_API_URL.includes("PASTE_")) {
    guestsEl.textContent = "—";
    timesEl.textContent = "Встав URL резервацій";
    return;
  }

  try {
    // reservation API returns DDMMYYYY strings
    const target = addDays(new Date(), dayOffset);
    const ddmmyyyy = toDDMMYYYY(target);

    // fastest: getByDate
    const res = await fetch(`${RESERVATION_API_URL}?action=getByDate&date=${encodeURIComponent(ddmmyyyy)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Reservation load error");

    const data = Array.isArray(json.data) ? json.data : [];

    // sum guests + group by time
    let totalGuests = 0;
    const byTime = new Map(); // time -> guests sum

    for (const it of data){
      const t = String(it.time || "").trim();
      const g = parseInt(String(it.guests || "0").replace(/[^\d]/g,""), 10) || 0;
      if (g) totalGuests += g;
      if (t) byTime.set(t, (byTime.get(t) || 0) + g);
    }

    guestsEl.textContent = String(totalGuests || 0);

    // render times (top 6)
    const items = [...byTime.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    if (!items.length) {
      timesEl.textContent = "Немає резервацій";
      return;
    }

    const top = items.slice(0, 6);
    const more = items.length - top.length;

    timesEl.innerHTML =
      top.map(([t,g]) => `<div class="t"><span>${escapeHtml(t)}</span><span>${g} гостей</span></div>`).join("") +
      (more > 0 ? `<div style="margin-top:6px;color:#6b7280;">ще +${more}</div>` : "");

  } catch (e) {
    console.error(e);
    guestsEl.textContent = "—";
    timesEl.textContent = "Помилка завантаження";
  }
}

/* =========================
   SCHEDULE (today/tomorrow)
   NO admins. Only Kellner/Küche/Reinigung with time intervals.
========================= */

async function loadScheduleSummary(dayOffset){
  const box = document.getElementById(dayOffset === 0 ? "schedule-today" : "schedule-tomorrow");
  if (!box) return;

  try {
    const targetDate = addDays(new Date(), dayOffset);
    const month = formatMonthParam(targetDate);

    if (!_schedCache || _schedCache.month !== month){
      const data = await jsonp(`${SCHEDULE_API_URL}?action=list&month=${month}`);
      _schedCache = { month, rows: (data && data.rows) ? data.rows : [] };
    }

    const rows = _schedCache.rows;
    const targetISO = toISODate(targetDate);

    const dayRows = rows
      .map(r => ({
        date: String(r.date || "").trim(),
        time: normalizeTime(r.time),
        kellner: Array.isArray(r.kellner) ? r.kellner : [],
        kueche: Array.isArray(r.kueche) ? r.kueche : [],
        reinigung: Array.isArray(r.reinigung) ? r.reinigung : [],
      }))
      .filter(r => r.date === targetISO && r.time)
      .sort((a,b) => a.time.localeCompare(b.time));

    // build role maps name -> times
    const roleMaps = {
      Kellner: new Map(),
      "Küche": new Map(),
      Reinigung: new Map(),
    };

    for (const r of dayRows){
      pushRole(roleMaps.Kellner, r.kellner, r.time);
      pushRole(roleMaps["Küche"], r.kueche, r.time);
      pushRole(roleMaps.Reinigung, r.reinigung, r.time);
    }

    box.innerHTML = `
      ${renderRole("Kellner", roleMaps.Kellner)}
      ${renderRole("Küche", roleMaps["Küche"])}
      ${renderRole("Reinigung", roleMaps.Reinigung)}
    `;
  } catch (e) {
    console.error(e);
    box.textContent = "Помилка завантаження";
  }
}

function pushRole(map, arr, time){
  for (const n0 of arr){
    const n = String(n0 || "").trim();
    if (!n) continue;
    if (!map.has(n)) map.set(n, []);
    map.get(n).push(time);
  }
}

function renderRole(title, map){
  if (!map || map.size === 0) {
    return `<div class="role"><b>${title}</b><div>—</div></div>`;
  }

  const lines = [];
  for (const [name, times] of map.entries()){
    times.sort((a,b)=>a.localeCompare(b));
    const intervals = buildIntervalsFromTimes(times);
    lines.push(`${escapeHtml(name)}: ${escapeHtml(intervals.join(", "))}`);
  }

  return `<div class="role"><b>${title}</b><div>${lines.join("<br>")}</div></div>`;
}

/* =========================
   Helpers
========================= */

function addDays(date, days){
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function pad2(n){ return String(n).padStart(2,"0"); }

function toISODate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function formatMonthParam(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function toDDMMYYYY(d){
  return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
}

function normalizeTime(raw){
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return `${pad2(raw.getHours())}:${pad2(raw.getMinutes())}`;
  if (typeof raw === "number" && isFinite(raw)) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${pad2(parseInt(m[1],10))}:${m[2]}`;
  return s;
}

// ["09:00","10:00","11:00","21:00","22:00"] => ["09:00–11:00","21:00–22:00"]
function buildIntervalsFromTimes(times){
  const res = [];
  let start = times[0];
  let prev  = times[0];

  for (let i=1; i<times.length; i++){
    const cur = times[i];
    const prevH = parseInt(prev.slice(0,2),10);
    const curH  = parseInt(cur.slice(0,2),10);
    if (curH === prevH + 1) prev = cur;
    else { res.push(`${start}–${prev}`); start = cur; prev = cur; }
  }
  res.push(`${start}–${prev}`);
  return res;
}

// JSONP for schedule (works from file://)
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