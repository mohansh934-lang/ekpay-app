import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { run } from "@/server/db";

// WebAuthn credential registration — browser ka fingerprint/face sensor link karo
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const { credentialId, publicKey } = await req.json();

    if (!credentialId || !publicKey) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "credentialId aur publicKey required hai" } },
        { status: 400 }
      );
    }

    // Save credential to DB (INSERT OR REPLACE — ek user ke paas ek credential)
    run(
      `INSERT OR REPLACE INTO webauthn_credentials (user_id, credential_id, public_key, created_at) VALUES (?, ?, ?, ?)`,
      user.id, String(credentialId).slice(0, 500), String(publicKey).slice(0, 2000), Date.now()
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.statusCode === 401) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: e.message } }, { status: 401 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Kuch gadbad hui" } }, { status: 500 });
  }
}

