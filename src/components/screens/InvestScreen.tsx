"use client";

import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { Sparkline } from "@/components/Sparkline";
import { ST } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function InvestScreen() {
  const {
    holdings,
    goldGrams,
    hideBal,
    go,
    stockVal,
    portfolioTotal,
  } = useEk();

  return (
    <>
      <div className="hero">
        <small>Total Wealth Portfolio</small>
        <h1>{hideBal ? "₹ ••••••" : inr(portfolioTotal)}</h1>
        <small style={{ color: "#6ee7b7" }}>
          ▲ Stocks {inr(stockVal)} • 24K Gold {goldGrams.toFixed(2)}g
        </small>
        <div style={{ marginTop: 10 }}>
          <Sparkline seed="PORTFOLIO" up={true} w={300} h={50} big />
        </div>
      </div>

      <h3>Investment Products</h3>
      <div className="qa sq" style={{ gridTemplateColumns: "repeat(3, 1fr)", rowGap: 12 }}>
        <button onClick={() => go("stocks")}><span className="it"><Icon n="trend" /></span>NSE Stocks</button>
        <button onClick={() => go("sip")}><span className="it"><Icon n="pie" /></span>Mutual Funds</button>
        <button onClick={() => go("gold")}><span className="it"><Icon n="rup" /></span>24K Gold</button>
        <button onClick={() => go("cat:fd")}><span className="it"><Icon n="tag" /></span>9% Fixed FD</button>
        <button onClick={() => go("cat:ipo")}><span className="it"><Icon n="rocket" /></span>Live IPOs</button>
        <button onClick={() => go("cat:nps")}><span className="it"><Icon n="bank" /></span>NPS & PPF</button>
      </div>

      <h3>Market Indices</h3>
      <div className="c">
        {[
          ["NIFTY 50", "24,812", "+0.6%", true],
          ["SENSEX", "81,340", "+0.5%", true],
          ["BANK NIFTY", "53,120", "−0.2%", false],
        ].map(([idxName, val, chg, up]) => (
          <div key={String(idxName)} className="row">
            <b className="m">{idxName}</b>
            <Sparkline seed={String(idxName)} up={Boolean(up)} w={70} h={24} />
            <span className="r" style={{ minWidth: 80 }}>
              {val}
              <br />
              <small className={up ? "cr" : "dr"}>{chg}</small>
            </span>
          </div>
        ))}
      </div>

      <h3>Your Demat Holdings <button onClick={() => go("stocks")}>Trade</button></h3>
      <div className="c">
        {Object.entries(holdings).map(([sym, h]) => {
          const st = ST.find((x) => x[0] === sym);
          const price = st ? Number(st[2]) : h.avg;
          return (
            <button key={sym} className="row" onClick={() => go(`stk:${sym}`)}>
              <span className="m">
                <b>{sym} ({h.qty} shares)</b>
                <small>Avg {inr(h.avg)} • LTP {inr(price)}</small>
              </span>
              <Sparkline seed={sym} up={price >= h.avg} w={64} h={24} />
              <span className="r cr">{inr(price * h.qty)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
