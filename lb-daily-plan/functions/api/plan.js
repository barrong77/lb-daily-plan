// Cloudflare Pages Function — the shared "notebook" for the Daily Plan.
// Requires a KV namespace binding named PLAN_KV (set in the Cloudflare Pages dashboard).
//
// PASSWORD (optional but recommended):
//   Set an environment variable named APP_PASSWORD in the Pages project settings.
//   When it's set, every request must send the matching key (the app handles this
//   after the user types the password once). If APP_PASSWORD is not set, the app
//   stays open (no password) — so nothing breaks before you configure it.
//
// GET  /api/plan   -> returns the current saved plan (or an empty shell)
// POST /api/plan   -> saves the plan that Yvette or Julio just edited

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-plan-key",
};

function authed(request, env) {
  const pw = env.APP_PASSWORD;
  if (!pw) return true; // no password configured -> open
  const url = new URL(request.url);
  const key = request.headers.get("x-plan-key") || url.searchParams.get("key") || "";
  return key === pw;
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json({ error: "unauthorized" }, 401);
  let data = null;
  try {
    data = await env.PLAN_KV.get("current");
  } catch (e) {
    return json({ error: "KV not bound. Add a KV namespace named PLAN_KV in Pages settings." }, 500);
  }
  return new Response(data || JSON.stringify({ state: null, updatedBy: "", updatedAt: 0 }), {
    headers: { "content-type": "application/json", ...CORS },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json({ error: "unauthorized" }, 401);
  let body;
  try {
    body = await request.text();
  } catch (e) {
    return json({ error: "bad body" }, 400);
  }
  if (!body || body.length > 300000) {
    return json({ error: "empty or too large" }, 413);
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    return json({ error: "not valid JSON" }, 400);
  }
  parsed.updatedAt = Date.now();
  const toStore = JSON.stringify(parsed);
  try {
    await env.PLAN_KV.put("current", toStore);
    const dk = (parsed.dateKey || "unknown").replace(/[^0-9A-Za-z._-]/g, "");
    await env.PLAN_KV.put("plan-" + dk, toStore, { expirationTtl: 60 * 60 * 24 * 120 });
  } catch (e) {
    return json({ error: "could not save" }, 500);
  }
  return json({ ok: true, updatedAt: parsed.updatedAt });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", ...CORS },
  });
}
