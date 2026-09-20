const ALLOWED_ORIGINS = new Set([
  "https://liuxiang-thu.github.io",
]);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://liuxiang-thu.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "origin_not_allowed" }, 403, origin);
    }

    if (request.method === "POST" && url.pathname === "/visit") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid_json" }, 400, origin);
      }

      const visitorId = String(body.visitorId || "");
      if (!/^[0-9a-f-]{36}$/i.test(visitorId)) {
        return json({ error: "invalid_visitor_id" }, 400, origin);
      }

      const visitorHash = await sha256(visitorId);
      await env.DB.prepare(
        "INSERT OR IGNORE INTO visitors (visitor_hash) VALUES (?)",
      ).bind(visitorHash).run();

      return json({ recorded: true }, 200, origin);
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      const result = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM visitors",
      ).first();
      return json({ uniqueVisitors: Number(result?.count || 0) }, 200, origin);
    }

    return json({ error: "not_found" }, 404, origin);
  },
};
