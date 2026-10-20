"use client";

import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { CAT_COLORS } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

export function HomeScreen() {
  const {
    upiLiteBal,
    checkedBalances,
    setCheckedBalances,
    setBalCheckModal,
    setBalSheetOpen,
    heroBalMode,
    setHeroBalMode,
    setHeroSingleBankId,
    setBalPinError,
    collectList,
    loadCollectAndComplaints,
    searchNpciBanks,
    getLiveBanks,
    txns,
    setNumModal,
    tone,
    go,
    tab,
    myUpi,
    catSpends,
    totalSpent,
  } = useEk();

  return (
    <>
      <div className="hero">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 5 }}>
          <small>
            {heroBalMode === "hidden"
              ? "Total balance • " + myUpi
              : Object.keys(checkedBalances).length === getLiveBanks().length && getLiveBanks().length > 0
              ? "Total Verified Balance (All Banks)"
              : Object.keys(checkedBalances).length > 0
              ? `Verified • ${Object.keys(checkedBalances).length} of ${getLiveBanks().length} banks`
              : "Total balance • " + myUpi}
          </small>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tone(660, 0.04);
              if (heroBalMode !== "hidden") {
                setHeroBalMode("hidden");
                setHeroSingleBankId(null);
                setCheckedBalances({}); // teeno banks wapas dots pe
              } else {
                setBalSheetOpen(true);
              }
            }}
            style={{
              padding: "5px 11px",
              borderRadius: 10,
              background: heroBalMode === "hidden" ? "#3ccf91" : "rgba(255,255,255,.22)",
              color: heroBalMode === "hidden" ? "#052e16" : "#fff",
              fontWeight: 600,
              display: "flex",
              gap: 5,
              alignItems: "center",
              fontSize: 11.5,
              cursor: "pointer",
            }}
          >
            <Icon n="eye" s={14} /> {heroBalMode === "hidden" ? "Show Balance" : "Hide Balance"}
          </button>
        </div>
        <h1 style={{ position: "relative", zIndex: 2 }}>
          {heroBalMode === "hidden"
            ? "₹ ••••••"
            : inr(
                getLiveBanks()
                  .filter((b) => checkedBalances[b.id] !== undefined)
                  .reduce((sum, b) => sum + b.balance, 0)
              )}
        </h1>
        <div className="bk" style={{ position: "relative", zIndex: 2 }}>
          {getLiveBanks().map((b) => {
            const isUnlocked = checkedBalances[b.id] !== undefined;
            return (
              <span
                key={b.id}
                onClick={() => {
                  if (isUnlocked) {
                    setHeroSingleBankId(b.id);
                    setHeroBalMode("single");
                  } else {
                    setBalPinError(""); setBalCheckModal({ id: b.id, label: b.label, pin: "" });
                  }
                }}
                style={{
                  cursor: "pointer",
                  border: isUnlocked ? "1px solid rgba(255,255,255,0.55)" : "1px solid transparent",
                }}
              >
                {b.label} · {isUnlocked ? inr(b.balance) : "₹ ••••"}
              </span>
            );
          })}
          <span style={{ background: "rgba(60, 207, 145, 0.22)", color: "#6ee7b7", cursor: "pointer" }} onClick={() => go("upilite")}>
            ⚡ UPI Lite: {inr(upiLiteBal)}
          </span>
        </div>
      </div>
      <div className="qa">
        <button onClick={() => go("pay")}><span className="it"><Icon n="up" /></span>To Contact</button>
        <button onClick={() => setNumModal("self")}><span className="it"><Icon n="bank" /></span>Self Transfer</button>
        <button onClick={() => { searchNpciBanks(""); go("addbank"); }}><span className="it"><Icon n="plus" /></span>Link Bank</button>
        <button onClick={() => { loadCollectAndComplaints(); go("collect"); }}>
          <span className="it"><Icon n="user" /></span>
          Collect Money{collectList.incoming.filter((x) => x.status === "pending").length > 0 ? ` (${collectList.incoming.filter((x) => x.status === "pending").length})` : ""}
        </button>
      </div>
      <h3>Credit, Loans & Protection</h3>
      <div className="qa sq">
        <button onClick={() => go("loans")}><span className="it"><Icon n="rup" /></span>Cash Loan</button>
        <button onClick={() => go("cibil")}><span className="it"><Icon n="trend" /></span>Check CIBIL</button>
        <button onClick={() => go("cards")}><span className="it"><Icon n="card" /></span>Credit Cards</button>
        <button onClick={() => go("cat:insurance")}><span className="it"><Icon n="shield" /></span>Insurance</button>
      </div>

      <h3>Recharge & Utility Bills</h3>
      <div className="qa sq" style={{ rowGap: 12 }}>
        {[
          ["Mobile", "phone", "bill:mobile"],
          ["Electricity", "bulb", "bill:electricity"],
          ["FASTag", "car", "bill:fastag"],
          ["DTH / TV", "tv", "bill:dth"],
          ["LPG Gas", "flame", "bill:gas"],
          ["Train IRCTC", "train", "bill:train"],
          ["Split Bill", "user", "split"],
          ["Autopay", "rec", "autopay"],
        ].map(([lbl, icn, rt]) => (
          <button key={lbl} onClick={() => go(rt)}>
            <span className="it"><Icon n={icn} /></span>
            {lbl}
          </button>
        ))}
      </div>

      <h3>October spendings <button onClick={() => go("analytics")}>Budget tracker</button></h3>
      <div className="c p">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <b style={{ fontSize: 19 }}>{inr(totalSpent)}</b>
          <small>by category on EkPay UPI</small>
        </div>
        <div className="sbar">
          {Object.keys(catSpends).map((cat) => (
            <i key={cat} style={{ width: `${(catSpends[cat] / totalSpent) * 100}%`, background: CAT_COLORS[cat] || "var(--pr)" }} />
          ))}
        </div>
        {Object.keys(catSpends).map((cat) => (
          <div key={cat} className="row" style={{ padding: "5px 0", border: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[cat] || "var(--pr)" }} />
            <span className="m">{cat}</span>
            <b>{inr(catSpends[cat])}</b>
            <small style={{ width: 34, textAlign: "right" }}>{Math.round((catSpends[cat] / totalSpent) * 100)}%</small>
          </div>
        ))}
      </div>

      <div className="car">
        <div style={{ background: "#fce7f0", color: "#83103e" }}>
          <b>Jio & Airtel True 5G Packs</b>
          <small>Zero convenience fee on mobile recharges</small>
          <button onClick={() => go("bill:mobile")}>Recharge Now</button>
        </div>
        <div style={{ background: "#ecfdf5", color: "#064e3b" }}>
          <b>IRCTC Authorized Partner</b>
          <small>Instant PNR & Confirmed Sleeper/3A tickets</small>
          <button onClick={() => go("bill:train")}>Search Trains</button>
        </div>
        <div style={{ background: "#fff7ed", color: "#7c2d12" }}>
          <b>Check Free CIBIL Report</b>
          <small>Instant speedometer credit health check</small>
          <button onClick={() => go("cibil")}>Check CIBIL</button>
        </div>
      </div>

      <h3>Recent transactions <button onClick={() => tab("txns")}>Passbook</button></h3>
      <div className="c">
        {txns.slice(0, 5).map((t, idx) => (
          <button key={t.id + "_" + idx} className="row" onClick={() => go(`txn:${idx}`)}>
            <BrandLogo brand={t.n} />
            <span className="m">
              <b>{t.n}</b>
              <small>{t.mode || "EkPay UPI"} • {t.d}</small>
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
