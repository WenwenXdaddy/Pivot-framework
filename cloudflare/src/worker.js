// Cloudflare Worker: API proxy for the pivot framework
// Swap providers by changing ACTIVE_PROVIDER below.
// Deploy: wrangler secret put API_KEY && wrangler secret put TAVILY_API_KEY && wrangler deploy

// ═══════════════════════════════════════════════════════
// PROVIDER CONFIG — change ACTIVE_PROVIDER to switch
// ═══════════════════════════════════════════════════════

const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: (env) => ({
      'Content-Type': 'application/json',
      'x-api-key': env.API_KEY,
      'anthropic-version': '2023-06-01',
    }),
    body: (model, system, messages, tools) => ({
      model,
      max_tokens: 4000,
      system,
      messages,
      tools,
    }),
    parse: (data) =>
      data.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n'),
    model: 'claude-sonnet-4-20250514',
    searchTool: { type: 'web_search_20250305', name: 'web_search' },
  },

  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: (env) => ({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.API_KEY,
    }),
    body: (model, system, messages, tools) => ({
      model,
      max_tokens: 4000,
      messages: [{ role: 'system', content: system }, ...messages],
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name || 'web_search',
          description: 'Search the web for current information',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Search query' } },
            required: ['query'],
          },
        },
      })),
    }),
    parse: (data) => data.choices?.[0]?.message?.content || '',
    model: 'gpt-4o',
    searchTool: { name: 'web_search' },
  },

  openai_websearch: {
    url: 'https://api.openai.com/v1/responses',
    headers: (env) => ({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.API_KEY,
    }),
    body: (model, system, messages) => ({
      model,
      instructions: system,
      input: messages[0].content,
      tools: [{ type: 'web_search_preview' }],
    }),
    parse: (data) =>
      (data.output || [])
        .filter((b) => b.type === 'message')
        .flatMap((b) => b.content || [])
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text)
        .join('\n'),
    model: 'gpt-4o',
    searchTool: { type: 'web_search_preview' },
  },

  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    headers: (env) => ({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.API_KEY,
    }),
    body: (model, system, messages) => ({
      model,
      max_tokens: 8000,
      messages: [{ role: 'system', content: system }, ...messages],
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
    }),
    parse: (data) => data.choices?.[0]?.message?.content || '',
    model: 'deepseek-v4-flash',
    searchTool: null,
  },

  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
    headers: (env) => ({
      'Content-Type': 'application/json',
      'x-goog-api-key': env.API_KEY,
    }),
    body: (model, system, messages) => ({
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      tools: [{ google_search: {} }],
    }),
    parse: (data) =>
      (data.candidates?.[0]?.content?.parts || [])
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('\n'),
    model: 'gemini-2.5-flash',
    searchTool: { google_search: {} },
  },

  zai: {
    url: 'https://api.z.ai/api/anthropic/v1/messages',
    headers: (env) => ({
      'Content-Type': 'application/json',
      'x-api-key': env.API_KEY,
      'anthropic-version': '2023-06-01',
    }),
    body: (model, system, messages) => ({
      model,
      max_tokens: 16000,
      system,
      messages,
    }),
    parse: (data) =>
      data.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n'),
    model: 'glm-5.1',
  },
};

// ╔═══════════════════════════════════════════════╗
// ║  SET YOUR PROVIDER HERE                       ║
// ║  Options: anthropic | openai | deepseek       ║
// ║           openai_websearch | gemini | zai      ║
// ╚═══════════════════════════════════════════════╝
const ACTIVE_PROVIDER = 'deepseek';

// ═══════════════════════════════════════════════════════
// PROVIDER-AGNOSTIC LAYER — nothing below needs editing
// ═══════════════════════════════════════════════════════

function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, label, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || !isRetryableStatus(response.status) || attempt === attempts) {
        return response;
      }
      console.warn(`${label} attempt ${attempt} returned ${response.status}; retrying`);
    } catch (e) {
      lastError = e;
      if (attempt === attempts) throw e;
      console.warn(`${label} attempt ${attempt} failed: ${e.message}; retrying`);
    }
    await sleep(400 * attempt);
  }
  throw lastError || new Error(label + ' failed after retries');
}

async function callProvider(env, systemPrompt, userMessage) {
  const P = PROVIDERS[ACTIVE_PROVIDER];
  if (!P) throw new Error('Unknown provider: ' + ACTIVE_PROVIDER);

  let url = P.url;
  if (url.includes('{MODEL}')) url = url.replace('{MODEL}', P.model);

  const messages = [{ role: 'user', content: userMessage }];
  const tools = P.searchTool ? [P.searchTool] : [];
  const body = P.body(P.model, systemPrompt, messages, tools);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: P.headers(env),
    body: JSON.stringify(body),
  }, ACTIVE_PROVIDER + ' API');

  if (!response.ok) {
    const err = await response.text();
    throw new Error(ACTIVE_PROVIDER + ' API ' + response.status + ': ' + err.slice(0, 300));
  }

  const data = await response.json();
  return P.parse(data);
}

function extractJSON(text) {
  // Strip markdown code fences if present
  text = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  // Find the first '{' and use brace counting to find its matching '}'
  const start = text.indexOf('{');
  if (start === -1) return { error: 'No JSON found in response', raw: text };

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }

  if (end === -1) return { error: 'No complete JSON object found', raw: text };

  let jsonStr = text.slice(start, end + 1);

  // Fix common LLM issues: unescaped newlines/tabs inside string values
  jsonStr = jsonStr.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/[\n\r]/g, ' ').replace(/\t/g, ' ');
  });

  // Remove trailing commas before } or ]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return { error: 'JSON parse failed: ' + e.message, raw: jsonStr.slice(0, 500) };
  }
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%,$,+bp\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeProbability(value) {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  if (parsed > 1) return Math.round((parsed / 100) * 10000) / 10000;
  return Math.round(parsed * 10000) / 10000;
}

function parseGenericBallot(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(even|tie|tied)$/i.test(trimmed)) return 0;

  const match = trimmed.match(/\b([DR])\s*\+?\s*(-?\d+(?:\.\d+)?)\b/i);
  if (!match) return null;

  const party = match[1].toUpperCase();
  const margin = Number(match[2]);
  if (!Number.isFinite(margin)) return null;
  return party === 'D' ? margin : -margin;
}

function formatReadingValue(value, unit = '') {
  if (value == null) return 'n/a';
  if (unit === '$') return '$' + value;
  return String(value) + unit;
}

function alertForThreshold(metric, value, { warning, critical, direction, unit = '' }) {
  if (value == null) return null;

  const crossedCritical = direction === 'below' ? value < critical : value > critical;
  const crossedWarning = direction === 'below' ? value < warning : value > warning;

  if (crossedCritical) {
    return `CRITICAL: ${metric} (${formatReadingValue(value, unit)}) crossed critical threshold`;
  }
  if (crossedWarning) {
    return `WARNING: ${metric} (${formatReadingValue(value, unit)}) crossed warning threshold`;
  }
  return null;
}

function buildThresholdAlerts(readings = {}) {
  const alerts = [
    alertForThreshold('Econ approval', toNumber(readings.econ_approval), { warning: 30, critical: 25, direction: 'below', unit: '%' }),
    alertForThreshold('GOP approval', toNumber(readings.gop_approval), { warning: 80, critical: 75, direction: 'below', unit: '%' }),
    alertForThreshold('VIX', toNumber(readings.vix), { warning: 30, critical: 40, direction: 'above' }),
    alertForThreshold('WTI crude', toNumber(readings.wti), { warning: 100, critical: 120, direction: 'above', unit: '$' }),
    alertForThreshold('Gas price avg', toNumber(readings.gas_price), { warning: 4.00, critical: 5.00, direction: 'above', unit: '$' }),
    alertForThreshold('10Y yield', toNumber(readings.yield_10y), { warning: 4.60, critical: 5.00, direction: 'above', unit: '%' }),
    alertForThreshold('2s10s spread', toNumber(readings.spread_2s10s), { warning: 0.75, critical: 1.00, direction: 'above', unit: '%' }),
    alertForThreshold('30Y yield', toNumber(readings.yield_30y), { warning: 5.25, critical: 5.50, direction: 'above', unit: '%' }),
    alertForThreshold('Fed hike probability', normalizeProbability(readings.fed_hike_prob), { warning: 0.30, critical: 0.50, direction: 'above' }),
  ].filter(Boolean);

  const genericBallotMargin = parseGenericBallot(readings.generic_ballot);
  const genericBallotAlert = alertForThreshold('Generic ballot', genericBallotMargin, {
    warning: 7,
    critical: 12,
    direction: 'above',
  });
  if (genericBallotAlert) {
    alerts.splice(2, 0, genericBallotAlert.replace(`(${genericBallotMargin})`, `(${readings.generic_ballot})`));
  }

  return alerts;
}

const SCENARIO_PROB_KEYS = [
  ['s1_no_pivot', 's1'],
  ['s2_tariff_rollback', 's2'],
  ['s3_oil_trap', 's3'],
];

function roundProbabilitiesToOne(values) {
  const rounded = values.map((value) => Math.round(value * 10000) / 10000);
  const drift = Math.round((1 - rounded.reduce((sum, value) => sum + value, 0)) * 10000) / 10000;
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * 10000) / 10000;
  return rounded;
}

function normalizeScenarioProbabilities(data) {
  const canonical = data.scenario_probs || {};
  const scenarios = data.scenarios || {};
  const values = SCENARIO_PROB_KEYS.map(([canonicalKey, oldKey]) => {
    const canonicalProb = normalizeProbability(canonical[canonicalKey]);
    if (canonicalProb != null) return canonicalProb;
    return normalizeProbability(scenarios[oldKey]?.prob);
  });

  const present = values.filter((value) => value != null);
  if (present.length === 0) {
    values.fill(1 / values.length);
  } else if (present.length < values.length) {
    const presentSum = present.reduce((sum, value) => sum + value, 0);
    const remaining = Math.max(0, 1 - presentSum);
    const missingShare = remaining / (values.length - present.length);
    for (let i = 0; i < values.length; i++) {
      if (values[i] == null) values[i] = missingShare;
    }
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const normalized = total > 0 ? values.map((value) => value / total) : values.map(() => 1 / values.length);
  const rounded = roundProbabilitiesToOne(normalized);

  data.scenario_probs = Object.fromEntries(
    SCENARIO_PROB_KEYS.map(([canonicalKey], index) => [canonicalKey, rounded[index]])
  );

  return data;
}

function normalizeReadings(data) {
  const r = data.readings || {};
  const numericFields = [
    'econ_approval',
    'gop_approval',
    'overall_approval',
    'silver_bulletin_net',
    'vix',
    'gold',
    'wti',
    'brent',
    'gas_price',
    'yield_10y',
    'yield_2y',
    'yield_30y',
    'sp500_forward_pe',
  ];
  for (const field of numericFields) {
    if (r[field] !== undefined) r[field] = toNumber(r[field]);
  }
  r.fed_hike_prob = normalizeProbability(r.fed_hike_prob);
  r.fed_cut_prob = normalizeProbability(r.fed_cut_prob);

  if (r.yield_10y != null && r.yield_2y != null) {
    r.spread_2s10s = Math.round((r.yield_10y - r.yield_2y) * 100) / 100;
  } else if (r.spread_2s10s !== undefined) {
    r.spread_2s10s = toNumber(r.spread_2s10s);
  }

  if (r.yield_10y != null && r.sp500_forward_pe) {
    r.erp = Math.round(((1 / r.sp500_forward_pe) * 100 - r.yield_10y) * 100) / 100;
  } else if (r.erp !== undefined) {
    r.erp = toNumber(r.erp);
  }

  data.readings = r;
  return data;
}

function parseTreasuryYieldCurveXml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) return null;

  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const parsedEntries = entries.map((entry) => {
    const field = (name) => {
      const match = entry.match(new RegExp(`<d:${name}[^>]*>([^<]+)<\\/d:${name}>`));
      return match ? match[1] : null;
    };
    const date = field('NEW_DATE');
    const yield_2y = toNumber(field('BC_2YEAR'));
    const yield_10y = toNumber(field('BC_10YEAR'));
    const yield_30y = toNumber(field('BC_30YEAR'));
    if (!date || yield_2y == null || yield_10y == null || yield_30y == null) return null;
    return {
      treasury_yield_date: date.slice(0, 10),
      yield_2y,
      yield_10y,
      yield_30y,
    };
  }).filter(Boolean);

  parsedEntries.sort((a, b) => a.treasury_yield_date.localeCompare(b.treasury_yield_date));
  const latest = parsedEntries[parsedEntries.length - 1];
  if (!latest) return null;
  latest.spread_2s10s = Math.round((latest.yield_10y - latest.yield_2y) * 100) / 100;
  return latest;
}

async function fetchTreasuryYieldCurveReadings(date = new Date()) {
  const year = date.getUTCFullYear();
  const url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=' + year;
  const response = await fetchWithRetry(url, {}, 'Treasury yield curve');
  if (!response.ok) return null;
  return parseTreasuryYieldCurveXml(await response.text());
}

function normalizeScenarioEntry(entry) {
  const clean = {};
  const direction = entry?.direction;
  clean.direction = ['strengthening', 'weakening', 'stable'].includes(direction) ? direction : 'stable';
  clean.key_signal = typeof entry?.key_signal === 'string' ? entry.key_signal : '';
  return clean;
}

function normalizeScenarioSchema(data) {
  const scenarios = data.scenarios || {};
  const canonicalProbs = data.scenario_probs || {};
  const scenario_probs = {
    s1_no_pivot: canonicalProbs.s1_no_pivot ?? scenarios.s1?.prob,
    s2_tariff_rollback: canonicalProbs.s2_tariff_rollback ?? scenarios.s2?.prob,
    s3_oil_trap: canonicalProbs.s3_oil_trap ?? scenarios.s3?.prob,
  };

  for (const key of Object.keys(scenario_probs)) {
    scenario_probs[key] = normalizeProbability(scenario_probs[key]);
  }

  data.scenario_probs = scenario_probs;
  data.scenarios = {
    s1: normalizeScenarioEntry(scenarios.s1),
    s2: normalizeScenarioEntry(scenarios.s2),
    s3: normalizeScenarioEntry(scenarios.s3),
  };
  data.elaborations = data.elaborations && typeof data.elaborations === 'object' ? data.elaborations : {};
  data.notes = typeof data.notes === 'string' ? data.notes : '';
  return data;
}

function postprocessRefreshData(data) {
  data = normalizeReadings(data);
  data = normalizeScenarioSchema(data);

  // Agent B owns deterministic threshold alerts and probability integrity.
  // If those helpers are present, this call point wires them into refresh output.
  if (typeof normalizeScenarioProbabilities === 'function') {
    data = normalizeScenarioProbabilities(data);
  }
  if (typeof buildThresholdAlerts === 'function') {
    data.threshold_alerts = buildThresholdAlerts(data.readings || {});
  } else if (!Array.isArray(data.threshold_alerts)) {
    data.threshold_alerts = [];
  }

  return data;
}

function scenarioProbabilityFor(entry, canonicalKey, legacyKey) {
  const canonical = normalizeProbability(entry?.scenario_probs?.[canonicalKey]);
  if (canonical != null) return canonical;
  return normalizeProbability(entry?.scenarios?.[legacyKey]?.prob);
}

const SYSTEM_PROMPT = `You are an investment research analyst updating a political-economic framework. 

Your task: Use the provided recent search context to get the latest data on Trump's economic approval ratings, GOP approval, generic ballot, VIX, gold, oil prices, gas prices, Treasury yields, Fed hike/cut probabilities, S&P 500 forward P/E, and Iran war status. Then re-evaluate three scenarios and assign probabilities. Ensure your numbers reflect the realities in the context.

FRAMEWORK:
- Channel 1: Gas price -> approval -> GOP defections -> policy pivot.
- Channel 2: Yields -> mortgage and borrowing costs -> affordability pain -> GOP defections -> policy pivot.
- Scenario 1 (No Pivot): Admin maintains tariffs despite low approval. Stagflation persists; high yields compress ERP and duration-sensitive assets.
- Scenario 2 (Tariff Rollback — base case): GOP defections force selective rollback Q2-Q3 2026; high yields can become a second catalyst for relief.
- Scenario 3 (Oil Trap): Iran ceasefire removes gas pressure, approval bounces, tariffs stay; persistent yields keep affordability pain alive even if oil falls.

KEY THRESHOLDS:
- Econ approval: warning < 30%, critical < 25%
- GOP approval: warning < 80%, critical < 75%  
- Generic ballot: warning D+7 or wider, critical D+12 or wider
- VIX: warning > 30, critical > 40
- WTI: warning > $100, critical > $120
- Gas price avg: warning > $4.00, critical > $5.00
- 10Y yield: warning > 4.60%, critical > 5.00%
- 2s10s spread: warning > +0.75%, critical > +1.00%
- 30Y yield: warning > 5.25%, critical > 5.50%
- ERP: warning below 0.50%, critical below 0.00%. ERP is computed after extraction; do not estimate it.
- Fed hike probability: warning > 30%, critical > 50%

SCHEMA RULES:
- Respond only with JSON, no markdown fences or extra text.
- Use the canonical top-level "scenario_probs" object for scenario probabilities.
- Each "scenarios.s1/s2/s3" object must contain only "direction" and "key_signal"; do not include "name" or "prob" inside scenarios.
- Include "threshold_alerts", "headline", "positioning_update", "elaborations", and "notes".
- "elaborations" should be {} unless scenario elaborations were explicitly requested.
- Number fields must be numbers, not strings. "generic_ballot" should be a string like "D+9".
- "yield_10y", "yield_2y", "yield_30y", "spread_2s10s", and "erp" are percentage points, not decimals.
- "fed_hike_prob" and "fed_cut_prob" are 0-1 probabilities.
- ERP is computed deterministically as (1 / sp500_forward_pe) * 100 - yield_10y when inputs are available.

OUTPUT FORMAT — respond ONLY with this JSON, no other text:
{
  "date": "YYYY-MM-DD",
  "readings": {
    "econ_approval": <number>,
    "gop_approval": <number>,
    "generic_ballot": "<string like D+9>",
    "overall_approval": <number>,
    "silver_bulletin_net": <number>,
    "vix": <number>,
    "gold": <number>,
    "wti": <number>,
    "brent": <number>,
    "gas_price": <number>,
    "yield_10y": <number>,
    "yield_2y": <number>,
    "yield_30y": <number>,
    "spread_2s10s": <number>,
    "fed_hike_prob": <0-1>,
    "fed_cut_prob": <0-1>,
    "sp500_forward_pe": <number>,
    "erp": <number>,
    "iran_status": "<1-2 sentence summary>"
  },
  "scenario_probs": {
    "s1_no_pivot": <0-1>,
    "s2_tariff_rollback": <0-1>,
    "s3_oil_trap": <0-1>
  },
  "scenarios": {
    "s1": { "direction": "<strengthening|stable|weakening>", "key_signal": "<1 sentence>" },
    "s2": { "direction": "<strengthening|stable|weakening>", "key_signal": "<1 sentence>" },
    "s3": { "direction": "<strengthening|stable|weakening>", "key_signal": "<1 sentence>" }
  },
  "threshold_alerts": ["<alert strings>"],
  "headline": "<1 sentence summary of what changed most since last week>",
  "positioning_update": "<2-3 sentences on what to do differently this week>",
  "elaborations": {},
  "notes": "<freeform notes on key developments>"
}`;

const ELABORATE_PROMPTS = {
  1: `Elaborate on Scenario 1: No Pivot / Stagflation Lock-in.

Use exactly these 7 markdown section headings, in this order:
### 1. Premise and current conditions
### 2. The yield amplification mechanism
### 3. Rates - curve steepener thesis
### 4. Gold - structural bid with yield headwind
### 5. Equity vol - elevated floor with dispersion
### 6. Duration rotation
### 7. Meta-point and invalidation

Each section should be 1-2 concise paragraphs. Cite current readings where available: econ approval, GOP approval, oil price, 10Y yield, 2s10s spread, ERP, VIX, and gold. Explain the no-pivot thesis, the GOP defection threshold distance, oil-to-inflation-to-yield transmission, ERP compression math, the 2022 duration parallel, bear steepening, the 5% 10Y regime-shift threshold, gold's structural bid with nominal-yield headwind, vol/dispersion implications, duration-sensitive sectors versus beneficiaries, and 3-4 invalidation signals.`,
  2: `Elaborate on Scenario 2: GOP Defections / Selective Tariff Rollback.

Use exactly these 6 markdown section headings, in this order:
### 1. The defection math
### 2. The yield-driven second catalyst
### 3. The legislative vehicle
### 4. Rally anatomy - three phases (yield-amplified)
### 5. Sector beneficiary ranking
### 6. Cross-asset implications (yield-aware)

Each section should be 1-2 concise paragraphs. Cite current readings where available: GOP approval, generic ballot, 10Y yield, 30Y yield, gas price, VIX, and tariff/court developments. Cover the number of Republican breaks needed, SCOTUS impact, mortgage and small-business borrowing pressure, how tariff rollback can be reframed as anti-inflation policy, must-pass legislation leverage, sentiment snap, earnings re-rate, restocking, the double-expansion mechanism from lower yields plus higher earnings, top sector beneficiaries including REITs/housing, and USD/rates/gold implications.`,
  3: `Elaborate on Scenario 3: Oil Drop / Approval Bounce / No Structural Pivot.

Use exactly these 6 markdown section headings, in this order:
### 1. The ceasefire path
### 2. The approval bounce mechanism
### 3. The yield persistence question
### 4. Why this is underpriced - the binary trap (updated)
### 5. Positioning for the trap (yield-aware)
### 6. The JP Morgan security tax wrinkle

Each section should be 1-2 concise paragraphs. Cite current readings where available: Iran/Hormuz status, WTI/Brent, gas price, GOP approval, 10Y yield, 30Y yield, Fed hike probability, and oil futures curve signals. Explain the ceasefire path, gas-price approval elasticity, whether GOP approval can move back above the 80-84% range, the oil-yield divergence indicator, the true-trap versus unstable-trap split, why a ceasefire is not uniformly bullish if yields persist, duration/bond decision rules, and the security-tax wrinkle for oil and bonds.`,
};

const TRANSLATE_SYSTEM_PROMPT = `You are a professional translator specializing in financial and investment research. Translate the following English text into Chinese (Simplified).

Rules:
- Use professional investment research tone and terminology
- Keep all numbers, percentages, ticker symbols, and dollar amounts as-is
- Keep company names in English (e.g. Wells Fargo, JP Morgan)
- Translate financial terms accurately: tariff=关税, stagflation=滞胀, yield curve=收益率曲线, equity vol=股票波动率, generic ballot=国会选情, defection=倒戈
- Preserve source formatting: keep HTML tags if the source uses HTML, and preserve markdown heading levels exactly if the source uses markdown
- Respond with ONLY the translated text, no explanations or notes`;

async function translateText(env, text) {
  if (!text || !text.trim()) return text;
  try {
    return await callProvider(env, TRANSLATE_SYSTEM_PROMPT, text);
  } catch (e) {
    console.error('Translation failed:', e.message);
    return text; // fallback to English
  }
}

async function translateDataFields(env, data) {
  const translated = JSON.parse(JSON.stringify(data));

  // Translate headline & positioning
  if (translated.headline) translated.headline = await translateText(env, translated.headline);
  if (translated.positioning_update) translated.positioning_update = await translateText(env, translated.positioning_update);

  // Translate threshold_alerts
  if (translated.threshold_alerts?.length) {
    const alertTexts = translated.threshold_alerts.join('\n');
    const translatedAlerts = await translateText(env, alertTexts);
    translated.threshold_alerts = translatedAlerts.split('\n').filter(l => l.trim());
  }

  // Translate scenario key_signals
  if (translated.scenarios) {
    for (const key of Object.keys(translated.scenarios)) {
      if (translated.scenarios[key].key_signal) {
        translated.scenarios[key].key_signal = await translateText(env, translated.scenarios[key].key_signal);
      }
    }
  }

  // Translate iran_status
  if (translated.readings?.iran_status) {
    translated.readings.iran_status = await translateText(env, translated.readings.iran_status);
  }

  return translated;
}

const ELABORATE_SYSTEM_PROMPT = `You are an investment research analyst providing a deep-dive scenario analysis for the Trump economic approval pivot framework.

Respond with a clear, well-structured prose analysis (NOT JSON). Follow the exact scenario-specific section headings provided by the user prompt.

Rules:
- Use markdown section headings exactly as provided so the dashboard can render stable sections.
- Do not add, remove, or rename sections.
- Use only concise paragraphs under each section; avoid tables unless the prompt explicitly requires ranking.
- Ground the analysis in the recent web-search context when it is available.
- Keep the total analysis substantive but compact, roughly 650-900 words.
- Write in a professional investment research style.`;

async function fetchTavily(query, env, topic = 'news') {
  try {
    const response = await fetchWithRetry('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.TAVILY_API_KEY,
      },
      body: JSON.stringify({
        query,
        max_results: 3,
        topic,
        ...(topic === 'news' ? { time_range: 'week' } : {}),
        search_depth: 'basic',
      }),
    }, 'Tavily search');
    if (!response.ok) return '';
    const data = await response.json();
    const snippets = (data.results || [])
      .map((r) => {
        const title = r.title ? `[${r.title}] ` : '';
        return '- ' + title + (r.content || '').slice(0, 400);
      })
      .filter(Boolean);
    return snippets.join('\n');
  } catch (e) {
    return '';
  }
}

async function getSearchContext(queries, env) {
  const results = await Promise.all(queries.map(async ({ q, topic }) => {
    const snippets = await fetchTavily(q, env, topic || 'news');
    if (!snippets) return '';
    return `Search results for "${q}":\n${snippets}`;
  }));
  return results.filter(Boolean).join('\n\n');
}

// ═══════════════════════════════════════════════════════
// CORE REFRESH LOGIC — used by both HTTP and Cron
// ═══════════════════════════════════════════════════════

async function doRefresh(env) {
  const dateStr = new Date().toISOString().split('T')[0];
  let userMsg =
    'Today is ' + dateStr + '. Update the pivot framework using the real-time context provided below:';

  const context = await getSearchContext([
    { q: 'Reuters Ipsos Trump economic approval', topic: 'news' },
    { q: 'Trump approval rating latest poll', topic: 'news' },
    { q: 'Trump Republican approval rating', topic: 'news' },
    { q: 'generic ballot 2026 midterms poll', topic: 'news' },
    { q: 'Nate Silver Trump approval rating', topic: 'news' },
    { q: 'VIX index today', topic: 'finance' },
    { q: 'gold price today', topic: 'finance' },
    { q: 'oil price WTI Brent today', topic: 'finance' },
    { q: 'average gas price US today', topic: 'finance' },
    { q: 'Iran war ceasefire negotiations latest', topic: 'news' },
    { q: 'Congress tariff vote Republican 2026', topic: 'news' },
    { q: '10 year Treasury yield today', topic: 'finance' },
    { q: '2 year Treasury yield today', topic: 'finance' },
    { q: '30 year Treasury yield today', topic: 'finance' },
    { q: 'CME FedWatch rate hike cut probability 2026', topic: 'finance' },
    { q: 'S&P 500 12 month forward P/E FactSet latest', topic: 'finance' },
  ], env);
  if (context) {
    userMsg += '\n\n--- RECENT WEB SEARCH CONTEXT ---\n' + context + '\n---------------------------------';
  }

  const text = await callProvider(env, SYSTEM_PROMPT, userMsg);
  const parsed = extractJSON(text);
  parsed.date = parsed.date || dateStr;
  parsed._refreshedAt = new Date().toISOString();
  const treasuryYields = await fetchTreasuryYieldCurveReadings();
  if (treasuryYields) {
    parsed.readings = {
      ...(parsed.readings || {}),
      ...treasuryYields,
    };
    parsed.notes = [
      `Authoritative Treasury yields: 2Y ${treasuryYields.yield_2y}%, 10Y ${treasuryYields.yield_10y}%, 30Y ${treasuryYields.yield_30y}%, 2s10s ${treasuryYields.spread_2s10s}% as of ${treasuryYields.treasury_yield_date}.`,
      parsed.notes,
      'Any model-estimated yield readings are superseded by the U.S. Treasury daily yield curve override.',
    ].filter(Boolean).join(' ');
  }
  return postprocessRefreshData(parsed);
}

const SCENARIO_QUERIES = {
  1: [
    { q: 'stagflation risk 2026 tariffs inflation outlook', topic: 'news' },
    { q: 'Federal Reserve rate decision 2026 latest', topic: 'news' },
    { q: 'Treasury term premium 2026', topic: 'finance' },
    { q: 'gold price forecast stagflation 2026', topic: 'finance' },
    { q: 'VIX equity volatility dispersion 2026', topic: 'finance' },
    { q: 'S&P 500 earnings revisions 2026', topic: 'finance' },
    { q: '10 year Treasury yield equity risk premium 2026', topic: 'finance' },
    { q: 'bear steepener yield curve 2026', topic: 'finance' },
    { q: 'duration equity rotation tech REIT 2026', topic: 'finance' },
  ],
  2: [
    { q: 'House Republican tariff vote defection 2026', topic: 'news' },
    { q: 'OBBBA reconciliation bill tariff exemption', topic: 'news' },
    { q: 'tariff rollback stock market sectors benefit', topic: 'finance' },
    { q: 'Wells Fargo tariff relief basket stocks', topic: 'finance' },
    { q: 'IEEPA tariff refund corporate earnings impact', topic: 'finance' },
    { q: 'consumer discretionary tariff impact 2026', topic: 'finance' },
    { q: 'farm state fertilizer shortage tariff pressure', topic: 'news' },
    { q: 'mortgage rates 2026 impact housing', topic: 'finance' },
    { q: '10 year yield tariff rollback inflation expectations', topic: 'finance' },
    { q: 'REIT recovery yield drop 2026', topic: 'finance' },
  ],
  3: [
    { q: 'Iran ceasefire negotiations 2026 latest', topic: 'news' },
    { q: 'oil futures curve backwardation contango 2026', topic: 'finance' },
    { q: 'oil price forecast ceasefire scenario 2026', topic: 'finance' },
    { q: 'Trump approval rating gas price correlation', topic: 'news' },
    { q: 'Hormuz shipping insurance premium 2026', topic: 'news' },
    { q: 'tariff impact without oil shock 2026 outlook', topic: 'news' },
    { q: 'Treasury yield forecast ceasefire oil drop 2026', topic: 'finance' },
    { q: 'mortgage rates affordability 2026 impact approval', topic: 'finance' },
    { q: 'tariff inflation persistent yield 2026', topic: 'finance' },
  ],
};

async function doElaborate(env, scenario) {
  const queries = SCENARIO_QUERIES[scenario] || SCENARIO_QUERIES[2];
  const context = await getSearchContext(queries, env);
  let prompt = ELABORATE_PROMPTS[scenario] || ELABORATE_PROMPTS[2];
  if (context) {
    prompt += '\n\n--- RECENT WEB SEARCH CONTEXT ---\n' + context + '\n---------------------------------';
  }
  return await callProvider(env, ELABORATE_SYSTEM_PROMPT, prompt);
}

async function doElaborateAll(env) {
  const [s1, s2, s3] = await Promise.all([
    doElaborate(env, 1),
    doElaborate(env, 2),
    doElaborate(env, 3),
  ]);
  return { 1: s1, 2: s2, 3: s3 };
}

async function saveElaborationsToKV(env, elaborations) {
  await Promise.all([
    env.CACHE.put('elaboration:1', elaborations[1]),
    env.CACHE.put('elaboration:2', elaborations[2]),
    env.CACHE.put('elaboration:3', elaborations[3]),
  ]);

  // Translate and store Chinese versions (non-blocking)
  const cnPromises = [1, 2, 3].map(async (n) => {
    if (elaborations[n]) {
      const cn = await translateText(env, elaborations[n]);
      await env.CACHE.put('elaboration:' + n + '_cn', cn);
    }
  });
  await Promise.all(cnPromises);
}

async function saveToKV(env, data) {
  const dateStr = data.date || new Date().toISOString().split('T')[0];

  // Save English version as latest
  await env.CACHE.put('latest', JSON.stringify(data));

  // Save to history by date
  await env.CACHE.put('history:' + dateStr, JSON.stringify(data));

  // Update date index (keep last 90 entries)
  const raw = await env.CACHE.get('history:index');
  const idx = raw ? JSON.parse(raw) : [];
  if (!idx.includes(dateStr)) {
    idx.push(dateStr);
    idx.sort().reverse();
  }
  if (idx.length > 90) idx.length = 90;
  await env.CACHE.put('history:index', JSON.stringify(idx));
}

// Run all background tasks: data translation + elaboration generation + translation
async function backgroundWork(env, data) {
  // Translate main data fields
  const cnData = await translateDataFields(env, data);
  await env.CACHE.put('latest_cn', JSON.stringify(cnData));

  // Generate and cache elaborations (English + Chinese)
  const elabs = await doElaborateAll(env);
  await saveElaborationsToKV(env, elabs);
}

// ═══════════════════════════════════════════════════════
// EXPORT: fetch (HTTP) + scheduled (Cron)
// ═══════════════════════════════════════════════════════

export default {
  // Daily cron trigger — auto-refresh and store
  async scheduled(event, env, ctx) {
    const result = await doRefresh(env);
    await saveToKV(env, result);
    ctx.waitUntil(backgroundWork(env, result));
  },

  // HTTP handler
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://pivotframework.wddiscovery.com',
      'https://pivot-dashboard.pages.dev',
      'https://main.pivot-dashboard.pages.dev',
    ];
    const allowOrigin = allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.pivot-dashboard\.pages\.dev$/.test(origin)
      ? origin
      : allowedOrigins[0];
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    try {
      // ── GET /api/latest — instant read from KV cache ──
      if (url.pathname === '/api/latest' && request.method === 'GET') {
        const lang = url.searchParams.get('lang');
        if (lang === 'cn') {
          // Try Chinese cache first
          let cnCached = await env.CACHE.get('latest_cn');
          if (!cnCached) {
            // On-demand: translate English data and cache
            const enCached = await env.CACHE.get('latest');
            if (enCached) {
              const cnData = await translateDataFields(env, JSON.parse(enCached));
              cnCached = JSON.stringify(cnData);
              ctx.waitUntil(env.CACHE.put('latest_cn', cnCached));
            }
          }
          if (cnCached) return new Response(cnCached, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Default: return English
        const cached = await env.CACHE.get('latest');
        if (!cached) {
          return new Response(JSON.stringify({ empty: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(cached, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── GET /api/history?date=2026-05-11 — history data ──
      if (url.pathname === '/api/history' && request.method === 'GET') {
        const date = url.searchParams.get('date');
        if (date) {
          // Return specific date's snapshot
          const entry = await env.CACHE.get('history:' + date);
          if (!entry) {
            return new Response(JSON.stringify({ error: 'No data for ' + date }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          return new Response(entry, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Return index + summary of all history entries
        const raw = await env.CACHE.get('history:index');
        const idx = raw ? JSON.parse(raw) : [];

        // Fetch summaries for each date (readings only, not full payload)
        const summaries = await Promise.all(idx.slice(0, 30).map(async (d) => {
          const entry = await env.CACHE.get('history:' + d);
          if (!entry) return null;
          const parsed = JSON.parse(entry);
          return {
            date: d,
            readings: parsed.readings || {},
            scenario_probs: {
              s1_no_pivot: scenarioProbabilityFor(parsed, 's1_no_pivot', 's1'),
              s2_tariff_rollback: scenarioProbabilityFor(parsed, 's2_tariff_rollback', 's2'),
              s3_oil_trap: scenarioProbabilityFor(parsed, 's3_oil_trap', 's3'),
            },
            scenarios: Object.fromEntries(
              Object.entries(parsed.scenarios || {}).map(([k, v]) => [
                k,
                {
                  prob: scenarioProbabilityFor(parsed, k === 's1' ? 's1_no_pivot' : k === 's2' ? 's2_tariff_rollback' : 's3_oil_trap', k),
                  direction: v.direction,
                },
              ])
            ),
          };
        }));

        return new Response(JSON.stringify({
          dates: idx,
          entries: summaries.filter(Boolean),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── POST /api/refresh — manual refresh, also saves to KV ──
      if (url.pathname === '/api/refresh') {
        const result = await doRefresh(env);
        await saveToKV(env, result);
        ctx.waitUntil(backgroundWork(env, result));
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── GET /api/elaboration/:n — cached elaboration ──
      const elabMatch = url.pathname.match(/^\/api\/elaboration\/([123])$/);
      if (elabMatch && request.method === 'GET') {
        const scenario = parseInt(elabMatch[1]);
        const lang = url.searchParams.get('lang');
        const cnKey = 'elaboration:' + scenario + '_cn';
        const enKey = 'elaboration:' + scenario;

        if (lang === 'cn') {
          // Try Chinese cache
          let cnCached = await env.CACHE.get(cnKey);
          if (cnCached) {
            return new Response(JSON.stringify({ scenario, analysis: cnCached }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          // No Chinese cache — return English, kick off background translation
          let enCached = await env.CACHE.get(enKey);
          if (!enCached) {
            enCached = await doElaborate(env, scenario);
            await env.CACHE.put(enKey, enCached);
          }
          // Translate in background, don't block response
          ctx.waitUntil(
            translateText(env, enCached).then(cn => env.CACHE.put(cnKey, cn))
          );
          return new Response(JSON.stringify({ scenario, analysis: enCached }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Default: English
        let cached = await env.CACHE.get(enKey);
        if (!cached) {
          cached = await doElaborate(env, scenario);
          ctx.waitUntil(env.CACHE.put(enKey, cached));
        }
        return new Response(JSON.stringify({ scenario, analysis: cached || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── POST /api/elaborate — scenario deep dive (fallback, on-demand) ──
      if (url.pathname === '/api/elaborate') {
        const body = await request.json();
        const scenario = body.scenario || 2;
        const text = await doElaborate(env, scenario);
        return new Response(JSON.stringify({ scenario, analysis: text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── GET /api/provider ──
      if (url.pathname === '/api/provider') {
        const P = PROVIDERS[ACTIVE_PROVIDER];
        const hasModelSearch = Boolean(P.searchTool);
        const hasTavilySearch = Boolean(env.TAVILY_API_KEY);
        const searchMode = hasModelSearch
          ? (hasTavilySearch ? 'model_and_tavily_prefetch' : 'model_native')
          : (hasTavilySearch ? 'tavily_prefetch' : 'none');
        return new Response(JSON.stringify({
          active: ACTIVE_PROVIDER,
          model: P.model,
          hasModelSearch,
          hasTavilySearch,
          searchMode,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
