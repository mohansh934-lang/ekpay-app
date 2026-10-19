"use client";

import { useEk } from "@/context/EkContext";

export function ForgotpinScreen() {
  const {
    resetPass,
    setResetPass,
    resetNewPin,
    setResetNewPin,
    showToast,
    back,
  } = useEk();

  return (
    <div className="c p">
      <b>🔐 Reset / Forgot UPI PIN</b>
      <p className="mu" style={{ marginTop: 4 }}>
        Verify your EkPay account password to set a new 4 or 6 digit UPI PIN and clear any PIN lockouts.
      </p>
      <small style={{ display: "block", marginTop: 10 }}>Account Password (default: StrongPass123)</small>
      <input
        type="password"
        placeholder="Enter account password"
        value={resetPass}
        onChange={(e) => setResetPass(e.target.value)}
      />
      <small style={{ display: "block", marginTop: 10 }}>New 4 or 6 Digit UPI PIN</small>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Enter new UPI PIN (e.g. 1234)"
        value={resetNewPin}
        onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ""))}
      />
      <button
        className="btn"
        onClick={async () => {
          const r = await fetch("/api/auth/reset-pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: resetPass, newPin: resetNewPin }),
          });
          const d = await r.json();
          if (r.ok) {
            /* setUserPin removed — PIN server pe reset hoti hai */
            setResetPass("");
            setResetNewPin("");
            showToast("UPI PIN Reset Successfully!");
            back();
          } else {
            showToast(d?.error?.message || "Reset failed");
          }
        }}
      >
        Verify & Reset UPI PIN
      </button>
    </div>
  );
}
