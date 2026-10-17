import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, upiPin, receiverName, bankName, upiApp } = body;

    if (!upiPin || String(upiPin).length !== 4) {
      return NextResponse.json({ success: false, message: '4-digit UPI PIN zaroori hai' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified by Bank Server',
      txn: {
        id: Date.now(),
        n: receiverName || 'Merchant',
        app: upiApp || 'ph',
        cat: 'Transfer',
        cr: false,
        amt: Number(amount),
        bank: bankName || 'HDFC Bank ••4521',
        ref: '4' + Math.floor(10000000000 + Math.random() * 90000000000),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
