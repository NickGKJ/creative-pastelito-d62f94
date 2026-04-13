// Receives binary file uploads from the admin, stores them in Netlify Blobs,
// and returns a URL that the file.js function will serve.

const { getStore } = require("@netlify/blobs");

const STORE = "aac-files";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-File-Type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const store = getStore(STORE);
  const { id } = event.queryStringParameters || {};

  try {
    // ── Upload ────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
      const fileId =
        id ||
        `f-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const contentType =
        event.headers["x-file-type"] ||
        event.headers["X-File-Type"] ||
        "application/octet-stream";

      const buf = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body || "", "binary");

      await store.set(fileId, buf, { metadata: { contentType } });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", ...CORS },
        body: JSON.stringify({
          id: fileId,
          url: `/.netlify/functions/file?id=${encodeURIComponent(fileId)}`,
        }),
      };
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    if (event.httpMethod === "DELETE" && id) {
      try {
        await store.delete(id);
      } catch {
        /* already gone — not an error */
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", ...CORS },
        body: JSON.stringify({ ok: true }),
      };
    }

    return { statusCode: 405, headers: CORS, body: "Method not allowed" };
  } catch (e) {
    console.error("[upload] error:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
