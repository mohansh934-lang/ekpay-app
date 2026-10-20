"use client";

import { useState, useEffect } from "react";
import { useEk } from "@/context/EkContext";

export function LockScreen() {
  const {
    setUnlocked,
    lockPin,
    simMode,
    setSimMode,
    tone,
    handleLockKey,
    apiCall,
    showToast,
  } = useEk();

  const [biometricAvail, setBiometricAvail] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // Check: device me biometric hai? User ne register kiya hai?
  useEffect(() => {
    const check = async () => {
      // Browser supports WebAuthn?
      if (!window.PublicKeyCredential) return;

      // Platform authenticator available? (fingerprint/face)
      try {
        const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvail(avail);
      } catch { return; }

      // User ne biometric register kiya hai?
      try {
        const res = await fetch("/api/auth/webauthn/check");
        if (res.ok) {
          const data = await res.json();
          setBiometricRegistered(data.registered);
        }
      } catch {}
    };
    check();
  }, []);

  // Register biometric (pehli baar)
  const registerBiometric = async () => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Ek App", id: window.location.hostname },
          user: {
            id: new Uint8Array(16).map(() => Math.floor(Math.random() * 256)),
            name: "ekapp-user",
            displayName: "Ek App User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },   // ES256
            { alg: -257, type: "public-key" },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!credential) { setBioLoading(false); return; }

      const credId = btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId)));

      const res = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: credId, publicKey: "platform" }),
      });

      if (res.ok) {
        setBiometricRegistered(true);
        showToast("Biometric registered! ✓");
      }
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") showToast("Biometric setup failed");
    }
    setBioLoading(false);
  };

  // Authenticate with biometric
  const authenticateBiometric = async () => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
        },
      });

      if (assertion) {
        tone(980, 0.15);
        try { navigator?.vibrate?.([50, 30, 50]); } catch {}
        setUnlocked(true);
      }
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") showToast("Biometric verification failed");
    }
    setBioLoading(false);
  };

  return (
    <>
      <div style={{ padding: "48px 20px 20px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--pr)", color: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700, margin: "0 auto 12px" }}>
          E
        </div>
        <b style={{ fontSize: 19 }}>Ek App Locked</b>
        <p className="mu" style={{ marginTop: 4 }}>Enter 4-digit Passcode or Biometric</p>
        <div className="dots" style={{ margin: "24px 0" }}>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i < lockPin.length ? "f" : ""} />
          ))}
        </div>
        <div style={{ margin: "4px 0 8px" }}>
              <select
                value={simMode}
                onChange={(e) => setSimMode(e.target.value as any)}
                style={{ padding: "6px 10px", fontSize: 12, marginTop: 2 }}
              >
                <option value="">⚡ Normal Instant UPI Payment</option>
                <option value="pending">⏳ Simulate: Pending (Settles in 20s)</option>
                <option value="deferred_failed">↩️ Simulate: Pending → Failed + Auto Refund</option>
                <option value="failed">✖ Simulate: Bank Declined (₹0 Debited)</option>
                <option value="bank_down">🚫 Simulate: Remitter Bank Server Down</option>
              </select>
            </div>
            <div className="kp">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
            <button key={k} onClick={() => handleLockKey(k)}>{k}</button>
          ))}
        </div>

        {/* REAL BIOMETRIC UNLOCK — WebAuthn API */}
        {biometricAvail ? (
          biometricRegistered ? (
            <button
              className="btn o"
              style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={authenticateBiometric}
              disabled={bioLoading}
            >
              {bioLoading ? <span className="ptr-spinner" style={{ width: 16, height: 16 }} /> : "🔐"} Unlock with Biometric
            </button>
          ) : (
            <button
              className="btn o"
              style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={registerBiometric}
              disabled={bioLoading}
            >
              {bioLoading ? <span className="ptr-spinner" style={{ width: 16, height: 16 }} /> : "☝️"} Setup Biometric Unlock
            </button>
          )
        ) : (
          <button
            className="btn o"
            style={{ marginTop: 14 }}
            onClick={() => {
              tone(980, 0.15);
              setUnlocked(true);
            }}
          >
            🔓 Instant Unlock (Demo Mode)
          </button>
        )}
      </div>
    </>
  );
}
