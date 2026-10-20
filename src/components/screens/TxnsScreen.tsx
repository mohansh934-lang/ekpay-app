"use client";

import { inr } from "@/lib/format";
import { BrandLogo } from "@/components/BrandLogo";
import { useEk } from "@/context/EkContext";

export function TxnsScreen() {
  const {
    txns,
    searchQ,
    setSearchQ,
    filterCat,
    setFilterCat,
    go,
    totalSpent,
    totalReceived,
  } = useEk();

  return (
    <>
      <div className="c p" style={{ display: "flex" }}>
        <div className="m">
          <small>Total Spent (Oct)</small>
          <b style={{ fontSize: 17 }}>{inr(totalSpent)}</b>
        </div>
        <div className="m">
          <small>Total Received</small>
          <b style={{ fontSize: 17 }} className="cr">{inr(totalReceived)}</b>
        </div>
      </div>
      <input
        placeholder="Search by merchant, category or UTR..."
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
      />
      <div className="chips">
        {[
          ["All", "All"],
          ["in", "Received"],
          ["out", "Paid"],
          ["Food", "Food"],
          ["Bills", "Bills"],
          ["Shopping", "Shopping"],
          ["Investment", "Wealth"],
        ].map(([k, lbl]) => (
          <button key={k} className={`chip ${filterCat === k ? "on" : ""}`} onClick={() => setFilterCat(k)}>
            {lbl}
          </button>
        ))}
      </div>
      <div className="c">
        {txns
          .filter(
            (t) =>
              (filterCat === "All" ||
                t.cat === filterCat ||
                (filterCat === "in" && t.cr) ||
                (filterCat === "out" && !t.cr)) &&
              (t.n + t.cat + t.bank).toLowerCase().includes(searchQ.toLowerCase())
          )
          .map((t, idx) => (
            <button key={t.id + "_" + idx} className="row" onClick={() => go(`txn:${txns.indexOf(t)}`)}>
              <BrandLogo brand={t.n} />
              <span className="m">
                <b>{t.n}</b>
                <small>{t.bank} • {t.cat} • {t.d}</small>
              </span>
              <span className={`r ${t.cr ? "cr" : ""}`}>
                {t.cr ? "+" : "−"}{inr(t.amt)}
              </span>
            </button>
          ))}
      </div>
    </>
  );
}
