// index.js — dashboard (today + tomorrow + calendar events)

// ====== SCHEDULE (same as schedule.html) ======
const SCHEDULE_API_URL =
  "https://script.google.com/macros/s/AKfycbw_uswtYYaimbBJytiHAdcwjbvv2rujyBt2Rrc9jlBHoYQ358F7vi8OvvQEhTptODNZ8g/exec";

// ====== RESERVATIONS (same as reservation.html) ======
const RESERVATION_API_URL =
  "https://script.google.com/macros/s/AKfycbwNlMF6GEshtn2-5C1n-EsaCRkNZa2xPOQ2mA2zfdYvZyEIl3JSk4evG2NgkCMQaUdqaA/exec";

// ====== TASKS + CALENDAR (gcal_events добавлен сюда) ======
const TASKS_API_URL =
  "https://script.google.com/macros/s/AKfycbzKxxknHm2WBYLRzNOAWaK66VGvUZMbT5tPjpTR6j2J_uYh838LRI5Nk0a2H4DPIkkG/exec";

// календарь берём из того же скрипта, где ты добавил action "gcal_events"
const CALENDAR_API_URL =
  "https://script.google.com/macros/s/AKfycbyQ4r7ZG3xdkyD30f0je-gFW2GZiQ4R7XApdN1R-tEc2WYy0md5TAz0-rTJd7M67P44Kw/exec";

const ADMIN_COLS = 3;
let _schedCache = null;

document.addEventListener("DOMContentLoaded", () => {
  loadDutyAdminsForOffset(0, "duty-admin-today");
  loadDutyAdminsForOffset(1, "duty-admin-tomorrow");

  loadReservationsSummary(0);
  loadReservationsSummary(1);

  loadScheduleSummary(0);
  loadScheduleSummary(1);

  loadTasksMini();

  // ✅ события на главной: сегодня/завтра/неделя
  initHomeEvents();
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

  hostEl.innerHTML = lines.map(x => {
  const s = String(x.name || "");

  // 1) Берём префикс "DD.MM HH:MM"
  // 2) Всё остальное считаем названием
  // 3) Ставим ОДИН пробел между ними
  const fixedName = s.replace(
    /^(\d{2}\.\d{2}\s+\d{1,2}:\d{2})\s*(.*)$/,
    (m, prefix, rest) => rest ? `${prefix} ${rest}` : prefix
  );

  return `<div style="margin-bottom:8px;">
    <strong>${escapeHtml(fixedName)}</strong><br>
    <span>${escapeHtml(x.text)}</span>
  </div>`;
}).join("");

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

  const toMin = (t) => {
    const m = String(t||"").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1])*60 + Number(m[2]);
  };

  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();
  const nowStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  try {
    const target = addDays(new Date(), dayOffset);
    const ddmmyyyy = toDDMMYYYY(target);

    // грузим ОДИН раз
    const res = await fetch(`${RESERVATION_API_URL}?action=getByDate&date=${encodeURIComponent(ddmmyyyy)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Reservation load error");

    const data = Array.isArray(json.data) ? json.data : [];

    const rows = data.map(it => {
      const time = String(it.time || "").trim();
      const min = toMin(time);
      const guests = parseInt(String(it.guests ?? "").replace(/[^\d]/g,""), 10) || 0;

      const src = String(it.source || it.Source || it.SOURCE || it.from || "").trim();
      const isQuandoo = /quandoo/i.test(src);
      const badge = isQuandoo ? "Quandoo" : "ручн.";

      const status = String(it.status || it.STATUS || "").toLowerCase().trim();
      const cancelled = status === "cancelled" || status === "canceled" || String(it.cancelled||"").toLowerCase()==="true";

      return { time, min, guests, badge, isQuandoo, cancelled };
    }).filter(r => r.min !== null).sort((a,b)=>a.min-b.min);

    if (!rows.length){
      guestsEl.textContent = "0";
      timesEl.textContent = "Немає резервацій";
      return;
    }

    const active = rows.filter(r=>!r.cancelled);
    const totalGuests = active.reduce((s,r)=>s+r.guests,0);
    const manualCount = active.filter(r=>!r.isQuandoo).length;
    const quandooCount = active.filter(r=>r.isQuandoo).length;
    const manualGuests = active.filter(r=>!r.isQuandoo).reduce((s,r)=>s+r.guests,0);
    const quandooGuests = active.filter(r=>r.isQuandoo).reduce((s,r)=>s+r.guests,0);
    const cancelledCount = rows.filter(r=>r.cancelled).length;

    guestsEl.textContent = String(totalGuests);

    const renderRow = (r, past) => {
      const cls = ["mini-res-row", past ? "is-past" : "", r.cancelled ? "is-cancelled" : ""].filter(Boolean).join(" ");
      const badgeCls = r.isQuandoo ? "bq" : "bm";
      const cancelTag = r.cancelled ? `<span class="mini-res-cancel">скасовано</span>` : "";
      return `
        <div class="${cls}">
          <span class="mini-res-time">${escapeHtml(r.time)}</span>
          <span class="mini-res-guests">${r.guests}</span>
          <span class="mini-res-badge ${badgeCls}">${r.badge}</span>
          ${cancelTag}
        </div>
      `;
    };

    const sub = `
      <div class="mini-sub">
        резервації: ${manualCount} ручн. / ${quandooCount} Quandoo · гості: ${manualGuests} / ${quandooGuests}
        ${cancelledCount ? `<span class="mini-sub--cancel"> · скасовано: ${cancelledCount}</span>` : ""}
      </div>
    `;

    const nowLine = `
      <div class="mini-now">
        <span class="mini-now-dot"></span><span class="mini-now-line"></span><span class="mini-now-time">${nowStr}</span>
      </div>
    `;

    // состояние (в data-атрибуте), чтобы не городить глобальные переменные
    const stateKey = dayOffset === 0 ? "expandedToday" : "expandedTomorrow";
    const initialExpanded = timesEl.dataset[stateKey] === "1";

    // ===== helpers build HTML =====
    const buildFullTodayHtml = () => {
      const splitIdx = rows.findIndex(r => r.min > nowMin);
      if (splitIdx === -1) {
        return rows.map(r => renderRow(r, true)).join("") + nowLine;
      } else if (splitIdx === 0) {
        return nowLine + rows.map(r => renderRow(r, false)).join("");
      } else {
        return rows.slice(0, splitIdx).map(r => renderRow(r, true)).join("") +
               nowLine +
               rows.slice(splitIdx).map(r => renderRow(r, false)).join("");
      }
    };

    const buildCollapsedTodayHtml = () => {
      const past = rows.filter(r => r.min <= nowMin);
      const future = rows.filter(r => r.min > nowMin);

      const pastTop = past.slice(-2);      // 2 серых
      const futureTop = future.slice(0, 5); // 5 будущих

      return pastTop.map(r => renderRow(r, true)).join("") +
             nowLine +
             futureTop.map(r => renderRow(r, false)).join("");
    };

    const buildTomorrowHtml = (expanded) => {
      if (expanded) return rows.map(r => renderRow(r, false)).join("");
      return rows.slice(0, 6).map(r => renderRow(r, false)).join("");
    };

    const hasMore =
      (dayOffset === 0)
        ? rows.length > (rows.filter(r=>r.min<=nowMin).slice(-2).length + rows.filter(r=>r.min>nowMin).slice(0,5).length)
        : rows.length > 6;

    // ===== render (NO FETCH on toggle) =====
    function render(expanded){
      let listHtml = "";
      if (dayOffset === 0) listHtml = expanded ? buildFullTodayHtml() : buildCollapsedTodayHtml();
      else listHtml = buildTomorrowHtml(expanded);

      const btn = hasMore ? `
        <button class="mini-res-btn mini-res-toggle" type="button">
          ${expanded ? "Згорнути" : "Показати всі"}
        </button>
      ` : "";

      timesEl.innerHTML = sub + listHtml + btn;

      const toggleBtn = timesEl.querySelector(".mini-res-toggle");
      if (!toggleBtn) return;

      // не даём родительской <a> перехватывать клик
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nextExpanded = !expanded;
        timesEl.dataset[stateKey] = nextExpanded ? "1" : "0";
        render(nextExpanded); // мгновенно
      }, { passive:false });
    }

    render(initialExpanded);

  } catch (e) {
    console.error(e);
    guestsEl.textContent = "—";
    timesEl.textContent = "Помилка завантаження";
  }
}
/* =========================
   SCHEDULE (today/tomorrow) — roles only
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
        const dueStr = formatDueHuman_(t.due);
        const due = dueStr ? `⏳ ${escapeHtml(dueStr)}` : "⏳ без строку";
        const who = String(t.assignee || "").trim();

        return `
          <div class="task-row" style="padding:10px; cursor:pointer;" onclick="location.href='tasks.html'">
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
   HOME EVENTS (Today / Tomorrow / Week)
========================= */

function initHomeEvents(){
  const buttons = document.querySelectorAll(".btn-ev");
  if (!buttons.length) return;

  buttons.forEach(b => b.addEventListener("click", () => {
    buttons.forEach(x => x.classList.remove("btn--active"));
    b.classList.add("btn--active");
    loadHomeEvents(b.dataset.range);
  }));

  loadHomeEvents("today");
}

async function loadHomeEvents(range){
  const list = document.getElementById("eventsList");
  if (!list) return;

  list.textContent = "Завантаження…";

  try{
    const res = await fetch(CALENDAR_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "gcal_events", range })
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Помилка календаря");

    const items = Array.isArray(json.events) ? json.events : [];
    if (!items.length){
      list.innerHTML = `<div style="color:#6b7280;font-weight:800;">Немає подій</div>`;
      return;
    }

    list.innerHTML = items.map(renderEventRow_).join("");
  } catch(e){
    console.error(e);
    list.innerHTML = `<div style="color:#b91c1c;font-weight:900;">Помилка: ${escapeHtml(e.message||String(e))}</div>`;
  }
}

function renderEventRow_(e){
  const title = escapeHtml(e.summary || "(без назви)");
  const time = formatEventTime_(e);
  const loc = e.location ? `<div class="event-meta">${escapeHtml(e.location)}</div>` : "";

  return `
    <div class="event-row">
      <div class="event-time">${escapeHtml(time)}</div>
      <div>
        <div class="event-title">${title}</div>
        ${loc}
      </div>
    </div>
  `;
}

function formatEventTime_(e){
  if (!e.start) return "";
  const d = new Date(e.start);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");

  if (e.allDay) return `${dd}.${mm} (весь день)`;

  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}.${mm} ${hh}:${mi}`;
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

function formatDueHuman_(due){
  if (!due) return "";
  const s = String(due).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
  }
  return s;
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
