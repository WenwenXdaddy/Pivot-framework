#!/usr/bin/env node
import assert from "node:assert/strict";


const DEFAULT_WORKER_URL = "https://pivot-framework-api.xuejiadi.workers.dev";
const DEFAULT_DASHBOARD_URLS = [
  "https://pivotframework.wddiscovery.com",
  "https://pivot-dashboard.pages.dev",
];


function argValue(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}


async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "pivot-framework-smoke/1.0" } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}


async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "pivot-framework-smoke/1.0" } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return text;
}


function assertScenarioProbs(probs) {
  assert(probs, "scenario_probs missing");
  for (const key of ["s1_no_pivot", "s2_tariff_rollback", "s3_oil_trap"]) {
    assert.equal(typeof probs[key], "number", `${key} must be numeric`);
  }
  const total = Object.values(probs).reduce((sum, value) => sum + value, 0);
  assert(Math.abs(total - 1) < 0.001, `scenario_probs must sum to 1.0; got ${total}`);
}


function assertAlerts(alerts) {
  assert(Array.isArray(alerts), "threshold_alerts must be an array");
  assert(
    alerts.every((alert) => alert.startsWith("WARNING:") || alert.startsWith("CRITICAL:")),
    "all threshold alerts must start with WARNING: or CRITICAL:",
  );
}


async function checkWorker(workerUrl) {
  const provider = await fetchJson(`${workerUrl}/api/provider`);
  assert.equal(provider.hasTavilySearch, true, "provider should report Tavily prefetch search");
  assert.equal(provider.searchMode, "tavily_prefetch", "provider searchMode should be tavily_prefetch");

  const latest = await fetchJson(`${workerUrl}/api/latest`);
  assert(latest.date, "latest date missing");
  assert(latest._refreshedAt, "latest _refreshedAt missing");
  assertScenarioProbs(latest.scenario_probs);
  assertAlerts(latest.threshold_alerts || []);

  const latestCn = await fetchJson(`${workerUrl}/api/latest?lang=cn`);
  assert.equal(latestCn.date, latest.date, "Chinese latest should use same date");
  assertScenarioProbs(latestCn.scenario_probs);

  const history = await fetchJson(`${workerUrl}/api/history`);
  assert((history.dates || []).length >= 1, "history dates missing");
  assert((history.entries || []).length >= 1, "history entries missing");

  for (const scenario of [1, 2, 3]) {
    const data = await fetchJson(`${workerUrl}/api/elaboration/${scenario}`);
    assert.equal(data.scenario, scenario, `scenario ${scenario} id mismatch`);
    assert((data.analysis || "").length > 500, `scenario ${scenario} elaboration too short`);
  }

  const s1 = (await fetchJson(`${workerUrl}/api/elaboration/1`)).analysis || "";
  const s2 = (await fetchJson(`${workerUrl}/api/elaboration/2`)).analysis || "";
  const s3 = (await fetchJson(`${workerUrl}/api/elaboration/3`)).analysis || "";
  assert(s1.includes("### 1. Premise and current conditions"), "S1 template section missing");
  assert(s1.includes("### 7. Meta-point and invalidation"), "S1 final section missing");
  assert(s2.includes("### 1. The defection math"), "S2 template section missing");
  assert(s2.includes("### 6. Cross-asset implications"), "S2 final section missing");
  assert(s3.includes("### 1. The ceasefire path"), "S3 template section missing");
  assert(s3.includes("### 3. The yield persistence question"), "S3 yield section missing");

  console.log(`Worker OK: ${latest.date} ${latest._refreshedAt}`);
}


async function checkDashboards(urls, workerUrl) {
  for (const url of urls) {
    const html = await fetchText(url);
    assert(html.includes("chart-s3"), `${url} missing S3 chart`);
    assert(html.includes("searchMode"), `${url} missing provider searchMode display`);
    assert(html.includes("scenario_probs"), `${url} missing canonical scenario_probs handling`);
    assert(html.includes(workerUrl), `${url} missing configured Worker URL`);
    console.log(`Dashboard OK: ${url}`);
  }
}


async function main() {
  const workerUrl = argValue("--worker", process.env.WORKER_URL || DEFAULT_WORKER_URL).replace(/\/$/, "");
  const dashboardsArg = argValue("--dashboards", process.env.DASHBOARD_URLS || DEFAULT_DASHBOARD_URLS.join(","));
  const dashboardUrls = dashboardsArg.split(",").map((url) => url.trim()).filter(Boolean);

  await checkWorker(workerUrl);
  await checkDashboards(dashboardUrls, workerUrl);
  console.log("Production smoke test passed.");
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});
