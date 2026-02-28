import {
  createPasswordGateSessionCookie,
  isPasswordGateEnabled,
  json
} from "./_lib.mjs";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    if (!isPasswordGateEnabled()) {
      return json(200, { ok: true, enabled: false });
    }

    const body = await request.json().catch(() => ({}));
    const password = String(body?.password || "");
    const expected = String(process.env.APP_PASSWORD || "");
    if (password !== expected) {
      return json(401, { ok: false, error: "Invalid password" });
    }

    const res = json(200, { ok: true, enabled: true });
    res.headers.set("set-cookie", createPasswordGateSessionCookie());
    return res;
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};
