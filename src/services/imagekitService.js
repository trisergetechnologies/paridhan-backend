import crypto from "crypto";

export const isImageKitConfigured = () =>
  Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY);

/**
 * Client-side upload auth per https://imagekit.io/docs/api-reference/upload-file-api/client-side-file-upload
 */
export const getUploadAuthParams = () => {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("ImageKit keys missing");
  }
  const token = crypto.randomBytes(16).toString("hex");
  const expire = Math.floor(Date.now() / 1000) + 2400;
  const signature = crypto.createHmac("sha1", privateKey).update(token + expire).digest("hex");
  return { token, expire, signature, publicKey };
};

/**
 * Delete file from ImageKit DAM (uses private API key).
 */
export const deleteImageKitFile = async (fileId) => {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!fileId || !privateKey) return { ok: false, skipped: true };
  const auth = Buffer.from(`${privateKey}:`).toString("base64");
  const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${auth}` },
  });
  return { ok: res.ok };
};

export const deleteManyImageKitFiles = async (fileIds) => {
  const unique = [...new Set((fileIds || []).filter(Boolean).map(String))];
  for (const id of unique) {
    await deleteImageKitFile(id);
  }
};
