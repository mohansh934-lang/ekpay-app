import { ApiError } from "./errors";
import { one, run } from "./db";
import { hashSecret, serialize, verifySecret } from "./security";
import { clearAttempts, registerFailure, reserveAttempt } from "./attempts";

const PIN_RE = /^\d{4}(\d{2})?$/;

/**
 * Forgot UPI PIN (simulator): account password se verify karke naya PIN set.
 * Real UPI me ye debit card ke last 6 digits + expiry + OTP se NPCI CL ke andar hota hai.
 * Password galat hone par login wale hi lockout counters lagte hain. Sahi hone par PIN lock bhi hat jaata hai.
 */
export async function resetPin(userId: number, body: Record<string, unknown>) {
  const next = typeof body.newPin === "string" ? body.newPin : "";
  if (!PIN_RE.test(next)) throw new ApiError(400, "INVALID_PIN_FORMAT", "Naya UPI PIN 4 ya 6 digits ka hona chahiye");
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 1 || password.length > 128) throw new ApiError(400, "INVALID_INPUT", "password chahiye");

  await serialize(`login:${userId}`, async () => {
    reserveAttempt(userId, "login");
    const u = one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
    if (!u || !(await verifySecret(password, u.password_hash))) {
      registerFailure(userId, "login");
      throw new ApiError(401, "INVALID_CREDENTIALS", "Password galat hai");
    }
    clearAttempts(userId, "login");
  });
  const hash = await hashSecret(next);
  run("UPDATE users SET pin_hash = ?, pin_failures = 0, pin_locked_until = 0 WHERE id = ?", hash, userId);
}
