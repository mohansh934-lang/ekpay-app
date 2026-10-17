import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'ek-db.json');

const DEFAULT_DB = {
  banks: [
    ['HDFC Bank ••4521', 48230],
    ['SBI ••7790', 12540],
    ['ICICI Bank ••3306', 8915]
  ],
  holdings: {
    RELIANCE: { qty: 12, avg: 2780 },
    TCS: { qty: 8, avg: 3910 },
    ZOMATO: { qty: 60, avg: 215 }
  },
  sips: [
    { name: 'Parag Parikh Flexi Cap', amt: 2000, day: '5 Nov' },
    { name: 'Nippon India Small Cap', amt: 1000, day: '5 Nov' },
    { name: 'SBI Bluechip', amt: 1000, day: '10 Nov' }
  ],
  goldGrams: 4.5,
  emiPaid: 14,
  cardDue: 18420,
  budget: 25000,
  customTxns: []
};

export function getDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
      return DEFAULT_DB;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return DEFAULT_DB;
  }
}

export function saveDb(data: any) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  return data;
}
