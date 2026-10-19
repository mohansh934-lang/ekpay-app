"use client";

import { inr } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import { ST } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function StkScreen() {
  const {
    banks,
    holdings,
    chartRange,
    setChartRange,
    showToast,
    newKey,
    apiCall,
    act,
    payDone,
    subParam,
  } = useEk();

  const x = ST.find((a) => a[0] === subParam) || ST[0];
  const sym = x[0];
  const price = Number(x[2]);
  const chg = Number(x[3]);
  const up = chg > 0;
  const held = holdings[sym]?.qty || 0;
  return (
    <>
      <small>{x[1]} • NSE</small>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "2px 0" }}>{inr(price)}</h1>
      <b className={up ? "cr" : "dr"}>
        {up ? "▲" : "▼"} {inr((price * Math.abs(chg)) / 100)} ({Math.abs(chg)}%) today
      </b>
      <div style={{ margin: "14px 0 6px" }}>
        <Sparkline seed={sym + chartRange} up={up} w={320} h={120} big />
      </div>
      <div className="chips" style={{ justifyContent: "space-between" }}>
        {["1D", "1W", "1M", "1Y", "5Y"].map((r) => (
          <button key={r} className={`chip ${chartRange === r ? "on" : ""}`} onClick={() => setChartRange(r)}>
            {r}
          </button>
        ))}
      </div>
      <div className="c" style={{ marginTop: 10 }}>
        <div className="row"><small className="m">Your Holdings</small><b>{held} shares ({inr(held * price)})</b></div>
        <div className="row"><small className="m">Day High / Low</small><b>{inr(price * 1.015)} / {inr(price * 0.985)}</b></div>
        <div className="row"><small className="m">52W High / Low</small><b>{inr(price * 1.28)} / {inr(price * 0.74)}</b></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn g"
          onClick={() => {
            if (banks[0][1] < price) return showToast("Balance kam hai");
            act(async () => {
              const r = await apiCall("POST", "/api/trades", { symbol: sym, side: "buy", qty: 1, idempotencyKey: newKey() });
              if (!r.ok) return showToast(r.message);
              await payDone("Order Executed", `Bought 1 ${sym} @ ${inr(r.data.order.price)}`);
              showToast(`Bought 1 ${sym} @ ${inr(r.data.order.price)}`);
            });
          }}
        >
          Buy 1 Share
        </button>
        <button
          className="btn r"
          onClick={() => {
            if (!held) return showToast("Koi share nahi hai bechne ke liye");
            act(async () => {
              const r = await apiCall("POST", "/api/trades", { symbol: sym, side: "sell", qty: 1, idempotencyKey: newKey() });
              if (!r.ok) return showToast(r.message);
              await payDone("Order Executed", `Sold 1 ${sym} @ ${inr(r.data.order.price)}`);
              showToast(`Sold 1 ${sym} @ ${inr(r.data.order.price)}`);
            });
          }}
        >
          Sell 1 Share
        </button>
      </div>
    </>
  );
}
