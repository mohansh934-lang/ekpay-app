"use client";

import { inr } from "@/lib/format";
import { MF } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function SipScreen() {
  const {
    banks,
    sipP,
    setSipP,
    sipN,
    setSipN,
    sipR,
    setSipR,
    showToast,
    newKey,
    apiCall,
    act,
    payDone,
  } = useEk();

  return (
    <>
      <div className="c p">
        <b>SIP Return Calculator</b>
        <div className="mu" style={{ marginTop: 8 }}>
          Monthly SIP: <b style={{ float: "right", color: "var(--tx)" }}>{inr(sipP)}</b>
        </div>
        <input type="range" min="500" max="50000" step="500" value={sipP} onChange={(e) => setSipP(+e.target.value)} />
        <div className="mu">
          Duration: <b style={{ float: "right", color: "var(--tx)" }}>{sipN} yrs</b>
        </div>
        <input type="range" min="1" max="30" value={sipN} onChange={(e) => setSipN(+e.target.value)} />
        <div className="mu">
          Expected Return: <b style={{ float: "right", color: "var(--tx)" }}>{sipR}%</b>
        </div>
        <input type="range" min="8" max="20" value={sipR} onChange={(e) => setSipR(+e.target.value)} />
        {(() => {
          const i = sipR / 1200;
          const m = sipN * 12;
          const fv = sipP * ((Math.pow(1 + i, m) - 1) / i) * (1 + i);
          return (
            <div style={{ marginTop: 10 }}>
              <b style={{ fontSize: 22 }}>{inr(fv)}</b>
              <br />
              <small>Invested {inr(sipP * m)} • Est. Gains {inr(fv - sipP * m)}</small>
            </div>
          );
        })()}
      </div>
      <h3>Direct Mutual Funds (0% Commission)</h3>
      <div className="c">
        {MF.map(([name, cat, ret, min]) => (
          <div key={name} className="row">
            <span className="m">
              <b>{name}</b>
              <small>{cat} • 1Y Return {ret}%</small>
            </span>
            <button
              className="chip on"
              onClick={() => {
                if (banks[0][1] < min) return showToast("Balance kam hai");
                act(async () => {
                  const r = await apiCall("POST", "/api/sips", {
                    name, amount: min, dayOfMonth: 5, payFirstInstallment: true, idempotencyKey: newKey(),
                  });
                  if (!r.ok) return showToast(r.message);
                  await payDone("SIP Started", `${inr(min)} debited for ${name}`);
                  showToast(`SIP started: ${inr(min)}/mo`);
                });
              }}
            >
              Start ₹{min}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
