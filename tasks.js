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
let isSaving = false;

let assigneeFilter = "__all__"; // __all__ | __none__ | name

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-add-task")?.addEventListener("click", openModalNew);
  document.getElementById("btn-cancel")?.addEventListener("click", closeModal);
  document.getElementById("btn-save")?.addEventListener("click", saveTask);

  document.getElementById("sortMode")?.addEventListener("change", (e) => {
    sortMode = e.target.value;
    render();
  });

  document.getElementById("assigneeFilter")?.addEventListener("change", (e) => {
    assigneeFilter = e.target.value;
    render();
  });

  document.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach((x) => x.classList.remove("pill--active"));
      btn.classList.add("pill--active");
      activeFilter = btn.getAttribute("data-filter") || "all";
      render();
    });
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("seg-btn--active"));
      btn.classList.add("seg-btn--active");
      activePriority = btn.getAttribute("data-priority") === "blue" ? "blue" : "red";
    });
  });

  // UX: закрытие модалки по клику на фон
  document.getElementById("taskModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "taskModal") closeModal();
  });

  loadAdminsForSelect(); // заполняет селекты (modal + фильтр)
  load();
});

async function load() {
  if (!TASKS_API_URL) {
    setListEmpty("Немає TASKS_API_URL");
    return;
  }

  setLoading(true, "Завантаження задач…");
  try {
    const json = await callTasksApi_("tasks_list");

    if (!json || !json.ok) throw new Error((json && json.error) ? json.error : "Load error");

    allTasks = Array.isArray(json.data) ? json.data : [];
    refreshAssigneeFilterOptions_();
    render();
  } catch (e) {
    console.error(e);
    setListEmpty("Помилка завантаження");
  } finally {
    setLoading(false);
  }
}

function render() {
  const list = document.getElementById("taskList");
  const counter = document.getElementById("taskCounter");
  if (!list) return;

  let items = [...allTasks].filter((t) => (t.status || "open") === "open");

  // priority filter (red/blue)
  if (activeFilter === "red") items = items.filter((t) => (t.priority || "blue") === "red");
  if (activeFilter === "blue") items = items.filter((t) => (t.priority || "blue") === "blue");

  // assignee filter
  if (assigneeFilter === "__none__") {
    items = items.filter((t) => !String(t.assignee || "").trim());
  } else if (assigneeFilter !== "__all__") {
    items = items.filter((t) => String(t.assignee || "").trim() === assigneeFilter);
  }

  // sort
  items.sort((a, b) => {
    if (sortMode === "new") return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
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
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

  if (counter) {
    const totalOpen = allTasks.filter((t) => (t.status || "open") === "open").length;
    counter.textContent = `Показано: ${items.length} із ${totalOpen}`;
  }

  if (!items.length) {
    setListEmpty("Немає активних завдань");
    return;
  }

  list.innerHTML = items
    .map((t) => {
      const pr = t.priority === "red" ? "🔴 Срочно" : "🔵 Звичайно";
      const dueStr = formatDueHuman_(t.due);
      const due = dueStr ? escapeHtml(dueStr) : "без строку";
      const badgeClass = t.priority === "red" ? "badge badge--red" : "badge badge--blue";
      const who = String(t.assignee || "").trim();
      const comment = String(t.comment || "").trim();

      return `
        <div class="task-row" data-edit="${escapeHtml(t.id)}">
          <div class="task-left">
            <div class="task-title">${escapeHtml(t.title || "")}</div>

            <div class="task-meta">
              <span class="${badgeClass}">${pr}</span>
              <span class="task-due">⏳ ${due}</span>
              ${
                who
                  ? `<span class="task-due">👤 ${escapeHtml(who)}</span>`
                  : `<span class="task-due">👤 без відповідального</span>`
              }
            </div>

            ${
              comment
                ? `<div class="task-comment">${escapeHtml(comment)}</div>`
                : ``
            }
          </div>

          <div class="task-actions">
            <button class="icon-btn" data-del="${escapeHtml(t.id)}" title="Видалити">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");

  // delete
  list.querySelectorAll("[data-del]").forEach((btn) => {
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
  list.querySelectorAll("[data-edit]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target && e.target.closest("[data-del]")) return;
      const id = row.getAttribute("data-edit");
      if (!id) return;
      openModalEdit(id);
    });
  });
}

async function deleteTask(id) {
  setLoading(true, "Видалення…");
  try {
    const json = await callTasksApi_("tasks_delete", { id });
    if (!json.ok) throw new Error(json.error || "Delete error");

    allTasks = allTasks.filter((t) => t.id !== id);
    refreshAssigneeFilterOptions_();
    render();
  } catch (e) {
    console.error(e);
    alert("Помилка видалення");
  } finally {
    setLoading(false);
  }
}

/* ===== modal ===== */

function openModalNew() {
  editId = "";
  document.getElementById("taskModalTitle").textContent = "Нова задача";

  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDue").value = "";
  document.getElementById("taskComment").value = "";

  activePriority = "red";
  document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("seg-btn--active"));
  document.querySelector('.seg-btn[data-priority="red"]')?.classList.add("seg-btn--active");

  const sel = document.getElementById("taskAssignee");
  if (sel) sel.value = "";

  document.getElementById("taskModal")?.classList.remove("modal-hidden");
}

function openModalEdit(id) {
  const t = allTasks.find((x) => x.id === id);
  if (!t) return;

  editId = id;
  document.getElementById("taskModalTitle").textContent = "Редагувати задачу";

  document.getElementById("taskTitle").value = t.title || "";
  document.getElementById("taskDue").value = formatDueHuman_(t.due) || "";
  document.getElementById("taskComment").value = String(t.comment || "");

  activePriority = t.priority === "blue" ? "blue" : "red";
  document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("seg-btn--active"));
  document.querySelector(`.seg-btn[data-priority="${activePriority}"]`)?.classList.add("seg-btn--active");

  const sel = document.getElementById("taskAssignee");
  if (sel) sel.value = t.assignee || "";

  document.getElementById("taskModal")?.classList.remove("modal-hidden");
}

function closeModal() {
  if (isSaving) return; // во время сохранения не закрываем
  document.getElementById("taskModal")?.classList.add("modal-hidden");
}

async function saveTask() {
  if (isSaving) return;

  const btnSave = document.getElementById("btn-save");
  const btnCancel = document.getElementById("btn-cancel");

  const title = String(document.getElementById("taskTitle")?.value || "").trim();
  const due = String(document.getElementById("taskDue")?.value || "").trim();
  const assignee = String(document.getElementById("taskAssignee")?.value || "").trim();
  const comment = String(document.getElementById("taskComment")?.value || "").trim();

  if (!title) {
    alert("Введи текст задачі");
    return;
  }
  if (due && !/^\d{2}\.\d{2}\.\d{4}$/.test(due)) {
    alert("Строк має бути DD.MM.YYYY або пусто");
    return;
  }

  // FRONT-FACE saving (block UI)
  isSaving = true;
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.style.opacity = "0.7";
    btnSave.textContent = "Збереження…";
  }
  if (btnCancel) {
    btnCancel.disabled = true;
    btnCancel.style.opacity = "0.6";
  }
  setLoading(true, editId ? "Збереження задачі…" : "Додавання задачі…");

  try {
    const payload = editId
      ? { id: editId, data: { title, priority: activePriority, due, assignee, comment } }
      : { data: { title, priority: activePriority, due, assignee, comment } };

    const json = await callTasksApi_(editId ? "tasks_update" : "tasks_add", payload);
    if (!json.ok) throw new Error(json.error || "Save error");

    editId = "";
    await load();
    document.getElementById("taskModal")?.classList.add("modal-hidden");
  } catch (e) {
    console.error(e);
    alert("Помилка збереження");
  } finally {
    setLoading(false);
    isSaving = false;
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.style.opacity = "";
      btnSave.textContent = "Зберегти";
    }
    if (btnCancel) {
      btnCancel.disabled = false;
      btnCancel.style.opacity = "";
    }
  }
}

/* ===== API helper (FIX: file:// uses JSONP fallback also for writes) ===== */

async function callTasksApi_(action, payload = null) {
  const useJsonp = location.protocol === "file:";

  // 1) GET list always fine
  if (!payload) {
    if (useJsonp) return jsonp(`${TASKS_API_URL}?action=${encodeURIComponent(action)}`);
    const res = await fetch(`${TASKS_API_URL}?action=${encodeURIComponent(action)}`, { method: "GET" });
    return await res.json();
  }

  // 2) POST main way (https pages)
  if (!useJsonp) {
    const res = await fetch(TASKS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
    });
    return await res.json();
  }

  // 3) file:// fallback: try JSONP with query params
  // IMPORTANT: your Apps Script must accept GET for these actions (many do).
  const qs = new URLSearchParams();
  qs.set("action", action);

  // flatten payload into GET (data.*)
  if (payload.id) qs.set("id", payload.id);
  if (payload.data) {
    Object.entries(payload.data).forEach(([k, v]) => {
      qs.set(`data_${k}`, String(v ?? ""));
    });
  }

  return await jsonp(`${TASKS_API_URL}?${qs.toString()}`);
}

/* ===== Admins dropdown (from schedule API) ===== */

async function loadAdminsForSelect() {
  const modalSel = document.getElementById("taskAssignee");
  const filterSel = document.getElementById("assigneeFilter");

  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const data = await jsonp(`${SCHEDULE_API_URL}?action=list&month=${month}`);

    const names = new Set();
    (data && data.rows ? data.rows : []).forEach((r) => {
      (r.admin || []).forEach((a) => {
        const n = String(a || "").trim();
        if (n) names.add(n);
      });
    });

    const sorted = [...names].sort((a, b) => a.localeCompare(b));

    if (modalSel) {
      modalSel.innerHTML = "";
      modalSel.appendChild(new Option("— не вибрано —", ""));
      sorted.forEach((n) => modalSel.appendChild(new Option(n, n)));
    }

    if (filterSel) {
      const base = [
        { value: "__all__", text: "Відповідальний: Усі" },
        { value: "__none__", text: "Відповідальний: Без відповідального" },
      ];
      filterSel.innerHTML = "";
      base.forEach((o) => filterSel.appendChild(new Option(o.text, o.value)));
      sorted.forEach((n) => filterSel.appendChild(new Option(`Відповідальний: ${n}`, n)));
      filterSel.value = "__all__";
      assigneeFilter = "__all__";
    }
  } catch (e) {
    console.error("Admins load error", e);
  }
}

function refreshAssigneeFilterOptions_() {
  const filterSel = document.getElementById("assigneeFilter");
  if (!filterSel) return;

  const existing = new Set([...filterSel.options].map((o) => o.value));
  const names = new Set(
    allTasks
      .map((t) => String(t.assignee || "").trim())
      .filter(Boolean)
  );

  [...names].sort((a, b) => a.localeCompare(b)).forEach((n) => {
    if (!existing.has(n)) filterSel.appendChild(new Option(`Відповідальний: ${n}`, n));
  });

  if ([...filterSel.options].some((o) => o.value === assigneeFilter)) filterSel.value = assigneeFilter;
  else {
    assigneeFilter = "__all__";
    filterSel.value = "__all__";
  }
}

/* ===== helpers ===== */

function setListEmpty(text) {
  const list = document.getElementById("taskList");
  const counter = document.getElementById("taskCounter");
  if (counter) counter.textContent = "";
  if (list) list.innerHTML = `<div class="task-empty">${escapeHtml(text)}</div>`;
}

function toSortableDate_(ddmmyyyy) {
  const s = String(ddmmyyyy || "").trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function setLoading(on, text) {
  const el = document.getElementById("global-loader");
  const t = document.getElementById("global-loader-text");
  if (!el) return;
  if (t && text) t.textContent = text;
  el.classList.toggle("global-loader--hidden", !on);
}

function formatDueHuman_(due) {
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

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// JSONP helper (works from file://)
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cb}`;

    window[cb] = (data) => {
      try {
        resolve(data);
      } finally {
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