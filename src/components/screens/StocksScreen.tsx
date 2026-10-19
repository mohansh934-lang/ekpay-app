"use client";

import { inr } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import { ST } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function StocksScreen() {
  const {
    holdings,
    go,
  } = useEk();

  return (
    <>
      <h3>NSE Live Stocks (Tap for Chart & Buy/Sell)</h3>
      <div className="c">
        {ST.map(([sym, name, price, chg]) => (
          <button key={sym} className="row" onClick={() => go(`stk:${sym}`)}>
            <span className="m">
              <b>{sym} <small>({holdings[sym]?.qty || 0} held)</small></b>
              <small>{name}</small>
            </span>
            <Sparkline seed={sym} up={chg > 0} w={65} h={26} />
            <span className="r" style={{ minWidth: 72 }}>
              {inr(price)}
              <br />
              <small className={chg > 0 ? "cr" : "dr"}>{chg > 0 ? "▲" : "▼"} {Math.abs(chg)}%</small>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
