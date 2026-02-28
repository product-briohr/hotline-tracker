import {
  assertPasswordGate,
  json,
  runSyncOnce
} from "./_lib.mjs";

export default async (request) => {
  const gateError = assertPasswordGate(request);
  if (gateError) return gateError;

  const authError = assertSyncAuth(request);
  if (authError) return authError;
  const url = new URL(request.url);
  const force = ["1", "true", "yes"].includes((url.searchParams.get("force") || "").toLowerCase());
  return runSyncOnce({ force });
};

function assertSyncAuth(request) {
  const requiredToken = process.env.SYNC_TOKEN;
  if (!requiredToken || requiredToken.startsWith("choose-")) return null;

  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (provided !== requiredToken) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  return null;
}
