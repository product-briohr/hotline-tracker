const THEME_KEY = "hotline-theme";

const els = {
  syncBtn: document.querySelector("#syncBtn"),
  toast: document.querySelector("#toast"),
  themeToggle: document.querySelector("#themeToggle"),
  lastSyncAt: document.querySelector("#lastSyncAt")
};

init();

async function init() {
  if (typeof window.waitForHotlineAuth === "function") {
    await window.waitForHotlineAuth();
  }
  applySavedTheme();
  els.syncBtn.addEventListener("click", runSync);
  els.themeToggle.addEventListener("click", toggleTheme);
  await loadLastSyncStatus();
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

async function runSync() {
  const original = els.syncBtn.textContent;
  clearToast();
  els.syncBtn.disabled = true;
  els.syncBtn.textContent = "Syncing now...";

  try {
    const res = await fetch("/api/sync?force=true", { method: "POST" });
    const data = await safeJson(res);
    if (!data.ok) {
      showToast("error", data.error || "Sync failed");
      return;
    }
    showToast("success", data.message || "Sync completed");
    await loadLastSyncStatus();
  } catch (error) {
    showToast("error", String(error?.message || error));
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = original;
  }
}

async function loadLastSyncStatus() {
  try {
    const res = await fetch("/api/issues?page=1&pageSize=1", { cache: "no-store" });
    const data = await safeJson(res);
    if (!data.ok) {
      els.lastSyncAt.textContent = "-";
      return;
    }
    els.lastSyncAt.textContent = formatLastUpdated(data?.lastAutoSyncAt);
  } catch {
    els.lastSyncAt.textContent = "-";
  }
}

function showToast(tone, message) {
  els.toast.classList.remove("is-error", "is-success");
  els.toast.classList.add(tone === "error" ? "is-error" : "is-success");
  els.toast.textContent = String(message || "");
}

function clearToast() {
  els.toast.classList.remove("is-error", "is-success");
  els.toast.textContent = "";
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
