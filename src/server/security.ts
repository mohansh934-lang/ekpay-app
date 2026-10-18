import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { config } from "./config";

const N = 16384, R = 8, P = 1, KEYLEN = 32;

function derive(secret: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  const peppered = createHmac("sha256", config.pepper).update(secret).digest();
  return new Promise((resolve, reject) =>
    scrypt(peppered, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );
}

/** Format: scrypt$N$r$p$salt$hash (base64) */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(secret, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await derive(secret, Buffer.from(saltB64, "base64"), +n, +r, +p);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | null = null;
/** Unknown user pe bhi same time lage (user enumeration timing attack se bachne ke liye). */
export const dummyHash = () => (dummy ??= hashSecret("dummy-password-for-timing"));

export const randomToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomDigits = (len: number) =>
  Array.from({ length: len }, () => randomInt(0, 10)).join("");

const tails = new Map<string, Promise<unknown>>();
/**
 * Ek key (jaise ek user) ke async kaam line se chalte hain. PIN/password verify ko serialize karne ke liye,
 * taaki parallel sahi requests galti se lockout trigger na karein, aur galat guesses exactly gine jaayein.
 */
export function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.then(() => undefined, () => undefined);
  tails.set(key, tail);
  void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  return next;
}
