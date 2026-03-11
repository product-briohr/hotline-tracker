import { assertPasswordGate, getDataStore, json, loadIssues } from "./_lib.mjs";

const MONTHS = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

export default async (request) => {
  try {
    const gateError = assertPasswordGate(request);
    if (gateError) return gateError;

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const body = await request.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    if (!prompt) return json(400, { ok: false, error: "Missing prompt" });

    const store = getDataStore();
    const rows = await loadIssues(store);
    const filters = extractPromptFilters(prompt);
    const scopedRows = applyPromptFilters(rows, filters);
    const targetRows = scopedRows.length ? scopedRows : rows;

    const answer = await buildAnswer(prompt, targetRows);
    return json(200, { ok: true, answer });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

async function buildAnswer(prompt, rows) {
  if (!rows.length) {
    return "I could not find matching issues for that request, so there is nothing reliable to summarize; try broadening the month, year, or issue type scope.";
  }

  const groqKey = String(process.env.GROQ_API_KEY || "").trim();
  if (groqKey) {
    try {
      const aiText = await runGroqSummary(prompt, pickRowsForAi(rows, 220), groqKey);
      if (aiText) return aiText;
    } catch {
      // Fall back to deterministic local summary when Groq fails or is rate-limited.
    }
  }
  return buildFallbackAnswer(prompt, rows);
}

function pickRowsForAi(rows, limit) {
  const out = [];
  for (const row of rows.slice(0, Math.max(1, limit))) {
    out.push({
      date: String(row?.date || ""),
      module: String(row?.module || ""),
      issueType: String(row?.issueType || ""),
      cs: String(row?.cs || ""),
      pmOwner: String(row?.pmOwner || ""),
      description: String(row?.description || "").slice(0, 420),
      comments: String(row?.comments || "").slice(0, 240)
    });
  }
  return out;
}

async function runGroqSummary(prompt, compactRows, apiKey) {
  const model = String(process.env.GROQ_MODEL || "llama-3.1-8b-instant").trim();
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";
  const system = [
    "You are a product analytics assistant.",
    "Analyze only the provided dataset rows.",
    "Return exactly one paragraph.",
    "No bullet points, no headings, no markdown.",
    "Prefer qualitative trend explanation and practical implications.",
    "Do not mention row counts unless the user explicitly asks for counts."
  ].join(" ");

  const user = `User prompt: ${prompt}\n\nDataset rows JSON:\n${JSON.stringify(compactRows)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 420,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!res.ok) throw new Error(parsed?.error?.message || text.slice(0, 240) || `Groq error ${res.status}`);
  const out = String(parsed?.choices?.[0]?.message?.content || "").trim();
  return normalizeOneParagraph(out);
}

function extractPromptFilters(promptRaw) {
  const prompt = String(promptRaw || "").toLowerCase();
  const yearMatch = prompt.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let month = null;
  for (const [name, num] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(prompt)) {
      month = num;
      break;
    }
  }

  let issueType = "";
  if (/\bbug\b/.test(prompt)) issueType = "Bug (CS ticket)";
  else if (/\bfeature\b/.test(prompt)) issueType = "Feature request";
  else if (/\bquestion\b|\btroubleshooting\b/.test(prompt)) issueType = "Question/Troubleshooting";

  return { year, month, issueType };
}

function applyPromptFilters(rows, filters) {
  return rows.filter((row) => {
    const date = String(row?.date || "");
    if (filters.year && !date.startsWith(`${filters.year}-`)) return false;
    if (filters.month) {
      const m = Number((date.split("-")[1] || "0"));
      if (m !== filters.month) return false;
    }
    if (filters.issueType && String(row?.issueType || "") !== filters.issueType) return false;
    return true;
  });
}

function buildFallbackAnswer(prompt, rows) {
  const issueTypeCounts = sortedCounts(countBy(rows, (r) => String(r?.issueType || "Unknown")));
  const moduleCounts = sortedCounts(countBy(rows, (r) => String(r?.module || "Unknown")));
  const pmCounts = sortedCounts(countBy(rows, (r) => String(r?.pmOwner || "Unassigned")));
  const topIssue = issueTypeCounts[0]?.[0] || "Unknown";
  const topModule = moduleCounts[0]?.[0] || "Unknown";
  const topPm = pmCounts[0]?.[0] || "Unassigned";
  const sample = rows
    .slice(0, 3)
    .map((row) => String(row?.description || "").replace(/\s+/g, " ").trim().slice(0, 90))
    .filter(Boolean)
    .join(" | ");
  const mentionsCounts = /\bcount|how many|number of\b/i.test(String(prompt || ""));
  const maybeCountNote = mentionsCounts ? ` There are ${rows.length} matching items in this scope.` : "";
  return normalizeOneParagraph(
    `From your requested scope, the strongest pattern points to ${topIssue} concentrated around ${topModule}, with ${topPm} appearing most frequently as owner, and the description narratives consistently emphasize similar operational pain points (${sample}).${maybeCountNote}`
  );
}

function countBy(rows, getter) {
  const m = new Map();
  for (const row of rows || []) {
    const key = getter(row) || "Unknown";
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

function sortedCounts(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function normalizeOneParagraph(text) {
  return String(text || "").replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}
