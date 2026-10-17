import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, side, qty, price } = body;
    return NextResponse.json({
      success: true,
      orderId: 'ORD' + Math.floor(100000 + Math.random() * 900000),
      symbol,
      side,
      qty: Number(qty),
      totalAmount: Number(qty) * Number(price)
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Order failed' }, { status: 500 });
  }
}
