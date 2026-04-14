// CRUD for categories, items and settings — stored in Netlify Blobs.
import { getStore } from "@netlify/blobs";

const STORE = "aac-data";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function ok(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function err(status, msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const resource   = url.searchParams.get("resource");
  const categoryId = url.searchParams.get("categoryId");
  const key        = url.searchParams.get("key");

  // Pass context so Blobs can authenticate automatically
  const store = getStore({ name: STORE, context });

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      if (resource === "categories") {
        const raw = await store.get("categories");
        return ok(raw ? JSON.parse(raw) : []);
      }
      if (resource === "items" && categoryId) {
        const raw = await store.get(`items:${categoryId}`);
        return ok(raw ? JSON.parse(raw) : []);
      }
      if (resource === "setting" && key) {
        const raw = await store.get(`setting:${key}`);
        return ok(raw !== null ? JSON.parse(raw) : null);
      }
      return err(400, "Unknown resource");
    }

    // ── POST ──────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);

      if (resource === "categories") {
        await store.set("categories", JSON.stringify(body));
        return ok({ ok: true });
      }
      if (resource === "items" && categoryId) {
        await store.set(`items:${categoryId}`, JSON.stringify(body));
        return ok({ ok: true });
      }
      if (resource === "setting" && key) {
        const value =
          body && typeof body === "object" && "value" in body ? body.value : body;
        await store.set(`setting:${key}`, JSON.stringify(value));
        return ok({ ok: true });
      }
      return err(400, "Unknown resource");
    }

    return err(405, "Method not allowed");
  } catch (e) {
    console.error("[api] error:", e);
    return err(500, e.message);
  }
};
