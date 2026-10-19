"use client";

import { useEk } from "@/context/EkContext";

export function LockScreen() {
  const {
    setUnlocked,
    lockPin,
    simMode,
    setSimMode,
    tone,
    handleLockKey,
  } = useEk();

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
            <i key={i} className={i < lockPin.length ? "f" : ""}></i>
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
        <button
          className="btn o"
          style={{ marginTop: 14 }}
          onClick={() => {
            tone(980, 0.15);
            setUnlocked(true);
          }}
        >
          🔓 Instant Biometric Unlock
        </button>
      </div>
    </>
  );
}
