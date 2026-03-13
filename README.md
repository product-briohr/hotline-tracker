# Product Hotline Tracker (Netlify)

Netlify app that:

- Reads Gemini meeting notes from your Google Drive folder.
- Extracts structured issues with Gemini API.
- Stores records in Netlify Blobs.
- Shows a clean filterable dashboard.

## 1) Prerequisites

- Node 18+
- Netlify account + CLI
- Google Cloud service account with Drive read access
- Gemini API key

## 2) Install

```bash
npm install
```

## 3) Configure env vars

Copy `.env.example` to `.env` for local dev.

For Netlify production, set the same values in:
`Site settings -> Environment variables`.

Required:

- `GEMINI_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`

Optional:

- `SYNC_TOKEN` (recommended)
- `EDIT_TOKEN` (recommended if app is public)
- `MEETING_KEYWORD` (default: Product Hotline)
- `BLOB_STORE_NAME`
- `GEMINI_MODEL`
- `SLACK_SYNC_WEBHOOK_URL` (optional; send scheduled sync pass/fail to Slack)
- `SLACK_SYNC_APP_NAME` (optional; default: `Product Hotline Tracker`)
- `APP_PUBLIC_URL` (optional; Slack button URL, defaults to site URL)

## 4) Google Drive access setup

1. Create a service account in Google Cloud.
2. Generate a JSON key.
3. Use:
   - `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
4. Share your Drive folder with that `client_email` as Viewer.

## 5) Local run

```bash
npm run dev
```

Open the local URL shown by Netlify CLI.

## 6) Deploy to Netlify

```bash
netlify init
netlify deploy --prod
```

Note: for private repos on Netlify free plan, deploys are blocked for unrecognized Git contributors.

## 7) How sync works

- Scheduled functions run weekdays at `05:00 UTC` (1:00 PM MYT) and `05:30 UTC` (1:30 PM MYT).
- Scheduled sync can post pass/fail status to Slack when `SLACK_SYNC_WEBHOOK_URL` is set.
- It scans Drive folder (+ subfolders), picks latest matching doc, and skips already processed files.
- Manual sync available via UI button (`Sync Now`).
- If `SYNC_TOKEN` is set, paste it in UI to run manual sync.
- Inline row editing is persisted in Netlify Blobs, so updates are shared for all users.

## 8) APIs

- `POST /api/sync`
- `GET /api/issues`
- `POST /api/issues/update`

Filters:

- `q`
- `module`
- `issueType`
- `cs`
- `pmOwner`
- `dateFrom`
- `dateTo`
