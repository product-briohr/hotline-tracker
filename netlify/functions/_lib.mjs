import { GoogleGenerativeAI } from "@google/generative-ai";
import { getStore } from "@netlify/blobs";
import { JWT } from "google-auth-library";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

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
const PM_OWNER_BY_MODULE = {
  "Claims": "Amir",
  "Document Management": "Amir",
  "Training": "Amir",
  "Time Attendance": "Nita Puspita",
  "Performance": "Nita Puspita",
  "Timesheets": "Nita Puspita",
  "Leave": "Nico",
  "Recruitment": "Nico",
  "Onboarding v3": "Nico",
  "Payroll": "Idris Ashari",
  "Emails": "Idris Ashari",
  "Profile/Core": "Idris Ashari",
  "Import/Export": "Idris Ashari",
  "Report builder": "Idris Ashari",
  "Who's away": "Idris Ashari",
  "Feed": "Idris Ashari",
  "Staffany": "Idris Ashari",
  "Xero": "Idris Ashari",
  "Pulse": "Idris Ashari"
};
const CS_NAME_ALIASES = [
  [/\bnoor\s+diyana\s+binti\s+kaseharom\b/gi, "Diyana"],
  [/\bnur\s+diyana\s+binti\s+sajali\b/gi, "Yana"]
];

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
  /\braised\b|\breported\b|\bdiscussed\b|\bmentioned\b|\brequest(?:ed|s|ing)?\b|\bconfirmed\b|\bstat(?:ed|es|ing)?\b|\bpresented\b|\binquir(?:ed|es|ing)?\b|\bsuggest(?:ed|s|ing)?\b|\backnowledged\b|\bcommitted\b|\binstructed\b|\badvised\b|\bescalated\b|\bnote(?:d|s)?\b/i;
const SPEAKER_KEYWORD_PRIORITY = [
  "acknowledged",
  "committed",
  "instructed",
  "noted",
  "note",
  "advised",
  "escalated",
  "raised",
  "reported",
  "discussed",
  "mentioned",
  "request",
  "requested",
  "suggested",
  "confirmed",
  "stated",
  "state",
  "presented",
  "inquire",
  "inquired",
  "suggest"
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

const AUTH_COOKIE_NAME = "hotline_auth";
const AUTH_SESSION_MS = 1000 * 60 * 60 * 24 * 365;

export function assertPasswordGate(request) {
  const appPassword = String(process.env.APP_PASSWORD || "").trim();
  if (!appPassword) return null;
  const token = readCookie(request, AUTH_COOKIE_NAME);
  if (!verifyAuthToken(token)) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  return null;
}

export function createPasswordGateSessionCookie(request) {
  const token = signAuthToken({
    exp: Date.now() + AUTH_SESSION_MS
  });
  const maxAgeSec = Math.floor(AUTH_SESSION_MS / 1000);
  const isSecure = isHttpsRequest(request);
  const securePart = isSecure ? "; Secure" : "";
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

function isHttpsRequest(request) {
  const url = request?.url || "";
  const proto = String(request?.headers?.get("x-forwarded-proto") || "").toLowerCase();
  return proto === "https" || url.startsWith("https:");
}

export function clearPasswordGateSessionCookie() {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function isPasswordGateEnabled() {
  return String(process.env.APP_PASSWORD || "").trim().length > 0;
}

function signAuthToken(payload) {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

function verifyAuthToken(token) {
  const raw = String(token || "").trim();
  if (!raw.includes(".")) return false;
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return false;
  const expected = signValue(encoded);
  if (!safeEqual(signature, expected)) return false;
  try {
    const payload = JSON.parse(fromBase64Url(encoded));
    const exp = Number(payload?.exp || 0);
    return Number.isFinite(exp) && Date.now() <= exp;
  } catch {
    return false;
  }
}

function signValue(value) {
  const secret = getSessionSecret();
  return createHmac("sha256", secret).update(String(value || "")).digest("base64url");
}

function getSessionSecret() {
  const explicit = String(process.env.APP_SESSION_SECRET || "").trim();
  if (explicit) return explicit;
  return `fallback:${String(process.env.APP_PASSWORD || "").trim()}`;
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a || ""));
  const bBuf = Buffer.from(String(b || ""));
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function readCookie(request, name) {
  const cookieHeader = String(request.headers.get("cookie") || "");
  if (!cookieHeader) return "";
  const target = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return "";
}

function toBase64Url(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
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
- Include ALL bullets from Details: issues, questions, status updates, discussions, and items stakeholders may want to track. Do not skip any.
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
    date: normalizeDate(input?.date, toIsoDate()),
    module: normalizeEnumMulti(input?.module, MODULES, "Others/General"),
    issueType: normalizeEnumMulti(input?.issueType, ISSUE_TYPES, "Question/Troubleshooting"),
    cs: normalizeEnumMulti(input?.cs, CS_LIST, ""),
    pmOwner: normalizeEnumMulti(input?.pmOwner, PM_OWNERS, ""),
    description: String(input?.description || "").trim(),
    comments: String(input?.comments || "").trim().slice(0, 2000)
  };
}

function normalizeEnumMulti(input, allowed, fallback) {
  const rawValues = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/\s*\|\s*|,\s*/)
        .map((x) => x.trim())
        .filter(Boolean);

  const normalized = [];
  for (const raw of rawValues) {
    const hit = normalizeEnum(raw, allowed, "");
    if (hit) normalized.push(hit);
  }

  const unique = Array.from(new Set(normalized));
  if (!unique.length) return fallback;
  return unique.join(" | ");
}

export function reclassifyRowByDescription(row, options = {}) {
  const overwriteActors = options.overwriteActors !== false;
  const inferred = inferFieldsFromDescription(row?.description || "");

  return {
    ...row,
    module: inferred.module || row.module || "Others/General",
    issueType: inferred.issueType || row.issueType || "Question/Troubleshooting",
    cs: overwriteActors ? (inferred.cs || row.cs || "") : row.cs || inferred.cs || "",
    // PM owner tagging is strictly module-keyword based.
    pmOwner: overwriteActors ? inferred.pmOwner || "" : row.pmOwner || inferred.pmOwner || ""
  };
}

export async function loadIssues(store, options = {}) {
  const dateFrom = String(options?.dateFrom || "").trim();
  const dateTo = String(options?.dateTo || "").trim();
  const partitions = await getIssuePartitions(store);
  if (partitions.length) {
    const selectedPartitions = filterPartitionsByDateRange(partitions, dateFrom, dateTo);
    if (!selectedPartitions.length) return [];

    const chunks = await Promise.all(
      selectedPartitions.map(async (partition) => {
        const rows = await store.get(issuePartitionKey(partition), { type: "json" });
        return Array.isArray(rows) ? rows : [];
      })
    );
    return chunks.flat();
  }

  // Backward-compatible fallback for legacy single-blob storage.
  const legacy = await store.get("issues", { type: "json" });
  return Array.isArray(legacy) ? legacy : [];
}

export async function saveIssues(store, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const grouped = groupRowsByPartition(safeRows);
  const partitions = Object.keys(grouped).sort();

  await Promise.all(
    partitions.map(async (partition) => {
      await store.setJSON(issuePartitionKey(partition), grouped[partition]);
    })
  );

  await store.setJSON("issues:partitions", partitions);
  // Prevent duplicate reads once partitioned storage is active.
  await store.setJSON("issues", []);
}

function issuePartitionKey(partition) {
  return `issues:${partition}`;
}

async function getIssuePartitions(store) {
  const value = await store.get("issues:partitions", { type: "json" });
  if (!Array.isArray(value)) return [];
  return value.filter((v) => /^\d{4}-\d{2}$/.test(String(v || "")));
}

function groupRowsByPartition(rows) {
  const grouped = {};
  for (const row of rows) {
    const partition = partitionFromRow(row);
    if (!grouped[partition]) grouped[partition] = [];
    grouped[partition].push(row);
  }
  return grouped;
}

function partitionFromRow(row) {
  const date = String(row?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 7);

  const createdAt = String(row?.createdAt || "").trim();
  const createdMs = Date.parse(createdAt);
  if (Number.isFinite(createdMs)) {
    return new Date(createdMs).toISOString().slice(0, 7);
  }

  return toIsoDate().slice(0, 7);
}

function filterPartitionsByDateRange(partitions, dateFrom, dateTo) {
  const fromMonth = monthFromIsoDate(dateFrom);
  const toMonth = monthFromIsoDate(dateTo);

  if (!fromMonth && !toMonth) return partitions;
  return partitions.filter((partition) => {
    if (fromMonth && partition < fromMonth) return false;
    if (toMonth && partition > toMonth) return false;
    return true;
  });
}

function monthFromIsoDate(value) {
  const input = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return "";
  return input.slice(0, 7);
}

export async function isProcessed(store, fileId) {
  const v = await store.get(`processed:${fileId}`);
  return v === "1";
}

export async function markProcessed(store, fileId) {
  await store.set(`processed:${fileId}`, "1");
}

export async function markAutoSyncSuccess(store, isoTime = new Date().toISOString()) {
  await store.set("meta:lastAutoSyncAt", String(isoTime));
}

export async function getLastAutoSyncAt(store) {
  return String((await store.get("meta:lastAutoSyncAt")) || "");
}

export function toIsoDate(dateInput) {
  const d = new Date(dateInput || new Date());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseMeetingDateFromNotes(notesText) {
  const lines = String(notesText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  for (const line of lines) {
    const parsed = parseDateLineToIso(line);
    if (parsed) return parsed;
  }
  return "";
}

function parseDateLineToIso(line) {
  const raw = String(line || "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const monthRe =
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b[.\s,/-]*(\d{1,2})(?:st|nd|rd|th)?[,\s/-]*(\d{4})\b/i;
  const m1 = raw.match(monthRe);
  if (m1) {
    const month = monthNameToNumber(m1[1]);
    const day = String(Number(m1[2])).padStart(2, "0");
    const year = m1[3];
    if (month) return `${year}-${month}-${day}`;
  }

  const dayMonthRe =
    /\b(\d{1,2})(?:st|nd|rd|th)?[\s/-]*(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)[,\s/-]*(\d{4})\b/i;
  const m2 = raw.match(dayMonthRe);
  if (m2) {
    const day = String(Number(m2[1])).padStart(2, "0");
    const month = monthNameToNumber(m2[2]);
    const year = m2[3];
    if (month) return `${year}-${month}-${day}`;
  }

  return "";
}

function monthNameToNumber(input) {
  const key = String(input || "").toLowerCase().slice(0, 3);
  const map = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };
  return map[key] || "";
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
  const module = inferModuleFromDescription(text);

  let issueType = "";
  for (const [value, regex] of ISSUE_KEYWORDS) {
    if (regex.test(text.toLowerCase())) {
      issueType = value;
      break;
    }
  }
  if (!issueType && /\?$/.test(text.trim())) {
    issueType = "Question/Troubleshooting";
  }

  const participants = inferParticipantsFromKeywordClauses(text);
  const pmOwner = inferPmOwnerByRule(module, participants.pmOwner);

  return {
    module,
    issueType,
    cs: participants.cs,
    pmOwner
  };
}

function inferModuleFromDescription(description) {
  const lc = String(description || "").toLowerCase();
  for (const [value, regex] of MODULE_KEYWORDS) {
    if (regex.test(lc)) return value;
  }
  return "";
}

function inferPmOwnerFromModule(module) {
  const key = String(module || "").trim();
  if (!key) return "";
  return PM_OWNER_BY_MODULE[key] || "";
}

function inferPmOwnerByRule(module, participantPmOwner) {
  const mappedByModule = inferPmOwnerFromModule(module);
  if (mappedByModule) return mappedByModule;
  // Fallback only when no module keyword is matched in description.
  return module ? "" : String(participantPmOwner || "").trim();
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
  const normalizedTextForCs = normalizeCsAliases(String(text || ""));
  const uniqueCsMention = findUniqueMentionedName(normalizedTextForCs, CS_LIST);
  const uniquePmMention = findUniqueMentionedName(String(text || ""), PM_OWNERS);
  const clauses = String(text || "")
    .split(/[\.\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => SPEAKER_KEYWORDS.test(s));

  if (!clauses.length) {
    return { cs: uniqueCsMention || "", pmOwner: uniquePmMention || "" };
  }

  const enriched = clauses.map((clause, i) => {
    const keyword = detectSpeakerKeyword(clause);
    const clauseForCs = normalizeCsAliases(clause);
    return {
      clause,
      i,
      keyword,
      priority: keyword ? SPEAKER_KEYWORD_PRIORITY.indexOf(keyword) : 999,
      pmActor: findActorBeforeKeyword(clause, PM_OWNERS, keyword),
      csActor: findActorBeforeKeyword(clauseForCs, CS_LIST, keyword),
      csTarget: findTargetAfterKeyword(clauseForCs, CS_LIST, keyword),
      pmAny: findFirstName(clause, PM_OWNERS),
      csAny: findFirstName(clauseForCs, CS_LIST)
    };
  });

  // Prefer actor-before-keyword matches; avoids picking referenced names like "involving Edison".
  const bestCs = pickBestClause(enriched, (x) => x.csActor);
  const bestCsRequestTarget = pickBestClause(enriched, (x) =>
    isRequestKeyword(x.keyword) ? x.csTarget : ""
  );
  const bestPm = pickBestClause(enriched, (x) => x.pmActor);
  const bestPmAny = pickBestClause(enriched, (x) => x.pmAny);

  const cs = bestCs?.csActor || bestCsRequestTarget?.csTarget || uniqueCsMention || "";
  const pmOwner = bestPm?.pmActor || bestPmAny?.pmAny || uniquePmMention || "";

  return { cs, pmOwner };
}

function findFirstName(text, names) {
  const raw = String(text || "");
  let best = "";
  let bestPos = Number.POSITIVE_INFINITY;
  for (const name of names) {
    const pos = findFirstNamePosition(raw, name);
    if (pos >= 0 && pos < bestPos) {
      best = name;
      bestPos = pos;
    }
  }
  return best;
}

function findUniqueMentionedName(text, names) {
  const raw = String(text || "");
  const matches = names.filter((name) => makeNameRegex(name).test(raw));
  return matches.length === 1 ? matches[0] : "";
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
  let best = "";
  let bestPos = -1;
  for (const name of names) {
    const pos = findLastNamePosition(left, name);
    if (pos > bestPos) {
      best = name;
      bestPos = pos;
    }
  }
  return best;
}

function findTargetAfterKeyword(clause, names, keyword) {
  const raw = String(clause || "");
  if (!keyword) return "";
  const lc = raw.toLowerCase();
  const idx = lc.indexOf(keyword);
  if (idx < 0) return "";

  const right = raw.slice(idx + keyword.length);
  let best = "";
  let bestPos = Number.POSITIVE_INFINITY;

  for (const name of names) {
    const pos = findFirstNamePosition(right, name);
    if (pos >= 0 && pos < bestPos) {
      best = name;
      bestPos = pos;
    }
  }
  return best;
}

function isRequestKeyword(keyword) {
  return /^request/.test(String(keyword || "").toLowerCase());
}

function normalizeCsAliases(input) {
  let text = String(input || "");
  for (const [pattern, canonical] of CS_NAME_ALIASES) {
    text = text.replace(pattern, canonical);
  }
  return text;
}

function findFirstNamePosition(text, name) {
  const re = makeNameRegex(name);
  const m = re.exec(String(text || ""));
  return m ? m.index : -1;
}

function findLastNamePosition(text, name) {
  const re = makeNameRegex(name, "g");
  let last = -1;
  let m;
  const s = String(text || "");
  while ((m = re.exec(s))) {
    last = m.index;
  }
  return last;
}

function makeNameRegex(name, flags = "i") {
  const escaped = escapeRegExp(String(name || "").trim()).replace(/\\\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, flags.includes("i") ? flags : `${flags}i`);
}

function escapeRegExp(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
- pmOwner is the PM who acknowledged the issue, committed to a fix, instructed the CS, advised, or owns the resolution — NOT the CS who reported it.
- CS is the support person who raised/reported the issue on behalf of the client.

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
      const module = normalizeEnum(fix.module, MODULES, row.module || "Others/General");
      const inferredModule = inferModuleFromDescription(row.description || "");
      const participants = inferParticipantsFromKeywordClauses(row.description || "");
      return {
        ...row,
        module,
        issueType: normalizeEnum(
          fix.issueType,
          ISSUE_TYPES,
          row.issueType || "Question/Troubleshooting"
        ),
        cs: normalizeEnum(fix.cs, CS_LIST, row.cs || ""),
        // Enforce PM owner by module keyword, with fallback to discussed PM only when no module is matched.
        pmOwner: inferPmOwnerByRule(inferredModule, participants.pmOwner)
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

function buildSlackWebhookBody(payload) {
  const trackerUrl = String(process.env.APP_PUBLIC_URL || process.env.URL || "https://producthotline.netlify.app/").trim();
  const syncedAt = String(payload?.syncedAt || new Date().toISOString());
  const isOk = payload?.ok === true;
  const headline = isOk
    ? `Product Hotline Tracker is available for ${formatDateWithOrdinal(syncedAt)}`
    : `Product Hotline Tracker is failed for ${formatDateWithOrdinal(syncedAt)}`;

  return {
    text: `${headline} ${trackerUrl}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${headline}*`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Product Hotline Tracker",
              emoji: true
            },
            url: trackerUrl
          }
        ]
      }
    ]
  };
}

export async function sendSlackSyncStatus(payload) {
  const webhookUrl = String(process.env.SLACK_SYNC_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(buildSlackWebhookBody(payload))
  });
}

async function makeSyncResponse(statusCode, body, options = {}) {
  const shouldNotifySlack =
    options?.notifySlack === true &&
    ((body?.ok === true && String(body?.sourceFile || "").trim().length > 0) || body?.ok === false);

  if (shouldNotifySlack) {
    try {
      await sendSlackSyncStatus({
        ok: body?.ok === true,
        syncedAt: options?.syncedAt || new Date().toISOString(),
        sourceFile: body?.sourceFile || "",
        trigger: options?.trigger || "scheduled"
      });
    } catch {
      // Never fail sync because Slack webhook notification failed.
    }
  }
  return json(statusCode, body);
}

export async function runSyncOnce(options = {}) {
  const notifySlack = options?.notifySlack === true;
  const trigger = String(options?.trigger || "manual").trim();
  const force = options?.force === true;
  const syncedAt = new Date().toISOString();
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return makeSyncResponse(500, { ok: false, error: "Missing GOOGLE_DRIVE_FOLDER_ID" }, { notifySlack, trigger, syncedAt });
    }

    const drive = getDriveClient();
    const store = getDataStore();
    const files = await listDocsRecursively(drive, folderId);
    const candidates = files.filter((f) => matchesKeywords(f.name));
    if (!candidates.length) {
      await markAutoSyncSuccess(store);
      return makeSyncResponse(200, { ok: true, inserted: 0, message: "No matching notes file found." }, { notifySlack, trigger, syncedAt });
    }
    let issues = await loadIssues(store);
    const stamped = [];
    const processedFiles = [];
    let skippedShortFiles = 0;

    for (const file of candidates) {
      const fileKey = file.id;
      if (!force && (await isProcessed(store, fileKey))) continue;

      const text = await exportDocText(drive, file.id);
      if (!text || text.trim().length < 80) {
        await markProcessed(store, fileKey);
        skippedShortFiles += 1;
        continue;
      }

      const dateIso = parseMeetingDateFromNotes(text) || toIsoDate(file.modifiedTime);
      const rows = await extractRowsFromNotes(text, dateIso);
      const nowIso = new Date().toISOString();
      stamped.push(
        ...rows.map((row) => ({
          id: randomUUID(),
          sourceFileId: file.id,
          sourceFileName: file.name,
          sourceFileLink: file.webViewLink || "",
          createdAt: nowIso,
          ...row
        }))
      );

      await markProcessed(store, fileKey);
      processedFiles.push(file.name);
      if (force) {
        issues = issues.filter((r) => r.sourceFileId !== file.id);
      }
    }

    if (stamped.length) {
      const merged = [...stamped, ...issues];
      await saveIssues(store, merged);
    }

    await markAutoSyncSuccess(store);

    if (!processedFiles.length) {
      return makeSyncResponse(
        200,
        { ok: true, inserted: 0, message: "All matching notes are already processed." },
        { notifySlack, trigger, syncedAt }
      );
    }

    const suffix = skippedShortFiles ? ` (${skippedShortFiles} short files skipped)` : "";
    return makeSyncResponse(
      200,
      {
        ok: true,
        inserted: stamped.length,
        sourceFile: processedFiles[0],
        message: `Processed ${processedFiles.length} file(s)${suffix}.`
      },
      { notifySlack, trigger, syncedAt }
    );
  } catch (error) {
    return makeSyncResponse(500, { ok: false, error: String(error?.message || error) }, { notifySlack, trigger, syncedAt });
  }
}

function formatDateWithOrdinal(isoDateTime) {
  const d = new Date(isoDateTime || Date.now());
  const day = d.getUTCDate();
  const suffix = getOrdinalSuffix(day);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

function getOrdinalSuffix(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}
