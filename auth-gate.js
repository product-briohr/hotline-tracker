(function authGateInit() {
  const PASSWORD = "briohr1234";
  const STORAGE_KEY = "hotline_auth_v1";
  const SESSION_MS = 1000 * 60 * 60 * 12;
  const waiters = [];

  window.waitForHotlineAuth = function waitForHotlineAuth() {
    if (isAuthorized()) return Promise.resolve();
    return new Promise((resolve) => waiters.push(resolve));
  };

  if (isAuthorized()) return;
  lockPage();

  function isAuthorized() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ok !== true) return false;
      if (!Number.isFinite(parsed.exp) || Date.now() > parsed.exp) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  function lockPage() {
    document.documentElement.classList.add("auth-locked");
    const gate = document.createElement("div");
    gate.className = "auth-gate";
    gate.innerHTML = `<div class="auth-card">
      <h2>Enter Password</h2>
      <p>This tracker is protected.</p>
      <form class="auth-form" autocomplete="off">
        <input id="authPasswordInput" type="text" placeholder="Password" required />
        <button type="submit" class="btn btn-primary">Unlock</button>
      </form>
      <div class="auth-error" id="authError"></div>
    </div>`;
    document.body.appendChild(gate);

    const form = gate.querySelector(".auth-form");
    const input = gate.querySelector("#authPasswordInput");
    const error = gate.querySelector("#authError");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(error instanceof HTMLElement)) {
      return;
    }

    setTimeout(() => input.focus(), 0);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = String(input.value || "");
      if (value !== PASSWORD) {
        error.textContent = "Wrong password";
        input.select();
        return;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ok: true,
          exp: Date.now() + SESSION_MS
        })
      );
      document.documentElement.classList.remove("auth-locked");
      gate.remove();
      while (waiters.length) {
        const resolve = waiters.shift();
        if (resolve) resolve();
      }
    });
  }
})();
