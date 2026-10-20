import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { one } from "@/server/db";

// Check karo ki is user ka biometric registered hai ya nahi
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const row = one<{ credential_id: string }>(
      `SELECT credential_id FROM webauthn_credentials WHERE user_id = ?`,
      user.id
    );
    return NextResponse.json({ registered: !!row, credentialId: row?.credential_id || null });
  } catch (e: any) {
    if (e?.statusCode === 401) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: e.message } }, { status: 401 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Kuch gadbad hui" } }, { status: 500 });
  }
}

