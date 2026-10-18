/**
 * Insurance / FD / IPO / NPS offerings. Price SERVER decide karta hai (client ka bheja amount ignore).
 * NOTE: titles aur prices page.tsx ke CATALOG se match hone chahiye. tests/api.test.ts drift check karta hai.
 */
export interface Offering { title: string; pricePaise: number }

export const CATALOG: Record<string, Offering[]> = {
  insurance: [
    { title: "EkCare Health Floater", pricePaise: 612_00 },
    { title: "Term Life Shield", pricePaise: 749_00 },
    { title: "Zero-Dep Bike Cover", pricePaise: 1150_00 },
    { title: "Comprehensive Car Cover", pricePaise: 4420_00 },
  ],
  fd: [
    { title: "Unity SFB High-Yield FD", pricePaise: 5000_00 },
    { title: "Shriram Finance FD", pricePaise: 5000_00 },
    { title: "Bajaj Finance Digital FD", pricePaise: 5000_00 },
    { title: "SBI Tax Saver FD", pricePaise: 5000_00 },
  ],
  ipo: [
    { title: "Nova Solar Energy IPO", pricePaise: 14796_00 },
    { title: "FinEdge Tech IPO", pricePaise: 14874_00 },
    { title: "BharatMed Labs IPO", pricePaise: 12500_00 },
  ],
  nps: [
    { title: "NPS Tier-1 Retirement", pricePaise: 1000_00 },
    { title: "Public Provident Fund (PPF)", pricePaise: 500_00 },
    { title: "Atal Pension Yojana", pricePaise: 210_00 },
  ],
};

export const findOffering = (category: string, title: string) =>
  Object.prototype.hasOwnProperty.call(CATALOG, category)
    ? CATALOG[category].find((o) => o.title === title)
    : undefined;
