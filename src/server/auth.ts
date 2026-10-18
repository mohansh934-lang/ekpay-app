import { config } from "./config";
import { ApiError, isUniqueViolation } from "./errors";
import { many, one, run, transaction } from "./db";
import { clientIp, parseCookies, rateLimit, str } from "./http";
import { dummyHash, hashSecret, randomToken, serialize, sha256, verifySecret } from "./security";
import { clearAttempts, registerFailure, reserveAttempt } from "./attempts";
import { seedDemoData } from "./seed";

export interface SessionUser { id: number; name: string; phone: string; upiId: string }

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^\d{4}(\d{2})?$/;

function checkCredentialsFormat(body: Record<string, unknown>) {
  const phone = str(body.phone, "phone", 10, 10);
  if (!PHONE_RE.test(phone)) throw new ApiError(400, "INVALID_PHONE", "Valid 10-digit Indian mobile number daalo");
  return phone;
}

// ---------- Sessions ----------
function createSession(userId: number, userAgent: string | null) {
  const token = randomToken();
  const now = Date.now();
  run("DELETE FROM sessions WHERE expires_at < ?", now); // purani sessions saaf
  run(
    "INSERT INTO sessions (user_id, token_hash, expires_at, created_at, user_agent) VALUES (?,?,?,?,?)",
    userId, sha256(token), now + config.sessionTtlMs, now, userAgent?.slice(0, 200) ?? null
  );
  return token;
}

export function sessionCookie(token: string) {
  const parts = [
    `${config.cookieName}=${token}`, "HttpOnly", "SameSite=Lax", "Path=/",
    `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`,
  ];
  if (config.secureCookies) parts.push("Secure");
  return parts.join("; ");
}
export const clearedCookie = () =>
  `${config.cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${config.secureCookies ? "; Secure" : ""}`;

export function getSessionUser(req: Request): SessionUser | null {
  const token = parseCookies(req)[config.cookieName];
  if (!token) return null;
  const r = one<{ id: number; name: string; phone: string; upi_id: string }>(
    `SELECT u.id, u.name, u.phone, u.upi_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token), Date.now()
  );
  return r ? { id: r.id, name: r.name, phone: r.phone, upiId: r.upi_id } : null;
}

export function requireUser(req: Request): SessionUser {
  const u = getSessionUser(req);
  if (!u) throw new ApiError(401, "UNAUTHORIZED", "Pehle login karo");
  return u;
}

export function destroySession(req: Request) {
  const token = parseCookies(req)[config.cookieName];
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
}

// ---------- Register / Login ----------
export async function register(req: Request, body: Record<string, unknown>) {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const phone = checkCredentialsFormat(body);
  const name = str(body.name, "name", 2, 60);
  const password = str(body.password, "password", 8, 128);
  const pin = typeof body.upiPin === "string" ? body.upiPin : "";
  if (!PIN_RE.test(pin)) throw new ApiError(400, "INVALID_PIN_FORMAT", "UPI PIN 4 ya 6 digits ka hona chahiye");

  const [passwordHash, pinHash] = await Promise.all([hashSecret(password), hashSecret(pin)]);

  let userId: number;
  try {
    userId = transaction((db) => {
      const res = db
        .prepare("INSERT INTO users (phone, name, upi_id, password_hash, pin_hash, created_at) VALUES (?,?,?,?,?,?)")
        .run(phone, name, `${phone}@ekpay`, passwordHash, pinHash, Date.now());
      const id = Number(res.lastInsertRowid);
      seedDemoData(db, id);
      return id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "PHONE_TAKEN", "Is number se account pehle se hai");
    throw e;
  }
  const token = createSession(userId, req.headers.get("user-agent"));
  return { token, user: { id: userId, name, phone, upiId: `${phone}@ekpay` } };
}

export async function login(req: Request, body: Record<string, unknown>) {
  rateLimit(`login:${clientIp(req)}`, 30, 10 * 60 * 1000);
  const phone = checkCredentialsFormat(body);
  const password = str(body.password, "password", 1, 128);

  const user = one<{ id: number; name: string; upi_id: string; password_hash: string }>(
    "SELECT id, name, upi_id, password_hash FROM users WHERE phone = ?", phone
  );
  if (!user) {
    await verifySecret(password, await dummyHash()); // timing same rakho
    throw new ApiError(401, "INVALID_CREDENTIALS", "Number ya password galat hai");
  }

  await serialize(`login:${user.id}`, async () => {
    reserveAttempt(user.id, "login");
    if (!(await verifySecret(password, user.password_hash))) {
      registerFailure(user.id, "login");
      throw new ApiError(401, "INVALID_CREDENTIALS", "Number ya password galat hai");
    }
    clearAttempts(user.id, "login");
  });
  const token = createSession(user.id, req.headers.get("user-agent"));
  return { token, user: { id: user.id, name: user.name, phone, upiId: user.upi_id } };
}

// ---------- UPI PIN ----------
export async function verifyPin(userId: number, pin: unknown) {
  if (typeof pin !== "string" || !PIN_RE.test(pin)) {
    throw new ApiError(400, "INVALID_PIN_FORMAT", "UPI PIN 4 ya 6 digits ka hona chahiye");
  }
  await serialize(`pin:${userId}`, async () => {
    reserveAttempt(userId, "pin");
    const u = one<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id = ?", userId);
    if (!u || !(await verifySecret(pin, u.pin_hash))) {
      const remaining = registerFailure(userId, "pin");
      throw new ApiError(
        401, "INVALID_PIN",
        remaining > 0 ? `Galat UPI PIN. ${remaining} attempt bache hain` : "Galat UPI PIN. PIN 15 minute ke liye lock ho gaya",
        { remainingAttempts: remaining }
      );
    }
    clearAttempts(userId, "pin");
  });
}

/** UPI PIN badalna: purana PIN verify hona zaroori (lockout rules same). */
export async function changePin(userId: number, body: Record<string, unknown>) {
  const next = typeof body.newPin === "string" ? body.newPin : "";
  if (!PIN_RE.test(next)) throw new ApiError(400, "INVALID_PIN_FORMAT", "Naya UPI PIN 4 ya 6 digits ka hona chahiye");
  await verifyPin(userId, body.currentPin);
  const hash = await hashSecret(next);
  run("UPDATE users SET pin_hash = ? WHERE id = ?", hash, userId);
}

export const listSessions = (userId: number) =>
  many("SELECT id, created_at, expires_at, user_agent FROM sessions WHERE user_id = ? AND expires_at > ?", userId, Date.now());
