// Binary file upload — receives base64 JSON, stores in Netlify Blobs, returns serve URL.
import { getStore } from "@netlify/blobs";

const STORE = "aac-files";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const store = getStore(STORE);

  try {
    // ── Upload ────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const fileId =
        id || `f-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Client sends { data: base64String, type: mimeType }
      const { data, type } = await req.json();
      const contentType = (type || "application/octet-stream").split(";")[0];

      // Decode base64 → Uint8Array → ArrayBuffer
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      await store.set(fileId, bytes.buffer, { metadata: { contentType } });

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
      try { await store.delete(id); } catch { /* already gone */ }
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
