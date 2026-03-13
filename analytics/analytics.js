const THEME_KEY = "hotline-theme";
const els = {
  themeToggle: document.querySelector("#themeToggle"),
  issueTypeBars: document.querySelector("#issueTypeBars"),
  kpiGrid: document.querySelector("#kpiGrid"),
  weeklyTrend: document.querySelector("#weeklyTrend"),
  monthlyTrend: document.querySelector("#monthlyTrend"),
  breakdownMonthBtn: document.querySelector("#breakdownMonthBtn"),
  breakdownWeekBtn: document.querySelector("#breakdownWeekBtn"),
  breakdownYearBtn: document.querySelector("#breakdownYearBtn"),
  moduleTypeBreakdown: document.querySelector("#moduleTypeBreakdown")
};

const state = {
  rows: [],
  breakdownMode: "month"
};

init();

async function init() {
  if (typeof window.waitForHotlineAuth === "function") {
    await window.waitForHotlineAuth();
  }
  applySavedTheme();
  els.themeToggle.addEventListener("click", toggleTheme);
  els.breakdownMonthBtn?.addEventListener("click", () => setBreakdownMode("month"));
  els.breakdownWeekBtn?.addEventListener("click", () => setBreakdownMode("week"));
  els.breakdownYearBtn?.addEventListener("click", () => setBreakdownMode("year"));
  state.rows = await fetchAllRows();
  renderKpiCards();
  renderIssueTypeBars();
  renderWeeklyTrend();
  renderMonthlyTrend();
  renderModuleTypeBreakdown();
}

function setBreakdownMode(mode) {
  const next = mode === "week" || mode === "year" ? mode : "month";
  state.breakdownMode = next;
  els.breakdownMonthBtn?.classList.toggle("is-active", next === "month");
  els.breakdownWeekBtn?.classList.toggle("is-active", next === "week");
  els.breakdownYearBtn?.classList.toggle("is-active", next === "year");
  els.breakdownMonthBtn?.setAttribute("aria-pressed", next === "month" ? "true" : "false");
  els.breakdownWeekBtn?.setAttribute("aria-pressed", next === "week" ? "true" : "false");
  els.breakdownYearBtn?.setAttribute("aria-pressed", next === "year" ? "true" : "false");
  renderModuleTypeBreakdown();
}

async function fetchAllRows() {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const rows = [];

  while (page <= totalPages) {
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });
    const res = await fetch(`/api/issues?${qs.toString()}`, { cache: "no-store" });
    const data = await safeJson(res);
    if (!data.ok) throw new Error(data.error || "Failed to load analytics data");
    totalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
    rows.push(...(data.rows || []));
    page += 1;
  }
  return rows;
}

function renderIssueTypeBars() {
  const counts = countBy(state.rows, (r) => String(r.issueType || "Unknown"));
  const items = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = items[0]?.[1] || 1;
  els.issueTypeBars.innerHTML =
    items
      .map(([name, count]) => {
        const pct = Math.round((count / max) * 100);
        return `<div class="issue-bar-row">
          <div class="issue-bar-label">${escapeHtml(name)}</div>
          <div class="issue-bar-track"><div class="issue-bar-fill" style="width:${pct}%"></div></div>
          <div class="issue-bar-value">${count}</div>
        </div>`;
      })
      .join("") || `<div class="analytics-muted">No issue data found.</div>`;
}

function renderKpiCards() {
  const today = new Date();
  const currentWeekRows = filterRowsByDateRange(state.rows, startOfWeek(today), endOfWeek(today));
  const prevWeekStart = addDays(startOfWeek(today), -7);
  const prevWeekRows = filterRowsByDateRange(state.rows, prevWeekStart, addDays(prevWeekStart, 6));

  const currentMonthRows = filterRowsByMonth(state.rows, today.getFullYear(), today.getMonth() + 1);
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthRows = filterRowsByMonth(state.rows, prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1);

  const cards = [
    buildKpi("Current Week", currentWeekRows.length, pctDelta(prevWeekRows.length, currentWeekRows.length)),
    buildKpi("Current Month", currentMonthRows.length, pctDelta(prevMonthRows.length, currentMonthRows.length)),
    buildKpi("Bug Share (Month)", pctLabel(shareByIssueType(currentMonthRows, "Bug (CS ticket)")), ""),
    buildKpi(
      "Top Module (Month)",
      topLabelFromRows(currentMonthRows, (r) => String(r.module || "Unknown")),
      ""
    )
  ];

  els.kpiGrid.innerHTML = cards.join("");
}

function buildKpi(title, value, delta) {
  const deltaHtml = delta ? `<span class="kpi-delta">${escapeHtml(delta)}</span>` : "";
  return `<div class="kpi-item">
    <div class="kpi-title">${escapeHtml(title)}</div>
    <div class="kpi-value">${escapeHtml(String(value))}</div>
    ${deltaHtml}
  </div>`;
}

function renderWeeklyTrend() {
  const today = new Date();
  const currentWeekRows = filterRowsByDateRange(state.rows, startOfWeek(today), endOfWeek(today));
  const prevWeekStart = addDays(startOfWeek(today), -7);
  const prevWeekRows = filterRowsByDateRange(state.rows, prevWeekStart, addDays(prevWeekStart, 6));
  els.weeklyTrend.innerHTML = renderTrendRows(currentWeekRows, prevWeekRows);
}

function renderMonthlyTrend() {
  const today = new Date();
  const currentMonthRows = filterRowsByMonth(state.rows, today.getFullYear(), today.getMonth() + 1);
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthRows = filterRowsByMonth(state.rows, prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1);
  els.monthlyTrend.innerHTML = renderTrendRows(currentMonthRows, prevMonthRows);
}

function renderModuleTypeBreakdown() {
  const periods = buildIssueTrendPeriods(state.rows, state.breakdownMode, 6);
  if (!periods.length) {
    els.moduleTypeBreakdown.innerHTML = `<div class="analytics-muted">No rows found for trend summary.</div>`;
    return;
  }

  els.moduleTypeBreakdown.innerHTML = periods.map((period) => renderIssuePeriodCard(period)).join("");
}

function renderTrendRows(currentRows, previousRows) {
  const current = countBy(currentRows, (r) => String(r.issueType || "Unknown"));
  const previous = countBy(previousRows, (r) => String(r.issueType || "Unknown"));
  const keys = Array.from(new Set([...current.keys(), ...previous.keys()]));
  if (!keys.length) return `<div class="analytics-muted">No rows found for this period.</div>`;

  return `<div class="trend-head">
      <span>Issue Type</span><span>Current</span><span>Previous</span><span>Delta</span>
    </div>
    ${keys
      .map((k) => {
        const cur = Number(current.get(k) || 0);
        const prev = Number(previous.get(k) || 0);
        const delta = cur - prev;
        const deltaLabel = `${delta > 0 ? "+" : ""}${delta}`;
        return `<div class="trend-row">
          <span>${escapeHtml(k)}</span>
          <span>${cur}</span>
          <span>${prev}</span>
          <span class="${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}">${deltaLabel}</span>
        </div>`;
      })
      .join("")}`;
}

function countBy(rows, getter) {
  const m = new Map();
  for (const row of rows) {
    const key = getter(row) || "Unknown";
    m.set(key, (m.get(key) || 0) + 1);
  }
  return m;
}

function sortedCounts(map) {
  return [...map.entries()].sort((a, b) => Number(b[1]) - Number(a[1]));
}

function filterRowsByDateRange(rows, fromDate, toDate) {
  const from = toIsoDate(fromDate);
  const to = toIsoDate(toDate);
  return rows.filter((row) => {
    const d = String(row?.date || "");
    return d >= from && d <= to;
  });
}

function filterRowsByMonth(rows, year, month) {
  const y = Number(year);
  const m = String(month).padStart(2, "0");
  return rows.filter((row) => String(row?.date || "").startsWith(`${y}-${m}-`));
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function toIsoDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pctDelta(previous, current) {
  const prev = Number(previous || 0);
  const cur = Number(current || 0);
  if (!prev) return cur ? "+100%" : "0%";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function shareByIssueType(rows, issueType) {
  if (!rows.length) return 0;
  const hit = rows.filter((r) => String(r.issueType || "") === issueType).length;
  return (hit / rows.length) * 100;
}

function pctLabel(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function topLabelFromRows(rows, getter) {
  return sortedCounts(countBy(rows, getter))[0]?.[0] || "Unknown";
}

function normalizeIssueTypeBucket(issueType) {
  const t = String(issueType || "").toLowerCase();
  if (t.includes("bug")) return "bug";
  if (t.includes("feature")) return "feature";
  if (t.includes("question") || t.includes("troubleshooting")) return "question";
  return "other";
}

function buildIssueTrendPeriods(rows, mode, maxPeriods) {
  const byPeriod = new Map();
  for (const row of rows) {
    const isoDate = String(row?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;
    const period = periodMetaFromIso(isoDate, mode);
    if (!byPeriod.has(period.key)) {
      byPeriod.set(period.key, {
        key: period.key,
        label: period.label,
        total: 0,
        issueTypes: new Map(),
        rowsByIssueType: new Map()
      });
    }
    const item = byPeriod.get(period.key);
    item.total += 1;

    const issueBucket = normalizeIssueTypeBucket(row.issueType);
    item.issueTypes.set(issueBucket, (item.issueTypes.get(issueBucket) || 0) + 1);
    if (!item.rowsByIssueType.has(issueBucket)) item.rowsByIssueType.set(issueBucket, []);
    item.rowsByIssueType.get(issueBucket).push(row);
  }

  return [...byPeriod.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, Number(maxPeriods || 6));
}

function periodMetaFromIso(isoDate, mode) {
  if (mode === "week") {
    const startIso = toIsoDate(startOfWeek(parseIsoDate(isoDate)));
    return {
      key: startIso,
      label: `Week of ${formatDateDmy(startIso)}`
    };
  }
  if (mode === "year") {
    const yearKey = isoDate.slice(0, 4);
    return {
      key: yearKey,
      label: yearKey
    };
  }
  const monthKey = isoDate.slice(0, 7);
  return {
    key: monthKey,
    label: formatMonthKey(monthKey)
  };
}

function parseIsoDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

function formatMonthKey(monthKey) {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

function formatDateDmy(isoDate) {
  const [y, m, d] = String(isoDate).split("-");
  return `${d}/${m}/${y}`;
}

function renderIssuePeriodCard(period) {
  const issueRows = sortedCounts(period.issueTypes)
    .map(([bucket, count]) => {
      const share = pctLabel((Number(count || 0) / period.total) * 100);
      const rows = period.rowsByIssueType.get(bucket) || [];
      const moduleSummaries = buildModuleActionPlanSummaries(rows, bucket, 6);
      return `<details class="issue-summary-detail">
        <summary class="issue-summary-row">
          <span>${escapeHtml(bucketLabel(bucket))}</span>
          <span>${count}</span>
          <span>${share}</span>
        </summary>
        <div class="issue-summary-expand">
          ${moduleSummaries
            .map(
              (item) => `<article class="module-summary-card">
                <h4>${escapeHtml(item.module)}</h4>
                <ul class="module-summary-bullets">
                  ${item.points
                    .map(
                      (point) => `<li>
                        <span>${escapeHtml(point.issue)}</span>
                        <span class="module-point-action">Action plan: ${escapeHtml(point.action)}</span>
                      </li>`
                    )
                    .join("")}
                </ul>
              </article>`
            )
            .join("")}
        </div>
      </details>`;
    })
    .join("");
  const top = sortedCounts(period.issueTypes)[0];
  const summary = top ? `${bucketLabel(top[0])} is highest at ${pctLabel((Number(top[1] || 0) / period.total) * 100)}.` : "No issue trend.";
  return `<section class="period-summary-card">
    <div class="period-summary-head">
      <h3>${escapeHtml(period.label)}</h3>
      <span class="period-summary-total">${period.total} total</span>
    </div>
    <p class="period-summary-mix">${escapeHtml(summary)}</p>
    <div class="issue-summary-head">
      <span>Issue Type</span>
      <span>Count</span>
      <span>Share</span>
    </div>
    ${issueRows || `<div class="analytics-muted">No issue data.</div>`}
  </section>`;
}

function bucketLabel(bucketKey) {
  if (bucketKey === "bug") return "Bug";
  if (bucketKey === "feature") return "Feature";
  if (bucketKey === "question") return "Question";
  return "Other";
}

function buildModuleActionPlanSummaries(rows, issueBucket, limit) {
  if (!rows.length) {
    return [
      {
        module: "Unknown",
        points: [{ issue: "No description details captured for this period.", action: "No action plan available." }]
      }
    ];
  }

  const grouped = new Map();
  for (const row of rows) {
    const moduleName = String(row.module || "Unknown");
    if (!grouped.has(moduleName)) grouped.set(moduleName, []);
    grouped.get(moduleName).push(row);
  }

  return sortedCounts(
    new Map([...grouped.entries()].map(([moduleName, moduleRows]) => [moduleName, moduleRows.length]))
  )
    .slice(0, Number(limit || 6))
    .map(([moduleName]) => {
      const moduleRows = grouped.get(moduleName) || [];
      return {
        module: moduleName,
        points: buildModuleActionPlanPoints(moduleRows, issueBucket, 3)
      };
    });
}

function scoreMatches(text, regex) {
  const matches = String(text || "").match(regex);
  return matches ? matches.length : 0;
}

function buildModuleActionPlanPoints(rows, issueBucket, limit) {
  const descriptions = rows.map((r) => String(r.description || "").trim()).filter(Boolean);
  if (!descriptions.length) {
    return [{ issue: "No description context is available for this module in the selected period.", action: "No action plan available." }];
  }

  const fullText = descriptions.join(" ").toLowerCase();
  const issueTypeName = bucketLabel(issueBucket).toLowerCase();
  const themes = detectThemeScores(fullText);
  const points = [];
  const topics = detectRecurringTopics(fullText, issueBucket);
  if (topics.length) {
    points.push({
      issue: topics[0].issue,
      action: topics[0].action
    });
  }

  for (const theme of themes.slice(0, 2)) {
    if (points.length >= Number(limit || 3)) break;
    points.push({
      issue: `Recurring ${issueTypeName} pattern: ${theme.summary}.`,
      action: actionPlanForTheme(issueBucket, theme.shortLabel)
    });
  }

  if (topics.length > 1 && points.length < Number(limit || 3)) {
    points.push({
      issue: topics[1].issue,
      action: topics[1].action
    });
  }

  if (points.length < Number(limit || 3)) {
    const intensity = descriptions.length >= 8 ? "high" : descriptions.length >= 4 ? "moderate" : "early";
    points.push({
      issue: `${bucketLabel(issueBucket)} recurrence is ${intensity} in this module based on description volume this period.`,
      action: `Track ${bucketLabel(issueBucket).toLowerCase()} trend weekly and close feedback loop with a short post-release validation check.`
    });
  }

  return points.slice(0, Number(limit || 3));
}

function actionPlanForTheme(issueBucket, shortLabel) {
  if (shortLabel === "flow-break and reliability failures") {
    return "Add root-cause fix tickets, strengthen regression coverage for impacted flows, and monitor reopen rate after deployment.";
  }
  if (shortLabel === "performance slowdown") {
    return "Set performance budget targets, profile slow paths, and ship focused optimizations with before/after latency checks.";
  }
  if (shortLabel === "authentication and access control friction") {
    return "Audit auth/session rules, tighten permission checks, and add clear in-app recovery steps for blocked users.";
  }
  if (shortLabel === "data consistency and sync reliability") {
    return "Add reconciliation checks, improve retry/error handling, and validate sync accuracy with periodic sampling.";
  }
  if (shortLabel === "UX clarity and interaction behavior") {
    return "Simplify the interaction flow, reduce ambiguous states, and run quick usability checks before next iteration.";
  }
  if (issueBucket === "bug") return "Prioritize fix+test cycle and verify stability post-release.";
  if (issueBucket === "feature") return "Define scope clearly and roll out incrementally with usage tracking.";
  if (issueBucket === "question") return "Document repeat asks and standardize support guidance for faster resolution.";
  return "Capture concrete acceptance criteria and review outcomes in the next planning cycle.";
}

function detectThemeScores(text) {
  return [
    {
      summary: "users cannot complete expected actions due to failures in core flow",
      shortLabel: "flow-break and reliability failures",
      score: scoreMatches(text, /\b(error|failed|failure|cannot|can't|unable|not working|crash|exception|timeout|stuck)\b/g)
    },
    {
      summary: "slow loading, lag, or delayed response degrades usability",
      shortLabel: "performance slowdown",
      score: scoreMatches(text, /\b(slow|lag|latency|delay|loading|hang|takes too long|sluggish)\b/g)
    },
    {
      summary: "login, session, or permission barriers block expected access",
      shortLabel: "authentication and access control friction",
      score: scoreMatches(text, /\b(login|auth|authentication|permission|access|forbidden|unauthorized|token|session)\b/g)
    },
    {
      summary: "sync/import/export and data consistency issues are repeatedly reported",
      shortLabel: "data consistency and sync reliability",
      score: scoreMatches(text, /\b(sync|import|export|download|upload|excel|csv|data mismatch|not updated)\b/g)
    },
    {
      summary: "unclear interface behavior creates friction in filters, page flow, or actions",
      shortLabel: "UX clarity and interaction behavior",
      score: scoreMatches(text, /\b(ui|ux|button|screen|page|layout|dropdown|filter|confusing|unclear)\b/g)
    }
  ]
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function detectRecurringTopics(text, issueBucket) {
  const rulesByType = {
    question: [
      {
        issue: "Most asked questions are about payroll amount differences and how calculations are derived.",
        action: "Publish a short payroll calculation guide with examples and link it directly from the related workflow.",
        score: scoreMatches(text, /\b(payroll|salary|payslip|deduction|allowance|tax|ot|overtime|amount|calculation)\b/g)
      },
      {
        issue: "A frequent question is about process steps and when a request status should change.",
        action: "Add a step-by-step process checklist and expected timelines in the product flow and support SOP.",
        score: scoreMatches(text, /\b(how to|process|steps|status|timeline|approval|pending|submitted|request)\b/g)
      },
      {
        issue: "Users repeatedly ask about access setup and where to find specific actions or settings.",
        action: "Add contextual tooltips and a quick-start walkthrough for first-time setup and navigation.",
        score: scoreMatches(text, /\b(access|permission|role|setup|where|find|menu|setting|configure)\b/g)
      }
    ],
    bug: [
      {
        issue: "Most recurring bugs involve broken flows where actions fail or cannot be completed.",
        action: "Prioritize blocker fixes first, add regression tests for affected flows, and verify on the next release.",
        score: scoreMatches(text, /\b(error|failed|failure|cannot|can't|unable|not working|crash|exception|timeout|stuck)\b/g)
      },
      {
        issue: "A common bug pattern is incorrect output or mismatched data after submission/sync.",
        action: "Add data validation checkpoints and reconciliation logs to catch mismatches before users are impacted.",
        score: scoreMatches(text, /\b(mismatch|incorrect|wrong|different|not updated|sync|duplicate|missing)\b/g)
      },
      {
        issue: "Performance-related bugs appear repeatedly, especially slow loading and laggy interactions.",
        action: "Profile the slow path, optimize heavy queries/components, and enforce performance budgets in QA.",
        score: scoreMatches(text, /\b(slow|lag|latency|delay|loading|hang|sluggish)\b/g)
      }
    ],
    feature: [
      {
        issue: "Most feature requests focus on reducing manual work through automation.",
        action: "Prioritize high-frequency automation requests and release them in incremental milestones.",
        score: scoreMatches(text, /\b(automation|auto|bulk|batch|schedule|reminder|template)\b/g)
      },
      {
        issue: "A recurring request is for better reporting visibility and easier export/share workflows.",
        action: "Add compact analytics views and configurable exports that match common reporting needs.",
        score: scoreMatches(text, /\b(report|dashboard|analytics|export|download|summary|visibility)\b/g)
      },
      {
        issue: "Users also request more flexible workflow controls and configurable settings.",
        action: "Introduce configurable workflow options with sensible defaults and admin-level controls.",
        score: scoreMatches(text, /\b(workflow|custom|configure|setting|rule|approval|flexible)\b/g)
      }
    ],
    other: []
  };

  const rules = rulesByType[issueBucket] || rulesByType.other;
  return rules.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text.slice(0, 200) };
  }
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "dark" ? "dark" : "light");
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  els.themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  els.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
}

function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
