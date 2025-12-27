// mini_events.js — 3 колонки: Сьогодні / Завтра / Цього тижня
// backend: WebApp action=gcal_events&range=today|tomorrow|week
// response: { ok:true, events:[{summary,start,allDay,calendarType}] }

const MINI_CALENDAR_API_URL =
  "https://script.google.com/macros/s/AKfycbw-yTbvyKAw8cO6j2dkopRYbGx5aHCB7nAxcG8M5yXAKGGLL8plNe9hUkiPO86LmZTD2A/exec";

document.addEventListener("DOMContentLoaded", () => {
  loadMiniEventsAll_();
});

async function loadMiniEventsAll_(){
  await Promise.all([
    loadMiniEventsInto_("today", "miniEventsToday", 6, true),
    loadMiniEventsInto_("tomorrow", "miniEventsTomorrow", 6, true),
    loadMiniEventsInto_("week", "miniEventsWeek", 10, false),
  ]);
}

async function loadMiniEventsInto_(range, elementId, limit, compactForDay){
  const box = document.getElementById(elementId);
  if (!box) return;

  box.textContent = "Завантаження…";

  try{
    const url = `${MINI_CALENDAR_API_URL}?action=gcal_events&range=${encodeURIComponent(range)}&_=${Date.now()}`;

    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const text = await res.text();

    let json;
    try { json = JSON.parse(text); }
    catch (_) {
      console.error("Non-JSON response:", text.slice(0, 400));
      throw new Error("WebApp повернув не JSON (деплой/доступ/помилка).");
    }

    if (!json.ok) throw new Error(json.error || "calendar error");

    const events = Array.isArray(json.events) ? json.events : [];
    if (!events.length){
      box.innerHTML = `<span class="mini-events__empty">Немає подій</span>`;
      return;
    }

    const top = events.slice(0, limit);
    const more = events.length - top.length;

    box.innerHTML =
      top.map(e => renderMiniItem_(e, compactForDay)).join("") +
      (more > 0 ? `<div class="mini-events__more">+ ще ${more}…</div>` : "");
  } catch(e){
    console.error(e);
    box.innerHTML = `<span class="mini-events__error">Помилка завантаження</span>`;
  }
}

function renderMiniItem_(e, compactForDay){
  const type = String(e.calendarType || "").toLowerCase();
  const isBday = type === "birthday";

  const cls = isBday
    ? "mini-event mini-event--bday"
    : "mini-event mini-event--holiday";

  const title = cleanTitle_(String(e.summary || "(без назви)"));
  const prefix = compactForDay ? formatMiniPrefixCompact_(e) : formatMiniPrefixFull_(e);

  const badge = isBday ? "ДР" : "Свято";

  return `<div class="${cls}">
    <span class="mini-event__time">${escapeHtml_(prefix)}</span>
    <span class="mini-event__title">${escapeHtml_(title)}</span>
    <span class="mini-event__badge">${badge}</span>
  </div>`;
}

function cleanTitle_(s){
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/^Geburtstag:\s*/i, "")
    .replace(/^Birthday:\s*/i, "")
    .trim();
}

function formatMiniPrefixCompact_(e){
  if (!e || !e.start) return "";
  if (e.allDay) return "весь день";
  const d = new Date(e.start);
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mi}`;
}

function formatMiniPrefixFull_(e){
  if (!e || !e.start) return "";
  const d = new Date(e.start);

  const wdArr = ["Нд","Пн","Вт","Ср","Чт","Пт","Сб"];
  const wd = wdArr[d.getDay()] || "";

  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");

  if (e.allDay) return `${wd} ${dd}.${mm}`;

  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${wd} ${dd}.${mm} ${hh}:${mi}`;
}

function escapeHtml_(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
window.taLineCb = function(d){
  const el = document.getElementById("taLine");
  if(!el) return;

  if(!d || !d.ok){
    el.innerHTML = `<span class="muted">TA недоступний</span>`;
    return;
  }

  const r = Number(d.rating);
  const n = Number(d.reviewsCount);
  const isNum = (x) => Number.isFinite(x);

  function needed5(r,n,t){
    if(!isNum(r)||!isNum(n)||!isNum(t)) return null;
    if(t>=5) return null;
    if(r>=t) return 0;
    return Math.ceil(((t-r)*n)/(5-t));
  }

  function pct(r,t){
    if(!isNum(r)||!isNum(t)||t<=0) return null;
    return Math.max(0, Math.min(100, Math.round((r/t)*100)));
  }

  function color(r,t){
    const delta = t-r;
    if(delta<=0.10) return "green";
    if(delta<=0.30) return "yellow";
    return "red";
  }

  const badge = `
    <span class="ta-badge" title="TripAdvisor">
      <span class="ta-badge__icon">TA</span>
      <span class="ta-badge__text">Trip</span>
    </span>
  `;

  const parts = [];
  if(isNum(r)) parts.push(`⭐${r}`);
  if(isNum(n)) parts.push(`📝${n}`);
  if(d.rankingText) parts.push(`🏆${d.rankingText}`);

  const targets = [4.3,4.5,4.7];
  const chips = targets.map(t=>{
    const k = needed5(r,n,t);
    const p = pct(r,t);
    const c = color(r,t);

    // супер коротко:
    // "4.5 ≈209" + "89%" (проценты спрячутся на мобиле CSS-ом)
    const left = (k===0) ? `${t} ✓` : `${t} ≈${k}`;
    const right = (p==null) ? "" : `<span class="ta-chip__pct">${p}%</span>`;
    return `<span class="ta-chip ta-chip--${c}">${left} ${right}</span>`;
  }).join(" ");

  const sep = `<span class="ta-sep">·</span>`;
  el.innerHTML = [badge, parts.join(` ${sep} `), chips].join(` ${sep} `);
};// ===== TripAdvisor compact line (no %, colored targets, green "T" logo) =====
(function () {
  const TA_WEBAPP =
    "https://script.google.com/macros/s/AKfycbxXfbBfEcrEVg3-gzA5CIeheUQTUbwbtTx5ej_mezADlUKsX00Glpj-Sc9OFiYePH1U/exec";

  const TARGETS = [4.3, 4.5, 4.7];

  const el = document.getElementById("taLine");
  if (!el) return;

  // helpers
  const isNum = (x) => Number.isFinite(x);

  function needed5Stars(r, n, t) {
    if (!isNum(r) || !isNum(n) || !isNum(t)) return null;
    if (t >= 5) return null;
    if (r >= t) return 0;
    return Math.ceil(((t - r) * n) / (5 - t));
  }

  // color by how far target is from current rating
  function targetColorClass(r, t) {
    const delta = t - r;
    if (delta <= 0) return "ta-num--green";     // already reached
    if (delta <= 0.10) return "ta-num--green";  // close
    if (delta <= 0.30) return "ta-num--yellow"; // medium
    return "ta-num--red";                       // far
  }

  function extractRankCompact(text) {
    // -> "#667/5796"
    if (!text) return null;
    const m = String(text).match(/(\d{1,4})\D+([\d\s,]{3,10})/);
    if (!m) return null;
    const rank = m[1];
    const total = m[2].replace(/[^\d]/g, "");
    if (!rank || !total) return null;
    return `#${rank}/${total}`;
  }

  // 1) callback must exist BEFORE script loads
  window.taLineCb = function (d) {
    if (!d || !d.ok) {
      el.innerHTML = `<span class="ta-muted">TripAdvisor недоступний</span>`;
      return;
    }

    const r = Number(d.rating);
    const n = Number(d.reviewsCount);

    const badge = `
      <span class="ta-badge" title="TripAdvisor">
        <span class="ta-badge__icon">T</span>
      </span>
    `;

    const sep = `<span class="ta-sep">·</span>`;

    const parts = [];
    if (isNum(r)) parts.push(`<span class="ta-item">⭐ ${r.toFixed(1)}</span>`);
    if (isNum(n)) parts.push(`<span class="ta-item">📝 ${n}</span>`);

    // ranking compact "#667/5796"
    const rankCompact = extractRankCompact(d.rankingText);
    if (rankCompact) parts.push(`<span class="ta-item ta-rank">🏆 ${rankCompact}</span>`);

    // targets: "4.5 ≈209"
    const chips = TARGETS.map((t) => {
      const k = needed5Stars(r, n, t);
      const cls = targetColorClass(r, t);

      const text =
        k === 0 ? `${t} ✓` :
        (k == null ? `${t} —` : `${t} ≈${k}`);

      return `<span class="ta-num ${cls}">${text}</span>`;
    }).join(` ${sep} `);

    el.innerHTML = [
      badge,
      parts.join(` ${sep} `),
      chips
    ].filter(Boolean).join(` ${sep} `);
  };

  // 2) load JSONP
  const s = document.createElement("script");
  s.src = `${TA_WEBAPP}?action=tripadvisor&callback=taLineCb&_=${Date.now()}`;
  s.onerror = () => {
    el.innerHTML = `<span class="ta-muted">TripAdvisor load error</span>`;
  };
  document.body.appendChild(s);
})();
// ===== TripAdvisor compact line (no %, colored targets, green "T" logo) =====
(function () {
  const TA_WEBAPP =
    "https://script.google.com/macros/s/AKfycbxXfbBfEcrEVg3-gzA5CIeheUQTUbwbtTx5ej_mezADlUKsX00Glpj-Sc9OFiYePH1U/exec";

  const TARGETS = [4.3, 4.5, 4.7];

  const el = document.getElementById("taLine");
  if (!el) return;

  // helpers
  const isNum = (x) => Number.isFinite(x);

  function needed5Stars(r, n, t) {
    if (!isNum(r) || !isNum(n) || !isNum(t)) return null;
    if (t >= 5) return null;
    if (r >= t) return 0;
    return Math.ceil(((t - r) * n) / (5 - t));
  }

  // color by how far target is from current rating
  function targetColorClass(r, t) {
    const delta = t - r;
    if (delta <= 0) return "ta-num--green";     // already reached
    if (delta <= 0.10) return "ta-num--green";  // close
    if (delta <= 0.30) return "ta-num--yellow"; // medium
    return "ta-num--red";                       // far
  }

  function extractRankCompact(text) {
    // -> "#667/5796"
    if (!text) return null;
    const m = String(text).match(/(\d{1,4})\D+([\d\s,]{3,10})/);
    if (!m) return null;
    const rank = m[1];
    const total = m[2].replace(/[^\d]/g, "");
    if (!rank || !total) return null;
    return `#${rank}/${total}`;
  }

  // 1) callback must exist BEFORE script loads
  window.taLineCb = function (d) {
    if (!d || !d.ok) {
      el.innerHTML = `<span class="ta-muted">TripAdvisor недоступний</span>`;
      return;
    }

    const r = Number(d.rating);
    const n = Number(d.reviewsCount);

    const badge = `
      <span class="ta-badge" title="TripAdvisor">
        <span class="ta-badge__icon">T</span>
      </span>
    `;

    const sep = `<span class="ta-sep">·</span>`;

    const parts = [];
    if (isNum(r)) parts.push(`<span class="ta-item">⭐ ${r.toFixed(1)}</span>`);
    if (isNum(n)) parts.push(`<span class="ta-item">📝 ${n}</span>`);

    // ranking compact "#667/5796"
    const rankCompact = extractRankCompact(d.rankingText);
    if (rankCompact) parts.push(`<span class="ta-item ta-rank">🏆 ${rankCompact}</span>`);

    // targets: "4.5 ≈209"
    const chips = TARGETS.map((t) => {
      const k = needed5Stars(r, n, t);
      const cls = targetColorClass(r, t);

      const text =
        k === 0 ? `${t} ✓` :
        (k == null ? `${t} —` : `${t} ≈${k}`);

      return `<span class="ta-num ${cls}">${text}</span>`;
    }).join(` ${sep} `);

    el.innerHTML = [
      badge,
      parts.join(` ${sep} `),
      chips
    ].filter(Boolean).join(` ${sep} `);
  };

  // 2) load JSONP
  const s = document.createElement("script");
  s.src = `${TA_WEBAPP}?action=tripadvisor&callback=taLineCb&_=${Date.now()}`;
  s.onerror = () => {
    el.innerHTML = `<span class="ta-muted">TripAdvisor load error</span>`;
  };
  document.body.appendChild(s);
})();