import { getDataStore, json, loadIssues, sanitizeEditableRow, saveIssues } from "./_lib.mjs";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const authError = assertEditAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return json(400, { ok: false, error: "Missing id" });

    const patch = sanitizeEditableRow(body);
    if (!patch.description) {
      return json(400, { ok: false, error: "Description is required" });
    }

    const store = getDataStore();
    const issues = await loadIssues(store);
    const idx = issues.findIndex((r) => r.id === id);
    if (idx < 0) return json(404, { ok: false, error: "Issue not found" });

    const prev = issues[idx];
    issues[idx] = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await saveIssues(store, issues);
    return json(200, { ok: true, row: issues[idx] });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

function assertEditAuth(request) {
  const requiredToken = process.env.EDIT_TOKEN;
  if (!requiredToken) return null;

  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (provided !== requiredToken) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  return null;
}
