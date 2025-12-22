/************************************************
 * Google Calendar — iframe controller
 * Режимы: День / Тиждень / Місяць
 * Навигация: Сегодня / ← →
 ************************************************/

/**
 * ВАЖНО:
 * Это src из Google Calendar → Integrate calendar → Embed code
 * ВСТАВЛЕН УЖЕ ТВОЙ URL
 */
const BASE_EMBED_URL =
  "https://calendar.google.com/calendar/embed?src=6742dec31885f193eab81207d89631f07d394186e0f23e140d66b6de4746da39%40group.calendar.google.com&ctz=Europe%2FVienna";

// ====== STATE ======
let currentDate = new Date();
let currentMode = "WEEK"; // DAY | WEEK | MONTH

// ====== ELEMENTS ======
const iframe = document.getElementById("gcal-iframe");
const titleEl = document.getElementById("calTitle");
const btnToday = document.getElementById("calToday");
const btnPrev = document.getElementById("calPrev");
const btnNext = document.getElementById("calNext");
const modeButtons = document.querySelectorAll(".btn-mode");

// ====== EVENTS ======
if (btnToday) {
  btnToday.addEventListener("click", () => {
    currentDate = new Date();
    updateCalendar();
  });
}

if (btnPrev) {
  btnPrev.addEventListener("click", () => {
    shiftDate(-1);
    updateCalendar();
  });
}

if (btnNext) {
  btnNext.addEventListener("click", () => {
    shiftDate(1);
    updateCalendar();
  });
}

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentMode = btn.dataset.mode;
    setActiveModeButton();
    updateCalendar();
  });
});

// ====== FUNCTIONS ======

function shiftDate(direction) {
  const d = new Date(currentDate);

  if (currentMode === "DAY") {
    d.setDate(d.getDate() + direction);
  } else if (currentMode === "WEEK") {
    d.setDate(d.getDate() + direction * 7);
  } else if (currentMode === "MONTH") {
    d.setMonth(d.getMonth() + direction);
  }

  currentDate = d;
}

function updateCalendar() {
  updateTitle();
  const src = buildIframeSrc();
  if (iframe && src) {
    iframe.src = src;
  }
}

function buildIframeSrc() {
  if (!BASE_EMBED_URL) return "";

  const url = new URL(BASE_EMBED_URL);

  // Режим отображения
  url.searchParams.set("mode", currentMode);

  // Дата (Google требует формат YYYYMMDD/YYYYMMDD)
  const dateStr = formatYMD(currentDate);
  url.searchParams.set("dates", `${dateStr}/${dateStr}`);

  // Скрываем лишнее (чистый вид)
  url.searchParams.set("showTitle", "0");
  url.searchParams.set("showNav", "0");
  url.searchParams.set("showDate", "0");
  url.searchParams.set("showPrint", "0");
  url.searchParams.set("showTabs", "0");
  url.searchParams.set("showCalendars", "0");

  return url.toString();
}

function updateTitle() {
  if (!titleEl) return;

  let options;

  if (currentMode === "MONTH") {
    options = { month: "long", year: "numeric" };
  } else {
    options = { day: "2-digit", month: "long", year: "numeric" };
  }

  titleEl.textContent = currentDate.toLocaleDateString("uk-UA", options);
}

function setActiveModeButton() {
  modeButtons.forEach(btn => {
    btn.classList.toggle("btn--active", btn.dataset.mode === currentMode);
  });
}

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ====== INIT ======
setActiveModeButton();
updateCalendar();