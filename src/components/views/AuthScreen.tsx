"use client";

import { useEk } from "@/context/EkContext";

export function AuthScreen() {
  const {
    authMode,
    setAuthMode,
    authPhone,
    setAuthPhone,
    authName,
    setAuthName,
    authPass,
    setAuthPass,
    authPin,
    setAuthPin,
    authErr,
    setAuthErr,
    authBusy,
    submitAuth,
  } = useEk();

  return (
    <>
      <div style={{ padding: "26px 20px 20px", textAlign: "center", overflowY: "auto", height: "100%" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--pr)", color: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700, margin: "0 auto 12px" }}>
          E
        </div>
        <b style={{ fontSize: 19 }}>{authMode === "login" ? "Welcome back" : "Create your Ek account"}</b>
        <p className="mu" style={{ marginTop: 4 }}>
          {authMode === "login" ? "Login karke apna paisa dekho" : "Demo accounts aur data aapko mil jayega"}
        </p>
        <div style={{ textAlign: "left", marginTop: 16 }}>
          {authMode === "register" && (
            <input placeholder="Full name" maxLength={60} value={authName} onChange={(e) => setAuthName(e.target.value)} />
          )}
          <input
            placeholder="10-digit mobile number"
            inputMode="numeric"
            maxLength={10}
            value={authPhone}
            onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ""))}
          />
          <input
            type="password"
            placeholder={authMode === "login" ? "Password" : "Password (min 8 characters)"}
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
          />
          {authMode === "register" && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Set 4-digit UPI PIN"
              value={authPin}
              onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ""))}
            />
          )}
        </div>
        {authErr && <p style={{ color: "var(--rd)", marginTop: 10, fontSize: 12.5 }}>{authErr}</p>}
        <button className="btn" style={{ marginTop: 14 }} disabled={authBusy} onClick={submitAuth}>
          {authBusy ? "Please wait…" : authMode === "login" ? "Login" : "Create account"}
        </button>
        <button
          className="btn o"
          style={{ marginTop: 8 }}
          onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthErr(""); }}
        >
          {authMode === "login" ? "New here? Create account" : "Already have an account? Login"}
        </button>
      </div>
    </>
  );
}
