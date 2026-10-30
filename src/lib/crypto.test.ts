import { describe, it, expect } from 'vitest';
import { deriveKey, newSalt, seal, open, makeVerifier, checkVerifier, toB64, fromB64 } from './crypto';

const ITER = 1000; // fast for tests; production uses PBKDF2_ITER

describe('yotes crypto', () => {
  it('round-trips JSON', async () => {
    const key = await deriveKey('correct horse', newSalt(), ITER);
    const note = { title: 'šđčćž test', content: '# hi\nsecret', tags: ['a', 'b'] };
    const sealed = await seal(key, note);
    expect(await open(key, sealed)).toEqual(note);
  });

  it('uses a fresh IV per encryption', async () => {
    const key = await deriveKey('pw', newSalt(), ITER);
    const a = await seal(key, { x: 1 });
    const b = await seal(key, { x: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('rejects the wrong passphrase', async () => {
    const salt = newSalt();
    const good = await deriveKey('good', salt, ITER);
    const bad = await deriveKey('bad', salt, ITER);
    const verifier = await makeVerifier(good);
    expect(await checkVerifier(good, verifier)).toBe(true);
    expect(await checkVerifier(bad, verifier)).toBe(false);
  });

  it('detects ciphertext tampering', async () => {
    const key = await deriveKey('pw', newSalt(), ITER);
    const sealed = await seal(key, { secret: 'x' });
    const raw = fromB64(sealed.ct);
    raw[0] ^= 0xff;
    await expect(open(key, { ...sealed, ct: toB64(raw) })).rejects.toThrow();
  });

  it('same passphrase + different salt gives a different key', async () => {
    const k1 = await deriveKey('pw', newSalt(), ITER);
    const k2 = await deriveKey('pw', newSalt(), ITER);
    const sealed = await seal(k1, { a: 1 });
    await expect(open(k2, sealed)).rejects.toThrow();
  });
});
