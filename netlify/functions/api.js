// CRUD for categories, items and settings — stored in Netlify Blobs.
// Called by the React frontend via fetch().

const { getStore } = require("@netlify/blobs");

const STORE = "aac-data";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonOk(body) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", ...CORS },
    body: JSON.stringify(body),
  };
}

function jsonErr(status, msg) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...CORS },
    body: JSON.stringify({ error: msg }),
  };
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const store = getStore(STORE);
  const { resource, categoryId, key } = event.queryStringParameters || {};

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET") {
      if (resource === "categories") {
        const raw = await store.get("categories");
        return jsonOk(raw ? JSON.parse(raw) : []);
      }

      if (resource === "items" && categoryId) {
        const raw = await store.get(`items:${categoryId}`);
        return jsonOk(raw ? JSON.parse(raw) : []);
      }

      if (resource === "setting" && key) {
        const raw = await store.get(`setting:${key}`);
        return jsonOk(raw !== null ? JSON.parse(raw) : null);
      }

      return jsonErr(400, "Unknown resource");
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "null");

      if (resource === "categories") {
        await store.set("categories", JSON.stringify(body));
        return jsonOk({ ok: true });
      }

      if (resource === "items" && categoryId) {
        await store.set(`items:${categoryId}`, JSON.stringify(body));
        return jsonOk({ ok: true });
      }

      if (resource === "setting" && key) {
        const value = body && typeof body === "object" && "value" in body
          ? body.value
          : body;
        await store.set(`setting:${key}`, JSON.stringify(value));
        return jsonOk({ ok: true });
      }

      return jsonErr(400, "Unknown resource");
    }

    return jsonErr(405, "Method not allowed");
  } catch (e) {
    console.error("[api] error:", e);
    return jsonErr(500, e.message);
  }
};
