// mini_events.js — показывает 3 колонки: Сьогодні / Завтра / Цього тижня
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

    // GET надёжнее, чем POST для WebApp
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
  const cls  = (type === "birthday") ? "mini-event mini-event--bday" : "mini-event mini-event--holiday";

  const title = cleanTitle_(String(e.summary || "(без назви)"));
  const prefix = compactForDay ? formatMiniPrefixCompact_(e) : formatMiniPrefixFull_(e);

  return `<div class="${cls}">
    <span class="mini-event__time">${escapeHtml_(prefix)}</span>
    <span class="mini-event__title">${escapeHtml_(title)}</span>
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
  // для Сьогодні/Завтра:
  // - allDay => "весь день"
  // - timed  => "HH:MM"
  if (!e || !e.start) return "";
  if (e.allDay) return "весь день";
  const d = new Date(e.start);
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mi}`;
}

function formatMiniPrefixFull_(e){
  // для Тижня: "Пн 27.12" или "Пн 27.12 18:30"
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