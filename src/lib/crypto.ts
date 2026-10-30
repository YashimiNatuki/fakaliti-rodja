// Yotes crypto: PBKDF2-HMAC-SHA256 -> AES-256-GCM via WebCrypto.
// Key is non-extractable and lives only in memory while the vault is unlocked.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITER = 600_000;

export interface Sealed {
  iv: string; // base64, 12 bytes, fresh per encryption
  ct: string; // base64 ciphertext (+ GCM tag)
}

export function toB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(pass: string, saltB64: string, iterations = PBKDF2_ITER): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64) as unknown as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    enc.encode(JSON.stringify(value))
  );
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv) as unknown as BufferSource },
    key,
    fromB64(sealed.ct) as unknown as BufferSource
  );
  return JSON.parse(dec.decode(pt)) as T;
}

const VERIFIER = { v: 'yotes-ok' };

export function makeVerifier(key: CryptoKey): Promise<Sealed> {
  return seal(key, VERIFIER);
}

export async function checkVerifier(key: CryptoKey, sealed: Sealed): Promise<boolean> {
  try {
    const r = await open<typeof VERIFIER>(key, sealed);
    return r.v === VERIFIER.v;
  } catch {
    return false; // wrong passphrase or tampered data: GCM tag mismatch
  }
}
