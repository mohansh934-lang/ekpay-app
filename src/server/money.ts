import { ApiError } from "./errors";

/** Rupees (number ya "123.45" string) -> integer paise. Float errors se bachne ke liye strict validation. */
export function toPaise(value: unknown, opts: { min?: number; max: number; field?: string }): number {
  const field = opts.field ?? "amount";
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value.trim())) n = Number(value);
  else throw new ApiError(400, "INVALID_AMOUNT", `${field} number hona chahiye`);

  if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, "INVALID_AMOUNT", `${field} 0 se zyada hona chahiye`);
  const paise = Math.round(n * 100);
  if (Math.abs(n * 100 - paise) > 1e-6) {
    throw new ApiError(400, "INVALID_AMOUNT", `${field} me maximum 2 decimal places allowed hain`);
  }
  if (paise < (opts.min ?? 1)) throw new ApiError(400, "AMOUNT_TOO_LOW", `${field} bahut kam hai`);
  if (paise > opts.max) {
    throw new ApiError(400, "AMOUNT_TOO_HIGH", `${field} limit (₹${(opts.max / 100).toLocaleString("en-IN")}) se zyada hai`);
  }
  return paise;
}

export const rupees = (paise: number) => paise / 100;
