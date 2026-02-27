const MODULES = [
  "",
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

const ISSUE_TYPES = ["", "Bug (CS ticket)", "Feature request", "Question/Troubleshooting"];
const CS_LIST = [
  "",
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
const PM_OWNERS = ["", "Amir", "Idris Ashari", "Nita Puspita", "Nico"];

const els = {
  search: document.querySelector("#search"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  moduleFilter: document.querySelector("#moduleFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  csFilter: document.querySelector("#csFilter"),
  pmFilter: document.querySelector("#pmFilter"),
  clearBtn: document.querySelector("#clearBtn"),
  syncBtn: document.querySelector("#syncBtn"),
  syncToken: document.querySelector("#syncToken"),
  stats: document.querySelector("#stats"),
  toast: document.querySelector("#toast"),
  rows: document.querySelector("#rows")
};

const state = {
  editingId: null
};

init();

function init() {
  setOptions(els.moduleFilter, MODULES, "All modules");
  setOptions(els.typeFilter, ISSUE_TYPES, "All issue types");
  setOptions(els.csFilter, CS_LIST, "All CS");
  setOptions(els.pmFilter, PM_OWNERS, "All PM owners");

  const controls = [
    els.search,
    els.dateFrom,
    els.dateTo,
    els.moduleFilter,
    els.typeFilter,
    els.csFilter,
    els.pmFilter
  ];
  controls.forEach((el) => el.addEventListener("input", debounce(loadRows, 240)));
  els.clearBtn.addEventListener("click", clearFilters);
  els.syncBtn.addEventListener("click", runSync);
  els.rows.addEventListener("click", onTableClick);

  loadRows();
  setInterval(() => {
    if (!state.editingId) loadRows();
  }, 15000);
}

function setOptions(select, values, fallbackLabel) {
  select.innerHTML = values
    .map((v) => `<option value="${escapeHtml(v)}">${v || fallbackLabel}</option>`)
    .join("");
}

async function loadRows() {
  const qs = new URLSearchParams();
  if (els.search.value.trim()) qs.set("q", els.search.value.trim());
  if (els.dateFrom.value) qs.set("dateFrom", els.dateFrom.value);
  if (els.dateTo.value) qs.set("dateTo", els.dateTo.value);
  if (els.moduleFilter.value) qs.set("module", els.moduleFilter.value);
  if (els.typeFilter.value) qs.set("issueType", els.typeFilter.value);
  if (els.csFilter.value) qs.set("cs", els.csFilter.value);
  if (els.pmFilter.value) qs.set("pmOwner", els.pmFilter.value);

  const res = await fetch(`/api/issues?${qs.toString()}`);
  const data = await res.json();
  if (!data.ok) {
    els.stats.textContent = `Failed to load: ${data.error || "Unknown error"}`;
    return;
  }

  els.stats.textContent = `${data.count} shown / ${data.total} total`;
  els.rows.innerHTML = data.rows.map(renderRow).join("") || emptyState();
}

function renderRow(r) {
  if (state.editingId === r.id) return renderEditableRow(r);
  return `<tr>
    <td>${escapeHtml(formatDisplayDate(r.date))}</td>
    <td><span class="badge">${escapeHtml(r.module || "")}</span></td>
    <td>${escapeHtml(r.issueType || "")}</td>
    <td>${escapeHtml(r.cs || "")}</td>
    <td>${escapeHtml(r.pmOwner || "")}</td>
    <td class="desc-cell">${escapeHtml(r.description || "")}</td>
    <td>${escapeHtml(r.comments || "")}</td>
    <td>
      <button class="icon-btn" data-action="edit" data-id="${escapeHtml(r.id)}" title="Edit row">✏️</button>
    </td>
  </tr>`;
}

function renderEditableRow(r) {
  return `<tr class="editing-row">
    <td>${escapeHtml(formatDisplayDate(r.date))}</td>
    <td>${renderSelect("module", MODULES.slice(1), r.module)}</td>
    <td>${renderSelect("issueType", ISSUE_TYPES.slice(1), r.issueType)}</td>
    <td>${renderSelect("cs", CS_LIST.slice(1), r.cs)}</td>
    <td>${renderSelect("pmOwner", PM_OWNERS.slice(1), r.pmOwner)}</td>
    <td>
      <textarea data-field="description" rows="4">${escapeHtml(r.description || "")}</textarea>
    </td>
    <td>
      <textarea data-field="comments" rows="3">${escapeHtml(r.comments || "")}</textarea>
    </td>
    <td>
      <div class="row-actions">
        <button class="btn btn-primary" data-action="save" data-id="${escapeHtml(r.id)}">Save</button>
        <button class="btn" data-action="cancel">Cancel</button>
      </div>
    </td>
  </tr>`;
}

function renderSelect(field, values, current) {
  const options = values
    .map((v) => `<option value="${escapeHtml(v)}" ${v === current ? "selected" : ""}>${escapeHtml(v)}</option>`)
    .join("");
  return `<select data-field="${field}">${options}</select>`;
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

function renderSource(r) {
  if (!r.sourceFileLink) return escapeHtml(r.sourceFileName || "");
  return `<a href="${escapeHtml(r.sourceFileLink)}" target="_blank" rel="noreferrer">${escapeHtml(
    r.sourceFileName || "Open"
  )}</a>`;
}

function emptyState() {
  return `<tr><td colspan="8" style="color:#8f9bb3;">No issues found for current filters.</td></tr>`;
}

function clearFilters() {
  els.search.value = "";
  els.dateFrom.value = "";
  els.dateTo.value = "";
  els.moduleFilter.value = "";
  els.typeFilter.value = "";
  els.csFilter.value = "";
  els.pmFilter.value = "";
  loadRows();
}

async function runSync() {
  const token = els.syncToken.value.trim();
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const original = els.syncBtn.textContent;
  els.syncBtn.disabled = true;
  els.syncBtn.textContent = "Syncing...";
  els.toast.textContent = "";

  try {
    const res = await fetch("/api/sync?force=1", { method: "POST", headers });
    const data = await res.json();
    if (!data.ok) {
      els.toast.style.color = "#ff8f8f";
      els.toast.textContent = data.error || "Sync failed";
      return;
    }
    els.toast.style.color = "#9be4aa";
    els.toast.textContent = data.message || `Synced: ${data.inserted || 0} rows`;
    await loadRows();
  } catch (error) {
    els.toast.style.color = "#ff8f8f";
    els.toast.textContent = String(error?.message || error);
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = original;
  }
}

async function onTableClick(event) {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  if (action === "edit") {
    state.editingId = btn.dataset.id;
    await loadRows();
    return;
  }
  if (action === "cancel") {
    state.editingId = null;
    await loadRows();
    return;
  }
  if (action === "save") {
    await saveEditedRow(btn.dataset.id);
  }
}

async function saveEditedRow(id) {
  const row = document.querySelector(".editing-row");
  if (!row) return;

  const payload = {
    id,
    module: row.querySelector('[data-field="module"]')?.value || "",
    issueType: row.querySelector('[data-field="issueType"]')?.value || "",
    cs: row.querySelector('[data-field="cs"]')?.value || "",
    pmOwner: row.querySelector('[data-field="pmOwner"]')?.value || "",
    description: row.querySelector('[data-field="description"]')?.value || "",
    comments: row.querySelector('[data-field="comments"]')?.value || ""
  };

  const headers = { "content-type": "application/json" };
  const token = els.syncToken.value.trim();
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch("/api/issues/update", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) {
      els.toast.style.color = "#ff8f8f";
      els.toast.textContent = data.error || "Update failed";
      return;
    }
    els.toast.style.color = "#9be4aa";
    els.toast.textContent = "Row updated";
    state.editingId = null;
    await loadRows();
  } catch (error) {
    els.toast.style.color = "#ff8f8f";
    els.toast.textContent = String(error?.message || error);
  }
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
