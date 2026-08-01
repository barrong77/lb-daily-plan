// Cloudflare Pages Function — reads the LB White Board calendar and returns
// the jobs for a given day, formatted for the Daily Plan.
//
// SETUP (one time): add an environment variable named ICAL_URL in the Pages
// project settings = the LB White Board calendar's "Secret address in iCal
// format" (from Google Calendar settings). Store it as a Secret.
//
// GET /api/calendar?date=YYYY-MM-DD  -> { date, count, jobs:[...] }
// Requires the same team password (x-plan-key) as /api/plan.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type,x-plan-key",
};

function authed(request, env) {
  const pw = env.APP_PASSWORD;
  if (!pw) return true;
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

  const url = new URL(request.url);
  const date = (url.searchParams.get("date") || "").replace(/-/g, "");
  if (!/^\d{8}$/.test(date)) return json({ error: "bad or missing date" }, 400);

  if (!env.ICAL_URL) {
    return json({ jobs: [], count: 0, error: "Calendar not connected yet — add the ICAL_URL setting in Cloudflare." });
  }

  let text;
  try {
    const res = await fetch(env.ICAL_URL, { headers: { "User-Agent": "LB-Daily-Plan" } });
    if (!res.ok) return json({ jobs: [], count: 0, error: "Could not read the calendar (status " + res.status + ")." });
    text = await res.text();
  } catch (e) {
    return json({ jobs: [], count: 0, error: "Could not reach the calendar." });
  }

  const jobs = parseIcs(text, parseInt(date, 10));
  return json({ date: date, count: jobs.length, jobs: jobs });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", ...CORS },
  });
}

/* ---------- iCal parsing ---------- */
function unfold(t) {
  return t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
}
function unesc(s) {
  return (s || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function getProp(block, name) {
  const re = new RegExp("^" + name + "(;[^:\\n]*)?:(.*)$", "mi");
  const m = block.match(re);
  return m ? m[2] : "";
}
function dateInt(v) {
  const m = (v || "").match(/(\d{8})/);
  return m ? parseInt(m[1], 10) : 0;
}
function parseIcs(text, target) {
  const t = unfold(text);
  const parts = t.split("BEGIN:VEVENT").slice(1);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const block = parts[i].split("END:VEVENT")[0];
    const summary = unesc(getProp(block, "SUMMARY")).trim();
    if (!summary || summary.charAt(0) !== "#") continue; // jobs start with "#"
    const start = dateInt(getProp(block, "DTSTART"));
    let end = dateInt(getProp(block, "DTEND"));
    if (!start) continue;
    if (!end) end = start + 1;
    // all-day DTEND is exclusive; include when start <= target < end
    if (!(target >= start && target < end)) {
      // handle single-day where end==start (defensive)
      if (!(end === start && target === start)) continue;
    }
    const description = unesc(getProp(block, "DESCRIPTION"));
    const job = parseJob(summary, description);
    job.start = String(start); // YYYYMMDD — lets the app flag carryovers from earlier days
    out.push(job);
  }
  // sort by job number then location
  out.sort((a, b) => (a.job || "zzz").localeCompare(b.job || "zzz") || a.location.localeCompare(b.location));
  return out;
}
function parseJob(summary, description) {
  const m = summary.match(/^#\s*(\S+)\s*([\s\S]*)$/);
  let jobNum = m ? m[1] : "";
  let loc = m ? m[2] : summary.replace(/^#/, "").trim();
  loc = loc.replace(/\s*\([^)]*\)\s*$/, "").trim(); // strip trailing (client) tag
  if (/^tbd$/i.test(jobNum)) jobNum = "";
  const desc = description || "";
  let ticket = "";
  const tm = desc.match(/\b(D[TN]\d[\w-]*)/i);
  if (tm) ticket = tm[1];
  let type = "";
  if (/quoted/i.test(desc)) type = "Quoted";
  else if (/distribution/i.test(desc)) type = "Distribution";
  const equipment = desc
    .split("\n")
    .filter((l) => /^\s*-/.test(l))
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .join(", ");
  return { job: jobNum, location: loc, ticket: ticket, type: type, equipment: equipment, note: desc.trim() };
}
