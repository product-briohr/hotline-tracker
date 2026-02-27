import { explodeRowsByDescriptionBullets, getDataStore, json, loadIssues } from "./_lib.mjs";

export default async (request) => {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();
    const moduleFilter = (url.searchParams.get("module") || "").trim();
    const typeFilter = (url.searchParams.get("issueType") || "").trim();
    const csFilter = (url.searchParams.get("cs") || "").trim();
    const pmFilter = (url.searchParams.get("pmOwner") || "").trim();
    const dateFrom = (url.searchParams.get("dateFrom") || "").trim();
    const dateTo = (url.searchParams.get("dateTo") || "").trim();

    const store = getDataStore();
    const all = await loadIssues(store);
    const expanded = explodeRowsByDescriptionBullets(all);

    const filtered = expanded.filter((r) => {
      if (moduleFilter && r.module !== moduleFilter) return false;
      if (typeFilter && r.issueType !== typeFilter) return false;
      if (csFilter && r.cs !== csFilter) return false;
      if (pmFilter && r.pmOwner !== pmFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (q) {
        const hay = `${r.description} ${r.comments} ${r.module} ${r.issueType} ${r.cs} ${r.pmOwner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return json(200, {
      ok: true,
      total: expanded.length,
      count: filtered.length,
      rows: filtered.slice(0, 1000)
    });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};
