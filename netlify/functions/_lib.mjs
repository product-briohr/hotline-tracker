import { GoogleGenerativeAI } from "@google/generative-ai";
import { getStore } from "@netlify/blobs";
import { JWT } from "google-auth-library";

const MODULES = [
  "Claims",
  "Emails",
  "Feed",
  "GL report",
  "Import/Export",
  "Leave",
  "Mobile App specific (non module)",
  "Onboarding v3",
  "Payroll",
  "Performance",
  "Profile/Core",
  "Pulse",
  "Recruitment",
  "Report builder",
  "Staffany",
  "Time Attendance",
  "Timesheets",
  "Training",
  "Who's away",
  "Xero",
  "Document Management",
  "Others/General",
  "Public Holiday"
];

const ISSUE_TYPES = [
  "Bug (CS ticket)",
  "Feature request",
  "Question/Troubleshooting"
];

const CS_LIST = [
  "Adila",
  "Arveena",
  "Awana",
  "Brandon",
  "Diyana",
  "Edison",
  "Edrin",
  "Elizabeth",
  "Haslina",
  "Ivan",
  "Kai Chi",
  "Lina",
  "Nadirah",
  "Nadzra",
  "Rubini",
  "Syakirah",
  "Yana",
  "Pavanjeet",
  "Aqilah"
];

const PM_OWNERS = ["Amir", "Idris Ashari", "Nita Puspita", "Nico"];

export const ENUMS = {
  MODULES,
  ISSUE_TYPES,
  CS_LIST,
  PM_OWNERS
};

const MODULE_KEYWORDS = [
  ["Document Management", /\bdocument\s*management\b|\be-sign\b/i],
  ["Time Attendance", /\btime\s*attendance\b|\bclock[\s-]?in\b|\bclock[\s-]?out\b|\broster\b/i],
  ["Timesheets", /\btimesheet\b|\btime\s*sheet\b/i],
  ["Payroll", /\bpayroll\b|\bpayslip\b|\bea\s*form\b|\bepf\b|\bsocso\b/i],
  ["Leave", /\bleave\s*policy\b|\bleave\b/i],
  ["Xero", /\bxero\b/i],
  ["Claims", /\bclaim\b|\bclaims\b/i],
  ["Recruitment", /\brecruitment\b|\bcandidate\b/i],
  ["Performance", /\bperformance\b/i],
  ["Training", /\btraining\b/i],
  ["Profile/Core", /\bprofile\b|\bcore\b/i],
  ["Report builder", /\breport\s*builder\b/i],
  ["Import/Export", /\bimport\b|\bexport\b/i],
  ["Public Holiday", /\bpublic\s*holiday\b|\bholiday\b/i],
  ["Onboarding v3", /\bonboarding\s*v?3\b|\bonboarding\b/i],
  ["Mobile App specific (non module)", /\bmobile\s*app\b|\bmobile\b/i],
  ["Feed", /\bfeed\b/i],
  ["Emails", /\bemail\b|\bemails\b/i],
  ["Pulse", /\bpulse\b/i],
  ["Who's away", /\bwho'?s\s*away\b/i],
  ["Staffany", /\bstaffany\b/i],
  ["GL report", /\bgl\s*report\b|\bgeneral\s*ledger\b/i]
];

const ISSUE_KEYWORDS = [
  ["Bug (CS ticket)", /\bbug\b|\berror\b|\bfailed\b|\bunable\b|\bcannot\b|\bmissing\b|\bdiscrepanc/i],
  ["Feature request", /\bfeature\s*request\b|\brequest(ed)?\b|\benhancement\b|\broadmap\b|\badd\b/i]
];

const SPEAKER_KEYWORDS =
  /\braised\b|\breported\b|\bdiscussed\b|\bmentioned\b|\brequested\b|\bconfirmed\b|\bpresented\b|\binquired\b|\bsuggested\b/i;
const SPEAKER_KEYWORD_PRIORITY = [
  "raised",
  "reported",
  "discussed",
  "mentioned",
  "requested",
  "suggested",
  "confirmed",
  "presented",
  "inquired"
];

export function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function getDataStore() {
  const name = process.env.BLOB_STORE_NAME || "hotline-tracker";
  return getStore({ name });
}

export function sanitizePrivateKey(key) {
  return String(key || "").replace(/\\n/g, "\n");
}

export function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = sanitizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (!email || !privateKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const auth = new JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"]
  });
  return auth;
}

export async function listDocsRecursively(drive, rootFolderId) {
  const fileRows = [];
  const queue = [rootFolderId];
  while (queue.length) {
    const folderId = queue.shift();

    const foldersRes = await driveGetJSON(
      drive,
      "https://www.googleapis.com/drive/v3/files",
      {
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id,name)",
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      }
    );

    for (const folder of foldersRes.files || []) {
      queue.push(folder.id);
    }

    const filesRes = await driveGetJSON(
      drive,
      "https://www.googleapis.com/drive/v3/files",
      {
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
        fields: "files(id,name,modifiedTime,webViewLink)",
        pageSize: 1000,
        orderBy: "modifiedTime desc",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      }
    );

    for (const f of filesRes.files || []) {
      fileRows.push(f);
    }
  }
  return fileRows.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
}

export async function exportDocText(drive, fileId) {
  return await driveGetText(
    drive,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`,
    { mimeType: "text/plain" }
  );
}

export async function extractRowsFromNotes(notesText, dateIso) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const detailsOnlyText = extractDetailsSectionText(notesText);

  const prompt = `
Extract issue tracker rows from meeting notes.
Return strict JSON only (array), no markdown:
[
  {
    "date": "YYYY-MM-DD",
    "module": "one of allowed modules",
    "issueType": "one of allowed issue types",
    "cs": "one of allowed CS names or empty",
    "pmOwner": "one of allowed PM owners or empty",
    "description": "string",
    "comments": "string"
  }
]

Allowed modules: ${MODULES.join(" | ")}
Allowed issue types: ${ISSUE_TYPES.join(" | ")}
Allowed CS: ${CS_LIST.join(" | ")}
Allowed PM owner: ${PM_OWNERS.join(" | ")}

Rules:
- Use ${dateIso} as default date if missing.
- Keep only actionable product issues/questions.
- Max 80 rows.
- If unsure module -> Others/General
- If unsure issue type -> Question/Troubleshooting
- Unknown CS/PM -> ""
- description MUST be copied verbatim from the notes (exact wording).
- Do NOT summarize, paraphrase, shorten, or rewrite description.
- Keep original punctuation and wording from source.
- If a single section contains multiple problems in bullet points (especially under "Details"), output one JSON row per bullet/problem.
- Do not merge multiple bullet points into one row.
- For bullet-based entries, set description to the single bullet text only (without bullet marker).
- Ignore Summary, Suggested next steps, attendee list, and all non-Details sections.
- Use only items from Details section as source for rows.

Meeting notes:
"""${detailsOnlyText.slice(0, 200000)}"""
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const outputText = result.response.text();
    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      throw new Error(`Gemini JSON parse failed: ${outputText.slice(0, 500)}`);
    }

    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((row) => normalizeRow(row, dateIso))
      .filter((r) => r.description);
    const expanded = explodeRowsByDescriptionBullets(normalized);
    return await refineRowsWithAI(expanded);
  } catch (error) {
    // Fail-safe mode so ingestion still works without model quota.
    const fallback = fallbackRowsFromNotes(detailsOnlyText, dateIso);
    const expandedFallback = explodeRowsByDescriptionBullets(fallback);
    return await refineRowsWithAI(expandedFallback);
  }
}

function normalizeRow(row, defaultDate) {
  const description = String(row?.description || "").trim();
  const inferred = inferFieldsFromDescription(description);
  const normalized = {
    date: normalizeDate(row?.date, defaultDate),
    module: normalizeEnum(row?.module, MODULES, "Others/General"),
    issueType: normalizeEnum(row?.issueType, ISSUE_TYPES, "Question/Troubleshooting"),
    cs: normalizeEnum(row?.cs, CS_LIST, ""),
    pmOwner: normalizeEnum(row?.pmOwner, PM_OWNERS, ""),
    description,
    comments: ""
  };
  return enrichWithInference(normalized, inferred);
}

export function explodeRowsByDescriptionBullets(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  return rows.flatMap((row) => {
    const parts = splitDescriptionIntoProblems(row?.description);
    if (parts.length <= 1) return [row];
    return parts.map((description) => ({
      ...row,
      description
    }));
  });
}

function splitDescriptionIntoProblems(input) {
  const raw = String(input || "").replace(/\r/g, "").trim();
  if (!raw) return [];

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];
  let current = "";
  let hasBullet = false;

  for (const line of lines) {
    const header = line.replace(/[:\-]\s*$/, "").trim();
    if (/^(gemini\s+)?details?$/i.test(header)) continue;
    if (/^issue\s*\/\s*question\s*description$/i.test(header)) continue;

    const bullet = line.match(/^(?:[-*•●]\s+|\d+[.)]\s+)(.+)$/);
    if (bullet) {
      hasBullet = true;
      if (current) items.push(current.trim());
      current = bullet[1].trim();
      continue;
    }

    if (hasBullet) {
      current = current ? `${current} ${line}` : line;
      continue;
    }

    current = current ? `${current} ${line}` : line;
  }

  if (current) items.push(current.trim());

  if (!hasBullet || items.length < 2) {
    const byTitle = splitByIssueTitle(raw);
    return byTitle.length > 1 ? byTitle : [raw];
  }

  return items.filter(Boolean);
}

function splitByIssueTitle(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const starts = [];
  const re = /(?:^|\n)\s*([A-Z][A-Za-z0-9'"()\/&,\-\s]{6,140}:)\s+/g;
  let m;
  while ((m = re.exec(text))) {
    starts.push(m.index + (m[0].startsWith("\n") ? 1 : 0));
  }
  if (starts.length < 2) return [];

  const out = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const chunk = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (chunk) out.push(chunk);
  }
  return out;
}

function normalizeDate(input, fallback) {
  const raw = String(input || "").trim();
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const d = String(parsed.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeEnum(input, allowed, fallback) {
  const raw = String(input || "").trim();
  if (!raw) return fallback;
  const exact = allowed.find((x) => x.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const soft = allowed.find((x) => x.toLowerCase().includes(raw.toLowerCase()));
  if (soft) return soft;
  return fallback;
}

export function sanitizeEditableRow(input) {
  return {
    module: normalizeEnum(input?.module, MODULES, "Others/General"),
    issueType: normalizeEnum(input?.issueType, ISSUE_TYPES, "Question/Troubleshooting"),
    cs: normalizeEnum(input?.cs, CS_LIST, ""),
    pmOwner: normalizeEnum(input?.pmOwner, PM_OWNERS, ""),
    description: String(input?.description || "").trim(),
    comments: String(input?.comments || "").trim().slice(0, 2000)
  };
}

export function reclassifyRowByDescription(row, options = {}) {
  const overwriteActors = options.overwriteActors !== false;
  const inferred = inferFieldsFromDescription(row?.description || "");

  return {
    ...row,
    module: inferred.module || row.module || "Others/General",
    issueType: inferred.issueType || row.issueType || "Question/Troubleshooting",
    cs: overwriteActors ? (inferred.cs || row.cs || "") : row.cs || inferred.cs || "",
    pmOwner: overwriteActors ? (inferred.pmOwner || row.pmOwner || "") : row.pmOwner || inferred.pmOwner || ""
  };
}

export async function loadIssues(store) {
  return (await store.get("issues", { type: "json" })) || [];
}

export async function saveIssues(store, rows) {
  await store.setJSON("issues", rows);
}

export async function isProcessed(store, fileId) {
  const v = await store.get(`processed:${fileId}`);
  return v === "1";
}

export async function markProcessed(store, fileId) {
  await store.set(`processed:${fileId}`, "1");
}

export function toIsoDate(dateInput) {
  const d = new Date(dateInput || new Date());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function matchesKeywords(name) {
  const keyword = (process.env.MEETING_KEYWORD || "Product Hotline").toLowerCase();
  return String(name || "").toLowerCase().includes(keyword);
}

function fallbackRowsFromNotes(notesText, dateIso) {
  const items = extractIssueItems(notesText);
  const candidates = items
    .filter((b) => b.length > 18)
    .filter((b) => /issue|bug|error|cannot|failed|request|question|troubleshoot|discussed|raised|mentioned/i.test(b))
    .slice(0, 80);

  if (!candidates.length) {
    const body = String(notesText || "").replace(/\s+/g, " ").trim();
    return body
      ? [
          enrichWithInference({
            date: dateIso,
            module: "Others/General",
            issueType: "Question/Troubleshooting",
            cs: "",
            pmOwner: "",
            description: body,
            comments: ""
          })
        ]
      : [];
  }

  return candidates.map((line) => enrichWithInference({
    date: dateIso,
    module: "Others/General",
    issueType: "Question/Troubleshooting",
    cs: "",
    pmOwner: "",
    description: line,
    comments: ""
  }));
}

function extractIssueItems(notesText) {
  const raw = String(notesText || "").replace(/\r/g, "");
  const lines = raw.split("\n");
  const items = [];
  let current = "";
  let inDetails = false;
  let foundDetailsHeader = false;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;

    const header = line.replace(/[:\-]\s*$/, "").trim();
    if (/^(gemini\s+)?details?$/i.test(header)) {
      inDetails = true;
      foundDetailsHeader = true;
      if (current) {
        items.push(current.trim());
        current = "";
      }
      continue;
    }
    if (/^suggested\s+next\s+steps?$/i.test(header)) {
      if (inDetails && current) items.push(current.trim());
      inDetails = false;
      current = "";
      continue;
    }

    if (foundDetailsHeader && !inDetails) continue;

    const isBullet =
      /^(?:[\-\*•●]\s+|\d+[.)]\s+)/.test(line);
    if (isBullet) {
      if (current) items.push(current.trim());
      current = line.replace(/^(?:[\-\*•●]\s+|\d+[.)]\s+)/, "");
      continue;
    }

    if (/^(summary|details|suggested next steps)\s*$/i.test(line)) continue;

    if (current) current += ` ${line}`;
    else current = line;
  }

  if (current) items.push(current.trim());
  return items;
}

function extractDetailsSectionText(notesText) {
  const raw = String(notesText || "").replace(/\r/g, "");
  const lines = raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line.trim()));

  let inDetails = false;
  let found = false;
  const out = [];

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    const header = line.replace(/[:\-]\s*$/, "").trim();

    if (/^(gemini\s+)?details?$/i.test(header)) {
      inDetails = true;
      found = true;
      continue;
    }
    if (/^suggested\s+next\s+steps?$/i.test(header)) break;
    if (/^summary$/i.test(header)) continue;
    if (!inDetails) continue;
    out.push(line);
  }

  if (!found || !out.length) return raw;
  return out.join("\n");
}

function enrichWithInference(row, precomputedInference) {
  const inferred = precomputedInference || inferFieldsFromDescription(row.description);
  return {
    ...row,
    module: row.module === "Others/General" && inferred.module ? inferred.module : row.module,
    issueType:
      row.issueType === "Question/Troubleshooting" && inferred.issueType
        ? inferred.issueType
        : row.issueType,
    cs: row.cs || inferred.cs || "",
    pmOwner: row.pmOwner || inferred.pmOwner || ""
  };
}

function inferFieldsFromDescription(description) {
  const text = String(description || "");
  const lc = text.toLowerCase();

  let module = "";
  for (const [value, regex] of MODULE_KEYWORDS) {
    if (regex.test(lc)) {
      module = value;
      break;
    }
  }

  let issueType = "";
  for (const [value, regex] of ISSUE_KEYWORDS) {
    if (regex.test(lc)) {
      issueType = value;
      break;
    }
  }
  if (!issueType && /\?$/.test(text.trim())) {
    issueType = "Question/Troubleshooting";
  }

  const participants = inferParticipantsFromKeywordClauses(text);

  return {
    module,
    issueType,
    cs: participants.cs,
    pmOwner: participants.pmOwner
  };
}

function inferPerson(text, allowed) {
  const lc = String(text || "").toLowerCase();
  for (const person of allowed) {
    const token = person.toLowerCase();
    if (lc.includes(token)) return person;
  }
  return "";
}

function inferParticipantsFromKeywordClauses(text) {
  const clauses = String(text || "")
    .split(/[\.\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => SPEAKER_KEYWORDS.test(s));

  if (!clauses.length) {
    return { cs: "", pmOwner: "" };
  }

  const enriched = clauses.map((clause, i) => {
    const keyword = detectSpeakerKeyword(clause);
    return {
      clause,
      i,
      keyword,
      priority: keyword ? SPEAKER_KEYWORD_PRIORITY.indexOf(keyword) : 999,
      pmActor: findActorBeforeKeyword(clause, PM_OWNERS, keyword),
      csActor: findActorBeforeKeyword(clause, CS_LIST, keyword),
      pmAny: findFirstName(clause, PM_OWNERS),
      csAny: findFirstName(clause, CS_LIST)
    };
  });

  // Prefer actor-before-keyword matches; avoids picking referenced names like "involving Edison".
  const bestCs = pickBestClause(enriched, (x) => x.csActor);
  const bestPm = pickBestClause(enriched, (x) => x.pmActor);

  const cs = bestCs?.csActor || "";
  const pmOwner = bestPm?.pmActor || "";

  // Soft fallback: if PM actor exists but CS actor missing, allow CS from same clause.
  if (pmOwner && !cs) {
    const sameClause = enriched.find((x) => x.pmActor === pmOwner && x.csAny);
    if (sameClause) return { cs: sameClause.csAny, pmOwner };
  }

  return { cs, pmOwner };
}

function findFirstName(text, names) {
  const lc = String(text || "").toLowerCase();
  for (const name of names) {
    if (lc.includes(name.toLowerCase())) return name;
  }
  return "";
}

function detectSpeakerKeyword(clause) {
  const lc = String(clause || "").toLowerCase();
  for (const kw of SPEAKER_KEYWORD_PRIORITY) {
    if (lc.includes(kw)) return kw;
  }
  return "";
}

function findActorBeforeKeyword(clause, names, keyword) {
  const raw = String(clause || "");
  if (!keyword) return "";
  const lc = raw.toLowerCase();
  const idx = lc.indexOf(keyword);
  if (idx < 0) return "";

  // Only consider the phrase before the action keyword (speaker side).
  const left = raw.slice(0, idx);
  const leftLc = left.toLowerCase();
  let best = "";
  let bestPos = -1;
  for (const name of names) {
    const pos = leftLc.lastIndexOf(name.toLowerCase());
    if (pos > bestPos) {
      best = name;
      bestPos = pos;
    }
  }
  return best;
}

function pickBestClause(rows, getValue) {
  const candidates = rows.filter((x) => getValue(x));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.priority - b.priority || a.i - b.i);
  return candidates[0];
}

async function refineRowsWithAI(rows) {
  if (!rows.length) return rows;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return rows;

  try {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const compact = rows.map((r, i) => ({
      i,
      description: r.description,
      module: r.module,
      issueType: r.issueType,
      cs: r.cs,
      pmOwner: r.pmOwner
    }));

    const prompt = `
You are a strict classifier for hotline issue rows.
For each item, return corrected values.
Return JSON only:
[
  {"i":0,"module":"...","issueType":"...","cs":"...","pmOwner":"..."}
]

Allowed modules: ${MODULES.join(" | ")}
Allowed issue types: ${ISSUE_TYPES.join(" | ")}
Allowed CS: ${CS_LIST.join(" | ")}
Allowed PM owner: ${PM_OWNERS.join(" | ")}

Rules:
- Use description as primary signal.
- If unsure module -> Others/General.
- If unsure issue type -> Question/Troubleshooting.
- If unsure CS/PM owner -> "".
- Keep the same indexes.

Input:
${JSON.stringify(compact)}
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json"
      }
    });

    const outputText = result.response.text();
    const fixes = JSON.parse(outputText);
    if (!Array.isArray(fixes)) return rows;

    const byIndex = new Map();
    for (const f of fixes) {
      if (typeof f?.i === "number") byIndex.set(f.i, f);
    }

    return rows.map((row, idx) => {
      const fix = byIndex.get(idx);
      if (!fix) return row;
      return {
        ...row,
        module: normalizeEnum(fix.module, MODULES, row.module || "Others/General"),
        issueType: normalizeEnum(
          fix.issueType,
          ISSUE_TYPES,
          row.issueType || "Question/Troubleshooting"
        ),
        cs: normalizeEnum(fix.cs, CS_LIST, row.cs || ""),
        pmOwner: normalizeEnum(fix.pmOwner, PM_OWNERS, row.pmOwner || "")
      };
    });
  } catch {
    return rows;
  }
}

async function driveGetJSON(authClient, url, query) {
  const token = await resolveAccessToken(authClient);
  const u = new URL(url);
  for (const [k, v] of Object.entries(query || {})) {
    u.searchParams.set(k, String(v));
  }
  const res = await fetch(u, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return await res.json();
}

async function driveGetText(authClient, url, query) {
  const token = await resolveAccessToken(authClient);
  const u = new URL(url);
  for (const [k, v] of Object.entries(query || {})) {
    u.searchParams.set(k, String(v));
  }
  const res = await fetch(u, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return await res.text();
}

async function resolveAccessToken(authClient) {
  const tokenResp = await authClient.getAccessToken();
  const token =
    typeof tokenResp === "string"
      ? tokenResp
      : tokenResp?.token || tokenResp?.access_token || "";
  if (!token) throw new Error("Failed to obtain Google OAuth access token");
  return token;
}

export async function runSyncOnce(options = {}) {
  try {
    const force = options?.force === true;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return json(500, { ok: false, error: "Missing GOOGLE_DRIVE_FOLDER_ID" });
    }

    const drive = getDriveClient();
    const store = getDataStore();
    const issues = await loadIssues(store);

    const files = await listDocsRecursively(drive, folderId);
    const candidates = files.filter((f) => matchesKeywords(f.name));
    if (!candidates.length) {
      return json(200, { ok: true, inserted: 0, message: "No matching notes file found." });
    }

    const latest = candidates[0];
    const fileKey = latest.id;
    if (!force && (await isProcessed(store, fileKey))) {
      return json(200, { ok: true, inserted: 0, message: "Latest file already processed." });
    }

    const text = await exportDocText(drive, latest.id);
    if (!text || text.trim().length < 80) {
      await markProcessed(store, fileKey);
      return json(200, {
        ok: true,
        inserted: 0,
        message: "Skipped file because notes were too short."
      });
    }

    const dateIso = toIsoDate(latest.modifiedTime);
    const rows = await extractRowsFromNotes(text, dateIso);
    const stamped = rows.map((row) => ({
      id: crypto.randomUUID(),
      sourceFileId: latest.id,
      sourceFileName: latest.name,
      sourceFileLink: latest.webViewLink || "",
      createdAt: new Date().toISOString(),
      ...row
    }));

    // Replace prior rows from the same source file to prevent stale/duplicate entries on force re-sync.
    const remaining = issues.filter((row) => row.sourceFileId !== latest.id);
    const merged = [...stamped, ...remaining].slice(0, 3000);
    await saveIssues(store, merged);
    await markProcessed(store, fileKey);

    return json(200, {
      ok: true,
      inserted: stamped.length,
      sourceFile: latest.name
    });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
}
