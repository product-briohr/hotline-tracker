import { getDataStore, json, loadIssues, saveIssues } from "./_lib.mjs";

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

    const store = getDataStore();
    const issues = await loadIssues(store);
    const remaining = issues.filter((row) => row.id !== id);
    if (remaining.length === issues.length) {
      return json(404, { ok: false, error: "Issue not found" });
    }

    await saveIssues(store, remaining);
    return json(200, { ok: true, deletedId: id });
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
