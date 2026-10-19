"use client";

import { useEk } from "@/context/EkContext";

export function ScanScreen() {
  const {
    banks,
    qrMode,
    setQrMode,
    camActive,
    videoRef,
    setPayToIdx,
    setPayAmt,
    stopCamera,
    startCamera,
    go,
    myName,
    myUpi,
  } = useEk();

  return (
    <>
      <div className="chips" style={{ justifyContent: "center", marginBottom: 8 }}>
        <button className={`chip ${qrMode === "scan" ? "on" : ""}`} onClick={() => setQrMode("scan")}>
          📷 Scan Any UPI QR
        </button>
        <button className={`chip ${qrMode === "myqr" ? "on" : ""}`} onClick={() => { stopCamera(); setQrMode("myqr"); }}>
          🔳 My EkPay QR
        </button>
      </div>
      {qrMode === "scan" ? (
        <>
          <div className="scan">
            {camActive && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            <div className="fr"></div>
            <p style={{ position: "absolute", bottom: 16, fontSize: 12, opacity: 0.85 }}>
              {camActive ? "Live Camera Active – Align QR Code" : "Align any BharatQR / UPI QR inside frame"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn o" onClick={() => (camActive ? stopCamera() : startCamera())}>
              {camActive ? "Stop Camera" : "Turn On Camera"}
            </button>
            <button
              className="btn"
              onClick={() => {
                stopCamera();
                setPayToIdx(5);
                setPayAmt("340");
                go("amt");
              }}
            >
              Demo Scan (Zomato)
            </button>
          </div>
        </>
      ) : (
        <div className="c p" style={{ textAlign: "center", padding: 20 }}>
          <b>{myName}</b>
          <p className="mu">{myUpi} • {banks[0][0]}</p>
          <svg viewBox="0 0 120 120" width="170" height="170" style={{ margin: "14px auto", background: "#fff", padding: 10, borderRadius: 12, border: "1px solid var(--ln)" }}>
            <rect x="10" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
            <rect x="80" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
            <rect x="10" y="80" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
            <rect x="20" y="20" width="10" height="10" fill="#e81a6c" />
            <rect x="90" y="20" width="10" height="10" fill="#e81a6c" />
            <rect x="20" y="90" width="10" height="10" fill="#e81a6c" />
            <path d="M50 20h10v20H50zM50 50h20v20H50zM80 50h20v10H80zM50 80h15v25H50zM75 75h30v30H75z" fill="#0f172a" />
          </svg>
          <small>Receive money directly into your primary bank account</small>
        </div>
      )}
    </>
  );
}
