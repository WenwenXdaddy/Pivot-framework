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

async function callProvider(env, systemPrompt, userMessage) {
  const P = PROVIDERS[ACTIVE_PROVIDER];
  if (!P) throw new Error('Unknown provider: ' + ACTIVE_PROVIDER);

  let url = P.url;
  if (url.includes('{MODEL}')) url = url.replace('{MODEL}', P.model);

  const messages = [{ role: 'user', content: userMessage }];
  const tools = P.searchTool ? [P.searchTool] : [];
  const body = P.body(P.model, systemPrompt, messages, tools);

  const response = await fetch(url, {
    method: 'POST',
    headers: P.headers(env),
    body: JSON.stringify(body),
  });

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

const SYSTEM_PROMPT = `You are an investment research analyst updating a political-economic framework. 

Your task: Use the provided recent search context to get the latest data on Trump's economic approval ratings, GOP approval, generic ballot, VIX, gold, oil prices, gas prices, and Iran war status. Then re-evaluate three scenarios and assign probabilities. Ensure your numbers reflect the realities in the context.

FRAMEWORK:
- Scenario 1 (No Pivot): Admin maintains tariffs despite low approval. Stagflation persists.
- Scenario 2 (Tariff Rollback — base case): GOP defections force selective rollback Q2-Q3 2026.
- Scenario 3 (Oil Trap): Iran ceasefire removes gas pressure, approval bounces, tariffs stay.

KEY THRESHOLDS:
- Econ approval: warning < 30%, critical < 25%
- GOP approval: warning < 80%, critical < 75%  
- Generic ballot: warning D+7 or wider, critical D+12 or wider
- VIX: warning > 30, critical > 40
- WTI: warning > $100, critical > $120

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
    "iran_status": "<1-2 sentence summary>"
  },
  "scenarios": {
    "s1": { "name": "No pivot", "prob": <0-1>, "direction": "<strengthening|stable|weakening>", "key_signal": "<1 sentence>" },
    "s2": { "name": "Tariff rollback", "prob": <0-1>, "direction": "<strengthening|stable|weakening>", "key_signal": "<1 sentence>" },
    "s3": { "name": "Oil trap", "prob": <0-1>, "direction": "<strengthening|stable|weakening>", "key_signal": "<1 sentence>" }
  },
  "threshold_alerts": ["<alert strings>"],
  "headline": "<1 sentence summary of what changed most since last week>",
  "positioning_update": "<2-3 sentences on what to do differently this week>"
}`;

const ELABORATE_PROMPTS = {
  1: 'Elaborate on Scenario 1: approval stabilizes with no policy pivot. What are the positioning implications for rates, gold, and equity vol? Use the provided recent data to support your analysis.',
  2: 'Elaborate on Scenario 2: GOP defections force selective tariff rollback in Q2-Q3 2026. What would the rally look like and which sectors benefit most? Use the provided recent data.',
  3: 'Elaborate on Scenario 3: Iran ceasefire and oil drop removes political pressure for a structural policy pivot. Why is this underpriced? Use the provided recent data.',
};

const TRANSLATE_SYSTEM_PROMPT = `You are a professional translator specializing in financial and investment research. Translate the following English text into Chinese (Simplified).

Rules:
- Use professional investment research tone and terminology
- Keep all numbers, percentages, ticker symbols, and dollar amounts as-is
- Keep company names in English (e.g. Wells Fargo, JP Morgan)
- Translate financial terms accurately: tariff=关税, stagflation=滞胀, yield curve=收益率曲线, equity vol=股票波动率, generic ballot=国会选情, defection=倒戈
- Preserve the original markdown heading levels exactly (## stays ##, ### stays ###) — do NOT change heading depths
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

Respond with a clear, well-structured prose analysis (NOT JSON). Use paragraphs with headers. Cover:
1. Current evidence supporting or weakening this scenario (cite recent data)
2. Key catalysts to watch in the next 2-4 weeks
3. Market positioning implications (rates, equities, commodities, vol)
4. Probability assessment and what would change it

Keep your analysis concise but substantive — roughly 400-600 words. Write in a professional investment research style.`;

async function fetchTavily(query, env, topic = 'news') {
  try {
    const response = await fetch('https://api.tavily.com/search', {
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
    });
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
    { q: 'VIX index today', topic: 'finance' },
    { q: 'gold price XAU USD today', topic: 'finance' },
    { q: 'WTI crude oil price today', topic: 'finance' },
    { q: 'US gas price average today', topic: 'finance' },
    { q: 'Trump economic approval rating latest poll', topic: 'news' },
    { q: 'Trump generic ballot poll 2026', topic: 'news' },
  ], env);
  if (context) {
    userMsg += '\n\n--- RECENT WEB SEARCH CONTEXT ---\n' + context + '\n---------------------------------';
  }

  const text = await callProvider(env, SYSTEM_PROMPT, userMsg);
  const parsed = extractJSON(text);
  parsed.date = parsed.date || dateStr;
  parsed._refreshedAt = new Date().toISOString();
  return parsed;
}

const SCENARIO_QUERIES = {
  1: [
    { q: 'US interest rates equity volatility today', topic: 'finance' },
    { q: 'gold price forecast target', topic: 'finance' },
  ],
  2: [
    { q: 'Trump tariff rollback exception news', topic: 'news' },
    { q: 'market sector performance today', topic: 'finance' },
  ],
  3: [
    { q: 'Iran news update ceasefire', topic: 'news' },
    { q: 'oil supply demand outlook', topic: 'finance' },
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
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://pivotframework.wddiscovery.com',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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
            scenarios: Object.fromEntries(
              Object.entries(parsed.scenarios || {}).map(([k, v]) => [k, { prob: v.prob, direction: v.direction }])
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
        return new Response(JSON.stringify({
          active: ACTIVE_PROVIDER,
          model: P.model,
          hasSearch: true,
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

