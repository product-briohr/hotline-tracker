import { GoogleGenerativeAI } from "@google/generative-ai";
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

    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return json(500, { ok: false, error: "Missing GEMINI_API_KEY for analytics chat" });
    }

    const store = getDataStore();
    const rows = await loadIssues(store);
    const filters = extractPromptFilters(prompt);
    const scopedRows = applyPromptFilters(rows, filters);
    const compactRows = pickRowsForAi(scopedRows.length ? scopedRows : rows, 220);

    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const instruction = [
      "You are an analytics assistant for Product Hotline Tracker.",
      "Analyze the full dataset and answer the user's prompt with contextual logic.",
      "Important rules:",
      "- Use the question/description content, not just tags.",
      "- Apply any implied filters in the prompt (month, year, issue type, module, PM owner).",
      "- Do NOT mention raw row counts unless user explicitly asks for counts.",
      "- Give practical insights, concise but meaningful.",
      "- Include sections exactly in this order:",
      "  1) Answer",
      "  2) Logic used",
      "  3) Relevant evidence",
      "- In Relevant evidence include 3-6 short bullets quoting snippets with date/module context.",
      "- If data is insufficient, say what is missing and what prompt user can try next."
    ].join("\n");

    const payloadText = JSON.stringify(compactRows);
    const content = `${instruction}\n\nUser prompt:\n${prompt}\n\nDataset rows (JSON):\n${payloadText}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: content }] }],
        generationConfig: { temperature: 0.2 }
      });

      const answer = String(result?.response?.text?.() || "").trim();
      if (!answer) {
        return json(200, { ok: true, answer: buildFallbackAnswer(prompt, scopedRows.length ? scopedRows : rows, false) });
      }
      return json(200, { ok: true, answer });
    } catch (error) {
      const message = String(error?.message || error);
      if (isQuotaOrRateLimitError(message)) {
        const fallbackAnswer = buildFallbackAnswer(prompt, scopedRows.length ? scopedRows : rows, true);
        return json(200, { ok: true, answer: fallbackAnswer });
      }
      throw error;
    }
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

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

function isQuotaOrRateLimitError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("429") || text.includes("quota") || text.includes("rate limit");
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

function buildFallbackAnswer(prompt, rows, aiUnavailable) {
  if (!rows.length) {
    return "Answer\nNo matching data found for your prompt.\n\nLogic used\nI applied prompt keywords as filters, then checked issue descriptions.\n\nRelevant evidence\n- No rows matched.";
  }

  const issueTypeCounts = sortedCounts(countBy(rows, (r) => String(r?.issueType || "Unknown")));
  const moduleCounts = sortedCounts(countBy(rows, (r) => String(r?.module || "Unknown")));
  const pmCounts = sortedCounts(countBy(rows, (r) => String(r?.pmOwner || "Unassigned")));
  const topIssue = issueTypeCounts[0]?.[0] || "Unknown";
  const topModule = moduleCounts[0]?.[0] || "Unknown";
  const topPm = pmCounts[0]?.[0] || "Unassigned";

  const evidence = rows
    .slice(0, 5)
    .map((row) => {
      const desc = String(row?.description || "").replace(/\s+/g, " ").trim().slice(0, 140);
      return `- ${row?.date || "-"} | ${row?.module || "Unknown"} | ${desc}`;
    })
    .join("\n");

  return [
    "Answer",
    `From your requested scope, the strongest recurring pattern is around "${topIssue}" with concentration in "${topModule}" and ownership trend around "${topPm}".`,
    "",
    "Logic used",
    aiUnavailable
      ? "Gemini quota/rate limit was hit, so this answer uses deterministic prompt filtering (month/year/issue type) plus recurrence and description-signal extraction."
      : "Applied prompt filters and recurrence signals from issue type/module/owner with description context.",
    "",
    "Relevant evidence",
    evidence
  ].join("\n");
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
