const THEME_KEY = "hotline-theme";
const els = {
  themeToggle: document.querySelector("#themeToggle"),
  issueTypeBars: document.querySelector("#issueTypeBars"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput")
};

const state = {
  rows: []
};
const MONTHS = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

init();

async function init() {
  if (typeof window.waitForHotlineAuth === "function") {
    await window.waitForHotlineAuth();
  }
  applySavedTheme();
  els.themeToggle.addEventListener("click", toggleTheme);
  els.chatForm.addEventListener("submit", onChatSubmit);
  state.rows = await fetchAllRows();
  renderIssueTypeBars();
  addBotMessage(
    "I loaded analytics. Ask me about recurring issue types, modules, PM owners, or ask for a summary."
  );
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

function onChatSubmit(event) {
  event.preventDefault();
  const prompt = String(els.chatInput.value || "").trim();
  if (!prompt) return;
  els.chatInput.value = "";
  addUserMessage(prompt);
  addBotMessage(answerPrompt(prompt));
}

function answerPrompt(promptRaw) {
  const prompt = promptRaw.toLowerCase();
  if (!state.rows.length) return "No rows available yet.";

  const filters = extractPromptFilters(promptRaw);
  const scopedRows = applyPromptFilters(state.rows, filters);
  if (!scopedRows.length) {
    return `No matching rows for that filter (${humanizeFilterScope(filters)}).`;
  }

  const issueTypeCounts = sortedCounts(countBy(scopedRows, (r) => String(r.issueType || "Unknown")));
  const moduleCounts = sortedCounts(countBy(scopedRows, (r) => String(r.module || "Unknown")));
  const pmCounts = sortedCounts(countBy(scopedRows, (r) => String(r.pmOwner || "Unassigned")));
  const scope = humanizeFilterScope(filters);

  if (/top.*module|module.*top|recurring.*module/.test(prompt)) {
    return `Top modules (${scope}): ${moduleCounts
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}`;
  }

  if (/top.*pm|pm.*top|owner/.test(prompt)) {
    return `Top PM owners (${scope}): ${pmCounts
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}`;
  }

  if (/summary|overall|overview/.test(prompt) || /give me a summary/.test(prompt)) {
    return `Summary (${scope}): total rows ${scopedRows.length}; top issue type ${issueTypeCounts[0][0]} (${issueTypeCounts[0][1]}); top module ${moduleCounts[0][0]} (${moduleCounts[0][1]}); top PM ${pmCounts[0][0]} (${pmCounts[0][1]}).`;
  }

  if (/(most|top).*(recurring|issue|type)|bug|feature|question|troubleshooting/.test(prompt)) {
    const top = issueTypeCounts[0];
    return `Most recurring issue type (${scope}) is "${top[0]}" (${top[1]} rows). Breakdown: ${issueTypeCounts
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}`;
  }

  return `I can answer with filters too. Try: "summary for March", "top modules in Feb 2026", "top PM owner for bug in March".`;
}

function countBy(rows, getter) {
  const m = new Map();
  for (const row of rows) {
    const key = getter(row) || "Unknown";
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

function sortedCounts(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function extractPromptFilters(promptRaw) {
  const prompt = String(promptRaw || "").toLowerCase();
  const yearMatch = prompt.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let month = null;
  for (const [name, num] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(prompt)) {
      month = num;
      break;
    }
  }

  let issueType = "";
  if (/\bbug\b/.test(prompt)) issueType = "Bug (CS ticket)";
  else if (/\bfeature\b/.test(prompt)) issueType = "Feature request";
  else if (/\bquestion\b|\btroubleshooting\b/.test(prompt)) issueType = "Question/Troubleshooting";

  return { year, month, issueType };
}

function applyPromptFilters(rows, filters) {
  return rows.filter((row) => {
    const date = String(row.date || "");
    if (filters.year && !date.startsWith(`${filters.year}-`)) return false;
    if (filters.month) {
      const m = Number((date.split("-")[1] || "0"));
      if (m !== filters.month) return false;
    }
    if (filters.issueType && String(row.issueType || "") !== filters.issueType) return false;
    return true;
  });
}

function humanizeFilterScope(filters) {
  const out = [];
  if (filters.month) {
    const monthName = Object.keys(MONTHS).find((k) => MONTHS[k] === filters.month && k.length > 3) || "";
    out.push(monthName ? monthName[0].toUpperCase() + monthName.slice(1) : `month ${filters.month}`);
  }
  if (filters.year) out.push(String(filters.year));
  if (filters.issueType) out.push(filters.issueType);
  return out.join(" / ") || "all data";
}

function addUserMessage(text) {
  els.chatMessages.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-msg user"><span>${escapeHtml(text)}</span></div>`
  );
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function addBotMessage(text) {
  els.chatMessages.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-msg bot"><span>${escapeHtml(text)}</span></div>`
  );
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
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
