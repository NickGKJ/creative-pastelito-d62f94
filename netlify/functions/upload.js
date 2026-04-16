// Binary file upload — receives base64 JSON, stores in Netlify Blobs, returns serve URL.
import { getStore } from "@netlify/blobs";

const STORE = "aac-files";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // Pass context so Blobs can authenticate automatically
  const store = getStore({ name: STORE, context });

  try {
    // ── Upload ────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const fileId =
        id || `f-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Client sends { data: base64String, type: mimeType }
      const { data, type } = await req.json();

      // Strip codec params e.g. audio/webm;codecs=opus → audio/webm
      const contentType = (type || "application/octet-stream").split(";")[0];

      // Decode base64 → ArrayBuffer using Node's Buffer.
      // new Uint8Array(buf).buffer always produces an owned ArrayBuffer that
      // starts at offset 0 — avoids the byteOffset pitfall of buf.buffer
      // when Buffer reuses a larger pool allocation.
      const buf = Buffer.from(data, "base64");
      const arrayBuffer = new Uint8Array(buf).buffer;

      await store.set(fileId, arrayBuffer, { metadata: { contentType } });

      return new Response(
        JSON.stringify({
          id: fileId,
          url: `/.netlify/functions/file?id=${encodeURIComponent(fileId)}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    if (req.method === "DELETE" && id) {
      try { await store.delete(id); } catch (_e) { /* already gone */ }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });
  } catch (e) {
    console.error("[upload] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
};
