import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";

/**
 * Train search. Live data sirf tab jab RAPIDAPI_KEY env set ho. Key code me nahi hai (pehle hardcoded thi).
 * IMPORTANT: live API se fare / seat availability nahi aate, pehle formula se fake bana kar "Live" bola jaata tha.
 * Ab live result me fare/availability `null` hai, aur fallback list saaf-saaf `demo: true` ke saath aati hai.
 */
type Train = { no: string; name: string; dep: string; arr: string; dur: string; sl: number | null; a3: number | null; a2: number | null; avl: string | null };

const HOST = process.env.RAPIDAPI_IRCTC_HOST || "irctc1.p.rapidapi.com";
const CODE_RE = /^[A-Z]{1,5}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`trains:${user.id}`, 60, 60 * 60 * 1000);

  const sp = new URL(req.url).searchParams;
  const from = (sp.get("from") || "BPL").toUpperCase();
  const to = (sp.get("to") || "NGP").toUpperCase();
  const date = sp.get("date") || new Date().toISOString().slice(0, 10);
  if (!CODE_RE.test(from) || !CODE_RE.test(to) || !DATE_RE.test(date)) {
    return json({ success: false, error: { code: "INVALID_INPUT", message: "from/to station code aur date (YYYY-MM-DD) galat hai" } }, { status: 400 });
  }

  const key = process.env.RAPIDAPI_KEY;
  let upstreamNote = key ? "" : "RAPIDAPI_KEY set nahi hai";
  if (key) {
    try {
      const url = `https://${HOST}/api/v3/trainBetweenStations?fromStationCode=${from}&toStationCode=${to}&dateOfJourney=${date}`;
      const res = await fetch(url, {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST }, cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      const raw = await res.json();
      const list: Record<string, unknown>[] | null = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.train_base) ? raw.data.train_base : null;
      if (res.ok && list && list.length) {
        const trains: Train[] = list.slice(0, 8).map((t) => ({
          no: String(t.train_number ?? t.trainNo ?? ""),
          name: String(t.train_name ?? t.trainName ?? ""),
          dep: String(t.from_std ?? t.departureTime ?? ""),
          arr: String(t.to_sta ?? t.arrivalTime ?? ""),
          dur: String(t.duration ?? ""),
          sl: null, a3: null, a2: null, avl: null, // is endpoint se fare/availability nahi milti
        }));
        return json({ success: true, demo: false, source: `RapidAPI (${HOST})`, fareAvailable: false, from, to, date, trains });
      }
      upstreamNote = `upstream status ${res.status}`;
    } catch {
      upstreamNote = "upstream error";
    }
  }

  // DEMO fallback: ye asli train data NAHI hai. UI par "demo" dikhana.
  const seed = (from.charCodeAt(0) * 31 + to.charCodeAt(0) * 17) % 90;
  const trains: Train[] = [
    { no: String(12600 + seed), name: `${from}-${to} Superfast Exp`, dep: "06:50", arr: "13:15", dur: "6h 25m", sl: 295 + seed, a3: 760 + seed * 2, a2: 1080 + seed * 3, avl: "AVL 46" },
    { no: "20171", name: `Vande Bharat Express (${from}-${to})`, dep: "08:15", arr: "13:40", dur: "5h 25m", sl: 840 + seed, a3: 1420 + seed * 2, a2: 2490 + seed * 3, avl: "AVL 22" },
    { no: String(19300 + (seed % 50)), name: "Dakshin Express", dep: "16:05", arr: "23:45", dur: "7h 40m", sl: 280 + seed, a3: 730 + seed * 2, a2: 1030 + seed * 3, avl: "RAC 12" },
  ];
  return json({ success: true, demo: true, source: `demo data (asli IRCTC nahi)${upstreamNote ? `: ${upstreamNote}` : ""}`, fareAvailable: true, from, to, date, trains });
});
