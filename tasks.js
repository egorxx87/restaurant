// tasks.js

// TASKS WebApp URL (/exec)
const TASKS_API_URL =
  "https://script.google.com/macros/s/AKfycbzKxxknHm2WBYLRzNOAWaK66VGvUZMbT5tPjpTR6j2J_uYh838LRI5Nk0a2H4DPIkkG/exec";

// SCHEDULE WebApp URL (/exec) — чтобы брать список админов
const SCHEDULE_API_URL =
  "https://script.google.com/macros/s/AKfycbw_uswtYYaimbBJytiHAdcwjbvv2rujyBt2Rrc9jlBHoYQ358F7vi8OvvQEhTptODNZ8g/exec";

let allTasks = [];
let activeFilter = "all"; // all | red | blue
let activePriority = "red";
let sortMode = "priority";
let editId = ""; // если не пусто — редактируем

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-add-task")?.addEventListener("click", openModalNew);
  document.getElementById("btn-cancel")?.addEventListener("click", closeModal);
  document.getElementById("btn-save")?.addEventListener("click", saveTask);

  document.getElementById("sortMode")?.addEventListener("change", (e) => {
    sortMode = e.target.value;
    render();
  });

  document.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach(x => x.classList.remove("pill--active"));
      btn.classList.add("pill--active");
      activeFilter = btn.getAttribute("data-filter") || "all";
      render();
    });
  });

  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach(x => x.classList.remove("seg-btn--active"));
      btn.classList.add("seg-btn--active");
      activePriority = btn.getAttribute("data-priority") === "blue" ? "blue" : "red";
    });
  });

  loadAdminsForSelect();
  load();
});

async function load(){
  if (!TASKS_API_URL) {
    setListEmpty("Немає TASKS_API_URL");
    return;
  }

  setLoading(true, "Завантаження задач…");
  try {
    const useJsonp = (location.protocol === "file:");
    let json;

    if (useJsonp) {
      json = await jsonp(`${TASKS_API_URL}?action=tasks_list`);
    } else {
      const res = await fetch(`${TASKS_API_URL}?action=tasks_list`, { method:"GET" });
      json = await res.json();
    }

    if (!json || !json.ok) throw new Error((json && json.error) ? json.error : "Load error");

    allTasks = Array.isArray(json.data) ? json.data : [];
    render();
  } catch (e){
    console.error(e);
    setListEmpty("Помилка завантаження");
  } finally {
    setLoading(false);
  }
}

function render(){
  const list = document.getElementById("taskList");
  if (!list) return;

  let items = [...allTasks].filter(t => (t.status || "open") === "open");

  if (activeFilter === "red") items = items.filter(t => (t.priority || "blue") === "red");
  if (activeFilter === "blue") items = items.filter(t => (t.priority || "blue") === "blue");

  items.sort((a,b) => {
    if (sortMode === "new") return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
    if (sortMode === "due") {
      const ad = toSortableDate_(formatDueHuman_(a.due));
      const bd = toSortableDate_(formatDueHuman_(b.due));
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return ad.localeCompare(bd);
    }
    const ap = (a.priority === "red") ? 0 : 1;
    const bp = (b.priority === "red") ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
  });

  if (!items.length){
    setListEmpty("Немає активних завдань");
    return;
  }

  list.innerHTML = items.map(t => {
    const pr = (t.priority === "red") ? "🔴 Срочно" : "🔵 Звичайно";
    const dueStr = formatDueHuman_(t.due);
    const due = dueStr ? escapeHtml(dueStr) : "без строку";
    const badgeClass = (t.priority === "red") ? "badge badge--red" : "badge badge--blue";
    const who = String(t.assignee || "").trim();

    return `
      <div class="task-row" data-edit="${escapeHtml(t.id)}">
        <div class="task-left">
          <div class="task-title">${escapeHtml(t.title || "")}</div>
          <div class="task-meta">
            <span class="${badgeClass}">${pr}</span>
            <span class="task-due">⏳ ${due}</span>
            ${who ? `<span class="task-due">👤 ${escapeHtml(who)}</span>` : ``}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-del="${escapeHtml(t.id)}" title="Видалити">🗑️</button>
        </div>
      </div>
    `;
  }).join("");

  // delete
  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-del");
      if (!id) return;

      const ok = confirm("Ви впевнені, що хочете видалити цю задачу?");
      if (!ok) return;

      await deleteTask(id);
    });
  });

  // edit on row click
  list.querySelectorAll("[data-edit]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target && e.target.closest("[data-del]")) return;
      const id = row.getAttribute("data-edit");
      if (!id) return;
      openModalEdit(id);
    });
  });
}

async function deleteTask(id){
  setLoading(true, "Видалення…");
  try {
    const res = await fetch(TASKS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "tasks_delete", id })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Delete error");
    allTasks = allTasks.filter(t => t.id !== id);
    render();
  } catch (e){
    console.error(e);
    alert("Помилка видалення");
  } finally {
    setLoading(false);
  }
}

/* ===== modal ===== */

function openModalNew(){
  editId = "";
  document.getElementById("taskModalTitle").textContent = "Нова задача";

  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDue").value = "";

  activePriority = "red";
  document.querySelectorAll(".seg-btn").forEach(x => x.classList.remove("seg-btn--active"));
  document.querySelector('.seg-btn[data-priority="red"]')?.classList.add("seg-btn--active");

  document.getElementById("taskModal")?.classList.remove("modal-hidden");
}

function openModalEdit(id){
  const t = allTasks.find(x => x.id === id);
  if (!t) return;

  editId = id;
  document.getElementById("taskModalTitle").textContent = "Редагувати задачу";

  document.getElementById("taskTitle").value = t.title || "";
  document.getElementById("taskDue").value = formatDueHuman_(t.due) || "";

  activePriority = (t.priority === "blue") ? "blue" : "red";
  document.querySelectorAll(".seg-btn").forEach(x => x.classList.remove("seg-btn--active"));
  document.querySelector(`.seg-btn[data-priority="${activePriority}"]`)?.classList.add("seg-btn--active");

  const sel = document.getElementById("taskAssignee");
  if (sel) sel.value = t.assignee || "";

  document.getElementById("taskModal")?.classList.remove("modal-hidden");
}

function closeModal(){
  document.getElementById("taskModal")?.classList.add("modal-hidden");
}

async function saveTask(){
  const title = String(document.getElementById("taskTitle")?.value || "").trim();
  const due = String(document.getElementById("taskDue")?.value || "").trim();
  const assignee = String(document.getElementById("taskAssignee")?.value || "").trim();

  if (!title){
    alert("Введи текст задачі");
    return;
  }
  if (due && !/^\d{2}\.\d{2}\.\d{4}$/.test(due)){
    alert("Строк має бути DD.MM.YYYY або пусто");
    return;
  }

  setLoading(true, editId ? "Збереження…" : "Додавання…");
  try {
    const payload = editId
      ? { action: "tasks_update", id: editId, data: { title, priority: activePriority, due, assignee } }
      : { action: "tasks_add", data: { title, priority: activePriority, due, assignee } };

    const res = await fetch(TASKS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Save error");

    editId = "";
    closeModal();
    await load();
  } catch (e){
    console.error(e);
    alert("Помилка збереження");
  } finally {
    setLoading(false);
  }
}

/* ===== Admins dropdown (from schedule API) ===== */

async function loadAdminsForSelect(){
  const sel = document.getElementById("taskAssignee");
  if (!sel) return;

  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const data = await jsonp(`${SCHEDULE_API_URL}?action=list&month=${month}`);

    const names = new Set();
    (data && data.rows ? data.rows : []).forEach(r => {
      (r.admin || []).forEach(a => {
        const n = String(a || "").trim();
        if (n) names.add(n);
      });
    });

    // очистим всё, кроме первого option
    const keep0 = new Option("— не вибрано —", "");
    sel.innerHTML = "";
    sel.appendChild(keep0);

    [...names].sort().forEach(n => sel.appendChild(new Option(n, n)));
  } catch (e){
    console.error("Admins load error", e);
  }
}

/* ===== helpers ===== */

function setListEmpty(text){
  const list = document.getElementById("taskList");
  if (list) list.innerHTML = `<div class="task-empty">${escapeHtml(text)}</div>`;
}

function toSortableDate_(ddmmyyyy){
  const s = String(ddmmyyyy || "").trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function setLoading(on, text){
  const el = document.getElementById("global-loader");
  const t = document.getElementById("global-loader-text");
  if (!el) return;
  if (t && text) t.textContent = text;
  el.classList.toggle("global-loader--hidden", !on);
}

function formatDueHuman_(due){
  if (!due) return "";

  const s = String(due).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  return s;
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// JSONP helper (works from file://)
function jsonp(url){
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cb}`;

    window[cb] = (data) => {
      try { resolve(data); }
      finally {
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