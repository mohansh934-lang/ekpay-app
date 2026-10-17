import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

export async function GET() {
  return NextResponse.json(getDb());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();

    if (body.banks) db.banks = body.banks;
    if (body.holdings) db.holdings = body.holdings;
    if (body.sips) db.sips = body.sips;
    if (typeof body.goldGrams === 'number') db.goldGrams = body.goldGrams;
    if (typeof body.emiPaid === 'number') db.emiPaid = body.emiPaid;
    if (typeof body.cardDue === 'number') db.cardDue = body.cardDue;
    if (typeof body.budget === 'number') db.budget = body.budget;
    if (body.newTxn) {
      db.customTxns = [body.newTxn, ...(db.customTxns || [])];
    }

    saveDb(db);
    return NextResponse.json({ success: true, db });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
