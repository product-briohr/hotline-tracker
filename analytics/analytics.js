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
  const total = state.rows.length;
  if (!total) return "No rows available yet.";

  const issueTypeCounts = sortedCounts(countBy(state.rows, (r) => String(r.issueType || "Unknown")));
  const moduleCounts = sortedCounts(countBy(state.rows, (r) => String(r.module || "Unknown")));
  const pmCounts = sortedCounts(countBy(state.rows, (r) => String(r.pmOwner || "Unassigned")));

  if (/(most|top).*(recurring|issue|type)|bug|feature|question/.test(prompt)) {
    const top = issueTypeCounts[0];
    return `Most recurring issue type is "${top[0]}" (${top[1]} rows). Breakdown: ${issueTypeCounts
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}`;
  }

  if (/top.*module|module.*top|recurring.*module/.test(prompt)) {
    return `Top modules: ${moduleCounts
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}`;
  }

  if (/top.*pm|pm.*top|owner/.test(prompt)) {
    return `Top PM owners: ${pmCounts
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}`;
  }

  if (/summary|overall|overview/.test(prompt)) {
    return `Total rows: ${total}. Most recurring issue type: ${issueTypeCounts[0][0]} (${issueTypeCounts[0][1]}). Top module: ${moduleCounts[0][0]} (${moduleCounts[0][1]}).`;
  }

  return `I can answer: "most recurring issue type", "top modules", "top PM owner", or "summary".`;
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
