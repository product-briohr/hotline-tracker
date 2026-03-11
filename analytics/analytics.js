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
  void askAnalyticsBot(prompt);
}

async function askAnalyticsBot(prompt) {
  const thinkingEl = addBotMessage("Analyzing your prompt...");
  try {
    const res = await fetch("/api/analytics/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await safeJson(res);
    if (!data.ok) {
      updateBotMessage(thinkingEl, data.error || "Failed to analyze your prompt.");
      return;
    }
    updateBotMessage(thinkingEl, String(data.answer || "No answer returned."));
  } catch (error) {
    updateBotMessage(thinkingEl, String(error?.message || error));
  }
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
    `<div class="chat-msg bot"><span>${escapeHtml(text).replaceAll("\n", "<br>")}</span></div>`
  );
  const messageNode = els.chatMessages.lastElementChild;
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return messageNode;
}

function updateBotMessage(messageNode, text) {
  const span = messageNode?.querySelector("span");
  if (span) span.innerHTML = escapeHtml(String(text || "")).replaceAll("\n", "<br>");
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
