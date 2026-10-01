export const SESSION_COOKIE_NAME = 'lc_session';
export const DEFAULT_USER_ID = 'learner-main';

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  exp: number;
}

export function getAppSecret(): string {
  return process.env.APP_SECRET || process.env.APP_PASSWORD || 'listening-coach-default-secret-key-2026';
}

export function getAppPassword(): string {
  return process.env.APP_PASSWORD || 'coach123';
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function base64UrlEncodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecodeBuffer(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(userId = DEFAULT_USER_ID, maxAgeSeconds = 30 * 86400): Promise<string> {
  const payload: SessionPayload = {
    userId,
    name: 'Learner',
    email: 'me@listening-coach.local',
    exp: Date.now() + maxAgeSeconds * 1000,
  };
  const secret = getAppSecret();
  const data = base64UrlEncode(JSON.stringify(payload));
  const key = await getCryptoKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigStr = base64UrlEncodeBuffer(sig);
  return `${data}.${sigStr}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sigStr] = parts;
  try {
    const secret = getAppSecret();
    const key = await getCryptoKey(secret);
    const sig = base64UrlDecodeBuffer(sigStr);
    const valid = await crypto.subtle.verify('HMAC', key, sig as unknown as BufferSource, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(base64UrlDecode(data)) as SessionPayload;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
