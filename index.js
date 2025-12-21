// index.js — dashboard (today + tomorrow)

// ====== SCHEDULE (same as schedule.html) ======
const SCHEDULE_API_URL =
  "https://script.google.com/macros/s/AKfycbw_uswtYYaimbBJytiHAdcwjbvv2rujyBt2Rrc9jlBHoYQ358F7vi8OvvQEhTptODNZ8g/exec";

// ====== RESERVATIONS (same as reservation.html) ======
const RESERVATION_API_URL =
  "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

// ====== TASKS ======
const TASKS_API_URL =
  "https://script.google.com/macros/s/AKfycbzKxxknHm2WBYLRzNOAWaK66VGvUZMbT5tPjpTR6j2J_uYh838LRI5Nk0a2H4DPIkkG/exec";

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

  // tasks mini list
  loadTasksMini();
});

/* =========================
   DUTY ADMINS
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
========================= */

async function loadReservationsSummary(dayOffset){
  const guestsEl = document.getElementById(dayOffset === 0 ? "res-today-guests" : "res-tomorrow-guests");
  const timesEl  = document.getElementById(dayOffset === 0 ? "res-today-times"  : "res-tomorrow-times");
  if (!guestsEl || !timesEl) return;

  if (!RESERVATION_API_URL) {
    guestsEl.textContent = "—";
    timesEl.textContent = "Встав URL резервацій";
    return;
  }

  try {
    const target = addDays(new Date(), dayOffset);
    const ddmmyyyy = toDDMMYYYY(target);

    const res = await fetch(`${RESERVATION_API_URL}?action=getByDate&date=${encodeURIComponent(ddmmyyyy)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Reservation load error");

    const data = Array.isArray(json.data) ? json.data : [];

    let totalGuests = 0;
    const byTime = new Map();

    for (const it of data){
      const t = String(it.time || "").trim();
      const g = parseInt(String(it.guests || "0").replace(/[^\d]/g,""), 10) || 0;
      if (g) totalGuests += g;
      if (t) byTime.set(t, (byTime.get(t) || 0) + g);
    }

    guestsEl.textContent = String(totalGuests || 0);

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
   NO admins. Only roles
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
   TASKS mini on dashboard
========================= */

async function loadTasksMini(){
  const list = document.getElementById("tasks-mini-list");
  const empty = document.getElementById("tasks-mini-empty");
  if (!list || !empty) return;

  try {
    // file:// → JSONP
    const useJsonp = (location.protocol === "file:");
    let json;

    if (useJsonp) {
      json = await jsonp(`${TASKS_API_URL}?action=tasks_list`);
    } else {
      const res = await fetch(`${TASKS_API_URL}?action=tasks_list`, { method: "GET" });
      json = await res.json();
    }

    if (!json || !json.ok) throw new Error((json && json.error) ? json.error : "tasks_list error");

    const data = Array.isArray(json.data) ? json.data : [];
    const open = data.filter(t => (t.status || "open") === "open");

    if (!open.length){
      list.innerHTML = `<div class="task-empty">Немає активних завдань</div>`;
      return;
    }

    open.sort((a,b) => {
      const ap = (a.priority === "red") ? 0 : 1;
      const bp = (b.priority === "red") ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
    });

    const top = open.slice(0, 3);
    const more = open.length - top.length;

    list.innerHTML =
      top.map(t => {
        const badgeClass = (t.priority === "red") ? "badge badge--red" : "badge badge--blue";
        const prText = (t.priority === "red") ? "🔴 Срочно" : "🔵 Звичайно";
        const due = (t.due && String(t.due).trim()) ? `⏳ ${escapeHtml(t.due)}` : "⏳ без строку";
        const who = String(t.assignee || "").trim();

        return `
          <div class="task-row" style="padding:10px;">
            <div class="task-left">
              <div class="task-title" style="font-size:14px;">${escapeHtml(t.title || "")}</div>
              <div class="task-meta" style="margin-top:6px;">
                <span class="${badgeClass}">${prText}</span>
                <span class="task-due">${due}</span>
                ${who ? `<span class="task-due">👤 ${escapeHtml(who)}</span>` : ``}
              </div>
            </div>
          </div>
        `;
      }).join("") +
      (more > 0 ? `<div style="margin-top:8px;color:#6b7280;font-weight:700;">Ще +${more}…</div>` : "");
  } catch (e){
    console.error(e);
    list.innerHTML = `<div class="task-empty">Помилка завантаження задач</div>`;
  }
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

function buildIntervalsFromTimes(times){
  if (!times || !times.length) return [];
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