// Serves binary files (images + audio) stored by upload.js.
// Supports HTTP Range requests — required for iOS Safari audio playback.
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const store = getStore({ name: "aac-files", context });

  try {
    const result = await store.getWithMetadata(id, { type: "arrayBuffer" });

    if (!result) {
      return new Response("File not found", { status: 404 });
    }

    const contentType = result.metadata?.contentType || "application/octet-stream";
    const data = result.data;           // ArrayBuffer
    const totalSize = data.byteLength;

    const baseHeaders = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",          // tells Safari range requests are supported
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    };

    // ── Handle Range requests (iOS Safari requires this to play audio) ─────────
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end   = match[2] !== "" ? parseInt(match[2], 10) : totalSize - 1;
        const safeEnd = Math.min(end, totalSize - 1);
        const chunk = data.slice(start, safeEnd + 1);

        return new Response(chunk, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range":  `bytes ${start}-${safeEnd}/${totalSize}`,
            "Content-Length": String(chunk.byteLength),
          },
        });
      }
    }

    // ── Full file ─────────────────────────────────────────────────────────────
    return new Response(data, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(totalSize),
      },
    });

  } catch (e) {
    console.error("[file] error:", e);
    return new Response("File not found", { status: 404 });
  }
};
