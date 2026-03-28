// Cloudflare Worker: API proxy for the pivot framework
// Calls Anthropic API with web search to refresh scenario analysis
// Deploy with: wrangler deploy

export default {
  async fetch(request, env) {
    // CORS headers for your Pages frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Route: /api/refresh — full scenario re-evaluation
    if (url.pathname === '/api/refresh') {
      return handleRefresh(env, corsHeaders);
    }

    // Route: /api/elaborate — deep dive on a specific scenario
    if (url.pathname === '/api/elaborate') {
      const body = await request.json();
      return handleElaborate(body.scenario, env, corsHeaders);
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};

async function handleRefresh(env, corsHeaders) {
  const systemPrompt = `You are an investment research analyst updating a political-economic framework. 

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'Search for the latest data and update the pivot framework. Today is ' + new Date().toISOString().split('T')[0] + '.',
        },
      ],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
    }),
  });

  const data = await response.json();

  // Extract text content from response (may include tool use blocks)
  const textContent = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  // Try to parse JSON from the response
  let parsed;
  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      parsed = { error: 'Could not parse JSON from response', raw: textContent };
    }
  } catch (e) {
    parsed = { error: 'JSON parse failed', raw: textContent };
  }

  return new Response(JSON.stringify(parsed), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleElaborate(scenario, env, corsHeaders) {
  const scenarioPrompts = {
    1: 'Elaborate on Scenario 1: approval stabilizes with no policy pivot. What are the positioning implications for rates, gold, and equity vol? Search for the latest data to support your analysis.',
    2: 'Elaborate on Scenario 2: GOP defections force selective tariff rollback in Q2-Q3 2026. What would the rally look like and which sectors benefit most? Search for the latest data.',
    3: 'Elaborate on Scenario 3: Iran ceasefire and oil drop removes political pressure for a structural policy pivot. Why is this underpriced? Search for the latest data.',
  };

  const prompt = scenarioPrompts[scenario] || scenarioPrompts[2];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: prompt },
      ],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
    }),
  });

  const data = await response.json();
  const textContent = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return new Response(JSON.stringify({ scenario, analysis: textContent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
