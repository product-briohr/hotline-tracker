import { assertPasswordGate, isPasswordGateEnabled, json } from "./_lib.mjs";

export default async (request) => {
  if (!isPasswordGateEnabled()) {
    return json(200, { ok: true, enabled: false, authenticated: true });
  }
  const authError = assertPasswordGate(request);
  if (authError) {
    return json(200, { ok: true, enabled: true, authenticated: false });
  }
  return json(200, { ok: true, enabled: true, authenticated: true });
};
