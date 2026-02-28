import { getDataStore, json, loadIssues, sanitizeEditableRow, saveIssues } from "./_lib.mjs";
import { randomUUID } from "node:crypto";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const authError = assertEditAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const row = sanitizeEditableRow(body);
    if (!row.description) {
      return json(400, { ok: false, error: "Description is required" });
    }

    const store = getDataStore();
    const issues = await loadIssues(store);
    const nowIso = new Date().toISOString();
    const created = {
      id: randomUUID(),
      sourceFileId: "manual",
      sourceFileName: "Manual Entry",
      sourceFileLink: "",
      createdAt: nowIso,
      updatedAt: nowIso,
      ...row
    };

    await saveIssues(store, [created, ...issues]);
    return json(200, { ok: true, row: created });
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
