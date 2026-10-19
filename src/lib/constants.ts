export const CAT_COLORS: Record<string, string> = {
  Food: "#e81a6c",
  Shopping: "#0f9d58",
  Bills: "#e08a00",
  Travel: "#00a6d6",
  Transfer: "#6739b7",
  Investment: "#d9480f",
};

export const TELECOM_PLANS: Record<string, { price: number; val: string; data: string; cat: string; desc: string }[]> = {
  Jio: [
    { price: 299, val: "28 Days", data: "1.5 GB/day", cat: "Popular", desc: "Unlimited Voice + 100 SMS/day + JioTV" },
    { price: 349, val: "28 Days", data: "2 GB/day + True 5G", cat: "5G Unlimited", desc: "Hero 5G Plan • Unlimited 5G Data + Calls" },
    { price: 749, val: "72 Days", data: "2 GB/day + 20GB Extra", cat: "5G Unlimited", desc: "Unlimited True 5G + JioCinema" },
    { price: 859, val: "84 Days", data: "2 GB/day + True 5G", cat: "5G Unlimited", desc: "Best 84-Day True 5G Unlimited Pack" },
    { price: 3599, val: "365 Days", data: "2.5 GB/day + True 5G", cat: "Annual", desc: "1 Year Non-Stop True 5G + Calls" },
    { price: 101, val: "Active Plan", data: "6 GB Booster", cat: "Data Add-on", desc: "True Unlimited 5G Upgrade Booster" },
  ],
  Airtel: [
    { price: 299, val: "28 Days", data: "1 GB/day", cat: "Popular", desc: "Unlimited Calls + 100 SMS/day + Wynk" },
    { price: 379, val: "1 Month", data: "2 GB/day + 5G", cat: "5G Unlimited", desc: "Unlimited 5G Data + Apollo 24|7 + Xstream" },
    { price: 859, val: "84 Days", data: "1.5 GB/day", cat: "Popular", desc: "Unlimited Calls + RewardsMini" },
    { price: 979, val: "84 Days", data: "2 GB/day + 5G", cat: "5G Unlimited", desc: "Unlimited 5G + Airtel Xstream Play Free" },
    { price: 3599, val: "365 Days", data: "2 GB/day + 5G", cat: "Annual", desc: "365 Days Unlimited 5G + Roaming" },
    { price: 99, val: "2 Days", data: "Unlimited Data (20GB/day)", cat: "Data Add-on", desc: "Weekend Heavy Data Pack" },
  ],
  Vi: [
    { price: 299, val: "28 Days", data: "1 GB/day", cat: "Popular", desc: "Unlimited Calls + 100 SMS/day" },
    { price: 365, val: "28 Days", data: "2 GB/day + Hero", cat: "5G Unlimited", desc: "12AM-6AM Binge All Night + Weekend Rollover" },
    { price: 859, val: "84 Days", data: "1.5 GB/day + Hero", cat: "5G Unlimited", desc: "Binge All Night + Data Delights" },
    { price: 3499, val: "365 Days", data: "1.5 GB/day", cat: "Annual", desc: "Full Year Validity + Vi Movies & TV" },
    { price: 139, val: "28 Days", data: "12 GB Data", cat: "Data Add-on", desc: "Work From Home Data Add-on" },
  ],
  BSNL: [
    { price: 153, val: "26 Days", data: "1 GB/day", cat: "Popular", desc: "Unlimited Voice Calls (Local/STD) + 100 SMS" },
    { price: 197, val: "70 Days", data: "2 GB/day (first 15d)", cat: "Popular", desc: "Best Validity Saver Plan" },
    { price: 397, val: "150 Days", data: "2 GB/day (first 30d)", cat: "Popular", desc: "5 Months SIM Active Validity Pack" },
    { price: 599, val: "84 Days", data: "3 GB/day + Night Free", cat: "5G Unlimited", desc: "Work & Study Heavy Data Pack (252 GB)" },
    { price: 1999, val: "365 Days", data: "600 GB Total", cat: "Annual", desc: "365 Days Unlimited Calls + 600 GB Data" },
  ],
};

export const STATIONS = [
  ["BPL", "Bhopal Jn"],
  ["NGP", "Nagpur Jn"],
  ["CNB", "Kanpur Central"],
  ["INDB", "Indore Jn"],
  ["JP", "Jaipur Jn"],
  ["UJN", "Ujjain Jn"],
  ["NDLS", "New Delhi"],
  ["CSMT", "Mumbai CSMT"],
];

export const IRCTC_TRAINS = [
  { no: "12622", name: "Tamil Nadu SF Express", dep: "07:00", arr: "12:35", dur: "5h 35m", sl: 295, a3: 755, a2: 1065, avl: "AVL 48" },
  { no: "12511", name: "Raptisagar SF Express", dep: "11:30", arr: "19:15", dur: "7h 45m", sl: 345, a3: 910, a2: 1290, avl: "AVL 24" },
  { no: "19302", name: "Dr. Ambedkar Nagar Exp", dep: "16:10", arr: "23:45", dur: "7h 35m", sl: 280, a3: 720, a2: 1020, avl: "AVL 62" },
  { no: "12967", name: "Jaipur SF Express", dep: "18:20", arr: "06:15", dur: "11h 55m", sl: 390, a3: 1040, a2: 1480, avl: "RAC 11" },
  { no: "20171", name: "Vande Bharat Express", dep: "05:40", arr: "13:10", dur: "7h 30m", sl: 890, a3: 1465, a2: 2650, avl: "AVL 19" },
];

export const DTH_PACKS: Record<string, { name: string; ch: string; val: string; price: number }[]> = {
  "Tata Play": [
    { name: "Hindi Bachat Pack", ch: "185+ Channels", val: "1 Month", price: 249 },
    { name: "Hindi Super Value HD", ch: "260+ HD/SD Channels", val: "1 Month", price: 365 },
    { name: "Family Sports & Kids HD", ch: "310+ Channels (Star/Sony HD)", val: "1 Month", price: 485 },
  ],
  "Airtel Digital TV": [
    { name: "Hindi Value Lite SD", ch: "170+ Channels", val: "1 Month", price: 259 },
    { name: "All-in-One Entertainment HD", ch: "250+ HD Channels", val: "1 Month", price: 379 },
    { name: "Ultimate Sports HD Pack", ch: "295+ Channels", val: "1 Month", price: 499 },
  ],
  "Dish TV": [
    { name: "Classic Joy Hindi", ch: "190+ Channels", val: "1 Month", price: 229 },
    { name: "Titanium HD Family", ch: "275+ Channels", val: "1 Month", price: 349 },
  ],
  "Sun Direct": [
    { name: "Cinema + Sports Value", ch: "210+ Channels", val: "1 Month", price: 235 },
    { name: "Mega HD Bouquet", ch: "280+ HD Channels", val: "1 Month", price: 390 },
  ],
};

export const INITIAL_CONTACTS = [
  ["Rahul Sharma", "+91 98765 43210", "rahul@ekapp"],
  ["Priya Verma", "+91 91234 56780", "priya@ekapp"],
  ["Mom", "+91 99887 76655", "mom@sbi"],
  ["Vikram Singh", "+91 98111 22334", "vikram@hdfc"],
  ["Neha Kapoor", "+91 90909 80808", "neha@icici"],
  ["Zomato Merchant", "Verified Merchant", "zomato@ekpay"],
];

export const ST = [
  ["RELIANCE", "Reliance Industries", 2945.3, 1.2],
  ["TCS", "Tata Consultancy Services", 4120.5, -0.4],
  ["HDFCBANK", "HDFC Bank", 1688.9, 0.8],
  ["INFY", "Infosys", 1842.2, -1.1],
  ["ITC", "ITC Ltd", 468.75, 0.5],
  ["SBIN", "State Bank of India", 812.4, 1.9],
  ["TATAMOTORS", "Tata Motors", 1012.6, 2.3],
  ["ZOMATO", "Zomato", 265.3, 3.1],
] as const;

export const MF = [
  ["Parag Parikh Flexi Cap", "Flexi Cap • Direct", 22.4, 1000],
  ["Nippon India Small Cap", "Small Cap • Direct", 31.8, 500],
  ["SBI Bluechip Fund", "Large Cap • Direct", 15.2, 500],
  ["HDFC Mid-Cap Opportunities", "Mid Cap • Direct", 26.1, 500],
] as const;

export const CATALOG: Record<string, [string, string, string, number][]> = {
  insurance: [
    ["EkCare Health Floater", "₹10L Family Cover • 100% Cashless", "₹612/mo", 612],
    ["Term Life Shield", "₹1 Crore Cover till age 60", "₹749/mo", 749],
    ["Zero-Dep Bike Cover", "Instant Policy in 2 mins", "₹1,150/yr", 1150],
    ["Comprehensive Car Cover", "24x7 Roadside Assistance", "₹4,420/yr", 4420],
  ],
  fd: [
    ["Unity SFB High-Yield FD", "1 Year Lock-in • DICGC Insured", "9.00% p.a.", 5000],
    ["Shriram Finance FD", "3 Years • Monthly Payout", "8.85% p.a.", 5000],
    ["Bajaj Finance Digital FD", "2 Years • AAA Rated", "7.80% p.a.", 5000],
    ["SBI Tax Saver FD", "5 Years • Sec 80C Benefit", "6.80% p.a.", 5000],
  ],
  ipo: [
    ["Nova Solar Energy IPO", "Lot: 27 shares • ₹520–548", "Bid ₹14,796", 14796],
    ["FinEdge Tech IPO", "Lot: 67 shares • ₹210–222", "Bid ₹14,874", 14874],
    ["BharatMed Labs IPO", "Lot: 30 shares • Opens Tomorrow", "Pre-Apply ₹12,500", 12500],
  ],
  nps: [
    ["NPS Tier-1 Retirement", "Extra ₹50,000 Tax Saving u/s 80CCD", "12.4% avg", 1000],
    ["Public Provident Fund (PPF)", "Tax-Free Sovereign Guarantee", "7.1% p.a.", 500],
    ["Atal Pension Yojana", "₹5,000/mo Guaranteed Pension", "₹210/mo", 210],
  ],
};

export const SCREEN_TITLES: Record<string, string> = {
  notif: "Notifications",
  txns: "Passbook & History",
  txn: "Transaction Receipt",
  pay: "Send Money",
  amt: "Enter Amount",
  scan: "EkPay QR Scanner",
  done: "Payment Status",
  invest: "Wealth & Portfolio",
  stocks: "NSE Stocks",
  sip: "Mutual Funds & SIP",
  gold: "24K Digital Gold",
  loans: "Instant Loans & EMI",
  cards: "Credit Cards",
  mobile: "Mobile Prepaid Recharge",
  train: "IRCTC Train Tickets",
  dth: "DTH & Cable TV Recharge",
  electricity: "Electricity Bill Pay",
  fastag: "NHAI FASTag Recharge",
  gas: "Book LPG Gas Cylinder",
  split: "Split Group Bill",
  cibil: "Credit Score (CIBIL)",
  analytics: "Budget & Analytics",
  profile: "My EkPay Profile & QR",
  more: "App & Security Settings",
  autopay: "Subscriptions & Autopay",
  upilite: "UPI Lite (Pin-less)",
  insurance: "Insurance Plans",
  fd: "Fixed Deposits",
  ipo: "IPO Center",
  nps: "Pension & Tax Saver",
  addbank: "Link Bank Account (NPCI)",
  collect: "Collect Money & Requests",
  complaints: "UPI Disputes & Tickets",
  forgotpin: "Reset Forgot UPI PIN",
};

// The 4 Root Bottom Tabs where Back Button should NOT appear
export const ROOT_TABS = new Set(["home", "txns", "invest", "more"]);

export type ThemePref = "light" | "dark" | "system";
export const PREFS_KEY = "ek_prefs";

/** Server ko bheja jaane wala settings payload (PATCH /api/settings). Key order fixed => compare reliable. */
export const settingsPayload = (theme: ThemePref, soundOn: boolean, hideBalance: boolean, intlUpi: boolean, payAlerts: boolean) => ({
  theme, soundOn, hideBalance, intlUpi, payAlerts,
});
