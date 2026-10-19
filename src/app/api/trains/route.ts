import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";

export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`trains:${user.id}`, 15, 60 * 1000);

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "BPL").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  const to = (searchParams.get("to") || "NGP").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  const todayIso = new Date().toISOString().slice(0, 10);
  const date = searchParams.get("date") || todayIso;

  const rapidKey = process.env.RAPIDAPI_KEY;
  const rapidHost = process.env.RAPIDAPI_IRCTC_HOST || "irctc1.p.rapidapi.com";

  if (rapidKey) {
    try {
      const url = `https://${rapidHost}/api/v3/trainBetweenStations?fromStationCode=${from}&toStationCode=${to}&dateOfJourney=${date}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-key": rapidKey,
          "x-rapidapi-host": rapidHost,
        },
        cache: "no-store",
      });

      const raw = (await res.json()) as Record<string, unknown>;
      const dataObj = raw?.data as Record<string, unknown> | unknown[] | undefined;
      const list = Array.isArray(dataObj)
        ? dataObj
        : Array.isArray((dataObj as Record<string, unknown>)?.train_base)
        ? ((dataObj as Record<string, unknown>).train_base as unknown[])
        : null;

      if (res.ok && list && list.length > 0) {
        const trains = list.slice(0, 8).map((item, idx) => {
          const t = item as Record<string, unknown>;
          const trainNo = String(t.train_number || t.trainNo || "12622");
          const baseEst = 260 + ((Number(trainNo) + idx * 37) % 240);
          return {
            no: trainNo,
            name: String(t.train_name || t.trainName || "Express"),
            dep: String(t.from_std || t.departureTime || "06:45"),
            arr: String(t.to_sta || t.arrivalTime || "14:20"),
            dur: String(t.duration || "7h 35m"),
            sl: Number(t.sl_fare) || baseEst,
            a3: Number(t.a3_fare) || Math.round(baseEst * 2.55),
            a2: Number(t.a2_fare) || Math.round(baseEst * 3.65),
            avl: String(t.availability || "Check Quota (Est.)"),
            isEstimatedFare: !t.sl_fare,
          };
        });

        return json({
          success: true,
          isLive: true,
          source: "RapidAPI Train Schedule (Est. Class Fares)",
          from,
          to,
          date,
          trains,
        });
      }
    } catch {
      // Fall through to clearly-labeled offline simulator schedule
    }
  }

  const seed = (from.charCodeAt(0) * 31 + to.charCodeAt(0) * 17) % 90;
  const simulatedTrains = [
    {
      no: String(12600 + seed),
      name: `${from}-${to} Superfast Exp`,
      dep: "06:50",
      arr: "13:15",
      dur: "6h 25m",
      sl: 295 + seed,
      a3: 760 + seed * 2,
      a2: 1080 + seed * 3,
      avl: "SIM-AVL 46",
    },
    {
      no: "20171",
      name: `Vande Bharat Express (${from}-${to})`,
      dep: "08:15",
      arr: "13:40",
      dur: "5h 25m",
      sl: 840 + seed,
      a3: 1420 + seed * 2,
      a2: 2490 + seed * 3,
      avl: "SIM-AVL 22",
    },
    {
      no: String(12510 + (seed % 40)),
      name: "Raptisagar SF Express",
      dep: "11:30",
      arr: "19:10",
      dur: "7h 40m",
      sl: 340 + seed,
      a3: 890 + seed * 2,
      a2: 1275 + seed * 3,
      avl: "SIM-AVL 31",
    },
  ];

  return json({
    success: true,
    isLive: false,
    source: "Offline Simulator Schedule (Est. Fares)",
    from,
    to,
    date,
    trains: simulatedTrains,
  });
});
