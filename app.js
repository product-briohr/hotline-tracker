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
const DEFAULT_PAGE_SIZE = 10;
const THEME_KEY = "hotline-theme";
const MIN_FILTER_DATE = "2026-02-25";

const els = {
  search: document.querySelector("#search"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  dateRangeWrap: document.querySelector("#dateRangeWrap"),
  dateRangeFilter: document.querySelector("#dateRangeFilter"),
  datePresets: document.querySelector("#datePresets"),
  moduleFilterMs: document.querySelector("#moduleFilterMs"),
  issueTypeFilterMs: document.querySelector("#issueTypeFilterMs"),
  csFilterMs: document.querySelector("#csFilterMs"),
  pmOwnerFilterMs: document.querySelector("#pmOwnerFilterMs"),
  tableFilters: document.querySelector(".table-filters"),
  newIssueBtn: document.querySelector("#newIssueBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  syncBtn: document.querySelector("#syncBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  pageNumbers: document.querySelector("#pageNumbers"),
  pageSummary: document.querySelector("#pageSummary"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  lastUpdated: document.querySelector("#lastUpdated"),
  toast: document.querySelector("#toast"),
  rows: document.querySelector("#rows"),
  newIssueModal: document.querySelector("#newIssueModal"),
  newIssueClose: document.querySelector("#newIssueClose"),
  newIssueCancel: document.querySelector("#newIssueCancel"),
  newIssueForm: document.querySelector("#newIssueForm"),
  newDate: document.querySelector("#newDate"),
  newModuleMs: document.querySelector("#newModuleMs"),
  newIssueType: document.querySelector("#newIssueType"),
  newCsMs: document.querySelector("#newCsMs"),
  newPmOwnerMs: document.querySelector("#newPmOwnerMs"),
  newDescription: document.querySelector("#newDescription"),
  newComments: document.querySelector("#newComments"),
  newIssueSave: document.querySelector("#newIssueSave")
  ,
  deleteConfirmModal: document.querySelector("#deleteConfirmModal"),
  deleteConfirmClose: document.querySelector("#deleteConfirmClose"),
  deleteConfirmCancel: document.querySelector("#deleteConfirmCancel"),
  deleteConfirmSubmit: document.querySelector("#deleteConfirmSubmit")
};

const state = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 1,
  totalCount: 0,
  scrollToTableOnNextLoad: false,
  editingDescriptionId: "",
  editingCommentId: "",
  draftDescription: "",
  draftComment: "",
  filterValues: {
    module: [],
    issueType: [],
    cs: [],
    pmOwner: []
  },
  currentRows: [],
  rowsById: new Map(),
  deletingId: "",
  dateRange: {
    from: "",
    to: ""
  },
  datePicker: null
};

init();

async function init() {
  if (typeof window.waitForHotlineAuth === "function") {
    await window.waitForHotlineAuth();
  }
  applySavedTheme();
  setNewIssueOptions();
  requestAnimationFrame(() => {
    renderTableFilterMultiSelects();
  });
  resetNewIssueForm();

  els.search.addEventListener("input", debounce(() => goToPage(1), 220));
  els.clearFiltersBtn.addEventListener("click", clearAllFilters);
  initDateRangePicker();
  els.datePresets.addEventListener("click", onDatePresetClick);
  els.dateRangeFilter.addEventListener("click", (event) => {
    event.stopPropagation();
    openDatePresetPanel();
  });
  els.tableFilters.addEventListener("click", onFilterClick);
  els.tableFilters.addEventListener("input", onFilterInput);
  els.newIssueBtn.addEventListener("click", openNewIssueModal);
  els.exportBtn.addEventListener("click", exportFilteredRowsToExcel);
  if (els.syncBtn) {
    els.syncBtn.addEventListener("click", runSync);
  }
  els.themeToggle.addEventListener("click", toggleTheme);
  els.rows.addEventListener("click", onTableClick);
  els.rows.addEventListener("input", onTableInput);
  els.rows.addEventListener("change", onTableChange);
  els.newIssueModal.addEventListener("click", onModalClick);
  els.newIssueModal.addEventListener("input", onModalInput);
  els.pageNumbers.addEventListener("click", onPageNumbersClick);
  els.pageSizeSelect.addEventListener("change", onPageSizeChange);
  els.newIssueClose.addEventListener("click", closeNewIssueModal);
  els.newIssueCancel.addEventListener("click", closeNewIssueModal);
  els.newIssueForm.addEventListener("submit", onNewIssueSubmit);
  els.deleteConfirmClose.addEventListener("click", closeDeleteConfirmModal);
  els.deleteConfirmCancel.addEventListener("click", closeDeleteConfirmModal);
  els.deleteConfirmSubmit.addEventListener("click", onDeleteConfirmSubmit);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeyDown);

  loadRows();
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

async function loadRows(options = {}) {
  const qs = buildIssueQueryParams({ page: state.page, pageSize: state.pageSize });

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
  state.pageSize = Math.max(1, Number(data?.pagination?.pageSize || state.pageSize || DEFAULT_PAGE_SIZE));
  if (els.pageSizeSelect.value !== String(state.pageSize)) {
    els.pageSizeSelect.value = String(state.pageSize);
  }
  els.lastUpdated.textContent = `Last auto sync: ${formatLastUpdated(data?.lastAutoSyncAt)}`;
  state.page = Math.min(Math.max(1, Number(data?.pagination?.page || state.page)), state.totalPages);
  if (state.page > state.totalPages) state.page = state.totalPages;

  renderPageNumbers();
  if (!options.preserveToast) {
    els.toast.textContent = "";
  }
  renderTable();
  if (state.scrollToTableOnNextLoad) {
    const tableWrap = document.querySelector(".table-wrap");
    if (tableWrap) {
      const top = tableWrap.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    state.scrollToTableOnNextLoad = false;
  }
}

function buildIssueQueryParams({ page, pageSize }) {
  const qs = new URLSearchParams();
  if (els.search.value.trim()) qs.set("q", els.search.value.trim());
  const maxDate = toIsoDateLocal(new Date());
  const rawFrom = String(state.dateRange.from || "").trim();
  const rawTo = String(state.dateRange.to || "").trim();
  const normalizedFrom = rawFrom && rawTo && rawFrom > rawTo ? rawTo : rawFrom;
  const normalizedTo = rawFrom && rawTo && rawFrom > rawTo ? rawFrom : rawTo;
  const dateFrom = clampIsoDateUpperBound(clampIsoDateLowerBound(normalizedFrom, MIN_FILTER_DATE), maxDate);
  const dateTo = clampIsoDateUpperBound(clampIsoDateLowerBound(normalizedTo, MIN_FILTER_DATE), maxDate);
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  for (const v of state.filterValues.module) qs.append("module", v);
  for (const v of state.filterValues.issueType) qs.append("issueType", v);
  for (const v of state.filterValues.cs) qs.append("cs", v);
  for (const v of state.filterValues.pmOwner) qs.append("pmOwner", v);
  qs.set("page", String(Math.max(1, Number(page || 1))));
  qs.set("pageSize", String(Math.max(1, Number(pageSize || DEFAULT_PAGE_SIZE))));
  return qs;
}

async function exportFilteredRowsToExcel() {
  const original = els.exportBtn.textContent;
  els.exportBtn.disabled = true;
  els.exportBtn.textContent = "Exporting...";
  els.toast.textContent = "";

  try {
    const rows = await fetchAllFilteredRows();
    if (!rows.length) {
      els.toast.style.color = "var(--danger)";
      els.toast.textContent = "No rows to export";
      return;
    }
    const csv = toCsv(rows);
    downloadCsv(csv, `product-hotline-${toIsoDateLocal(new Date())}.csv`);
    els.toast.style.color = "var(--success)";
    els.toast.textContent = `Exported ${rows.length} row(s)`;
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = `Export failed: ${String(error?.message || error)}`;
  } finally {
    els.exportBtn.disabled = false;
    els.exportBtn.textContent = original;
  }
}

async function fetchAllFilteredRows() {
  const pageSize = 100;
  const firstQs = buildIssueQueryParams({ page: 1, pageSize });
  const firstRes = await fetch(`/api/issues?${firstQs.toString()}`);
  const firstData = await safeJson(firstRes);
  if (!firstData.ok) {
    throw new Error(firstData.error || "Failed to load rows for export");
  }

  const allRows = Array.isArray(firstData.rows) ? [...firstData.rows] : [];
  const totalPages = Math.max(1, Number(firstData?.pagination?.totalPages || 1));
  if (totalPages <= 1) return allRows;

  for (let page = 2; page <= totalPages; page += 1) {
    const qs = buildIssueQueryParams({ page, pageSize });
    const res = await fetch(`/api/issues?${qs.toString()}`);
    const data = await safeJson(res);
    if (!data.ok) {
      throw new Error(data.error || `Failed while exporting page ${page}`);
    }
    if (Array.isArray(data.rows)) allRows.push(...data.rows);
  }
  return allRows;
}

function toCsv(rows) {
  const headers = [
    "Date",
    "Module",
    "Issue Type",
    "CS",
    "PM Owner",
    "Issue / Question Description",
    "Comments"
  ];
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.date || "",
        row.module || "",
        row.issueType || "",
        row.cs || "",
        row.pmOwner || "",
        row.description || "",
        row.comments || ""
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderTable() {
  els.rows.innerHTML = state.currentRows.map((row, idx) => renderRow(row, idx)).join("") || emptyState();
  autoSizeVisibleTextareas();
}

function renderRow(row, idx) {
  const rowNumber = (state.page - 1) * state.pageSize + idx + 1;
  const isEditingDesc = state.editingDescriptionId === row.id;
  const isEditingComment = state.editingCommentId === row.id;
  const shouldShowCsEditor = shouldShowCsField(row);

  const descriptionCell = isEditingDesc
    ? `<div class="cell-edit">
        <textarea data-field="description" data-id="${escapeHtml(row.id)}" rows="4">${escapeHtml(state.draftDescription)}</textarea>
        <div class="mini-actions">
          <button class="mini-btn save" data-action="save-description" data-id="${escapeHtml(row.id)}">Save</button>
          <button class="mini-btn" data-action="cancel-description">Cancel</button>
        </div>
      </div>`
    : `<div class="cell-with-icon">
        <span class="desc-cell">${renderDescriptionText(row.description || "")}</span>
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
    : String(row.comments || "").trim()
      ? `<div class="cell-with-icon">
          <span class="comment-cell">${renderRichText(row.comments || "")}</span>
          <button class="icon-only comment-add-btn" data-action="edit-comments" data-id="${escapeHtml(
            row.id
          )}" title="Edit comment">✏️</button>
        </div>`
      : `<div class="cell-with-icon comment-empty-wrap">
          <span class="comment-cell"></span>
          <button class="icon-only comment-add-btn" data-action="edit-comments" data-id="${escapeHtml(
            row.id
          )}" title="Add/Edit comment">＋</button>
        </div>`;

  return `<tr data-id="${escapeHtml(row.id)}">
    <td>${rowNumber}</td>
    <td>${escapeHtml(formatDisplayDate(row.date))}</td>
    <td>${renderPillMultiSelect("module", MODULES, row.module, row.id)}</td>
    <td>${renderPillMultiSelect("issueType", ISSUE_TYPES, row.issueType, row.id, false)}</td>
    <td>${shouldShowCsEditor ? renderPillMultiSelect("cs", CS_LIST, row.cs, row.id) : ""}</td>
    <td>${renderPillMultiSelect("pmOwner", PM_OWNERS, row.pmOwner, row.id)}</td>
    <td>${descriptionCell}</td>
    <td>${commentsCell}</td>
    <td><div class="action-cell"><button class="icon-only danger" data-action="delete-row" data-id="${escapeHtml(
      row.id
    )}" title="Delete row">🗑</button></div></td>
  </tr>`;
}

function shouldShowCsField(row) {
  const currentCs = String(row?.cs || "").trim();
  if (currentCs) return true;
  const description = String(row?.description || "").toLowerCase();
  if (!description) return false;
  return CS_LIST.some((name) => description.includes(String(name || "").toLowerCase()));
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
        ${renderValueChip(field, value)}
        <span class="ms-check">${isSelected ? "✓" : ""}</span>
      </div>`;
    })
    .join("");

  const footer = isMulti
    ? `<div class="ms-footer">
        <button class="mini-btn" data-action="cancel-ms" type="button">Cancel</button>
        <button class="mini-btn save" data-action="apply-ms" type="button">Apply</button>
      </div>`
    : "";

  return `<div class="ms" data-context="row" data-edit-field="${field}" data-id="${escapeHtml(id)}" data-multi="${
    isMulti ? "1" : "0"
  }" data-values="${escapeHtml(
    encodeMultiValue(selected)
  )}">
    <button class="ms-trigger" data-action="toggle-ms" type="button">
      <span class="ms-chips">${selectedValues.map((value) => renderValueChip(field, value)).join("") || chips}</span>
      <span class="ms-caret">▾</span>
    </button>
    <div class="ms-menu">
      <input class="ms-search" type="text" placeholder="Search..." />
      <div class="ms-options">${options}</div>
      ${footer}
    </div>
  </div>`;
}

function renderChip(value) {
  const tone = chipToneClass(value);
  return `<span class="chip ${tone}">${escapeHtml(value)}</span>`;
}

function renderValueChip(field, value) {
  if (field === "issueType") {
    return `<span class="chip ${issueTypeChipClass(value)}">${escapeHtml(value)}</span>`;
  }
  return renderChip(value);
}

function issueTypeChipClass(value) {
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized === "bug (cs ticket)") return "chip-issue-bug";
  if (normalized === "feature request") return "chip-issue-feature";
  if (normalized === "question/troubleshooting") return "chip-issue-question";
  return "chip-tone-2";
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
    handleMultiSelectSearchInput(target);
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
    const isOpen = cell.classList.contains("open");
    for (const other of document.querySelectorAll(".ms.open")) {
      if (other !== cell) {
        if (other.dataset.context === "row") {
          await maybeSavePendingRowMultiSelect(other);
        }
        other.classList.remove("open");
      }
    }
    if (!isOpen) {
      cell.dataset.original = cell.dataset.values || "";
    } else {
      await maybeSavePendingRowMultiSelect(cell);
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
    if (isMulti) {
      refreshMultiSelectVisual(cell, field, parseMultiValue(merged));
      return;
    }
    await saveRowPatch(rowId, { ...base, [field]: merged });
    cell.classList.remove("open");
    return;
  }

  if (action === "cancel-ms") {
    event.stopPropagation();
    const cell = btn.closest(".ms");
    if (!cell) return;
    const field = cell.dataset.editField || "";
    const original = cell.dataset.original || "";
    cell.dataset.values = original;
    refreshMultiSelectVisual(cell, field, parseMultiValue(original));
    cell.classList.remove("open");
    return;
  }

  if (action === "apply-ms") {
    event.stopPropagation();
    const cell = btn.closest(".ms");
    if (!cell) return;
    const field = cell.dataset.editField || "";
    const rowId = cell.dataset.id || "";
    const base = state.rowsById.get(rowId);
    if (!field || !base) return;
    const merged = cell.dataset.values || "";
    await saveRowPatch(rowId, { ...base, [field]: merged });
    cell.classList.remove("open");
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
    return;
  }

  if (action === "delete-row" && row) {
    state.deletingId = id;
    els.deleteConfirmModal.classList.remove("hidden");
  }
}

function onDocumentClick(event) {
  const clickedInDateUi =
    (els.dateRangeWrap && els.dateRangeWrap.contains(event.target)) ||
    (els.datePresets && els.datePresets.contains(event.target)) ||
    Boolean(event.target.closest(".flatpickr-calendar"));
  if (!clickedInDateUi) {
    closeDatePresetPanel();
  }
  if (event.target === els.newIssueModal) {
    closeNewIssueModal();
    return;
  }
  if (event.target === els.deleteConfirmModal) {
    closeDeleteConfirmModal();
    return;
  }
  if (event.target.closest(".ms")) return;
  for (const open of document.querySelectorAll(".ms.open")) {
    if (open.dataset.context === "row") {
      void maybeSavePendingRowMultiSelect(open);
    }
    open.classList.remove("open");
  }
}

function onDocumentKeyDown(event) {
  if (event.key === "Escape") {
    closeDatePresetPanel();
  }
  if (event.key === "Escape" && !els.newIssueModal.classList.contains("hidden")) {
    closeNewIssueModal();
  } else if (event.key === "Escape" && !els.deleteConfirmModal.classList.contains("hidden")) {
    closeDeleteConfirmModal();
  }
}

function onModalInput(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.classList.contains("ms-search")) {
    handleMultiSelectSearchInput(target);
  }
}

function onModalClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
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
    const isMulti = cell.dataset.multi !== "0";
    const value = option.dataset.value || "";
    if (!field || !value) return;

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
    refreshMultiSelectVisual(cell, field, parseMultiValue(merged));
    if (!isMulti) cell.classList.remove("open");
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
    await loadRows({ preserveToast: true });
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  }
}

function renderPageNumbers() {
  const buttons = [];
  const current = state.page;
  const total = state.totalPages;
  const items = buildCompactPageItems(current, total);

  const prevDisabled = current <= 1 ? "disabled" : "";
  const prevPage = Math.max(1, current - 1);
  buttons.push(
    `<button class="page-btn nav" data-page="${prevPage}" type="button" aria-label="Previous page" ${prevDisabled}>‹</button>`
  );

  for (const item of items) {
    if (item === "...") {
      buttons.push(`<span class="page-ellipsis">…</span>`);
      continue;
    }
    const active = item === current ? "active" : "";
    buttons.push(`<button class="page-btn ${active}" data-page="${item}" type="button">${item}</button>`);
  }

  const nextDisabled = current >= total ? "disabled" : "";
  const nextPage = Math.min(total, current + 1);
  buttons.push(
    `<button class="page-btn nav" data-page="${nextPage}" type="button" aria-label="Next page" ${nextDisabled}>›</button>`
  );

  els.pageNumbers.innerHTML = buttons.join("");
  renderPageSummary();
}

function onPageNumbersClick(event) {
  const btn = event.target.closest("button[data-page]");
  if (!btn || btn.disabled) return;
  const p = Number(btn.dataset.page || 1);
  if (p >= 1 && p <= state.totalPages && p !== state.page) {
    state.scrollToTableOnNextLoad = true;
    goToPage(p);
  }
}

function onPageSizeChange() {
  const nextSize = Math.max(1, Number(els.pageSizeSelect.value || DEFAULT_PAGE_SIZE));
  if (nextSize === state.pageSize) return;
  state.pageSize = nextSize;
  state.page = 1;
  loadRows();
}

function renderPageSummary() {
  if (!els.pageSummary) return;
  if (!state.totalCount) {
    els.pageSummary.textContent = "Results: 0 - 0 of 0";
    return;
  }
  const start = (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.totalCount, state.page * state.pageSize);
  els.pageSummary.textContent = `Results: ${start} - ${end} of ${state.totalCount}`;
}

function buildCompactPageItems(current, total) {
  if (total <= 1) return [1];
  if (total <= 7) return range(1, total);

  let start = 2;
  let end = total - 1;
  if (current <= 2) {
    start = 2;
    end = 3;
  } else if (current === 3) {
    start = 2;
    end = 4;
  } else if (current >= total - 1) {
    start = total - 2;
    end = total - 1;
  } else if (current === total - 2) {
    start = total - 3;
    end = total - 1;
  } else {
    start = current - 1;
    end = current + 1;
  }

  const out = [1];
  if (start > 2) out.push("...");
  for (let p = start; p <= end; p += 1) out.push(p);
  if (end < total - 1) out.push("...");
  out.push(total);
  return out;
}

function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

async function runSync() {
  const original = els.syncBtn.textContent;
  els.syncBtn.disabled = true;
  els.syncBtn.textContent = "Syncing...";
  els.toast.textContent = "";

  try {
    const res = await fetch("/api/sync?force=true", { method: "POST" });
    const data = await safeJson(res);
    if (!data.ok) {
      els.toast.style.color = "var(--danger)";
      els.toast.textContent = data.error || "Sync failed";
      return;
    }
    els.toast.style.color = "var(--success)";
    els.toast.textContent = data.message || "Sync completed";
    state.page = 1;
    await loadRows({ preserveToast: true });
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = original;
  }
}

function setNewIssueOptions() {
  els.newIssueType.innerHTML = ISSUE_TYPES.map(
    (x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`
  ).join("");
  renderNewIssueMultiSelects({ module: [], cs: [], pmOwner: [] });
}

function setTableFilterOptions() {
  renderTableFilterMultiSelects();
}

function resetNewIssueForm() {
  els.newDate.value = toIsoDateLocal(new Date());
  els.newIssueType.value = ISSUE_TYPES[0] || "Question/Troubleshooting";
  renderNewIssueMultiSelects({ module: [], cs: [], pmOwner: [] });
  els.newDescription.value = "";
  els.newComments.value = "";
}

function openNewIssueModal() {
  resetNewIssueForm();
  els.newIssueModal.classList.remove("hidden");
  els.newDescription.focus();
}

function closeNewIssueModal() {
  els.newIssueModal.classList.add("hidden");
}

function closeDeleteConfirmModal() {
  state.deletingId = "";
  els.deleteConfirmModal.classList.add("hidden");
}

async function onNewIssueSubmit(event) {
  event.preventDefault();
  const payload = {
    date: els.newDate.value,
    module: getModalMultiSelectValue(els.newModuleMs),
    issueType: els.newIssueType.value,
    cs: getModalMultiSelectValue(els.newCsMs),
    pmOwner: getModalMultiSelectValue(els.newPmOwnerMs),
    description: els.newDescription.value.trim(),
    comments: els.newComments.value.trim()
  };
  if (!payload.module) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = "Module is required";
    return;
  }
  if (!payload.description) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = "Description is required";
    return;
  }

  const original = els.newIssueSave.textContent;
  els.newIssueSave.disabled = true;
  els.newIssueSave.textContent = "Saving...";
  try {
    const res = await fetch("/api/issues/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!data.ok) {
      els.toast.style.color = "var(--danger)";
      els.toast.textContent = data.error || "Failed to create issue";
      return;
    }

    closeNewIssueModal();
    state.page = 1;
    els.toast.style.color = "var(--success)";
    els.toast.textContent = "Issue created";
    await loadRows({ preserveToast: true });
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  } finally {
    els.newIssueSave.disabled = false;
    els.newIssueSave.textContent = original;
  }
}

async function onDeleteConfirmSubmit() {
  const id = state.deletingId;
  if (!id) return;

  const original = els.deleteConfirmSubmit.textContent;
  els.deleteConfirmSubmit.disabled = true;
  els.deleteConfirmSubmit.textContent = "Deleting...";
  try {
    const res = await fetch("/api/issues/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await safeJson(res);
    if (!data.ok) {
      els.toast.style.color = "var(--danger)";
      els.toast.textContent = data.error || "Failed to delete record";
      return;
    }

    closeDeleteConfirmModal();
    if (state.currentRows.length <= 1 && state.page > 1) state.page -= 1;
    els.toast.style.color = "var(--success)";
    els.toast.textContent = "Record deleted";
    await loadRows({ preserveToast: true });
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  } finally {
    els.deleteConfirmSubmit.disabled = false;
    els.deleteConfirmSubmit.textContent = original;
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
  return `<tr>
    <td colspan="9" class="empty-cell">
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">🔎</div>
        <div class="empty-title">No issues found</div>
        <div class="empty-subtitle">Try adjusting filters or clear them to see more records.</div>
      </div>
    </td>
  </tr>`;
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
  els.themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  els.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
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

function renderDescriptionText(input) {
  const raw = String(input || "");
  const titleMatch = raw.match(/^([^:\n]{3,180}:)\s*/);
  if (!titleMatch) return renderRichText(raw);

  const title = titleMatch[1];
  const rest = raw.slice(titleMatch[0].length);
  return `<strong>${escapeHtml(title)}</strong> ${renderRichText(rest)}`;
}

async function maybeSavePendingRowMultiSelect(cell) {
  const field = cell.dataset.editField || "";
  const rowId = cell.dataset.id || "";
  const current = cell.dataset.values || "";
  const original = cell.dataset.original || "";
  if (!field || !rowId || current === original) return;
  const base = state.rowsById.get(rowId);
  if (!base) return;
  await saveRowPatch(rowId, { ...base, [field]: current });
  cell.dataset.original = current;
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

function handleMultiSelectSearchInput(target) {
  const menu = target.closest(".ms-menu");
  if (!menu) return;
  const q = target.value.trim().toLowerCase();
  const options = menu.querySelectorAll(".ms-option");
  for (const opt of options) {
    const label = opt.textContent.toLowerCase();
    opt.style.display = !q || label.includes(q) ? "" : "none";
  }
}

function renderNewIssueMultiSelects(valuesByField) {
  els.newModuleMs.innerHTML = renderModalPillMultiSelect("module", MODULES, valuesByField.module || []);
  els.newCsMs.innerHTML = renderModalPillMultiSelect("cs", CS_LIST, valuesByField.cs || []);
  els.newPmOwnerMs.innerHTML = renderModalPillMultiSelect("pmOwner", PM_OWNERS, valuesByField.pmOwner || []);
}

function renderModalPillMultiSelect(field, values, selectedValues) {
  const selectedSet = new Set(selectedValues);
  const chipsHtml = selectedValues.length
    ? selectedValues.map((value) => renderValueChip(field, value)).join("")
    : `<span class="chip chip-empty">Select</span>`;
  const options = values
    .map((value) => {
      const isSelected = selectedSet.has(value);
      return `<div class="ms-option ${isSelected ? "selected" : ""}" data-action="toggle-ms-option" data-value="${escapeHtml(
        value
      )}">
        ${renderValueChip(field, value)}
        <span class="ms-check">${isSelected ? "✓" : ""}</span>
      </div>`;
    })
    .join("");
  return `<div class="ms" data-context="modal" data-edit-field="${field}" data-multi="1" data-values="${escapeHtml(
    encodeMultiValue(selectedValues)
  )}">
    <button class="ms-trigger" data-action="toggle-ms" type="button">
      <span class="ms-chips">${chipsHtml}</span>
      <span class="ms-caret">▾</span>
    </button>
    <div class="ms-menu">
      <input class="ms-search" type="text" placeholder="Search..." />
      <div class="ms-options">${options}</div>
    </div>
  </div>`;
}

function refreshMultiSelectVisual(msCell, field, selectedValues) {
  const chipsContainer = msCell.querySelector(".ms-chips");
  if (chipsContainer) {
    chipsContainer.innerHTML = selectedValues.length
      ? selectedValues.map((value) => renderValueChip(field, value)).join("")
      : `<span class="chip chip-empty">Select</span>`;
  }
  const selectedSet = new Set(selectedValues);
  const options = msCell.querySelectorAll(".ms-option");
  for (const option of options) {
    const value = option.dataset.value || "";
    const selected = selectedSet.has(value);
    option.classList.toggle("selected", selected);
    const check = option.querySelector(".ms-check");
    if (check) check.textContent = selected ? "✓" : "";
  }
}

function getModalMultiSelectValue(container) {
  const ms = container.querySelector(".ms");
  return ms?.dataset?.values || "";
}

function toIsoDateLocal(inputDate) {
  const d = new Date(inputDate || new Date());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isLocalDevHost() {
  const host = String(location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function getSelectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions || [])
    .map((opt) => opt.value)
    .filter(Boolean);
}

function renderTableFilterMultiSelects() {
  const m = document.querySelector("#moduleFilterMs");
  const t = document.querySelector("#issueTypeFilterMs");
  const c = document.querySelector("#csFilterMs");
  const p = document.querySelector("#pmOwnerFilterMs");
  if (m) m.innerHTML = renderFilterPillMultiSelect("module", MODULES, state.filterValues.module);
  if (t) t.innerHTML = renderFilterPillMultiSelect("issueType", ISSUE_TYPES, state.filterValues.issueType);
  if (c) c.innerHTML = renderFilterPillMultiSelect("cs", CS_LIST, state.filterValues.cs);
  if (p) p.innerHTML = renderFilterPillMultiSelect("pmOwner", PM_OWNERS, state.filterValues.pmOwner);
}

function renderFilterPillMultiSelect(field, values, selectedValues) {
  const selected = Array.from(new Set(selectedValues || []));
  const selectedSet = new Set(selected);
  const chips = selected.length
    ? selected.map((value) => renderValueChip(field, value)).join("")
    : `<span class="chip chip-empty">All</span>`;
  const options = values
    .map((value) => {
      const isSelected = selectedSet.has(value);
      return `<div class="ms-option ${isSelected ? "selected" : ""}" data-action="toggle-filter-option" data-value="${escapeHtml(
        value
      )}">
        ${renderValueChip(field, value)}
        <span class="ms-check">${isSelected ? "✓" : ""}</span>
      </div>`;
    })
    .join("");
  return `<div class="ms filter-ms" data-context="filters" data-filter-field="${field}" data-multi="1" data-values="${escapeHtml(
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

function onFilterInput(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.classList.contains("ms-search")) {
    handleMultiSelectSearchInput(target);
  }
}

function onFilterClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
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
  if (action === "toggle-filter-option") {
    event.stopPropagation();
    const option = btn.closest(".ms-option");
    const cell = btn.closest(".ms");
    if (!option || !cell) return;
    const field = cell.dataset.filterField || "";
    if (!field) return;
    const value = option.dataset.value || "";
    const selected = new Set(state.filterValues[field] || []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    state.filterValues[field] = Array.from(selected);
    refreshMultiSelectVisual(cell, field, state.filterValues[field]);
    goToPage(1);
  }
}

function clearAllFilters() {
  els.search.value = "";
  state.dateRange = { from: "", to: "" };
  if (state.datePicker) state.datePicker.clear();
  closeDatePresetPanel();
  state.filterValues = {
    module: [],
    issueType: [],
    cs: [],
    pmOwner: []
  };
  renderTableFilterMultiSelects();
  goToPage(1);
}

function initDateRangePicker() {
  if (!els.dateRangeFilter || typeof window.flatpickr !== "function") return;
  state.datePicker = window.flatpickr(els.dateRangeFilter, {
    mode: "range",
    dateFormat: "Y-m-d",
    allowInput: false,
    minDate: MIN_FILTER_DATE,
    maxDate: "today",
    disable: [isWeekendDate],
    onOpen: openDatePresetPanel,
    onClose: closeDatePresetPanel,
    onChange(selectedDates) {
      if (!selectedDates.length) {
        state.dateRange = { from: "", to: "" };
        goToPage(1);
        return;
      }
      if (selectedDates.length === 1) {
        const single = clampIsoDateUpperBound(
          clampIsoDateLowerBound(toIsoDateLocal(selectedDates[0]), MIN_FILTER_DATE),
          toIsoDateLocal(new Date())
        );
        state.dateRange = { from: single, to: single };
        goToPage(1);
        return;
      }
      const maxDate = toIsoDateLocal(new Date());
      const a = clampIsoDateUpperBound(
        clampIsoDateLowerBound(toIsoDateLocal(selectedDates[0]), MIN_FILTER_DATE),
        maxDate
      );
      const b = clampIsoDateUpperBound(
        clampIsoDateLowerBound(toIsoDateLocal(selectedDates[1]), MIN_FILTER_DATE),
        maxDate
      );
      state.dateRange = a <= b ? { from: a, to: b } : { from: b, to: a };
      goToPage(1);
    }
  });
  const calendar = state.datePicker?.calendarContainer;
  if (calendar && els.datePresets) {
    els.datePresets.classList.add("in-calendar");
    calendar.appendChild(els.datePresets);
  }
  closeDatePresetPanel();
}

function onDatePresetClick(event) {
  const btn = event.target.closest("button[data-range]");
  if (!btn || !state.datePicker) return;
  const preset = btn.dataset.range || "";
  const today = new Date();
  let from = "";
  let to = "";

  if (preset === "today") {
    from = toIsoDateLocal(today);
    to = from;
  } else if (preset === "yesterday") {
    const d = shiftDays(today, -1);
    from = toIsoDateLocal(d);
    to = from;
  } else if (preset === "last-week") {
    from = toIsoDateLocal(shiftDays(today, -6));
    to = toIsoDateLocal(today);
  } else if (preset === "last-month") {
    from = toIsoDateLocal(shiftDays(today, -29));
    to = toIsoDateLocal(today);
  } else if (preset === "last-quarter") {
    from = toIsoDateLocal(shiftDays(today, -89));
    to = toIsoDateLocal(today);
  } else if (preset === "reset") {
    state.datePicker.clear();
    closeDatePresetPanel();
    return;
  } else {
    return;
  }

  const maxDate = toIsoDateLocal(new Date());
  from = clampIsoDateUpperBound(clampIsoDateLowerBound(from, MIN_FILTER_DATE), maxDate);
  to = clampIsoDateUpperBound(clampIsoDateLowerBound(to, MIN_FILTER_DATE), maxDate);
  from = shiftIsoToWeekday(from, 1);
  to = shiftIsoToWeekday(to, -1);
  if (from > to) from = to;
  state.datePicker.setDate([from, to], true, "Y-m-d");
  closeDatePresetPanel();
}

function shiftDays(inputDate, days) {
  const d = new Date(inputDate);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function isWeekendDate(date) {
  const day = Number(date?.getDay?.() ?? -1);
  return day === 0 || day === 6;
}

function shiftIsoToWeekday(isoDate, direction) {
  const raw = String(isoDate || "").trim();
  if (!raw) return raw;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  const step = Number(direction || 1) >= 0 ? 1 : -1;
  while (isWeekendDate(d)) d.setDate(d.getDate() + step);
  return toIsoDateLocal(d);
}

function clampIsoDateLowerBound(inputDate, minDate) {
  const raw = String(inputDate || "").trim();
  const min = String(minDate || "").trim();
  if (!raw) return "";
  if (!min) return raw;
  return raw < min ? min : raw;
}

function clampIsoDateUpperBound(inputDate, maxDate) {
  const raw = String(inputDate || "").trim();
  const max = String(maxDate || "").trim();
  if (!raw) return "";
  if (!max) return raw;
  return raw > max ? max : raw;
}

function openDatePresetPanel() {
  if (!els.datePresets) return;
  els.datePresets.classList.add("open");
}

function closeDatePresetPanel() {
  if (!els.datePresets) return;
  els.datePresets.classList.remove("open");
}

function formatLastUpdated(input) {
  const raw = String(input || "").trim();
  if (!raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
