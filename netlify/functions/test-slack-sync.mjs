import { json } from "./_lib.mjs";

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const authError = assertAdminAuth(request);
    if (authError) return authError;

    const webhookUrl = String(process.env.SLACK_SYNC_WEBHOOK_URL || "").trim();
    if (!webhookUrl) {
      return json(500, { ok: false, error: "Missing SLACK_SYNC_WEBHOOK_URL" });
    }

    const appName = String(process.env.SLACK_SYNC_APP_NAME || "Product Hotline Tracker").trim();
    const nowIso = new Date().toISOString();
    const text = [
      ":test_tube: *Manual Slack test*",
      `*App:* ${appName}`,
      "*Trigger:* manual-test",
      "*Status:* success",
      `*Time:* ${nowIso}`
    ].join("\n");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      return json(500, { ok: false, error: `Slack webhook failed with status ${res.status}` });
    }

    return json(200, { ok: true, sentAt: nowIso });
  } catch (error) {
    return json(500, { ok: false, error: String(error?.message || error) });
  }
};

function assertAdminAuth(request) {
  const requiredToken = process.env.EDIT_TOKEN || process.env.SYNC_TOKEN;
  if (!requiredToken || requiredToken.startsWith("choose-")) return null;

  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (provided !== requiredToken) {
    return json(401, { ok: false, error: "Unauthorized" });
  }
  return null;
}
