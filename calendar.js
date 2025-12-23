/************************************************
 * Google-like (FullCalendar) — Monday first ✅
 * Events from .ics via your Apps Script proxy ✅
 ************************************************/

const ICS_URL =
  "https://script.google.com/macros/s/AKfycbx2ZDz7sugW-psw3kpx4GdaM-u9vdhjQUDGrlsR6YBsz_ZFPIQjcgHio2DAHiS7MBdn/exec";

const TZ = "Europe/Vienna";

// UI
const titleEl   = document.getElementById("calTitle");
const btnToday  = document.getElementById("calToday");
const btnPrev   = document.getElementById("calPrev");
const btnNext   = document.getElementById("calNext");
const viewSel   = document.getElementById("viewSelect");
const tzBadge   = document.getElementById("tzBadge");

let currentMode = "WEEK";
const modeToView = { DAY:"timeGridDay", WEEK:"timeGridWeek", MONTH:"dayGridMonth" };

function fmtTitle(date, viewType){
  // Google shows month name in title on week view too (e.g., "Грудень 2025")
  // Сделаем: для MONTH — месяц+год, для WEEK/DAY — тоже месяц+год (как у тебя на скрине)
  const opts = { month:"long", year:"numeric" };
  return date.toLocaleDateString("ru-RU", opts).replace(/^\w/, c => c.toUpperCase());
}

function gmtBadgeForVienna(){
  // простой вариант: выводим GMT+01/ GMT+02 по текущей дате (лето/зима)
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" });
  const part = fmt.formatToParts(d).find(p => p.type === "timeZoneName")?.value || "GMT+01";
  return part.replace("GMT", "GMT");
}

async function fetchIcsText(){
  const url = new URL(ICS_URL);
  url.searchParams.set("_ts", String(Date.now()));
  const res = await fetch(url.toString(), { cache:"no-store" });
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
  return await res.text();
}

function pastelColorFromTitle(title){
  // чтобы было ближе к Google: пастельная заливка + тёмный текст
  // (стабильно по названию события)
  const s = String(title || "").toLowerCase();
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const bg = `hsl(${hue} 70% 85%)`;     // pastel
  const text = `hsl(${hue} 60% 20%)`;   // readable dark
  return { bg, text };
}

async function fetchIcsEvents(){
  const text = await fetchIcsText();
  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent") || [];

  const events = [];
  for (const ve of vevents){
    const ev = new ICAL.Event(ve);
    const title = ev.summary || "(Без назви)";
    const start = ev.startDate.toJSDate();
    const end = ev.endDate ? ev.endDate.toJSDate() : new Date(start.getTime() + 30*60*1000);

    const c = pastelColorFromTitle(title);

    events.push({
      title,
      start,
      end,
      allDay: ev.startDate.isDate === true,
      backgroundColor: c.bg,
      borderColor: c.bg,
      textColor: c.text
    });
  }
  return events;
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("calendar");
  if (!el) return;

  if (tzBadge) tzBadge.textContent = gmtBadgeForVienna();

  const calendar = new FullCalendar.Calendar(el, {
    timeZone: TZ,
    locale: "ru",              // чтобы дни/месяцы были как на твоём скрине
    firstDay: 1,               // ✅ ПН всегда
    initialView: modeToView[currentMode],
    headerToolbar: false,

    nowIndicator: true,
    height: "auto",
    expandRows: true,
    stickyHeaderDates: true,
    dayMaxEvents: true,

    allDaySlot: true,
    slotMinTime: "10:00:00",   // как на твоём скрине (можешь поменять)
    slotMaxTime: "23:00:00",
    slotDuration: "00:30:00",
    slotLabelInterval: "01:00",
    slotLabelFormat: { hour:"numeric", minute:"2-digit", hour12:false },
    eventTimeFormat: { hour:"numeric", minute:"2-digit", hour12:false },
    displayEventEnd: false,

    views: {
      timeGridWeek: { dayHeaderFormat: { weekday:"short", day:"numeric" } },
      timeGridDay:  { dayHeaderFormat: { weekday:"long", day:"numeric", month:"long" } },
      dayGridMonth: { dayHeaderFormat: { weekday:"short" } }
    },

    events: async (_info, success) => {
      try {
        success(await fetchIcsEvents());
      } catch (e) {
        console.error("ICS ERROR:", e);
        success([]);
      }
    },

    datesSet: (arg) => {
      const base = (arg.view.type === "dayGridMonth") ? arg.view.currentStart : calendar.getDate();
      if (titleEl) titleEl.textContent = fmtTitle(base, arg.view.type);

      // sync select with view
      if (viewSel) {
        const mode =
          arg.view.type === "timeGridDay" ? "DAY" :
          arg.view.type === "timeGridWeek" ? "WEEK" :
          "MONTH";
        viewSel.value = mode;
        currentMode = mode;
      }
    }
  });

  calendar.render();

  // header buttons
  btnToday && (btnToday.onclick = () => calendar.today());
  btnPrev  && (btnPrev.onclick  = () => calendar.prev());
  btnNext  && (btnNext.onclick  = () => calendar.next());

  // view dropdown
  if (viewSel) {
    viewSel.onchange = () => {
      currentMode = viewSel.value;
      calendar.changeView(modeToView[currentMode]);
    };
  }
});