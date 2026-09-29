export interface ParsedUpload {
  bytes: Buffer<ArrayBuffer>;
  mimeType: string;
}

const ALLOWED_IMAGE = /^image\/(png|jpe?g|webp|gif)$/;

export function parseDataUrl(dataUrl: string, maxBytes: number): ParsedUpload {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("Invalid file data");
  const mimeType = m[1].toLowerCase();
  if (!ALLOWED_IMAGE.test(mimeType)) throw new Error("Only PNG, JPEG, WEBP or GIF images are allowed");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0) throw new Error("Empty file");
  if (bytes.length > maxBytes)
    throw new Error(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  return { bytes, mimeType };
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_SIGNATURE_BYTES = 1 * 1024 * 1024;
