"use client";

import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { IRCTC_TRAINS, STATIONS } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function BillTrainScreen() {
  const {
    trFrom,
    setTrFrom,
    trTo,
    setTrTo,
    trDate,
    setTrDate,
    trClass,
    setTrClass,
    trPassenger,
    setTrPassenger,
    showToast,
    triggerCheckout,
  } = useEk();

  return (
    <>
      <div className="c p">
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <BrandLogo brand="IRCTC" size={40} />
          <div>
            <b>IRCTC Authorized Train Booking</b>
            <small style={{ display: "block" }}>Instant PNR & Confirmed Berths</small>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
          <div>
            <small>From Station</small>
            <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)}>
              {STATIONS.map(([code, name]) => (
                <option key={code} value={code}>{code} - {name}</option>
              ))}
            </select>
          </div>
          <button
            className="ib"
            style={{ marginTop: 18, background: "var(--bg)" }}
            onClick={() => {
              const tmp = trFrom;
              setTrFrom(trTo);
              setTrTo(tmp);
            }}
          >
            ⇄
          </button>
          <div>
            <small>To Station</small>
            <select value={trTo} onChange={(e) => setTrTo(e.target.value)}>
              {STATIONS.map(([code, name]) => (
                <option key={code} value={code}>{code} - {name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div>
            <small>Journey Date</small>
            <input type="date" value={trDate} onChange={(e) => setTrDate(e.target.value)} />
          </div>
          <div>
            <small>Passenger</small>
            <input value={trPassenger} onChange={(e) => setTrPassenger(e.target.value)} placeholder="Full Name" />
          </div>
        </div>

        <small style={{ display: "block", marginTop: 10 }}>Select Coach Class</small>
        <div className="chips">
          {[
            ["sl", "SL (Sleeper)"],
            ["a3", "3A (AC 3 Tier)"],
            ["a2", "2A (AC 2 Tier)"],
          ].map(([k, lbl]) => (
            <button key={k} className={`chip ${trClass === k ? "on" : ""}`} onClick={() => setTrClass(k as any)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <h3>Available Trains ({trFrom} → {trTo})</h3>
      <div className="c">
        {IRCTC_TRAINS.map((tr) => {
          const fare = tr[trClass];
          return (
            <div key={tr.no} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>#{tr.no} {tr.name}</b>
                <b className="cr">{tr.avl}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mu)" }}>
                <span>{tr.dep} ({trFrom}) ── {tr.dur} ── {tr.arr} ({trTo})</span>
                <b style={{ color: "var(--tx)", fontSize: 14 }}>{inr(fare)}</b>
              </div>
              <button
                className="btn"
                style={{ marginTop: 4, padding: "9px" }}
                onClick={() => {
                  if (trFrom === trTo) return showToast("From & To station alag chuno");
                  triggerCheckout(
                    `IRCTC #${tr.no} (${trFrom}-${trTo})`,
                    fare,
                    `${trClass.toUpperCase()} • ${trPassenger} • ${trDate}`
                  );
                }}
              >
                Book {trClass.toUpperCase()} Ticket ({inr(fare)})
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
