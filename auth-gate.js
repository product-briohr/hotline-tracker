(function authGateInit() {
  const waiters = [];
  let gateVisible = false;

  window.waitForHotlineAuth = async function waitForHotlineAuth() {
    await ensureAuthorized();
    if (!gateVisible) return;
    await new Promise((resolve) => waiters.push(resolve));
  };

  void ensureAuthorized();

  async function ensureAuthorized() {
    const session = await readSession();
    if (!session.enabled || session.authenticated) return;
    lockPage();
  }

  function lockPage() {
    if (gateVisible) return;
    gateVisible = true;
    document.documentElement.classList.add("auth-locked");
    const gate = document.createElement("div");
    gate.className = "auth-gate";
    gate.innerHTML = `<div class="auth-card">
      <h2>Enter Password</h2>
      <p>This tracker is protected.</p>
      <form class="auth-form" autocomplete="on">
        <input
          class="auth-hidden-username"
          type="text"
          name="username"
          autocomplete="username"
          value="hotline-user"
          tabindex="-1"
          aria-hidden="true"
        />
        <div class="auth-password-row">
          <input
            id="authPasswordInput"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            required
          />
          <button id="authToggleVisible" type="button" class="btn">Show</button>
        </div>
        <button type="submit" class="btn btn-primary">Unlock</button>
      </form>
      <div class="auth-error" id="authError"></div>
    </div>`;
    document.body.appendChild(gate);

    const form = gate.querySelector(".auth-form");
    const input = gate.querySelector("#authPasswordInput");
    const error = gate.querySelector("#authError");
    const toggleBtn = gate.querySelector("#authToggleVisible");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(error instanceof HTMLElement)) {
      return;
    }

    if (toggleBtn instanceof HTMLButtonElement) {
      toggleBtn.addEventListener("click", () => {
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        toggleBtn.textContent = reveal ? "Hide" : "Show";
      });
    }

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      form.requestSubmit();
    });

    setTimeout(() => input.focus(), 0);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = String(input.value || "");
      if (!value) {
        error.textContent = "Password is required";
        input.focus();
        return;
      }
      const ok = await submitPassword(value);
      if (!ok) {
        error.textContent = "Wrong password";
        input.select();
        return;
      }
      gateVisible = false;
      document.documentElement.classList.remove("auth-locked");
      gate.remove();
      while (waiters.length) {
        const resolve = waiters.shift();
        if (resolve) resolve();
      }
    });
  }

  async function submitPassword(password) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await safeJson(res);
      return Boolean(res.ok && data?.ok);
    } catch {
      return false;
    }
  }

  async function readSession() {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await safeJson(res);
      if (!res.ok || !data?.ok) return { enabled: true, authenticated: false };
      return {
        enabled: Boolean(data.enabled),
        authenticated: Boolean(data.authenticated)
      };
    } catch {
      return { enabled: true, authenticated: false };
    }
  }

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
})();
