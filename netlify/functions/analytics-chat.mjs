import { GoogleGenerativeAI } from "@google/generative-ai";
import { assertPasswordGate, getDataStore, json, loadIssues } from "./_lib.mjs";

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
    const compactRows = rows
      .slice(0, 1000)
      .map((row) => ({
        date: String(row?.date || ""),
        module: String(row?.module || ""),
        issueType: String(row?.issueType || ""),
        cs: String(row?.cs || ""),
        pmOwner: String(row?.pmOwner || ""),
        description: String(row?.description || ""),
        comments: String(row?.comments || "")
      }));

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

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: content }] }],
      generationConfig: { temperature: 0.2 }
    });

    const answer = String(result?.response?.text?.() || "").trim();
    if (!answer) return json(500, { ok: false, error: "Empty AI response" });
    return json(200, { ok: true, answer });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};
