// Serves binary files (images + audio) stored by upload.js.
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  // Pass context so Blobs can authenticate automatically
  const store = getStore({ name: "aac-files", context });

  try {
    const result = await store.getWithMetadata(id, { type: "arrayBuffer" });

    if (!result) {
      return new Response("File not found", { status: 404 });
    }

    const contentType =
      result.metadata?.contentType || "application/octet-stream";

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("[file] error:", e);
    return new Response("File not found", { status: 404 });
  }
};
