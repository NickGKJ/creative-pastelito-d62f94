// Serves binary files (images + audio) stored by upload.js.
// Files are cached by the browser and CDN for a full year since
// the content never changes for a given ID.

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) {
    return { statusCode: 400, body: "Missing id parameter" };
  }

  const store = getStore("aac-files");

  try {
    const result = await store.getWithMetadata(id, { type: "arrayBuffer" });

    if (!result) {
      return { statusCode: 404, body: "File not found" };
    }

    const contentType =
      result.metadata?.contentType || "application/octet-stream";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        // Files are immutable — same ID always means same content.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
      body: Buffer.from(result.data).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error("[file] error:", e);
    return { statusCode: 404, body: "File not found" };
  }
};
