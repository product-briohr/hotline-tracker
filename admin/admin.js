const THEME_KEY = "hotline-theme";

const els = {
  syncBtn: document.querySelector("#syncBtn"),
  toast: document.querySelector("#toast"),
  themeToggle: document.querySelector("#themeToggle")
};

init();

async function init() {
  if (typeof window.waitForHotlineAuth === "function") {
    await window.waitForHotlineAuth();
  }
  applySavedTheme();
  els.syncBtn.addEventListener("click", runSync);
  els.themeToggle.addEventListener("click", toggleTheme);
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
  } catch (error) {
    els.toast.style.color = "var(--danger)";
    els.toast.textContent = String(error?.message || error);
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = original;
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
