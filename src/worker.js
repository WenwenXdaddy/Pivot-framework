// Cloudflare Worker: API proxy for the pivot framework
// Swap providers by changing ACTIVE_PROVIDER below.
// Deploy: wrangler secret put API_KEY && wrangler deploy

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
    url: 'https://api.deepseek.com/v1/chat/completions',
    headers: (env) => ({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.API_KEY,
    }),
    body: (model, system, messages) => ({
      model,
      max_tokens: 4000,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
    parse: (data) => data.choices?.[0]?.message?.content || '',
    model: 'deepseek-chat',
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
    model: 'glm-5.1',
    searchTool: { type: 'web_search_20250305', name: 'web_search' },
  },
};

// ╔═══════════════════════════════════════════════╗
// ║  SET YOUR PROVIDER HERE                       ║
// ║  Options: anthropic | openai | deepseek       ║
// ║           openai_websearch | gemini | zai      ║
// ╚═══════════════════════════════════════════════╝
const ACTIVE_PROVIDER = 'zai';

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
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { error: 'No JSON found in response', raw: text };
  } catch (e) {
    return { error: 'JSON parse failed: ' + e.message, raw: text };
  }
}

const SYSTEM_PROMPT = `You are an investment research analyst updating a political-economic framework. 

Your task: Search for the latest data on Trump's economic approval ratings, GOP approval, generic ballot, VIX, gold, oil prices, gas prices, and Iran war status. Then re-evaluate three scenarios and assign probabilities.

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
  1: 'Elaborate on Scenario 1: approval stabilizes with no policy pivot. What are the positioning implications for rates, gold, and equity vol? Search for the latest data to support your analysis.',
  2: 'Elaborate on Scenario 2: GOP defections force selective tariff rollback in Q2-Q3 2026. What would the rally look like and which sectors benefit most? Search for the latest data.',
  3: 'Elaborate on Scenario 3: Iran ceasefire and oil drop removes political pressure for a structural policy pivot. Why is this underpriced? Search for the latest data.',
};

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://pivotframework.wddiscovery.com',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/refresh') {
        const userMsg =
          'Search for the latest data and update the pivot framework. Today is ' +
          new Date().toISOString().split('T')[0] + '.';
        const text = await callProvider(env, SYSTEM_PROMPT, userMsg);
        const parsed = extractJSON(text);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/api/elaborate') {
        const body = await request.json();
        const scenario = body.scenario || 2;
        const prompt = ELABORATE_PROMPTS[scenario] || ELABORATE_PROMPTS[2];
        const text = await callProvider(env, SYSTEM_PROMPT, prompt);
        return new Response(JSON.stringify({ scenario, analysis: text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/api/provider') {
        const P = PROVIDERS[ACTIVE_PROVIDER];
        return new Response(JSON.stringify({
          active: ACTIVE_PROVIDER,
          model: P.model,
          hasSearch: !!P.searchTool,
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
