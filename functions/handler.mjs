// Anonymous aggregate benchmarks for the Masar peer-comparison feature.
// Stores only income band + category percentages; never amounts or identities.
const BANDS = new Set(["under-10k", "10k-20k", "20k-40k", "40k-80k", "80k-plus"]);
const CATEGORIES = ["housing", "loans", "subscriptions", "food", "dining", "transport", "other"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_ROWS = 1000;
const MAX_BODY = 4096;

const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", ...headers },
});

function validateShares(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const shares = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CATEGORIES.includes(key)) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return null;
    shares[key] = Math.round(value * 10) / 10;
  }
  return Object.keys(shares).length > 0 ? shares : null;
}

async function benchmark({ supabase, band }) {
  try {
    const { data, error } = await supabase.from("peer_benchmarks")
      .select("shares")
      .eq("band", band)
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error || !Array.isArray(data)) return json({ error: "database_request_failed" }, 503);

    const sums = {};
    let count = 0;
    for (const row of data) {
      const shares = validateShares(row.shares);
      if (!shares) continue;
      count += 1;
      for (const [cat, pct] of Object.entries(shares)) sums[cat] = (sums[cat] ?? 0) + pct;
    }
    const averages = {};
    if (count > 0) {
      for (const [cat, total] of Object.entries(sums)) averages[cat] = Math.round((total / count) * 10) / 10;
    }
    return json({ ok: true, band, sampleSize: count, averages });
  } catch {
    return json({ error: "database_request_failed" }, 503);
  }
}

async function contribute({ request, supabase, params }) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) return json({ error: "payload_too_large" }, 413);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "invalid_body" }, 400);

  const peerId = typeof body.peerId === "string" ? body.peerId : "";
  if (!uuid.test(peerId)) return json({ error: "invalid_peer_id" }, 400);
  const band = typeof body.band === "string" ? body.band : "";
  if (!BANDS.has(band)) return json({ error: "invalid_band" }, 400);
  const shares = validateShares(body.shares);
  if (!shares) return json({ error: "invalid_shares" }, 400);

  try {
    const { error } = await supabase.from("peer_benchmarks").upsert(
      { peer_id: peerId, band, shares, updated_at: new Date().toISOString() },
      { onConflict: "peer_id" },
    );
    if (error) return json({ error: "database_request_failed" }, 503);
    return json({ ok: true });
  } catch {
    return json({ error: "database_request_failed" }, 503);
  }
}

export async function handleBenchmark({ request, supabase }) {
  const params = new URL(request.url).searchParams;
  const action = params.get("action");

  if (action === "benchmark") {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
    const band = params.get("band") ?? "";
    if (!BANDS.has(band)) return json({ error: "invalid_band" }, 400);
    return benchmark({ supabase, band });
  }

  if (action === "contribute") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
    return contribute({ request, supabase, params });
  }

  return json({ error: "not_found" }, 404);
}
