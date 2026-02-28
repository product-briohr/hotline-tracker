import {
  explodeRowsByDescriptionBullets,
  getDataStore,
  getLastAutoSyncAt,
  json,
  loadIssues
} from "./_lib.mjs";

export default async (request) => {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();
    const moduleFilter = readMultiFilter(url, "module");
    const typeFilter = readMultiFilter(url, "issueType");
    const csFilter = readMultiFilter(url, "cs");
    const pmFilter = readMultiFilter(url, "pmOwner");
    const dateFilter = readMultiFilter(url, "date");
    const dateFrom = (url.searchParams.get("dateFrom") || "").trim();
    const dateTo = (url.searchParams.get("dateTo") || "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 10) || 10));

    const store = getDataStore();
    const all = await loadIssues(store);
    const expanded = explodeRowsByDescriptionBullets(all);
    const lastEditedAt = getLatestUpdatedAt(expanded);
    const lastAutoSyncAt = await getLastAutoSyncAt(store);

    const filtered = expanded.filter((r) => {
      if (moduleFilter.length && !hasAnySelectedValue(r.module, moduleFilter)) return false;
      if (typeFilter.length && !hasAnySelectedValue(r.issueType, typeFilter)) return false;
      if (csFilter.length && !hasAnySelectedValue(r.cs, csFilter)) return false;
      if (pmFilter.length && !hasAnySelectedValue(r.pmOwner, pmFilter)) return false;
      if (dateFilter.length && !dateFilter.includes(r.date || "")) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (q) {
        const hay = `${r.description} ${r.comments} ${r.module} ${r.issueType} ${r.cs} ${r.pmOwner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    filtered.sort(compareRowsByLatestDate);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);

    return json(200, {
      ok: true,
      total: expanded.length,
      count: filtered.length,
      lastAutoSyncAt,
      lastEditedAt,
      pagination: {
        page: safePage,
        pageSize,
        totalPages
      },
      rows
    });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

function readMultiFilter(url, key) {
  const values = [];
  for (const raw of url.searchParams.getAll(key)) {
    for (const part of String(raw || "").split(",")) {
      const value = part.trim();
      if (value) values.push(value);
    }
  }
  return Array.from(new Set(values));
}

function compareRowsByLatestDate(a, b) {
  const dateCmp = String(b?.date || "").localeCompare(String(a?.date || ""));
  if (dateCmp !== 0) return dateCmp;
  return String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""));
}

function hasAnySelectedValue(cellValue, selected) {
  const values = String(cellValue || "")
    .split(/\s*\|\s*|,\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (!values.length) return false;
  return selected.some((s) => values.includes(s));
}

function getLatestUpdatedAt(rows) {
  let best = "";
  let bestMs = 0;
  for (const row of rows || []) {
    const candidate = String(row?.updatedAt || row?.createdAt || "").trim();
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (!Number.isFinite(ms)) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  }
  return best;
}
