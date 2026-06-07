exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { post, platform, niche } = JSON.parse(event.body);

    if (!post || !platform || !niche) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
    }

    const system = `You are an expert social media strategist. Grade the post on 5 dimensions and return ONLY a valid JSON object — no markdown fences, no explanation, no extra text before or after the JSON.

Dimensions scored 0–100:
- hook_strength: Does line 1 stop scrolling? Is it bold, specific, or surprising?
- specificity: Concrete details, numbers, named things vs vague generalities?
- format_fit: Right length and structure for the stated platform?
- emotional_pull: Does it create curiosity, recognition, or surprise?
- cta_clarity: Is there clear direction at the end (implicit or explicit)?

Also include:
- overall_score: weighted average — hook 30%, specificity 20%, format 20%, emotional 20%, cta 10%
- top_strength: one sentence on what it does best
- top_weakness: one sentence on the single biggest problem
- fix_it: 2-3 specific, actionable sentences on exactly how to improve it
- template_match: one of: hook_weak | no_story | no_perspective | not_educational | low_engagement | not_relatable
- rewrite: a complete, ready-to-post rewrite using the matched template structure. Keep the user's topic and niche. No bracket placeholders. Must be meaningfully stronger.

Return ONLY this JSON:
{"scores":{"hook_strength":0,"specificity":0,"format_fit":0,"emotional_pull":0,"cta_clarity":0},"overall_score":0,"top_strength":"","top_weakness":"","fix_it":"","template_match":"","rewrite":""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: `Platform: ${platform}\nNiche: ${niche}\n\nPost:\n"""\n${post}\n"""` }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { statusCode: response.status, body: JSON.stringify({ error: err?.error?.message || `API error ${response.status}` }) };
    }

    const data  = await response.json();
    const raw   = (data?.content || []).find(b => b.type === "text")?.text || "";
    const found = raw.replace(/```json|```/gi, "").trim().match(/\{[\s\S]*\}/);
    if (!found) return { statusCode: 500, body: JSON.stringify({ error: "Bad AI response" }) };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(JSON.parse(found[0]))
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
