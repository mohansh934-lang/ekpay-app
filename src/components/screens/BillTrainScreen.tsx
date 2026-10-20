"use client";

import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

type Train = {
  no: string; name: string; dep: string; arr: string; dur: string;
  sl: number | null; a3: number | null; a2: number | null; avl: string | null;
};
type Station = { code: string; name: string; state: string };

const today = () => new Date().toISOString().slice(0, 10);

function StationPicker({ label, code, onPick, align }: { label: string; code: string; onPick: (code: string) => void; align: "left" | "right" }) {
  const { apiCall } = useEk();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Station[]>([]);
  const [shown, setShown] = useState(code);
  const seq = useRef(0);

  useEffect(() => { if (!open) setShown(code); }, [code, open]);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      const r = await apiCall("GET", `/api/stations?q=${encodeURIComponent(q)}`);
      if (id !== seq.current) return;
      setList(r.ok ? (r.data.stations as Station[]) : []);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  return (
    <div style={{ position: "relative" }}>
      <small>{label}</small>
      <input
        value={open ? q : shown}
        placeholder="Station / code likho"
        onFocus={() => { setOpen(true); setQ(""); }}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && list.length > 0 && (
        <div
          style={{
            position: "absolute", ...(align === "left" ? { left: 0 } : { right: 0 }), top: "100%", marginTop: 6, zIndex: 30,
            width: 270, maxWidth: "88vw", maxHeight: 280, overflowY: "auto",
            background: "var(--cd)", border: "1px solid var(--ln)", borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,.28)", padding: "4px 0",
          }}
        >
          {list.map((s, i) => (
            <button
              key={s.code}
              type="button"
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                padding: "12px 14px", borderTop: i ? "1px solid var(--ln)" : 0,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(s.code);
                setShown(`${s.code} - ${s.name}`);
                setOpen(false);
              }}
            >
              <b
                style={{
                  flex: "none", minWidth: 46, textAlign: "center", padding: "5px 8px", borderRadius: 8,
                  background: "var(--bg)", color: "var(--pr)", fontSize: 12.5,
                }}
              >
                {s.code}
              </b>
              <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                <b style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{s.name}</b>
                <small style={{ display: "block", marginTop: 2 }}>{s.state}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BillTrainScreen() {
  const {
    trFrom, setTrFrom, trTo, setTrTo, trDate, setTrDate, trClass, setTrClass,
    trPassenger, setTrPassenger, triggerCheckout, apiCall,
  } = useEk();

  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState<{ demo: boolean; source: string } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!trDate || trDate < today()) setTrDate(today());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route/date badla to purane results hata do (search button se naya search hoga)
  useEffect(() => {
    seq.current++;
    setTrains([]); setMeta(null); setErr(""); setLoading(false);
  }, [trFrom, trTo, trDate]);

  const search = async () => {
    if (trFrom === trTo) { setErr("From & To station alag chuno"); return; }
    if (!trDate || trDate < today()) { setErr("Aaj ya aage ki date chuno"); return; }
    const id = ++seq.current;
    setLoading(true); setErr(""); setTrains([]); setMeta(null);
    const r = await apiCall("GET", `/api/trains?from=${trFrom}&to=${trTo}&date=${trDate}`);
    if (id !== seq.current) return;
    setLoading(false);
    if (!r.ok) { setErr(r.message); return; }
    setTrains(r.data.trains as Train[]);
    setMeta({ demo: !!r.data.demo, source: String(r.data.source || "") });
  };

  return (
    <>
      <div className="c p">
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <BrandLogo brand="IRCTC" size={40} />
          <div>
            <b>Train Search</b>
            <small style={{ display: "block" }}>Trains between stations</small>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
          <StationPicker label="From Station" code={trFrom} onPick={setTrFrom} align="left" />
          <button
            className="ib"
            style={{ marginTop: 18, background: "var(--bg)" }}
            onClick={() => { const tmp = trFrom; setTrFrom(trTo); setTrTo(tmp); }}
          >
            ⇄
          </button>
          <StationPicker label="To Station" code={trTo} onPick={setTrTo} align="right" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div>
            <small>Journey Date</small>
            <input type="date" min={today()} value={trDate} onChange={(e) => setTrDate(e.target.value)} />
          </div>
          <div>
            <small>Passenger</small>
            <input value={trPassenger} onChange={(e) => setTrPassenger(e.target.value)} placeholder="Full Name" />
          </div>
        </div>

        <small style={{ display: "block", marginTop: 10 }}>Select Coach Class</small>
        <div className="chips">
          {[["sl", "SL (Sleeper)"], ["a3", "3A (AC 3 Tier)"], ["a2", "2A (AC 2 Tier)"]].map(([k, lbl]) => (
            <button key={k} className={`chip ${trClass === k ? "on" : ""}`} onClick={() => setTrClass(k as "sl" | "a3" | "a2")}>
              {lbl}
            </button>
          ))}
        </div>

        <button className="btn" style={{ marginTop: 12 }} disabled={loading} onClick={search}>
          {loading ? "Searching…" : "🔍 Search Trains"}
        </button>
      </div>

      {err && <p style={{ color: "var(--rd)", padding: "10px 4px" }}>{err}</p>}

      {meta && (
        <>
          <h3>
            Trains ({trFrom} → {trTo})
            {meta.demo && <small style={{ fontWeight: 500 }}>demo</small>}
          </h3>
          {!meta.demo && (
            <small className="mu" style={{ display: "block", margin: "0 4px 8px" }}>
              Fare / seat availability IRCTC app pe dekho.
            </small>
          )}
          {trains.length === 0 && <p className="mu" style={{ padding: 12 }}>Is route/date pe koi train nahi mili.</p>}
          <div className="c">
            {trains.map((tr) => {
              const fare = tr[trClass];
              return (
                <div key={tr.no + tr.dep} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>#{tr.no} {tr.name}</b>
                    {tr.avl && <b className="cr">{tr.avl}</b>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mu)" }}>
                    <span>{tr.dep} ({trFrom}) ── {tr.dur} ── {tr.arr} ({trTo})</span>
                    <b style={{ color: "var(--tx)", fontSize: 14 }}>{fare != null ? inr(fare) : "Fare N/A"}</b>
                  </div>
                  <button
                    className="btn"
                    style={{ marginTop: 4, padding: "9px", opacity: fare == null ? 0.5 : 1 }}
                    disabled={fare == null}
                    onClick={() => {
                      if (fare == null) return;
                      triggerCheckout(
                        `IRCTC #${tr.no} (${trFrom}-${trTo})`,
                        fare,
                        `${trClass.toUpperCase()} • ${trPassenger} • ${trDate}`
                      );
                    }}
                  >
                    {fare != null ? `Book ${trClass.toUpperCase()} Ticket (${inr(fare)})` : "Fare available nahi"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
