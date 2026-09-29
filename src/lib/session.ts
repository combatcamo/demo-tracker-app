// HMAC-signed cookie sessions using Web Crypto (works in Node and Edge runtimes).
// Cookie value format: base64url(payload).base64url(signature)
// where payload = JSON { uid, exp }.

export const COOKIE_NAME = "dt_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SessionPayload {
  uid: string;
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

function slowEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  uid: string,
  secret: string,
  maxAgeSec: number = SESSION_MAX_AGE_SEC
): Promise<string> {
  const payload = b64urlEncode(
    encoder.encode(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + maxAgeSec }))
  );
  const sig = await signData(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await signData(payload, secret);
  if (!slowEqual(expected, sig)) return null;
  try {
    const parsed = JSON.parse(decoder.decode(b64urlDecode(payload))) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as SessionPayload).uid !== "string" ||
      typeof (parsed as SessionPayload).exp !== "number"
    ) {
      return null;
    }
    const p = parsed as SessionPayload;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
