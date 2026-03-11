const THEME_KEY = "hotline-theme";
const els = {
  themeToggle: document.querySelector("#themeToggle"),
  issueTypeBars: document.querySelector("#issueTypeBars")
};

const state = {
  rows: []
};

init();

async function init() {
  if (typeof window.waitForHotlineAuth === "function") {
    await window.waitForHotlineAuth();
  }
  applySavedTheme();
  els.themeToggle.addEventListener("click", toggleTheme);
  state.rows = await fetchAllRows();
  renderIssueTypeBars();
}

async function fetchAllRows() {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const rows = [];

  while (page <= totalPages) {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });
    const res = await fetch(`/api/issues?${qs.toString()}`, { cache: "no-store" });
    const data = await safeJson(res);
    if (!data.ok) throw new Error(data.error || "Failed to load analytics data");
    totalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
    rows.push(...(data.rows || []));
    page += 1;
  }
  return rows;
}

function renderIssueTypeBars() {
  const counts = countBy(state.rows, (r) => String(r.issueType || "Unknown"));
  const items = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = items[0]?.[1] || 1;
  els.issueTypeBars.innerHTML =
    items
      .map(([name, count]) => {
        const pct = Math.round((count / max) * 100);
        return `<div class="issue-bar-row">
          <div class="issue-bar-label">${escapeHtml(name)}</div>
          <div class="issue-bar-track"><div class="issue-bar-fill" style="width:${pct}%"></div></div>
          <div class="issue-bar-value">${count}</div>
        </div>`;
      })
      .join("") || `<div class="analytics-muted">No issue data found.</div>`;
}

function countBy(rows, getter) {
  const m = new Map();
  for (const row of rows) {
    const key = getter(row) || "Unknown";
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
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

function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
