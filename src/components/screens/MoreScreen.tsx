"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function MoreScreen() {
  const {
    setUnlocked,
    soundOn,
    setSoundOn,
    intlUpi,
    setIntlUpi,
    complaintsList,
    loadCollectAndComplaints,
    theme,
    setTheme,
    payAlerts,
    setPayAlerts,
    settingsSaved,
    setAuthState,
    me,
    setMe,
    setCurPin,
    setNavHist,
    hideBal,
    setHideBal,
    setNumModal,
    setNumInput,
    showToast,
    go,
    apiCall,
    myName,
    myUpi,
    myPhone,
    initials,
    settingToggle,
  } = useEk();

  return (
    <>
      <div className="c p">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="av" style={{ width: 48, height: 48, background: "#fce7f0", color: "#9d1048", fontSize: 17 }}>
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{myName}</b>
            <small style={{ display: "block" }}>{myUpi} • {myPhone}</small>
          </div>
          <button
            className="chip"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(myUpi);
                showToast("UPI ID copied");
              } catch {
                showToast("Copy nahi ho paya");
              }
            }}
          >
            Copy ID
          </button>
        </div>
        <button className="btn o" style={{ marginTop: 10 }} onClick={() => go("profile")}>
          View Profile & My QR
        </button>
      </div>

      <h3>Security & Privacy</h3>
      <div className="c">
        <button className="row" onClick={() => { loadCollectAndComplaints(); go("complaints"); }}>
          <span className="it"><Icon n="shield" /></span>
          <span className="m">
            <b>UPI Disputes & Complaint Tickets</b>
            <small>Track raised NPCI tickets ({complaintsList.length} total)</small>
          </span>
          <span className="mu">Open →</span>
        </button>
        <button className="row" onClick={() => { setNumInput(""); setCurPin(""); setNumModal("changepin"); }}>
          <span className="it"><Icon n="lock" /></span>
          <span className="m">
            <b>Change UPI PIN</b>
            <small>Update your UPI PIN</small>
          </span>
          <span className="mu">Reset →</span>
        </button>
        {settingToggle("eye", "Balance Privacy Mode", "Mask bank balances on screen", hideBal, () => {
          setHideBal(!hideBal);
          showToast("Privacy Mode " + (!hideBal ? "Enabled" : "Disabled"));
        })}
        {settingToggle("shield", "International UPI", "Pay merchants abroad (UAE, Singapore, France)", intlUpi, () => {
          setIntlUpi(!intlUpi);
          showToast("International UPI " + (!intlUpi ? "Enabled" : "Disabled"));
        })}
        <button
          className="row"
          onClick={async () => {
            await apiCall("POST", "/api/auth/logout");
            settingsSaved.current = null;
            setAuthState("out");
            setUnlocked(false);
            setMe(null);
            setNavHist(["home"]);
          }}
        >
          <span className="it"><Icon n="lock" /></span>
          <span className="m">
            <b>Log out</b>
            <small>{me ? `${me.name} • ${me.phone}` : "Sign out of Ek App"}</small>
          </span>
          <span className="mu">Logout →</span>
        </button>
      </div>

      <h3>Notifications</h3>
      <div className="c">
        {settingToggle("bell", "Payment Alerts", "Banner & sound when a payment happens", payAlerts, () => {
          setPayAlerts(!payAlerts);
          showToast("Payment alerts " + (!payAlerts ? "ON" : "OFF"));
        })}
        <button className="row" onClick={() => go("notif")}>
          <span className="it"><Icon n="bell" /></span>
          <span className="m">
            <b>Notification Inbox</b>
            <small>See all your alerts</small>
          </span>
          <span className="mu">Open →</span>
        </button>
      </div>

      <h3>Appearance & Sound</h3>
      <div className="c p">
        <b>App Theme</b>
        <small style={{ display: "block" }}>Light, Dark, ya phone ki setting follow karo</small>
        <div className="chips">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              className={`chip ${theme === t ? "on" : ""}`}
              onClick={() => {
                setTheme(t);
                showToast("Theme: " + (t === "light" ? "Light" : t === "dark" ? "Dark" : "System"));
              }}
            >
              {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "📱 System"}
            </button>
          ))}
        </div>
      </div>
      <div className="c">
        {settingToggle("vol", "Sound & Tap Feedback", "Play chime on taps and UPI transfers", soundOn, () => {
          setSoundOn(!soundOn);
          showToast("Sound " + (!soundOn ? "ON" : "OFF"));
        })}
      </div>

      <h3>About</h3>
      <div className="c">
        <div className="row">
          <span className="it"><Icon n="gear" /></span>
          <span className="m">
            <b>Ek App v0.1.0</b>
            <small>Demo simulator: koi real bank ya paisa involved nahi hai</small>
          </span>
        </div>
      </div>
    </>
  );
}
