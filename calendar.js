/************************************************
 * Site Calendar (FullCalendar) — Monday first ✅
 * Source: public Google Calendar .ics
 ************************************************/

const ICS_URL =
  "https://calendar.google.com/calendar/ical/6742dec31885f193eab81207d89631f07d394186e0f23e140d66b6de4746da39%40group.calendar.google.com/public/basic.ics";

const TZ = "Europe/Vienna";

// ====== UI ======
const titleEl = document.getElementById("calTitle");
const btnToday = document.getElementById("calToday");
const btnPrev = document.getElementById("calPrev");
const btnNext = document.getElementById("calNext");
const modeButtons = document.querySelectorAll(".btn-mode");

let currentMode = "WEEK"; // DAY | WEEK | MONTH

const modeToView = {
  DAY: "timeGridDay",
  WEEK: "timeGridWeek",
  MONTH: "dayGridMonth"
};

function setActiveModeButton(){
  modeButtons.forEach(btn=>{
    btn.classList.toggle("btn--active", btn.dataset.mode === currentMode);
  });
}

function fmtTitle(date, viewType){
  const isMonth = viewType === "dayGridMonth";
  const opts = isMonth
    ? { month: "long", year: "numeric" }
    : { day: "2-digit", month: "long", year: "numeric" };
  return date.toLocaleDateString("uk-UA", opts);
}

// ====== ICS loader ======
async function fetchIcsEvents(info){
  const res = await fetch(ICS_URL, { cache: "no-store" });
  const text = await res.text();

  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent") || [];

  const events = [];
  for (const ve of vevents){
    const ev = new ICAL.Event(ve);
    const start = ev.startDate.toJSDate();
    const end = ev.endDate
      ? ev.endDate.toJSDate()
      : new Date(start.getTime() + 30 * 60 * 1000);

    events.push({
      title: ev.summary || "(Без назви)",
      start,
      end,
      allDay: ev.startDate.isDate === true
    });
  }
  return events;
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("calendar");

  const calendar = new FullCalendar.Calendar(el, {
    timeZone: TZ,
    locale: "uk",
    firstDay: 1, // ✅ ПОНЕДІЛОК
    initialView: modeToView[currentMode],
    nowIndicator: true,
    height: "auto",
    headerToolbar: false,

    events: async (info, success) => {
      try {
        success(await fetchIcsEvents(info));
      } catch (e) {
        console.error(e);
        success([]);
      }
    },

    datesSet: (arg) => {
      const base =
        arg.view.type === "dayGridMonth"
          ? arg.view.currentStart
          : calendar.getDate();
      titleEl.textContent = fmtTitle(base, arg.view.type);
    }
  });

  calendar.render();

  btnToday.onclick = () => calendar.today();
  btnPrev.onclick = () => calendar.prev();
  btnNext.onclick = () => calendar.next();

  modeButtons.forEach(btn => {
    btn.onclick = () => {
      currentMode = btn.dataset.mode;
      setActiveModeButton();
      calendar.changeView(modeToView[currentMode]);
    };
  });

  setActiveModeButton();
});