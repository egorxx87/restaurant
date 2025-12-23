const ICS_PROXY =
  "https://script.google.com/macros/s/AKfycbx2ZDz7sugW-psw3kpx4GdaM-u9vdhjQUDGrlsR6YBsz_ZFPIQjcgHio2DAHiS7MBdn/exec";

// чтобы не было +1 час сюрпризов
const CAL_TZ = "local";

const titleEl = document.getElementById("calTitle");
const btnPrev = document.getElementById("calPrev");
const btnNext = document.getElementById("calNext");
const viewSel = document.getElementById("viewSelect");

const modeToView = { WEEK: "timeGridWeek", MONTH: "dayGridMonth" };

function titleLikeGoogle(date){
  const s = date.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchIcsText(){
  const url = new URL(ICS_PROXY);
  url.searchParams.set("_ts", String(Date.now()));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
  return await res.text();
}

// стабильный цвет по названию -> используем как "точку" в месяце
function dotColorFromTitle(title){
  const s = String(title || "").toLowerCase();
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 55%)`; // как google-ish dots
}

// для WEEK оставляем пастельную плашку
function pastelFromTitle(title){
  const s = String(title || "").toLowerCase();
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { bg: `hsl(${hue} 70% 86%)`, text: `hsl(${hue} 65% 18%)` };
}

async function fetchEventsFromIcs(){
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

    const dot = dotColorFromTitle(title);
    const pastel = pastelFromTitle(title);

    events.push({
      title,
      start,
      end,
      allDay: false,
      // week style
      backgroundColor: pastel.bg,
      borderColor: pastel.bg,
      textColor: pastel.text,
      // month dot style via extendedProps
      extendedProps: { dotColor: dot }
    });
  }
  return events;
}

function slotLabelContentUkAMPM(arg){
  const h24 = arg.date.getHours();
  const isAM = h24 < 12;
  const h12 = ((h24 + 11) % 12) + 1;
  return { html: `${h12}<span class="ampm">${isAM ? "дп" : "пп"}</span>` };
}

function dayHeaderContent(arg){
  const d = arg.date;
  const wd = d.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
  const day = d.getDate();
  return { html: `<span style="color:#5f6368;font-weight:500;font-size:12px">${wd}, ${day}</span>` };
}

// ✅ "сейчас выбранный день" как у Google (синий кружок)
function setSelectedDay(calendar){
  const d = calendar.getDate(); // текущая дата фокуса (то, что выделяется)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const iso = `${y}-${m}-${day}`;

  document.querySelectorAll(".fc-daygrid-day").forEach(el => el.classList.remove("fc-day-selected"));
  const cell = document.querySelector(`.fc-daygrid-day[data-date="${iso}"]`);
  if (cell) cell.classList.add("fc-day-selected");
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("calendar");
  if (!el) return;

  const calendar = new FullCalendar.Calendar(el, {
    timeZone: CAL_TZ,
    locale: "ru",
    firstDay: 1,
    initialView: modeToView.MONTH,   // как на твоём фото — месяц
    headerToolbar: false,

    nowIndicator: true,
    height: "auto",
    expandRows: true,
    stickyHeaderDates: true,
    dayMaxEvents: true,

    allDaySlot: false,

    slotMinTime: "10:00:00",
    slotMaxTime: "23:00:00",
    slotDuration: "00:30:00",
    slotLabelInterval: "01:00",
    slotLabelContent: slotLabelContentUkAMPM,

    displayEventEnd: false,

    views: {
      timeGridWeek: { dayHeaderContent },
      dayGridMonth: { dayHeaderFormat: { weekday: "short" } }
    },

    // month dot: прокидываем --dot-color в событие
    eventDidMount: (info) => {
      const dot = info.event.extendedProps?.dotColor;
      if (dot && info.el) {
        info.el.style.setProperty("--dot-color", dot);
      }
    },

    events: async (_info, success) => {
      try { success(await fetchEventsFromIcs()); }
      catch (e) { console.error("ICS ERROR:", e); success([]); }
    },

    datesSet: (arg) => {
      const base = (arg.view.type === "dayGridMonth") ? arg.view.currentStart : calendar.getDate();
      if (titleEl) titleEl.textContent = titleLikeGoogle(base);
      if (viewSel) viewSel.value = (arg.view.type === "dayGridMonth") ? "MONTH" : "WEEK";

      // выделение выбранного дня
      setTimeout(() => setSelectedDay(calendar), 0);
    },

    dateClick: () => {
      // после клика — обновить выделение
      setTimeout(() => setSelectedDay(calendar), 0);
    }
  });

  calendar.render();
  setSelectedDay(calendar);

  if (btnPrev) btnPrev.onclick = () => { calendar.prev(); setTimeout(() => setSelectedDay(calendar), 0); };
  if (btnNext) btnNext.onclick = () => { calendar.next(); setTimeout(() => setSelectedDay(calendar), 0); };

  if (viewSel) {
    viewSel.onchange = () => {
      calendar.changeView(modeToView[viewSel.value]);
      setTimeout(() => setSelectedDay(calendar), 0);
    };
  }
});