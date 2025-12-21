document.addEventListener("DOMContentLoaded", async () => {
  const SCHEDULE_API_URL =
    "https://script.google.com/macros/s/AKfycbw_uswtYYaimbBJytiHAdcwjbvv2rujyBt2Rrc9jlBHoYQ358F7vi8OvvQEhTptODNZ8g/exec";

  const MODE_DAY = "day";
  const MODE_WEEK = "week";
  const MODE_MONTH = "month";

  // Роли + список имён (для пикера)
  const ROLE_OPTIONS = {
    admin: ["Egor", "Karina", "Maxym"],
    kellner: ["Jane", "Mykola", "Zeindi", "Dima", "Vladyslav", "Karina", "Michi", "Egor"],
    kueche: ["Pavlo", "Tymur", "Hlib", "Oleksandr", "Vsevolod", "Danja", "Artur"],
    reinigung: ["Inna", "Tymur", "Oleksandr"]
  };

  // ✅ Нормальная палитра (приятные, читаемые)
  const COLOR_PRESETS = [
    "#34d399", "#22c55e", "#16a34a",
    "#60a5fa", "#3b82f6", "#2563eb",
    "#a78bfa", "#8b5cf6", "#7c3aed",
    "#f472b6", "#ec4899", "#db2777",
    "#fb923c", "#f97316", "#ea580c",
    "#fbbf24", "#f59e0b", "#d97706",
    "#94a3b8", "#64748b"
  ];

  // DOM
  const weekLabelEl = document.getElementById("schedule-week-label");
  const subLabelEl = document.getElementById("schedule-sub-label");
  const scheduleContentEl = document.getElementById("schedule-content");

  const prevBtn = document.getElementById("schedule-prev-period");
  const nextBtn = document.getElementById("schedule-next-period");
  const todayBtn = document.getElementById("schedule-today");

  const modeDayBtn = document.getElementById("mode-day");
  const modeWeekBtn = document.getElementById("mode-week");
  const modeMonthBtn = document.getElementById("mode-month");

  const openStatsBtn = document.getElementById("open-stats");
  const closeStatsBtn = document.getElementById("close-stats");
  const sectionSchedule = document.getElementById("section-schedule");
  const sectionStats = document.getElementById("section-stats");

  const loaderEl = document.getElementById("global-loader");
  const loaderTextEl = document.getElementById("global-loader-text");

  // Picker
  const pickerBackdrop = document.getElementById("picker-backdrop");
  const pickerRoleLabel = document.getElementById("picker-role-label");
  const pickerOptionsEl = document.getElementById("picker-options");
  const pickerClearBtn = document.getElementById("picker-clear");
  const pickerCustomBtn = document.getElementById("picker-custom");
  const pickerCancelBtn = document.getElementById("picker-cancel");

  // Stats
  const statsSummaryEl = document.getElementById("stats-summary");
  const statsTableEl = document.getElementById("stats-table");
  const statsMonthCurrentBtn = document.getElementById("stats-month-current");
  const statsMonthPrevBtn = document.getElementById("stats-month-prev");
  const statsRoleButtons = document.querySelectorAll("[data-stats-role]");

  // WEEK FILTER (кнопки ролей)
  const weekFilterEl = document.getElementById("week-filter");
  const weekCompactEl = document.getElementById("week-compact-view");

  // State
  let currentMode = MODE_DAY;
  let currentDate = new Date();
  let allRows = [];
  let currentRows = [];
  let pickerState = null;

  // ✅ Colors (shared for all users)
  let NAME_COLORS = {};

  const statsState = {
    activeSlot: "current",
    role: "all",
    data: null,
    monthLabels: {},
    slotMapping: { current: "current", previous: "previous" }
  };

  // ============ helpers ============
  function setLoading(on, text = "Загрузка…") {
    if (!loaderEl) return;
    loaderTextEl.textContent = text;
    loaderEl.classList.toggle("global-loader--hidden", !on);
    prevBtn.disabled = on;
    nextBtn.disabled = on;
    todayBtn.disabled = on;
    modeDayBtn.disabled = on;
    modeWeekBtn.disabled = on;
    modeMonthBtn.disabled = on;
    if (openStatsBtn) openStatsBtn.disabled = on;
  }
function toISODate_(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function shortName_(name){
  const n = String(name || "").trim();
  if (!n) return "";
  // если несколько слов — берём первое
  const first = n.split(/\s+/)[0];

  // правило сокращения как на скрине:
  // длинные имена -> первые 4 буквы, короткие -> как есть
  if (first.length >= 7) return first.slice(0, 4);
  if (first.length >= 6) return first.slice(0, 4);
  return first; // 1-5 символов оставляем
}
function timePretty_(t){
  const s = String(t || "");
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  return `${parseInt(m[1],10)}:${m[2]}`;
}
function hourShort_(t){
  const s = String(t || "");
  const m = s.match(/^(\d{1,2})/);
  return m ? String(parseInt(m[1],10)) : s;
}
  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatDate(d) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function formatMonthYear(d) {
    return `${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function getWeekdayName(d) {
    return d.toLocaleDateString("de-DE", { weekday: "long" });
  }

  function getDayStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function getWeekRange(d) {
    const start = getDayStart(d);
    const day = start.getDay();
    const diff = (day + 6) % 7; // Monday start
    start.setDate(start.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  function getMonthRange(d) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function parseISODate(str) {
    if (!str) return null;
    if (str instanceof Date) return new Date(str.getFullYear(), str.getMonth(), str.getDate());

    const s = String(str).trim();

    // yyyy-mm-dd
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    // dd.mm.yyyy
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

    const d = new Date(s);
    if (!isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate());

    return null;
  }

  function normalizeTime(raw) {
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

    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d)) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${pad2(parseInt(m[1], 10))}:${m[2]}`;

    return s;
  }

  function normalizeSlots(list, count) {
    const arr = Array.isArray(list) ? list.slice(0, count) : [];
    while (arr.length < count) arr.push("");
    return arr;
  }

  // ===== JSONP (для обхода CORS на GET) =====
  function jsonp(url) {
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

  // ✅ Load colors once (shared for all users)
  async function loadNameColors() {
    try {
      const data = await jsonp(`${SCHEDULE_API_URL}?action=get_colors`);
      NAME_COLORS = (data && typeof data === "object") ? data : {};
    } catch (e) {
      console.warn("Не удалось загрузить цвета:", e);
      NAME_COLORS = {};
    }
  }

  // ===== COLORS =====
  function hexToRgba_(hex, a){
  const h = String(hex).replace("#","").trim();
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function getColorForName(name) {
    if (!name) return null;

    const key = String(name).trim();
    const saved = NAME_COLORS[key];

    // если задан вручную — используем
    if (saved) {
  return { 
    bg: hexToRgba_(saved, 0.82),   // мягче
    border: saved                  // границу оставляем чёткой
  };
}

    // fallback
    const hue = hashString(key) % 360;
    return {
  bg: `hsla(${hue}, 70%, 82%, 0.82)`,
  border: `hsl(${hue}, 55%, 45%)`
};
  }

  function getPillStyleForName(name) {
    const c = getColorForName(name);
    if (!c) return "";
    return `background-color:${c.bg};color:#111827;--pill-border:${c.border};`;
  }

  // ===== POST no-cors =====
  function postNoCors(payload) {
    return fetch(SCHEDULE_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  async function saveNameColor(name, color) {
    const n = String(name || "").trim();
    const c = String(color || "").trim();
    if (!n || !c) return;

    try {
      await postNoCors({ action: "set_color", name: n, color: c });
    } catch (e) {
      console.warn("Не удалось сохранить цвет:", e);
    }

    NAME_COLORS[n] = c;
  }

  function getCurrentCellNameFromState(row, role, slot) {
    const obj = allRows.find(r => r.row === row);
    if (!obj) return "";
    const arr = obj[role] || [];
    return String(arr?.[slot] || "").trim();
  }

  // ===== pills HTML =====
  function pillsHtml(rowObj, list, role) {
    return list.map((name, slot) => {
      const hasName = name && String(name).trim() !== "";
      const text = hasName ? String(name).trim() : "";
      const extraClass = hasName ? "" : " schedule-pill-empty";
      const styleAttr = hasName ? ` style="${getPillStyleForName(text)}"` : "";

      const prev =
        rowObj.__prev &&
        rowObj.__prev[role] &&
        rowObj.__prev[role][slot] === text;

      const isStart = hasName && !prev;

      return `
        <span class="schedule-pill${extraClass}"
          data-row="${rowObj.row}"
          data-role="${role}"
          data-slot="${slot}"
          ${isStart ? 'data-start="1"' : ""}
          ${styleAttr}>
          ${isStart ? text : ""}
        </span>
      `;
    }).join("");
  }
// ===== Dynamic label fitting (shrink font, then truncate) =====
const _fitCanvas = document.createElement("canvas");
const _fitCtx = _fitCanvas.getContext("2d");

function _getFontForMeasure(el, fontSizePx){
  const cs = window.getComputedStyle(el);
  const weight = cs.fontWeight || "700";
  const family = cs.fontFamily || "system-ui";
  return `${weight} ${fontSizePx}px ${family}`;
}

function _measureTextPx(el, text, fontSizePx){
  _fitCtx.font = _getFontForMeasure(el, fontSizePx);
  return _fitCtx.measureText(text).width;
}

function fitLabelIntoEl(el, fullText, opts = {}){
  const {
    maxFont = 13,
    minFont = 4,
    minChars = 4,     // минимум букв, чтобы не было "пусто"
    padding = 4      // запас внутри плашки
  } = opts;

  const text = String(fullText || "").trim();
  if (!text) { el.textContent = ""; return; }

  // ширина доступная
  const w = Math.max(0, (el.clientWidth || 0) - padding);
  if (w <= 0) { el.textContent = text; return; }

  // 1) пробуем подобрать размер шрифта (binary search)
  let lo = minFont, hi = maxFont, best = minFont;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const mw = _measureTextPx(el, text, mid);
    if (mw <= w) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }

  el.style.fontSize = best + "px";
  el.textContent = text;

  // 2) если даже на minFont не помещается — режем буквы под ширину
  if (_measureTextPx(el, text, best) > w) {
    let s = text;
    // сначала одно слово (если несколько)
    const first = text.split(/\s+/)[0];
    s = first;

    // режем до влезания, но не меньше minChars
    while (s.length > minChars && _measureTextPx(el, s, best) > w) {
      s = s.slice(0, -1);
    }

    // если всё равно не влезает — оставляем minChars
    if (_measureTextPx(el, s, best) > w) {
      s = first.slice(0, minChars);
    }

    el.textContent = s;
  }
}

function applyDynamicLabels(root){
  const labels = root.querySelectorAll(".day-cell__label, .week-role-cell__label");
  labels.forEach(el => {
    const full = el.getAttribute("data-full") || el.getAttribute("title") || el.textContent || "";
    fitLabelIntoEl(el, full, { maxFont: 13, minFont: 4, minChars: 4, padding: 6 });
  });
}
  // ===== фиксированные часы 09..22 =====
  function getFixedTimes_() {
    const times = [];
    for (let h = 9; h <= 22; h++) times.push(`${pad2(h)}:00`);
    return times;
  }

  // ============ load & render ============
  async function loadScheduleForMonth(year, month) {
    const monthStr = `${year}-${pad2(month)}`;
    setLoading(true, `Загружаю расписание за ${monthStr}…`);
    weekLabelEl.textContent = `Месяц ${monthStr}`;
    subLabelEl.textContent = " ";

    try {
      const data = await jsonp(`${SCHEDULE_API_URL}?action=list&month=${monthStr}`);
      const rows = (data && data.rows) ? data.rows : [];

      allRows = rows.map((r) => {
        const rawDate = String(r.date || "").trim();
const dObj = parseISODate(rawDate);
const isoDay = dObj ? toISODate_(dObj) : "";

return {
  row: Number(r.row),
  date: isoDay,      // <-- ВАЖНО: теперь всегда YYYY-MM-DD
  dateObj: dObj,
  time: normalizeTime(r.time),
  admin: normalizeSlots(r.admin, 3),
  kellner: normalizeSlots(r.kellner, 4),
  kueche: normalizeSlots(r.kueche, 4),
  reinigung: normalizeSlots(r.reinigung, 2),
};
      }).filter(r => r.dateObj && r.date);

      renderForCurrentPeriod();
      computeAllStats();
      setLoading(false);
    } catch (e) {
      setLoading(false);
      weekLabelEl.textContent = "Ошибка загрузки";
      subLabelEl.textContent = String(e && e.message ? e.message : e);
      scheduleContentEl.innerHTML = `<p style="color:#b91c1c;font-weight:800;">Ошибка загрузки: ${subLabelEl.textContent}</p>`;
    }
  }

  function renderTableView() {
    const rows = currentRows.slice().sort((a, b) => {
      if (a.dateObj.getTime() !== b.dateObj.getTime()) return a.dateObj - b.dateObj;
      return (a.time || "").localeCompare(b.time || "");
    });

    if (!rows.length) {
      scheduleContentEl.innerHTML =
        "<p style='font-size:0.9rem;color:#6b7280;font-weight:700;'>На этот период нет смен.</p>";
      return;
    }

    // group by day
    const groups = [];
    let currentGroup = null;
    rows.forEach((r) => {
      const key = r.dateObj.getTime();
      if (!currentGroup || currentGroup.key !== key) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { key, dateObj: r.dateObj, items: [r] };
      } else currentGroup.items.push(r);
    });
    if (currentGroup) groups.push(currentGroup);

    let desktopHtml = '<div class="schedule-wrapper"><table class="schedule-table">';
    desktopHtml += "<thead><tr><th>Zeit</th><th>Admin</th><th>Kellner</th><th>Küche</th><th>Reinigung</th></tr></thead><tbody>";

    groups.forEach((g) => {
      const weekday = getWeekdayName(g.dateObj);
      const dateStr = formatDate(g.dateObj);

      desktopHtml += `<tr class="day-divider"><td colspan="5">${weekday} ${dateStr}</td></tr>`;

      g.items.forEach((r, idx) => {
        r.__prev = idx > 0 ? g.items[idx - 1] : null;
        desktopHtml += "<tr>";
        desktopHtml += `<td class="time-cell">${r.time || ""}</td>`;
        desktopHtml += `<td>${pillsHtml(r, r.admin, "admin")}</td>`;
        desktopHtml += `<td>${pillsHtml(r, r.kellner, "kellner")}</td>`;
        desktopHtml += `<td>${pillsHtml(r, r.kueche, "kueche")}</td>`;
        desktopHtml += `<td>${pillsHtml(r, r.reinigung, "reinigung")}</td>`;
        desktopHtml += "</tr>";
      });
    });

    desktopHtml += "</tbody></table></div>";
    scheduleContentEl.innerHTML = `<div class="schedule-desktop">${desktopHtml}</div>`;
  }

 function renderDayGridCells(dayRows, targetEl = scheduleContentEl, roleFilter = "all") {
  const rows = dayRows.slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  if (!rows.length) {
    targetEl.innerHTML =
      "<p style='font-size:0.9rem;color:#6b7280;font-weight:700;'>На этот день нет смен.</p>";
    return;
  }

  const ALL_ROLES = [
    { key: "admin", title: "Admin", cols: 3 },
    { key: "kellner", title: "Kellner", cols: 4 },
    { key: "kueche", title: "Küche", cols: 4 },
    { key: "reinigung", title: "Reinigung", cols: 2 },
  ];

  const roles =
    roleFilter && roleFilter !== "all"
      ? ALL_ROLES.filter(r => r.key === roleFilter)
      : ALL_ROLES;

  const withSeps = roles.length > 1;

  let gridCols = `70px `;
  roles.forEach((r, idx) => {
    gridCols += `repeat(${r.cols}, minmax(46px, 1fr)) `;
    if (withSeps && idx !== roles.length - 1) gridCols += `10px `;
  });

  let html = `<div class="day-compact">
    <div class="day-grid" style="grid-template-columns:${gridCols.trim()};">
  `;

  // header
  html += `<div class="day-head day-head--time">Zeit</div>`;
  roles.forEach((r, idx) => {
    html += `<div class="day-head day-head--role" style="grid-column: span ${r.cols};">${r.title}</div>`;
    if (withSeps && idx !== roles.length - 1) html += `<div class="day-head day-sep day-sep--head"></div>`;
  });

  // body
  rows.forEach((r, i) => {
    const gridRow = i + 2;
    const isShiftStartLine = (r.time || "").trim() === "16:00";
    const shiftCls = isShiftStartLine ? " day-row--shiftstart" : "";

    // time
    html += `<div class="day-time${shiftCls}" style="grid-row:${gridRow};grid-column:1;">${r.time || ""}</div>`;

    let col = 2;

    roles.forEach((role, ridx) => {
      for (let slot = 0; slot < role.cols; slot++) {
        const name = (r[role.key]?.[slot] || "").trim();
        const prev = i > 0 ? (rows[i - 1][role.key]?.[slot] || "").trim() : "";
        const next = i < rows.length - 1 ? (rows[i + 1][role.key]?.[slot] || "").trim() : "";

        const isStart = !!name && name !== prev;
        let isEnd = !!name && name !== next; // ✅ let

        // середина блока — не рисуем
        if (name && !isStart) {
          col++;
          continue;
        }

        const styleStr = name ? getPillStyleForName(name) : "";
        const label = isStart ? name : "";

        let blockSpan = 1;
        let timeText = "";
        let addOverlay = false;
        let hideOverlay = false;

        if (name && isStart) {
          let e = i;
          while (e < rows.length - 1 && String(rows[e + 1][role.key]?.[slot] || "").trim() === name) e++;
          blockSpan = e - i + 1;

          // ✅ если блок реально тянется вниз, этот элемент должен иметь и end
          if (blockSpan > 1) isEnd = true;

          if (blockSpan > 1) {
            timeText = `${timePretty_(rows[i].time)}–${timePretty_(rows[e].time)}`;
            addOverlay = true;
            hideOverlay = blockSpan <= 2;
          }
        }

        // ✅ если блок span>1 — сохраняем список rowId на каждый час,
        // чтобы клик внутри большого блока мог открыть ПРАВИЛЬНЫЙ час.
        const rowsListAttr = (name && isStart && blockSpan > 1)
          ? ` data-rows="${rows.slice(i, i + blockSpan).map(x => x.row).join(',')}"`
          : "";

        html += `
          <div class="day-cell${shiftCls} ${name ? "day-cell--filled" : "day-cell--empty"} ${isStart ? "day-cell--start" : ""} ${isEnd ? "day-cell--end" : ""}"
               style="grid-row:${gridRow}${name && isStart ? ` / span ${blockSpan}` : ""};grid-column:${col};${styleStr}"
               data-row="${r.row}"
               ${rowsListAttr}
               data-role="${role.key}"
               data-slot="${slot}">
            <span class="day-cell__label" title="${name}" data-full="${name}">${label}</span>
            ${addOverlay ? `
              <span class="block-time-overlay" data-len="${blockSpan}" ${hideOverlay ? 'data-hide="1"' : ""}>
                <span class="block-time-vert">${timeText}</span>
              </span>
            ` : ""}
          </div>
        `;

        col++;
      }

      if (withSeps && ridx !== roles.length - 1) {
        html += `<div class="day-sep${shiftCls}" style="grid-row:${gridRow};grid-column:${col};"></div>`;
        col++;
      }
    });
  });

  html += `</div></div>`;
  targetEl.innerHTML = html;

  applyDynamicLabels(targetEl);
}

  function renderWeekBlocks(roleFilter = "all") {
    const byDate = new Map();
    currentRows.forEach(r => {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date).push(r);
    });

    const dates = Array.from(byDate.keys()).sort();
    if (!dates.length) {
      scheduleContentEl.innerHTML = "<p style='color:#6b7280;font-weight:700;'>Нет данных.</p>";
      return;
    }

    let html = `<div class="week-blocks">`;

    dates.forEach(dateStr => {
      const d = new Date(dateStr);
      const title = `${getWeekdayName(d)} ${formatDate(d)}`;

      html += `
        <div class="week-day-card">
          <div class="week-day-title">${title}</div>
          <div class="week-day-body" data-week-day="${dateStr}"></div>
        </div>
      `;
    });

    html += `</div>`;
    scheduleContentEl.innerHTML = html;

    dates.forEach(dateStr => {
      const host = scheduleContentEl.querySelector(`[data-week-day="${dateStr}"]`);
      if (!host) return;
      renderDayGridCells(byDate.get(dateStr), host, roleFilter);
    });
  }

  // ===== NEW: Week Role Timeline (сплошные столбики на неделю для 1 роли) =====
  function renderWeekRoleTimeline(roleKey) {
  if (!weekCompactEl) return;

  scheduleContentEl.style.display = "none";
  weekCompactEl.style.display = "block";

  const range = getWeekRange(currentDate);

  const days = [];
  for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    days.push(day);
  }

  const roleCols =
    roleKey === "admin" ? 3 :
    roleKey === "kellner" ? 4 :
    roleKey === "kueche" ? 4 :
    2;

  const roleTitle =
    roleKey === "admin" ? "Админы" :
    roleKey === "kellner" ? "Официанты" :
    roleKey === "kueche" ? "Кухня" :
    "Уборка";

  const times = getFixedTimes_();

  const map = new Map();
  currentRows.forEach(r => {
    if (!r.date || !r.time) return;
    map.set(`${r.date}|${r.time}`, r);
  });

  let gridCols = `70px `;
  const cellMin = (roleCols === 4) ? 30 : (roleCols === 3) ? 40 : 48;
  const sepW = 8;

  days.forEach((_, idx) => {
    gridCols += `repeat(${roleCols}, minmax(${cellMin}px, 1fr)) `;
    if (idx !== days.length - 1) gridCols += `${sepW}px `;
  });

  let html = `
    <div class="week-role-wrap">
      <div class="week-role-title">${roleTitle}</div>
      <div class="week-role-grid" style="grid-template-columns:${gridCols.trim()};">
  `;

  // header
  html += `<div class="week-role-head week-role-head--time">Zeit</div>`;

  let colCursor = 2;
  days.forEach((day, idx) => {
    const head = day.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
    html += `<div class="week-role-head week-role-head--day" style="grid-column:${colCursor} / span ${roleCols};">${head}</div>`;
    colCursor += roleCols;
    if (idx !== days.length - 1) {
      html += `<div class="week-role-sep week-role-sep--head" style="grid-column:${colCursor};"></div>`;
      colCursor += 1;
    }
  });

  // body
  times.forEach((time, tIndex) => {
    const gridRow = tIndex + 2;

    html += `<div class="week-role-time" style="grid-row:${gridRow};grid-column:1;">${time}</div>`;

    let col = 2;

    days.forEach((day, dayIndex) => {
      const dateISO = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;

      for (let slot = 0; slot < roleCols; slot++) {
        const rowObj = map.get(`${dateISO}|${time}`) || null;
        const name = rowObj ? String(rowObj[roleKey]?.[slot] || "").trim() : "";

        const prevTime = times[tIndex - 1] || null;
        const nextTime = times[tIndex + 1] || null;

        const prevRow = prevTime ? (map.get(`${dateISO}|${prevTime}`) || null) : null;
        const nextRow = nextTime ? (map.get(`${dateISO}|${nextTime}`) || null) : null;

        const prevName = prevRow ? String(prevRow[roleKey]?.[slot] || "").trim() : "";
        const nextName = nextRow ? String(nextRow[roleKey]?.[slot] || "").trim() : "";

        const isStart = !!name && name !== prevName;
        let isEnd = !!name && name !== nextName; // ✅ let

        // середина блока — не рисуем
        if (name && !isStart) {
          col++;
          continue;
        }

        const styleStr = name ? getPillStyleForName(name) : "";
        const label = isStart ? shortName_(name) : "";

        let blockSpan = 1;
        let timeText = "";
        let addOverlay = false;
        let hideOverlay = false;

        if (name && isStart) {
          let e = tIndex;
          while (e < times.length - 1) {
            const nr = map.get(`${dateISO}|${times[e + 1]}`) || null;
            const nn = nr ? String(nr[roleKey]?.[slot] || "").trim() : "";
            if (nn !== name) break;
            e++;
          }

          blockSpan = e - tIndex + 1;

          // ✅ если блок реально тянется вниз, этот элемент должен иметь и end
          if (blockSpan > 1) isEnd = true;

          if (blockSpan > 1) {
            timeText = `${timePretty_(times[tIndex])}–${timePretty_(times[e])}`;
            addOverlay = true;
            hideOverlay = blockSpan <= 2;
          }
        }

        const clickable = rowObj ? "week-role-cell--click" : "week-role-cell--nocell";

        // ✅ если блок span>1 — сохраняем список rowId на каждый час,
        // чтобы клик внутри большого блока мог открыть ПРАВИЛЬНЫЙ час.
        const rowsListAttr = (name && isStart && blockSpan > 1)
          ? ` data-rows="${times.slice(tIndex, tIndex + blockSpan)
              .map(t => (map.get(`${dateISO}|${t}`) || {}).row)
              .filter(Boolean)
              .join(',')}"`
          : "";

        html += `
          <div class="week-role-cell ${clickable} ${name ? "week-role-cell--filled" : "week-role-cell--empty"} ${isStart ? "week-role-cell--start" : ""} ${isEnd ? "week-role-cell--end" : ""}"
               style="grid-row:${gridRow}${name && isStart ? ` / span ${blockSpan}` : ""};grid-column:${col};${styleStr}"
               ${rowObj ? `data-row="${rowObj.row}"` : ""}
               ${rowsListAttr}
               data-role="${roleKey}"
               data-slot="${slot}">
            <span class="week-role-cell__label" title="${name}" data-full="${name}">${label}</span>
            ${addOverlay ? `
              <span class="block-time-overlay" data-len="${blockSpan}" ${hideOverlay ? 'data-hide="1"' : ""}>
                <span class="block-time-vert">${timeText}</span>
              </span>
            ` : ""}
          </div>
        `;

        col++;
      }

      if (dayIndex !== days.length - 1) {
        html += `<div class="week-role-sep" style="grid-row:${gridRow};grid-column:${col};"></div>`;
        col++;
      }
    });
  });

  html += `</div></div>`;
  weekCompactEl.innerHTML = html;

  // чтобы подписи (имена) уменьшались по ширине
  applyDynamicLabels(weekCompactEl);
}

  // ===== WEEK FILTER helpers =====
  function setWeekFilterVisible_(visible) {
    if (!weekFilterEl || !weekCompactEl) return;
    weekFilterEl.style.display = visible ? "flex" : "none";
    if (!visible) {
      weekCompactEl.style.display = "none";
      weekCompactEl.innerHTML = "";
      scheduleContentEl.style.display = "";
      weekFilterEl.querySelectorAll("[data-week-filter]").forEach(btn => {
        btn.classList.toggle("week-filter__pill--active", btn.dataset.weekFilter === "all");
      });
    }
  }

  function getActiveWeekFilter_() {
    if (!weekFilterEl) return "all";
    const active = weekFilterEl.querySelector(".week-filter__pill--active");
    return active ? (active.dataset.weekFilter || "all") : "all";
  }

  if (weekFilterEl) {
    weekFilterEl.querySelectorAll("[data-week-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        weekFilterEl.querySelectorAll("[data-week-filter]").forEach(b =>
          b.classList.remove("week-filter__pill--active")
        );
        btn.classList.add("week-filter__pill--active");

        const role = btn.dataset.weekFilter;

        // ✅ ВАЖНО: "Все" не трогаем — оставляем текущий недельный вид
        if (role === "all") {
          weekCompactEl.style.display = "none";
          weekCompactEl.innerHTML = "";
          scheduleContentEl.style.display = "";
          renderWeekBlocks("all");
        } else {
          renderWeekRoleTimeline(role); // новый столбиковый вид
        }
      });
    });
  }

  function renderForCurrentPeriod() {
    if (!allRows.length) {
      weekLabelEl.textContent = "Нет данных";
      subLabelEl.textContent = " ";
      scheduleContentEl.innerHTML = "<p style='color:#6b7280;font-weight:700;'>Нет данных.</p>";
      setWeekFilterVisible_(false);
      return;
    }

    let start, end;

    if (currentMode === MODE_DAY) {
      const d = getDayStart(currentDate);
      start = d; end = d;
      weekLabelEl.textContent = `День ${formatDate(d)} (${getWeekdayName(d)})`;
      setWeekFilterVisible_(false);
    } else if (currentMode === MODE_WEEK) {
      const range = getWeekRange(currentDate);
      start = range.start; end = range.end;
      weekLabelEl.textContent = `Неделя ${formatDate(range.start)} — ${formatDate(range.end)}`;
      setWeekFilterVisible_(true);
    } else {
      const range = getMonthRange(currentDate);
      start = range.start; end = range.end;
      weekLabelEl.textContent = `Месяц ${formatMonthYear(range.start)}`;
      setWeekFilterVisible_(false);
    }

    const startMs = start.getTime();
    const endMs = end.getTime();

    currentRows = allRows.filter((r) => {
      const t = r.dateObj.getTime();
      return t >= startMs && t <= endMs;
    });

    subLabelEl.textContent = `Смен: ${currentRows.length}`;

    if (currentMode === MODE_DAY) {
      // reset week special
      if (weekCompactEl) { weekCompactEl.style.display = "none"; weekCompactEl.innerHTML = ""; }
      scheduleContentEl.style.display = "";
      renderDayGridCells(currentRows, scheduleContentEl, "all");
      return;
    }

    if (currentMode === MODE_WEEK) {
      const role = getActiveWeekFilter_();

      // ✅ "Все" = старый вид
      if (role === "all") {
        if (weekCompactEl) { weekCompactEl.style.display = "none"; weekCompactEl.innerHTML = ""; }
        scheduleContentEl.style.display = "";
        renderWeekBlocks("all");
      } else {
        renderWeekRoleTimeline(role); // новый столбиковый вид
      }
      return;
    }

    // MODE_MONTH
    if (weekCompactEl) { weekCompactEl.style.display = "none"; weekCompactEl.innerHTML = ""; }
    scheduleContentEl.style.display = "";
    renderTableView();
  }

  function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    modeDayBtn.classList.toggle("view-toggle__btn--active", currentMode === MODE_DAY);
    modeWeekBtn.classList.toggle("view-toggle__btn--active", currentMode === MODE_WEEK);
    modeMonthBtn.classList.toggle("view-toggle__btn--active", currentMode === MODE_MONTH);

    if (currentMode === MODE_MONTH) {
      loadScheduleForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
    } else {
      renderForCurrentPeriod();
    }
  }

  function changePeriod(delta) {
    if (currentMode === MODE_DAY) currentDate.setDate(currentDate.getDate() + delta);
    else if (currentMode === MODE_WEEK) currentDate.setDate(currentDate.getDate() + delta * 7);
    else currentDate.setMonth(currentDate.getMonth() + delta);

    if (currentMode === MODE_MONTH) {
      loadScheduleForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
    } else {
      renderForCurrentPeriod();
    }
  }

  // ============ picker ============
  function renderColorPaletteUI_(currentName) {
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.marginBottom = "10px";

    const title = document.createElement("div");
    title.style.fontWeight = "900";
    title.style.marginBottom = "6px";
    title.textContent = currentName
      ? `🎨 Цвет для: ${currentName}`
      : "🎨 Цвет: выберите имя";

    const grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = "8px";

    const makeSwatch = (hex) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = hex;
      b.style.width = "28px";
      b.style.height = "28px";
      b.style.borderRadius = "10px";
      b.style.border = "2px solid rgba(17,24,39,0.15)";
      b.style.background = hex;
      b.style.cursor = currentName ? "pointer" : "not-allowed";
      b.style.opacity = currentName ? "1" : "0.35";

      b.addEventListener("click", async () => {
        if (!currentName) return;
        await saveNameColor(currentName, hex);
        renderForCurrentPeriod();
      });
      return b;
    };

    COLOR_PRESETS.forEach(hex => grid.appendChild(makeSwatch(hex)));

    const customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className = "picker-option-btn";
    customBtn.textContent = "Свой цвет…";
    customBtn.disabled = !currentName;
    customBtn.style.marginLeft = "auto";

    customBtn.addEventListener("click", async () => {
      if (!currentName) return;
      const cur = NAME_COLORS[currentName] || "#34d399";
      const hex = prompt(`HEX цвет для "${currentName}"`, cur);
      if (!hex) return;
      await saveNameColor(currentName, hex.trim());
      renderForCurrentPeriod();
    });

    wrap.appendChild(title);
    wrap.appendChild(grid);
    wrap.appendChild(customBtn);

    pickerOptionsEl.prepend(wrap);
  }

  function openPicker(targetEl, row, role, slot) {
    const names = ROLE_OPTIONS[role] || [];
    pickerState = { el: targetEl, row, role, slot };

    const roleLabel =
      role === "admin" ? "Администраторы (Admin)" :
      role === "kellner" ? "Официанты (Kellner)" :
      role === "kueche" ? "Кухня (Küche)" :
      "Уборка (Reinigung)";
    pickerRoleLabel.textContent = roleLabel;

    const currentName = getCurrentCellNameFromState(row, role, slot);

    pickerOptionsEl.innerHTML = "";
    renderColorPaletteUI_(currentName || "");

    names.forEach((name) => {
      const btn = document.createElement("button");
      btn.className = "picker-option-btn";
      btn.type = "button";
      btn.textContent = name;
      btn.addEventListener("click", () => applySelection(name));
      pickerOptionsEl.appendChild(btn);
    });

    pickerBackdrop.classList.remove("picker-hidden");
  }

  function closePicker() {
    pickerBackdrop.classList.add("picker-hidden");
    pickerState = null;
  }

  function extendShift(name, startRowNum, role, slot, hoursToExtend) {
    const startRowObj = allRows.find((r) => r.row === startRowNum);
    if (!startRowObj) return;

    const dayTime = startRowObj.dateObj.getTime();
    const sameDayRows = allRows
      .filter((r) => r.dateObj.getTime() === dayTime)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    const startIndex = sameDayRows.findIndex((r) => r.row === startRowNum);
    if (startIndex === -1) return;

    for (let i = 1; i <= hoursToExtend; i++) {
      const target = sameDayRows[startIndex + i];
      if (!target) break;

      if (target[role] && typeof target[role][slot] !== "undefined") {
        target[role][slot] = name;
      }
      postNoCors({ action: "schedule_update", row: target.row, role, slot, value: name }).catch(console.error);
    }

    renderForCurrentPeriod();
  }

  function applySelection(name) {
    if (!pickerState) return;

    const { row, role, slot } = pickerState;
    const trimmed = (name || "").trim();

    postNoCors({ action: "schedule_update", row, role, slot, value: trimmed })
      .catch(console.error);

    const obj = allRows.find(r => r.row === row);
    if (obj && obj[role] && typeof obj[role][slot] !== "undefined") {
      obj[role][slot] = trimmed;
    }

    closePicker();
    renderForCurrentPeriod();

    if (trimmed) {
      const extendStr = prompt(
        "Продлить смену этим сотрудником ещё на сколько часов вниз по этому дню?\nОставьте пусто или 0, если только этот час.",
        "0"
      );
      const extend = parseInt(extendStr, 10);
      if (!isNaN(extend) && extend > 0) extendShift(trimmed, row, role, slot, extend);
    }
  }

  pickerClearBtn.addEventListener("click", () => applySelection(""));
  pickerCustomBtn.addEventListener("click", () => {
    if (!pickerState) return;
    const { row, role, slot } = pickerState;
    const currentValue = getCurrentCellNameFromState(row, role, slot);
    const newValue = prompt("Введите имя сотрудника", currentValue || "");
    if (newValue === null) return;
    applySelection(newValue);
  });
  pickerCancelBtn.addEventListener("click", closePicker);
  pickerBackdrop.addEventListener("click", (e) => { if (e.target === pickerBackdrop) closePicker(); });

  // ===== CLICK -> correct hour inside spanned block =====
  // В day/week-grid мы рисуем один большой блок (grid-row: span N)
  // и сохраняем внутри него список rowId на каждый час: data-rows="1,2,3".
  // По клику вычисляем, в какой "под-час" попали, чтобы очистка/редактирование
  // работали именно для выбранного часа, а не всегда для верхнего.
  function resolveRowFromSpannedCell_(cellEl, clientY) {
    if (!cellEl) return null;

    const rowsAttr = (cellEl.dataset && cellEl.dataset.rows) ? String(cellEl.dataset.rows).trim() : "";
    if (!rowsAttr) {
      const r = Number(cellEl.dataset.row || "");
      return r || null;
    }

    const ids = rowsAttr.split(",").map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0);
    if (!ids.length) {
      const r = Number(cellEl.dataset.row || "");
      return r || null;
    }

    // вычисляем индекс часа по Y внутри прямоугольника
    const rect = cellEl.getBoundingClientRect();
    const relY = Math.min(Math.max(0, clientY - rect.top), rect.height - 1);
    const partH = rect.height / ids.length;
    let idx = Math.floor(relY / partH);
    if (idx < 0) idx = 0;
    if (idx >= ids.length) idx = ids.length - 1;
    return ids[idx] || ids[0] || null;
  }

  // Клики по таблице (месяц) и дневной сетке + новый week-role
  scheduleContentEl.addEventListener("click", (e) => {
    const pill = e.target.closest(".schedule-pill");
    if (pill) {
      openPicker(pill, Number(pill.dataset.row), pill.dataset.role, Number(pill.dataset.slot));
      return;
    }
    const cell = e.target.closest(".day-cell");
    if (cell) {
      const realRow = resolveRowFromSpannedCell_(cell, e.clientY);
      if (!realRow) return;
      openPicker(cell, realRow, cell.dataset.role, Number(cell.dataset.slot));
      return;
    }
  });

  // ✅ клики по week role grid
  if (weekCompactEl) {
    weekCompactEl.addEventListener("click", (e) => {
      const cell = e.target.closest(".week-role-cell");
      if (!cell) return;
      const realRow = resolveRowFromSpannedCell_(cell, e.clientY);
      if (!realRow) return; // если в таблице нет строки на этот час
      openPicker(cell, realRow, cell.dataset.role, Number(cell.dataset.slot));
    });
  }

  // ============ stats ============
  function computeStatsForRange(start, end) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const persons = {};
    const totals = { overall: 0, kellner: 0, kueche: 0, reinigung: 0 };
    const roles = ["kellner", "kueche", "reinigung"];
    const usedDaysSet = new Set();

    allRows.forEach((row) => {
      const t = row.dateObj.getTime();
      if (t < startMs || t > endMs) return;

      let rowHasAnyWork = false;

      roles.forEach((role) => {
        (row[role] || []).forEach((name) => {
          const trimmed = (name || "").trim();
          if (!trimmed) return;

          rowHasAnyWork = true;

          if (!persons[trimmed]) persons[trimmed] = { total: 0, kellner: 0, kueche: 0, reinigung: 0 };

          persons[trimmed][role] += 1;
          persons[trimmed].total += 1;
          totals[role] += 1;
          totals.overall += 1;
        });
      });

      if (rowHasAnyWork) usedDaysSet.add(getDayStart(row.dateObj).getTime());
    });

    return { persons, totals, usedDays: usedDaysSet.size, range: { start, end } };
  }

  function computeAllStats() {
    if (!allRows.length) { statsState.data = null; renderStatsView(); return; }

    const today = new Date();
    const currentRange = getMonthRange(today);

    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const prevPrevMonthDate = new Date(today.getFullYear(), today.getMonth() - 2, 15);

    const prevRange = getMonthRange(prevMonthDate);
    const prevPrevRange = getMonthRange(prevPrevMonthDate);

    const currentStats = computeStatsForRange(currentRange.start, currentRange.end);
    const previousStats = computeStatsForRange(prevRange.start, prevRange.end);
    const prevPrevStats = computeStatsForRange(prevPrevRange.start, prevPrevRange.end);

    statsState.data = { current: currentStats, previous: previousStats, prevPrev: prevPrevStats };
    statsState.monthLabels = {
      current: formatMonthYear(currentRange.start),
      previous: formatMonthYear(prevRange.start),
      prevPrev: formatMonthYear(prevPrevRange.start)
    };

    if (today.getDate() <= 10) {
      statsState.slotMapping = { current: "previous", previous: "prevPrev" };
    } else {
      statsState.slotMapping = { current: "current", previous: "previous" };
    }

    statsState.activeSlot = "current";
    renderStatsView();
  }

  function renderStatsView() {
    if (!statsState.data) {
      statsSummaryEl.innerHTML = "<p style='color:#6b7280;font-weight:800;'>Нет данных для статистики.</p>";
      statsTableEl.innerHTML = "";
      return;
    }

    const key = (statsState.slotMapping || {})[statsState.activeSlot] || "current";
    const monthData = statsState.data[key];

    if (!monthData) {
      statsSummaryEl.innerHTML = "<p style='color:#6b7280;font-weight:800;'>Нет данных за этот месяц.</p>";
      statsTableEl.innerHTML = "";
      return;
    }

    const monthLabel = statsState.monthLabels[key] || "";
    const totals = monthData.totals;
    const personsMap = monthData.persons;

    const roleLabelMap = { all: "Все роли", kellner: "Kellner", kueche: "Küche", reinigung: "Reinigung" };

    statsSummaryEl.innerHTML = `
      <div class="stats-summary-grid">
        <div class="stats-summary-item">
          <div class="stats-summary-label">Месяц</div>
          <div class="stats-summary-value">${monthLabel}</div>
          <div class="stats-summary-days">${monthData.usedDays} дней</div>
        </div>
        <div class="stats-summary-item">
          <div class="stats-summary-label">Всего часов</div>
          <div class="stats-summary-value">${totals.overall}</div>
        </div>
        <div class="stats-summary-item">
          <div class="stats-summary-label">Фильтр</div>
          <div class="stats-summary-value">${roleLabelMap[statsState.role] || ""}</div>
        </div>
      </div>
    `;

    const entries = Object.entries(personsMap);
    if (!entries.length) {
      statsTableEl.innerHTML = "<p style='color:#6b7280;font-weight:800;'>Нет смен.</p>";
      return;
    }

    const roleFilter = statsState.role;
    let html = '<table class="stats-table"><thead>';

    if (roleFilter === "all") {
      html += "<tr><th>Mitarbeiter</th><th>Всего</th><th>Kellner</th><th>Küche</th><th>Reinigung</th></tr></thead><tbody>";
      const rows = entries
        .map(([name, p]) => ({ name, total: p.total, kellner: p.kellner, kueche: p.kueche, reinigung: p.reinigung }))
        .sort((a, b) => b.total - a.total);

      rows.forEach((r) => {
        html += `<tr><td>${r.name}</td><td>${r.total}</td><td>${r.kellner}</td><td>${r.kueche}</td><td>${r.reinigung}</td></tr>`;
      });

      html += "</tbody></table>";
    } else {
      const rKey = roleFilter;
      html += `<tr><th>Mitarbeiter</th><th>${roleLabelMap[rKey]}</th><th>Всего</th></tr></thead><tbody>`;
      const rows = entries
        .map(([name, p]) => ({ name, roleHours: p[rKey], total: p.total }))
        .filter((r) => r.roleHours > 0)
        .sort((a, b) => b.roleHours - a.roleHours);

      rows.forEach((r) => {
        html += `<tr><td>${r.name}</td><td>${r.roleHours}</td><td>${r.total}</td></tr>`;
      });

      html += "</tbody></table>";
    }

    statsTableEl.innerHTML = html;
  }

  statsMonthCurrentBtn.addEventListener("click", () => {
    statsState.activeSlot = "current";
    statsMonthCurrentBtn.classList.add("stats-toggle-btn--active");
    statsMonthPrevBtn.classList.remove("stats-toggle-btn--active");
    renderStatsView();
  });

  statsMonthPrevBtn.addEventListener("click", () => {
    statsState.activeSlot = "previous";
    statsMonthPrevBtn.classList.add("stats-toggle-btn--active");
    statsMonthCurrentBtn.classList.remove("stats-toggle-btn--active");
    renderStatsView();
  });

  statsRoleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-stats-role");
      statsState.role = role;
      statsRoleButtons.forEach((b) => b.classList.toggle("stats-toggle-pill--active", b === btn));
      renderStatsView();
    });
  });

  // ============ navigation ============
  prevBtn.addEventListener("click", () => changePeriod(-1));
  nextBtn.addEventListener("click", () => changePeriod(1));
  todayBtn.addEventListener("click", () => {
    currentDate = new Date();
    if (currentMode === MODE_MONTH) {
      loadScheduleForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
    } else {
      renderForCurrentPeriod();
    }
  });

  modeDayBtn.addEventListener("click", () => setMode(MODE_DAY));
  modeWeekBtn.addEventListener("click", () => setMode(MODE_WEEK));
  modeMonthBtn.addEventListener("click", () => setMode(MODE_MONTH));

  // stats show/hide
  openStatsBtn.addEventListener("click", () => {
    sectionSchedule.style.display = "none";
    sectionStats.style.display = "block";
    renderStatsView();
  });
  closeStatsBtn.addEventListener("click", () => {
    sectionStats.style.display = "none";
    sectionSchedule.style.display = "block";
  });

  // init
  // init
  setLoading(true, "Загружаю расписание…");

  try {
    await loadNameColors();
  } catch (e) {
    console.warn("loadNameColors failed:", e);
  }

  loadScheduleForMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
});