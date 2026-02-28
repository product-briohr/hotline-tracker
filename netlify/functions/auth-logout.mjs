import { clearPasswordGateSessionCookie, json } from "./_lib.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }
  const res = json(200, { ok: true });
  res.headers.set("set-cookie", clearPasswordGateSessionCookie());
  return res;
};
