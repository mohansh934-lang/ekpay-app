import fs from "node:fs";
import path from "node:path";

export type BankCategory = "public" | "private" | "small_finance" | "payments" | "foreign" | "rural" | "cooperative";
export interface Bank { id: string; name: string; category: BankCategory; popular: boolean }

/**
 * SEED LIST: UPI par live banks ka ek bada subset, par NPCI ki poori (300+) list nahi.
 * Poori list ke liye NPCI ki "UPI Live Members" list download karke `data/upi-banks.json` me rakh do
 * (format: [{ "id": "hdfc", "name": "HDFC Bank", "category": "private", "popular": true }, ...]).
 * Wo file milte hi ye seed list ignore ho jaati hai. PSP ke saath real SDK aane par
 * ListAccountProvider API se yahi list aayegi (upi/sdk.ts).
 * IIN / account-provider codes yahan jaan-boojh kar nahi hain: wo NPCI ki list se hi lena, andaza mat lagana.
 */
const SEED: [string, BankCategory, boolean?][] = [
  // Popular
  ["State Bank of India", "public", true], ["HDFC Bank", "private", true], ["ICICI Bank", "private", true],
  ["Axis Bank", "private", true], ["Kotak Mahindra Bank", "private", true], ["Punjab National Bank", "public", true],
  ["Bank of Baroda", "public", true], ["Canara Bank", "public", true], ["Union Bank of India", "public", true],
  ["Yes Bank", "private", true], ["IDFC FIRST Bank", "private", true], ["Paytm Payments Bank", "payments", true],
  // Public sector
  ["Bank of India", "public"], ["Indian Bank", "public"], ["Central Bank of India", "public"],
  ["Indian Overseas Bank", "public"], ["UCO Bank", "public"], ["Bank of Maharashtra", "public"],
  ["Punjab & Sind Bank", "public"],
  // Private
  ["IndusInd Bank", "private"], ["Federal Bank", "private"], ["IDBI Bank", "private"], ["South Indian Bank", "private"],
  ["Karnataka Bank", "private"], ["Karur Vysya Bank", "private"], ["City Union Bank", "private"],
  ["Tamilnad Mercantile Bank", "private"], ["RBL Bank", "private"], ["Bandhan Bank", "private"], ["DCB Bank", "private"],
  ["CSB Bank", "private"], ["Dhanlaxmi Bank", "private"], ["Jammu & Kashmir Bank", "private"], ["Nainital Bank", "private"],
  ["IDBI Intesa", "private"],
  // Small finance
  ["AU Small Finance Bank", "small_finance"], ["Equitas Small Finance Bank", "small_finance"],
  ["Ujjivan Small Finance Bank", "small_finance"], ["Jana Small Finance Bank", "small_finance"],
  ["Suryoday Small Finance Bank", "small_finance"], ["ESAF Small Finance Bank", "small_finance"],
  ["Utkarsh Small Finance Bank", "small_finance"], ["Capital Small Finance Bank", "small_finance"],
  ["North East Small Finance Bank", "small_finance"], ["Fincare Small Finance Bank", "small_finance"],
  ["Shivalik Small Finance Bank", "small_finance"], ["Unity Small Finance Bank", "small_finance"],
  // Payments banks
  ["Airtel Payments Bank", "payments"], ["India Post Payments Bank", "payments"], ["Fino Payments Bank", "payments"],
  ["Jio Payments Bank", "payments"], ["NSDL Payments Bank", "payments"],
  // Foreign
  ["Standard Chartered Bank", "foreign"], ["HSBC", "foreign"], ["Citibank", "foreign"], ["DBS Bank India", "foreign"],
  ["Deutsche Bank", "foreign"],
  // Regional rural
  ["Madhya Pradesh Gramin Bank", "rural"], ["Karnataka Gramin Bank", "rural"], ["Kerala Gramin Bank", "rural"],
  ["Tamil Nadu Grama Bank", "rural"], ["Telangana Grameena Bank", "rural"], ["Andhra Pradesh Grameena Vikas Bank", "rural"],
  ["Chhattisgarh Rajya Gramin Bank", "rural"], ["Jharkhand Rajya Gramin Bank", "rural"], ["Himachal Pradesh Gramin Bank", "rural"],
  ["Punjab Gramin Bank", "rural"], ["Assam Gramin Vikash Bank", "rural"], ["Maharashtra Gramin Bank", "rural"],
  ["Utkal Grameen Bank", "rural"], ["Odisha Gramya Bank", "rural"], ["Uttar Bihar Gramin Bank", "rural"],
  ["Dakshin Bihar Gramin Bank", "rural"], ["Baroda UP Bank", "rural"], ["Prathama UP Gramin Bank", "rural"],
  ["Aryavart Bank", "rural"], ["Saptagiri Grameena Bank", "rural"],
  // Co-operative
  ["Saraswat Co-operative Bank", "cooperative"], ["Cosmos Co-operative Bank", "cooperative"], ["TJSB Sahakari Bank", "cooperative"],
  ["Bharat Co-operative Bank", "cooperative"], ["Abhyudaya Co-operative Bank", "cooperative"], ["NKGSB Co-operative Bank", "cooperative"],
  ["SVC Co-operative Bank", "cooperative"], ["Janata Sahakari Bank", "cooperative"], ["Kalupur Commercial Co-operative Bank", "cooperative"],
  ["Nutan Nagarik Sahakari Bank", "cooperative"], ["Mehsana Urban Co-operative Bank", "cooperative"], ["Apna Sahakari Bank", "cooperative"],
  ["Thane Bharat Sahakari Bank", "cooperative"], ["Rajkot Nagarik Sahakari Bank", "cooperative"], ["Ahmedabad Mercantile Co-operative Bank", "cooperative"],
];

const slug = (n: string) => n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let cache: { key: string; list: Bank[] } | null = null;

function fromFile(): Bank[] | null {
  const file = process.env.EK_BANKS_FILE || path.join(process.cwd(), "data", "upi-banks.json");
  try {
    const stat = fs.statSync(file);
    const key = `${file}:${stat.mtimeMs}`;
    if (cache?.key === key) return cache.list;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(raw)) return null;
    const cats: string[] = ["public", "private", "small_finance", "payments", "foreign", "rural", "cooperative"];
    const list: Bank[] = [];
    for (const r of raw as Record<string, unknown>[]) {
      if (typeof r?.name !== "string" || !r.name.trim()) continue;
      const name = r.name.trim().slice(0, 80);
      list.push({
        id: typeof r.id === "string" && /^[a-z0-9-]{1,60}$/.test(r.id) ? r.id : slug(name),
        name,
        category: (cats.includes(String(r.category)) ? r.category : "private") as BankCategory,
        popular: r.popular === true,
      });
    }
    if (!list.length) return null;
    cache = { key, list };
    return list;
  } catch {
    return null;
  }
}

const seedList = (): Bank[] => SEED.map(([name, category, popular]) => ({ id: slug(name), name, category, popular: !!popular }));

/** Popular pehle, baaki alphabetical. `q` se naam me search. */
export function listBanks(q?: string): Bank[] {
  let list = fromFile() ?? seedList();
  const needle = q?.trim().toLowerCase();
  if (needle) list = list.filter((b) => b.name.toLowerCase().includes(needle) || b.id.includes(needle));
  return [...list].sort((a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name));
}

export const getBank = (id: string): Bank | undefined => (fromFile() ?? seedList()).find((b) => b.id === id);
