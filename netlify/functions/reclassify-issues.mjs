import { assertPasswordGate, getDataStore, json, loadIssues, reclassifyRowByDescription, saveIssues } from "./_lib.mjs";

export default async (request) => {
  try {
    const gateError = assertPasswordGate(request);
    if (gateError) return gateError;

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const authError = assertAdminAuth(request);
    if (authError) return authError;

    const store = getDataStore();
    const issues = await loadIssues(store);
    const updated = issues.map((row) => ({
      ...reclassifyRowByDescription(row, { overwriteActors: true }),
      updatedAt: new Date().toISOString()
    }));

    await saveIssues(store, updated);
    return json(200, { ok: true, updated: updated.length });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

function assertAdminAuth(request) {
  const requiredToken = process.env.EDIT_TOKEN || process.env.SYNC_TOKEN;
  if (!requiredToken || requiredToken.startsWith("choose-")) return null;

  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (provided !== requiredToken) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  return null;
}
