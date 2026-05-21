import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";


const source = readFileSync("cloudflare/src/worker.js", "utf8")
  .replace("export default", "const workerDefault =");

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  `${source}
  globalThis.__workerHelpers = {
    isRetryableStatus,
    parseGenericBallot,
    parseTreasuryYieldCurveXml,
    buildThresholdAlerts,
    normalizeScenarioProbabilities,
    postprocessRefreshData,
  };`,
  sandbox,
  { filename: "cloudflare/src/worker.js" },
);

const {
  isRetryableStatus,
  parseGenericBallot,
  parseTreasuryYieldCurveXml,
  buildThresholdAlerts,
  normalizeScenarioProbabilities,
  postprocessRefreshData,
} = sandbox.__workerHelpers;


function plain(value) {
  return JSON.parse(JSON.stringify(value));
}


function testThresholdAlerts() {
  const alerts = buildThresholdAlerts({
    gop_approval: 76,
    yield_10y: 4.67,
    yield_30y: 5.20,
    fed_hike_prob: 0.40,
    generic_ballot: "D+9",
  });

  assert(alerts.includes("WARNING: GOP approval (76%) crossed warning threshold"));
  assert(alerts.includes("WARNING: 10Y yield (4.67%) crossed warning threshold"));
  assert(alerts.includes("WARNING: Fed hike probability (0.4) crossed warning threshold"));
  assert(alerts.includes("WARNING: Generic ballot (D+9) crossed warning threshold"));
  assert(!alerts.some((alert) => alert.includes("30Y yield")), "30Y 5.20 should not cross 5.25 warning");
  assert(alerts.every((alert) => alert.startsWith("WARNING:") || alert.startsWith("CRITICAL:")));
}


function testRetryableStatusClassification() {
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(404), false);
}


function testCriticalAlerts() {
  const alerts = buildThresholdAlerts({
    gop_approval: 74,
    yield_30y: 5.51,
    fed_hike_prob: 0.53,
    generic_ballot: "D+12",
  });

  assert(alerts.includes("CRITICAL: GOP approval (74%) crossed critical threshold"));
  assert(alerts.includes("CRITICAL: 30Y yield (5.51%) crossed critical threshold"));
  assert(alerts.includes("CRITICAL: Fed hike probability (0.53) crossed critical threshold"));
  assert(alerts.includes("WARNING: Generic ballot (D+12) crossed warning threshold"));
}


function testGenericBallotParsing() {
  assert.equal(parseGenericBallot("D+9"), 9);
  assert.equal(parseGenericBallot("R+3"), -3);
  assert.equal(parseGenericBallot("N/A"), null);
}


function testProbabilityNormalization() {
  const data = {
    scenario_probs: { s1_no_pivot: "15%" },
    scenarios: {
      s2: { prob: 0.45, name: "Tariff rollback", direction: "strengthening", key_signal: "S2" },
      s3: { prob: 0.40, name: "Oil trap", direction: "strengthening", key_signal: "S3" },
    },
  };

  const result = normalizeScenarioProbabilities(data);
  assert.equal(result.scenario_probs.s1_no_pivot, 0.15);
  assert.equal(result.scenario_probs.s2_tariff_rollback, 0.45);
  assert.equal(result.scenario_probs.s3_oil_trap, 0.40);
  assert.equal(
    Number(Object.values(result.scenario_probs).reduce((sum, value) => sum + value, 0).toFixed(4)),
    1,
  );
}

function testTreasuryYieldCurveParsing() {
  const xml = `
    <feed>
      <entry><content><m:properties>
        <d:NEW_DATE m:type="Edm.DateTime">2026-05-19T00:00:00</d:NEW_DATE>
        <d:BC_2YEAR m:type="Edm.Double">4.01</d:BC_2YEAR>
        <d:BC_10YEAR m:type="Edm.Double">4.52</d:BC_10YEAR>
        <d:BC_30YEAR m:type="Edm.Double">5.08</d:BC_30YEAR>
      </m:properties></content></entry>
      <entry><content><m:properties>
        <d:NEW_DATE m:type="Edm.DateTime">2026-05-20T00:00:00</d:NEW_DATE>
        <d:BC_2YEAR m:type="Edm.Double">4.04</d:BC_2YEAR>
        <d:BC_10YEAR m:type="Edm.Double">4.57</d:BC_10YEAR>
        <d:BC_30YEAR m:type="Edm.Double">5.11</d:BC_30YEAR>
      </m:properties></content></entry>
    </feed>`;

  assert.deepEqual(plain(parseTreasuryYieldCurveXml(xml)), {
    treasury_yield_date: "2026-05-20",
    yield_2y: 4.04,
    yield_10y: 4.57,
    yield_30y: 5.11,
    spread_2s10s: 0.53,
  });
}


function testPostprocessCanonicalizesAndOverridesAlerts() {
  const data = postprocessRefreshData({
    readings: {
      gop_approval: 77,
      yield_10y: 4.598,
      yield_2y: 3.75,
      yield_30y: 5.12,
      fed_hike_prob: 0.53,
      generic_ballot: "D+9",
      sp500_forward_pe: 18.5,
    },
    scenarios: {
      s1: { name: "No pivot", prob: 0.15, direction: "weakening", key_signal: "S1" },
      s2: { name: "Tariff rollback", prob: 0.45, direction: "strengthening", key_signal: "S2" },
      s3: { name: "Oil trap", prob: 0.40, direction: "strengthening", key_signal: "S3" },
    },
    threshold_alerts: ["WTI above $100 (warning)"],
  });

  assert.deepEqual(plain(data.scenario_probs), {
    s1_no_pivot: 0.15,
    s2_tariff_rollback: 0.45,
    s3_oil_trap: 0.40,
  });
  assert.deepEqual(plain(data.scenarios.s1), { direction: "weakening", key_signal: "S1" });
  assert(!("prob" in data.scenarios.s1));
  assert(!("name" in data.scenarios.s1));
  assert(data.threshold_alerts.every((alert) => alert.startsWith("WARNING:") || alert.startsWith("CRITICAL:")));
  assert(data.threshold_alerts.includes("CRITICAL: Fed hike probability (0.53) crossed critical threshold"));
  assert.equal(data.readings.spread_2s10s, 0.85);
  assert.equal(data.readings.erp, 0.81);
}


testRetryableStatusClassification();
testThresholdAlerts();
testCriticalAlerts();
testGenericBallotParsing();
testProbabilityNormalization();
testTreasuryYieldCurveParsing();
testPostprocessCanonicalizesAndOverridesAlerts();

console.log("worker helper tests passed");
