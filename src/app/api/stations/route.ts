import { api, json, rateLimit } from "../../../server/http";
import { requireUser } from "../../../server/auth";

const ALL_STATIONS: [string, string, string][] = [
  ["BPL", "Bhopal Jn", "Madhya Pradesh"],
  ["RKMP", "Rani Kamalapati (Habibganj)", "Madhya Pradesh"],
  ["INDB", "Indore Jn", "Madhya Pradesh"],
  ["UJN", "Ujjain Jn", "Madhya Pradesh"],
  ["JBP", "Jabalpur Jn", "Madhya Pradesh"],
  ["GWL", "Gwalior Jn", "Madhya Pradesh"],
  ["ET", "Itarsi Jn", "Madhya Pradesh"],
  ["KTE", "Katni Jn", "Madhya Pradesh"],
  ["STA", "Satna Jn", "Madhya Pradesh"],
  ["BINA", "Bina Jn", "Madhya Pradesh"],
  ["CNB", "Kanpur Central", "Uttar Pradesh"],
  ["LKO", "Lucknow Charbagh NR", "Uttar Pradesh"],
  ["PRYJ", "Prayagraj Jn (Allahabad)", "Uttar Pradesh"],
  ["BSB", "Varanasi Jn", "Uttar Pradesh"],
  ["AGC", "Agra Cantt", "Uttar Pradesh"],
  ["JHS", "Virangana Lakshmibai Jhansi", "Uttar Pradesh"],
  ["GKP", "Gorakhpur Jn", "Uttar Pradesh"],
  ["MTJ", "Mathura Jn", "Uttar Pradesh"],
  ["NGP", "Nagpur Jn", "Maharashtra"],
  ["CSMT", "Mumbai CSMT", "Maharashtra"],
  ["MMCT", "Mumbai Central", "Maharashtra"],
  ["LTT", "Lokmanya Tilak Terminus", "Maharashtra"],
  ["PUNE", "Pune Jn", "Maharashtra"],
  ["BSL", "Bhusaval Jn", "Maharashtra"],
  ["NK", "Nashik Road", "Maharashtra"],
  ["NDLS", "New Delhi", "Delhi NCR"],
  ["NZM", "Hazrat Nizamuddin", "Delhi NCR"],
  ["DLI", "Old Delhi Jn", "Delhi NCR"],
  ["ANVT", "Anand Vihar Terminal", "Delhi NCR"],
  ["JP", "Jaipur Jn", "Rajasthan"],
  ["KOTA", "Kota Jn", "Rajasthan"],
  ["AII", "Ajmer Jn", "Rajasthan"],
  ["JU", "Jodhpur Jn", "Rajasthan"],
  ["UDZ", "Udaipur City", "Rajasthan"],
  ["ADI", "Ahmedabad Jn", "Gujarat"],
  ["ST", "Surat", "Gujarat"],
  ["BRC", "Vadodara Jn", "Gujarat"],
  ["RJT", "Rajkot Jn", "Gujarat"],
  ["SBC", "KSR Bengaluru City", "Karnataka"],
  ["YPR", "Yesvantpur Jn", "Karnataka"],
  ["MAS", "MGR Chennai Central", "Tamil Nadu"],
  ["SC", "Secunderabad Jn", "Telangana"],
  ["HYB", "Hyderabad Deccan", "Telangana"],
  ["HWH", "Howrah Jn", "West Bengal"],
  ["SDAH", "Sealdah", "West Bengal"],
  ["PNBE", "Patna Jn", "Bihar"],
  ["RNC", "Ranchi Jn", "Jharkhand"],
  ["BBS", "Bhubaneswar", "Odisha"],
  ["PURI", "Puri", "Odisha"],
  ["R", "Raipur Jn", "Chhattisgarh"],
  ["BSP", "Bilaspur Jn", "Chhattisgarh"],
  ["CDG", "Chandigarh Jn", "Chandigarh"],
  ["ASR", "Amritsar Jn", "Punjab"],
  ["LDH", "Ludhiana Jn", "Punjab"],
  ["JAT", "Jammu Tawi", "J&K"],
  ["HW", "Haridwar Jn", "Uttarakhand"],
  ["DDN", "Dehradun", "Uttarakhand"],
  ["GHY", "Guwahati", "Assam"],
  ["ERS", "Ernakulam Jn (Kochi)", "Kerala"],
  ["TVC", "Thiruvananthapuram Central", "Kerala"],
];

export const GET = api(async (req) => {
  const user = requireUser(req);
  rateLimit(`stations:${user.id}`, 40, 60 * 1000);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const localMatches = ALL_STATIONS.filter(
    ([code, name, state]) =>
      !q ||
      code.toLowerCase().startsWith(q) ||
      name.toLowerCase().includes(q) ||
      state.toLowerCase().includes(q)
  )
    .slice(0, 10)
    .map(([code, name, state]) => ({ code, name, state, source: "directory" }));

  const rapidKey = process.env.RAPIDAPI_KEY;
  const rapidHost = process.env.RAPIDAPI_IRCTC_HOST || "irctc1.p.rapidapi.com";

  if (rapidKey && q.length >= 2 && localMatches.length < 3) {
    try {
      const res = await fetch(
        `https://${rapidHost}/api/v1/searchStation?query=${encodeURIComponent(q.toUpperCase())}`,
        {
          headers: {
            "x-rapidapi-key": rapidKey,
            "x-rapidapi-host": rapidHost,
          },
          cache: "no-store",
        }
      );
      const raw = (await res.json()) as { data?: Array<Record<string, unknown>> };
      if (Array.isArray(raw?.data)) {
        for (const s of raw.data.slice(0, 6)) {
          const code = String(s.code || s.station_code || "").toUpperCase();
          const name = String(s.name || s.station_name || "");
          if (code && name && !localMatches.some((m) => m.code === code)) {
            localMatches.push({ code, name, state: "Indian Railways", source: "rapidapi" });
          }
        }
      }
    } catch {
      // Ignore upstream timeout and return local directory matches
    }
  }

  return json({ success: true, stations: localMatches });
});
