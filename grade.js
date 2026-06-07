exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set in Netlify environment variables" }) };
  }

  let post, platform, niche;
  try {
    const body = JSON.parse(event.body);
    post = body.post;
    platform = body.platform;
    niche = body.niche;
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!post || !platform || !niche) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing post, platform or niche" }) };
  }

  const system = `You are an expert social media strategist. Grade the post on 5 dimensions and return ONLY a valid JSON object with no markdown, no explanation, nothing else.

Score each 0-100:
- hook_strength: Does line 1 stop scrolling? Bold, specific, surprising?
- specificity: Concrete details and numbers vs vague generalities?
- format_fit: Right length and structure for the platform?
- emotional_pull: Creates curiosity, recognition, or surprise?
- cta_clarity: Clear direction at the end?

Also:
- overall_score: weighted avg (hook 30%, specificity 20%, format 20%, emotional 20%, cta 10%)
- top_strength: one sentence on what it does best
- top_weakness: one sentence on the biggest problem
- fix_it: 2-3 specific actionable sentences on how to improve it
- template_match: one of: hook_weak | no_story | no_perspective | not_educational | low_engagement | not_relatable
- rewrite: full ready-to-post rewrite. No brackets. Meaningfully stronger.

Return ONLY this JSON structure:
{"scores":{"hook_strength":0,"specificity":0,"format_fit":0,"emotional_pull":0,"cta_clarity":0},"overall_score":0,"top_strength":"","top_weakness":"","fix_it":"","template_match":"","rewrite":""}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: system,
        messages: [{ role: "user", content: `Platform: ${platform}\nNiche: ${niche}\n\nPost:\n"""\n${post}\n"""` }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { statusCode: response.status, headers, body: JSON.stringify({ error: err?.error?.message || "Anthropic API error " + response.status }) };
    }

    const data = await response.json();
    const text = (data?.content || []).find(b => b.type === "text")?.text || "";
    const match = text.replace(/```json|```/gi, "").trim().match(/\{[\s\S]*\}/);
    if (!match) return { statusCode: 500, headers, body: JSON.stringify({ error: "Could not parse AI response" }) };

    return { statusCode: 200, headers, body: match[0] };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
