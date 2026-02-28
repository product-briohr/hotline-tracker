const MODULES = [
  "Claims",
  "Emails",
  "Feed",
  "GL report",
  "Import/Export",
  "Leave",
  "Mobile App specific (non module)",
  "Onboarding v3",
  "Payroll",
  "Performance",
  "Profile/Core",
  "Pulse",
  "Recruitment",
  "Report builder",
  "Staffany",
  "Time Attendance",
  "Timesheets",
  "Training",
  "Who's away",
  "Xero",
  "Document Management",
  "Others/General",
  "Public Holiday"
];
const ISSUE_TYPES = ["Bug (CS ticket)", "Feature request", "Question/Troubleshooting"];
const CS_LIST = [
  "Adila",
  "Arveena",
  "Awana",
  "Brandon",
  "Diyana",
  "Edison",
  "Edrin",
  "Elizabeth",
  "Haslina",
  "Ivan",
  "Kai Chi",
  "Lina",
  "Nadirah",
  "Nadzra",
  "Rubini",
  "Syakirah",
  "Yana",
  "Pavanjeet",
  "Aqilah"
];
const PM_OWNERS = ["Amir", "Idris Ashari", "Nita Puspita", "Nico"];
const PAGE_SIZE = 10;
const PAGE_WINDOW_SIZE = 10;
const THEME_KEY = "hotline-theme";

const els = {
  search: document.querySelector("#search"),
  syncBtn: document.querySelector("#syncBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  pageNumbers: document.querySelector("#pageNumbers"),
  toast: document.querySelector("#toast"),
  rows: document.querySelector("#rows")
};

const state = {
  page: 1,
  totalPages: 1,
  totalCount: 0,
  scrollToTableOnNextLoad: false,
  editingDescriptionId: "",
  editingCommentId: "",
  draftDescription: "",
  draftComment: "",
  currentRows: [],
  rowsById: new Map()
};

init();

function init() {
  applySavedTheme();

  els.search.addEventListener("input", debounce(() => goToPage(1), 220));
  els.syncBtn.addEventListener("click", runSync);
  els.themeToggle.addEventListener("click", toggleTheme);
  els.rows.addEventListener("click", onTableClick);
  els.rows.addEventListener("input", onTableInput);
  els.rows.addEventListener("change", onTableChange);
  els.pageNumbers.addEventListener("click", onPageNumbersClick);
  document.addEventListener("click", onDocumentClick);

  loadRows();
  setInterval(() => {
    if (!state.editingDescriptionId && !state.editingCommentId) loadRows();
  }, 15000);
}

function goToPage(page) {
  state.page = Math.max(1, page);
  loadRows();
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

async function loadRows() {
  const qs = new URLSearchParams();
  if (els.search.value.trim()) qs.set("q", els.search.value.trim());
  qs.set("page", String(state.page));
  qs.set("pageSize", String(PAGE_SIZE));

  const res = await fetch(`/api/issues?${qs.toString()}`);
  const data = await safeJson(res);
  if (!data.ok) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = `Failed to load: ${data.error || "Unknown error"}`;
    return;
  }

  const rows = data.rows || [];
  state.currentRows = rows;
  state.rowsById = new Map(rows.map((row) => [row.id, row]));
  state.totalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
  state.totalCount = Number(data?.count || 0);
  state.page = Math.min(Math.max(1, Number(data?.pagination?.page || state.page)), state.totalPages);
  if (state.page > state.totalPages) state.page = state.totalPages;

  renderPageNumbers();
  els.toast.textContent = "";
  renderTable();
  if (state.scrollToTableOnNextLoad) {
    const tableWrap = document.querySelector(".table-wrap");
    if (tableWrap) tableWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    state.scrollToTableOnNextLoad = false;
  }
}

function renderTable() {
  els.rows.innerHTML = state.currentRows.map((row, idx) => renderRow(row, idx)).join("") || emptyState();
  autoSizeVisibleTextareas();
}

function renderRow(row, idx) {
  const rowNumber = (state.page - 1) * PAGE_SIZE + idx + 1;
  const isEditingDesc = state.editingDescriptionId === row.id;
  const isEditingComment = state.editingCommentId === row.id;

  const descriptionCell = isEditingDesc
    ? `<div class="cell-edit">
        <textarea data-field="description" data-id="${escapeHtml(row.id)}" rows="4">${escapeHtml(state.draftDescription)}</textarea>
        <div class="mini-actions">
          <button class="mini-btn save" data-action="save-description" data-id="${escapeHtml(row.id)}">Save</button>
          <button class="mini-btn" data-action="cancel-description">Cancel</button>
        </div>
      </div>`
    : `<div class="cell-with-icon">
        <span class="desc-cell">${renderRichText(row.description || "")}</span>
        <button class="icon-only" data-action="edit-description" data-id="${escapeHtml(row.id)}" title="Edit description">✏️</button>
      </div>`;

  const commentsCell = isEditingComment
    ? `<div class="cell-edit">
        <textarea data-field="comments" data-id="${escapeHtml(row.id)}" rows="4">${escapeHtml(state.draftComment)}</textarea>
        <div class="mini-actions">
          <button class="mini-btn save" data-action="save-comments" data-id="${escapeHtml(row.id)}">Save</button>
          <button class="mini-btn" data-action="cancel-comments">Cancel</button>
        </div>
      </div>`
    : `<div class="cell-with-icon">
        <span class="comment-cell">${renderRichText(row.comments || "")}</span>
        <button class="icon-only" data-action="edit-comments" data-id="${escapeHtml(row.id)}" title="Add/Edit comment">＋</button>
      </div>`;

  return `<tr data-id="${escapeHtml(row.id)}">
    <td>${rowNumber}</td>
    <td>${escapeHtml(formatDisplayDate(row.date))}</td>
    <td>${renderPillMultiSelect("module", MODULES, row.module, row.id)}</td>
    <td>${renderPillMultiSelect("issueType", ISSUE_TYPES, row.issueType, row.id, false)}</td>
    <td>${renderPillMultiSelect("cs", CS_LIST, row.cs, row.id)}</td>
    <td>${renderPillMultiSelect("pmOwner", PM_OWNERS, row.pmOwner, row.id)}</td>
    <td>${descriptionCell}</td>
    <td>${commentsCell}</td>
  </tr>`;
}

function renderRowSelect(field, values, current, id, isMulti = false) {
  const selectedValues = isMulti ? new Set(parseMultiValue(current)) : new Set([String(current || "")]);
  const options = values
    .map((value) => {
      const selected = selectedValues.has(value) ? "selected" : "";
      return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(value)}</option>`;
    })
    .join("");
  const multiAttr = isMulti ? "multiple" : "";
  return `<select data-edit-field="${field}" data-id="${escapeHtml(id)}" ${multiAttr}>${options}</select>`;
}

function renderPillMultiSelect(field, values, current, id, isMulti = true) {
  const selected = parseMultiValue(current);
  const selectedValues = isMulti ? selected : selected.slice(0, 1);
  const selectedSet = new Set(selectedValues);
  const chips = selectedValues.length
    ? selectedValues.map((value) => renderChip(value)).join("")
    : `<span class="chip chip-empty">Select</span>`;

  const options = values
    .map((value) => {
      const isSelected = selectedSet.has(value);
      return `<div class="ms-option ${isSelected ? "selected" : ""}" data-action="toggle-ms-option" data-value="${escapeHtml(
        value
      )}">
        ${renderChip(value)}
        <span class="ms-check">${isSelected ? "✓" : ""}</span>
      </div>`;
    })
    .join("");

  return `<div class="ms" data-edit-field="${field}" data-id="${escapeHtml(id)}" data-multi="${
    isMulti ? "1" : "0"
  }" data-values="${escapeHtml(
    encodeMultiValue(selected)
  )}">
    <button class="ms-trigger" data-action="toggle-ms" type="button">
      <span class="ms-chips">${chips}</span>
      <span class="ms-caret">▾</span>
    </button>
    <div class="ms-menu">
      <input class="ms-search" type="text" placeholder="Search..." />
      <div class="ms-options">${options}</div>
    </div>
  </div>`;
}

function renderChip(value) {
  const tone = chipToneClass(value);
  return `<span class="chip ${tone}">${escapeHtml(value)}</span>`;
}

function chipToneClass(value) {
  let hash = 0;
  for (const ch of String(value || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tones = ["chip-tone-1", "chip-tone-2", "chip-tone-3", "chip-tone-4", "chip-tone-5"];
  return tones[hash % tones.length];
}

function onTableInput(event) {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    autoSizeTextarea(target);
    if (target.dataset.field === "description") state.draftDescription = target.value;
    if (target.dataset.field === "comments") state.draftComment = target.value;
    return;
  }

  if (target instanceof HTMLInputElement && target.classList.contains("ms-search")) {
    const menu = target.closest(".ms-menu");
    if (!menu) return;
    const q = target.value.trim().toLowerCase();
    const options = menu.querySelectorAll(".ms-option");
    for (const opt of options) {
      const label = opt.textContent.toLowerCase();
      opt.style.display = !q || label.includes(q) ? "" : "none";
    }
  }
}

async function onTableClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id || "";
  const row = state.rowsById.get(id);

  if (action === "toggle-ms") {
    event.stopPropagation();
    const cell = btn.closest(".ms");
    if (!cell) return;
    for (const other of document.querySelectorAll(".ms.open")) {
      if (other !== cell) other.classList.remove("open");
    }
    cell.classList.toggle("open");
    return;
  }

  if (action === "toggle-ms-option") {
    event.stopPropagation();
    const option = btn.closest(".ms-option");
    const cell = btn.closest(".ms");
    if (!option || !cell) return;
    const field = cell.dataset.editField || "";
    const rowId = cell.dataset.id || "";
    const base = state.rowsById.get(rowId);
    if (!field || !base) return;

    const value = option.dataset.value || "";
    const isMulti = cell.dataset.multi !== "0";
    const selected = new Set(parseMultiValue(cell.dataset.values || ""));
    if (isMulti) {
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
    } else {
      selected.clear();
      selected.add(value);
    }
    const merged = encodeMultiValue(Array.from(selected));
    cell.dataset.values = merged;
    await saveRowPatch(rowId, { ...base, [field]: merged });
    if (!isMulti) cell.classList.remove("open");
    return;
  }

  if (action === "edit-description" && row) {
    state.editingCommentId = "";
    state.editingDescriptionId = id;
    state.draftDescription = row.description || "";
    renderTable();
    return;
  }
  if (action === "cancel-description") {
    state.editingDescriptionId = "";
    state.draftDescription = "";
    await loadRows();
    return;
  }
  if (action === "save-description" && row) {
    const nextDescription = state.draftDescription;
    state.editingDescriptionId = "";
    state.draftDescription = "";
    await saveRowPatch(id, { description: nextDescription, comments: row.comments || "" });
    return;
  }

  if (action === "edit-comments" && row) {
    state.editingDescriptionId = "";
    state.editingCommentId = id;
    state.draftComment = row.comments || "";
    renderTable();
    return;
  }
  if (action === "cancel-comments") {
    state.editingCommentId = "";
    state.draftComment = "";
    await loadRows();
    return;
  }
  if (action === "save-comments" && row) {
    const nextComments = state.draftComment;
    state.editingCommentId = "";
    state.draftComment = "";
    await saveRowPatch(id, { description: row.description || "", comments: nextComments });
  }
}

function onDocumentClick(event) {
  if (event.target.closest(".ms")) return;
  for (const open of document.querySelectorAll(".ms.open")) {
    open.classList.remove("open");
  }
}

function autoSizeVisibleTextareas() {
  const textareas = els.rows.querySelectorAll("textarea[data-field='description'], textarea[data-field='comments']");
  for (const textarea of textareas) {
    autoSizeTextarea(textarea);
  }
}

function autoSizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

async function onTableChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const field = target.dataset.editField;
  const id = target.dataset.id || "";
  if (!field || !id) return;
  const row = state.rowsById.get(id);
  if (!row) return;

  const value = target.multiple
    ? encodeMultiValue(
        Array.from(target.selectedOptions || [])
          .map((opt) => opt.value)
          .filter(Boolean)
      )
    : target.value;

  await saveRowPatch(id, {
    ...row,
    [field]: value
  });
}

async function saveRowPatch(id, fields) {
  const row = state.rowsById.get(id);
  if (!row) return;

  const payload = {
    id,
    date: fields.date ?? row.date ?? "",
    module: fields.module ?? row.module ?? "",
    issueType: fields.issueType ?? row.issueType ?? "",
    cs: fields.cs ?? row.cs ?? "",
    pmOwner: fields.pmOwner ?? row.pmOwner ?? "",
    description: fields.description ?? row.description ?? "",
    comments: fields.comments ?? row.comments ?? ""
  };

  try {
    const res = await fetch("/api/issues/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!data.ok) {
      els.toast.style.color = "var(--danger)";
      els.toast.textContent = data.error || "Update failed";
      return;
    }
    els.toast.style.color = "var(--success)";
    els.toast.textContent = "Row updated";
    await loadRows();
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  }
}

function renderPageNumbers() {
  const buttons = [];
  const windowStart = Math.floor((state.page - 1) / PAGE_WINDOW_SIZE) * PAGE_WINDOW_SIZE + 1;
  const windowEnd = Math.min(state.totalPages, windowStart + PAGE_WINDOW_SIZE - 1);

  if (windowStart > 1) {
    buttons.push(
      `<button class="page-btn nav" data-page="${windowStart - 1}" type="button">Prev</button>`
    );
  }

  for (let p = windowStart; p <= windowEnd; p += 1) {
    const active = p === state.page ? "active" : "";
    buttons.push(
      `<button class="page-btn ${active}" data-page="${p}" type="button">${p}</button>`
    );
  }

  if (windowEnd < state.totalPages) {
    buttons.push(
      `<button class="page-btn nav" data-page="${windowEnd + 1}" type="button">Next</button>`
    );
  }
  els.pageNumbers.innerHTML = buttons.join("");
}

function onPageNumbersClick(event) {
  const btn = event.target.closest("button[data-page]");
  if (!btn) return;
  const p = Number(btn.dataset.page || 1);
  if (p >= 1 && p <= state.totalPages && p !== state.page) {
    state.scrollToTableOnNextLoad = true;
    goToPage(p);
  }
}

async function runSync() {
  const original = els.syncBtn.textContent;
  els.syncBtn.disabled = true;
  els.syncBtn.textContent = "Syncing...";
  els.toast.textContent = "";

  try {
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await safeJson(res);
    if (!data.ok) {
      els.toast.style.color = "var(--danger)";
      els.toast.textContent = data.error || "Sync failed";
      return;
    }
    els.toast.style.color = "var(--success)";
    els.toast.textContent = data.message || "Sync completed";
    state.page = 1;
    await loadRows();
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = original;
  }
}

function formatDisplayDate(dateStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return "";
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `${day}${ordinal(day)} ${month} ${year}`;
}

function ordinal(day) {
  if (day >= 11 && day <= 13) return "th";
  const mod = day % 10;
  if (mod === 1) return "st";
  if (mod === 2) return "nd";
  if (mod === 3) return "rd";
  return "th";
}

function emptyState() {
  return `<tr><td colspan="8" style="color:var(--muted);">No issues found for current filters.</td></tr>`;
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "dark" ? "dark" : "light");
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  els.themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRichText(input) {
  const escaped = escapeHtml(input || "");
  return escaped.replace(
    /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi,
    (match) => {
      const href = match.toLowerCase().startsWith("www.") ? `https://${match}` : match;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    }
  );
}

function parseMultiValue(input) {
  return String(input || "")
    .split(/\s*\|\s*|,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function encodeMultiValue(values) {
  return Array.from(new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))).join(" | ");
}
