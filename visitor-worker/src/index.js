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

function validVisitorId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
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
      const body = await requestBody(request);
      if (!body) return json({ error: "invalid_json" }, 400, origin);
      const visitorId = String(body.visitorId || "");
      if (!validVisitorId(visitorId)) {
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

    if (request.method === "POST" && url.pathname === "/likes") {
      const body = await requestBody(request);
      if (!body) return json({ error: "invalid_json" }, 400, origin);
      const visitorId = String(body.visitorId || "");
      if (!validVisitorId(visitorId)) {
        return json({ error: "invalid_visitor_id" }, 400, origin);
      }

      const visitorHash = await sha256(visitorId);
      const [countRows, likedRows] = await Promise.all([
        env.DB.prepare(
          "SELECT photo_id, COUNT(*) AS count FROM photo_likes GROUP BY photo_id",
        ).all(),
        env.DB.prepare(
          "SELECT photo_id FROM photo_likes WHERE visitor_hash = ?",
        ).bind(visitorHash).all(),
      ]);
      const likes = Object.fromEntries(
        (countRows.results || []).map((row) => [row.photo_id, Number(row.count)]),
      );
      const liked = (likedRows.results || []).map((row) => row.photo_id);
      return json({ likes, liked }, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/like") {
      const body = await requestBody(request);
      if (!body) return json({ error: "invalid_json" }, 400, origin);
      const visitorId = String(body.visitorId || "");
      const photoId = String(body.photoId || "");
      if (!validVisitorId(visitorId)) {
        return json({ error: "invalid_visitor_id" }, 400, origin);
      }
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(photoId)) {
        return json({ error: "invalid_photo_id" }, 400, origin);
      }

      const visitorHash = await sha256(visitorId);
      const inserted = await env.DB.prepare(
        "INSERT OR IGNORE INTO photo_likes (visitor_hash, photo_id) VALUES (?, ?)",
      ).bind(visitorHash, photoId).run();
      const result = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM photo_likes WHERE photo_id = ?",
      ).bind(photoId).first();
      return json({
        liked: true,
        added: Number(inserted.meta?.changes || 0) > 0,
        count: Number(result?.count || 0),
      }, 200, origin);
    }

    return json({ error: "not_found" }, 404, origin);
  },
};
