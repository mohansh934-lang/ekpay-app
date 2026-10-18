/**
 * Demo quotes (static). Real feed lagane ke liye sirf getQuote()/listQuotes() badlo,
 * baaki backend ko farak nahi padega: price hamesha SERVER decide karta hai, client nahi.
 */
interface Quote { symbol: string; name: string; pricePaise: number; changePct: number }

const QUOTES: Quote[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", pricePaise: 2945_30, changePct: 1.2 },
  { symbol: "TCS", name: "Tata Consultancy Services", pricePaise: 4120_50, changePct: -0.4 },
  { symbol: "HDFCBANK", name: "HDFC Bank", pricePaise: 1688_90, changePct: 0.8 },
  { symbol: "INFY", name: "Infosys", pricePaise: 1842_20, changePct: -1.1 },
  { symbol: "ITC", name: "ITC Ltd", pricePaise: 468_75, changePct: 0.5 },
  { symbol: "SBIN", name: "State Bank of India", pricePaise: 812_40, changePct: 1.9 },
  { symbol: "TATAMOTORS", name: "Tata Motors", pricePaise: 1012_60, changePct: 2.3 },
  { symbol: "ZOMATO", name: "Zomato", pricePaise: 265_30, changePct: 3.1 },
];

export const listQuotes = () =>
  QUOTES.map((q) => ({ symbol: q.symbol, name: q.name, price: q.pricePaise / 100, changePct: q.changePct }));

export const getQuote = (symbol: string) => QUOTES.find((q) => q.symbol === symbol);
