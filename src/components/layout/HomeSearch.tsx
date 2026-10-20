"use client";

import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { ST } from "@/lib/constants";
import { useEk } from "@/context/EkContext";

type Svc = { t: string; k: string; ic: string; r: string; tab?: boolean; pre?: "addbank" | "collect" | "mobile" | "upi" };

const SERVICES: Svc[] = [
  { t: "Mobile Recharge", k: "recharge mobile prepaid jio airtel vi bsnl plan", ic: "phone", r: "bill:mobile" },
  { t: "DTH & Cable TV Recharge", k: "dth cable tv tata play dish recharge", ic: "tv", r: "bill:dth" },
  { t: "Electricity Bill", k: "electricity bijli bill light power", ic: "bulb", r: "bill:electricity" },
  { t: "FASTag Recharge", k: "fastag toll nhai vehicle car", ic: "car", r: "bill:fastag" },
  { t: "Book LPG Gas Cylinder", k: "gas lpg cylinder", ic: "flame", r: "bill:gas" },
  { t: "IRCTC Train Tickets", k: "train irctc ticket railway", ic: "train", r: "bill:train" },
  { t: "Send Money to Contact", k: "pay send contact transfer paisa", ic: "up", r: "pay" },
  { t: "Pay to Mobile Number", k: "pay mobile number phone send", ic: "phone", r: "", pre: "mobile" },
  { t: "Pay to UPI ID", k: "pay upi id vpa send", ic: "at", r: "", pre: "upi" },
  { t: "Scan QR", k: "scan qr camera pay", ic: "scan", r: "scan" },
  { t: "Link Bank Account", k: "add link bank account npci", ic: "bank", r: "addbank", pre: "addbank" },
  { t: "Collect Money & Requests", k: "collect request money", ic: "down", r: "collect", pre: "collect" },
  { t: "UPI Disputes & Complaints", k: "complaint dispute ticket problem", ic: "shield", r: "complaints" },
  { t: "Reset UPI PIN", k: "forgot reset change pin upi", ic: "lock", r: "forgotpin" },
  { t: "UPI Lite (Pin-less)", k: "upi lite pinless wallet", ic: "rocket", r: "upilite" },
  { t: "Autopay & Subscriptions", k: "autopay subscription mandate netflix", ic: "rec", r: "autopay" },
  { t: "Budget & Analytics", k: "budget analytics spending tracker kharcha", ic: "pie", r: "analytics" },
  { t: "Split Group Bill", k: "split group bill share", ic: "user", r: "split" },
  { t: "Cash Loan & EMI", k: "loan emi cash", ic: "rup", r: "loans" },
  { t: "Check CIBIL Score", k: "cibil credit score", ic: "trend", r: "cibil" },
  { t: "Credit Cards", k: "credit card", ic: "card", r: "cards" },
  { t: "Insurance", k: "insurance bima health term", ic: "shield", r: "cat:insurance" },
  { t: "Fixed Deposits", k: "fd fixed deposit", ic: "bank", r: "cat:fd" },
  { t: "IPO Center", k: "ipo", ic: "rocket", r: "cat:ipo" },
  { t: "Pension & Tax Saver (NPS)", k: "nps pension tax saver", ic: "shield", r: "cat:nps" },
  { t: "NSE Stocks", k: "stocks share market nse", ic: "trend", r: "stocks" },
  { t: "Mutual Funds & SIP", k: "mutual fund sip", ic: "pie", r: "sip" },
  { t: "24K Digital Gold", k: "gold sona", ic: "tag", r: "gold" },
  { t: "Wealth & Portfolio", k: "wealth portfolio invest", ic: "trend", r: "invest", tab: true },
  { t: "Passbook & History", k: "passbook history transactions statement", ic: "rec", r: "txns", tab: true },
  { t: "Settings & Security", k: "settings security theme dark", ic: "gear", r: "more", tab: true },
  { t: "My Profile & QR", k: "profile qr my upi id", ic: "user", r: "profile" },
  { t: "Notifications", k: "notification alerts bell", ic: "bell", r: "notif" },
];

const digitsOf = (x: unknown) => String(x ?? "").replace(/\D/g, "");

function Head({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.4, color: "var(--mu)", textTransform: "uppercase", margin: "14px 0 2px" }}>
      {children}
    </div>
  );
}

/** Home ka search bar: contacts, services/bills, transactions (naam/UTR/amount) aur stocks search karta hai */
export function HomeSearch() {
  const {
    contacts, txns, go, tab, setPayToIdx, setPayAmt, setNumInput, setNumModal, searchNpciBanks, loadCollectAndComplaints,
  } = useEk();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Search khula ho: bottom nav chhupao (keyboard ke upar tairta nahi) + phone ka back button isko band kare
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("ek-searching");
    (window as any).__ekSearchOpen = true;
    const close = () => { setQ(""); setOpen(false); inputRef.current?.blur(); };
    window.addEventListener("ek-close-search", close);
    return () => {
      root.classList.remove("ek-searching");
      (window as any).__ekSearchOpen = false;
      window.removeEventListener("ek-close-search", close);
    };
  }, [open]);

  const tokens = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const hit = (hay: string) => tokens.every((t) => hay.toLowerCase().includes(t));

  const cList = tokens.length
    ? contacts.map((c, i) => ({ c, i })).filter(({ c }) => hit(`${c[0]} ${c[1]} ${c[2]} ${digitsOf(c[1])}`)).slice(0, 4)
    : [];
  const sList = (tokens.length ? SERVICES.filter((s) => hit(`${s.t} ${s.k}`)) : SERVICES.slice(0, 8)).slice(0, 7);
  const tList = tokens.length
    ? txns
        .map((t: any, i: number) => ({ t, i }))
        .filter(({ t }: any) => hit(`${t.n} ${t.cat} ${t.bank} ${t.ref ?? ""} ${t.mode ?? ""} ${t.amt}`))
        .slice(0, 6)
    : [];
  const kList = tokens.length ? ST.filter((s) => hit(`${s[0]} ${s[1]}`)).slice(0, 3) : [];
  const nothing = tokens.length > 0 && !cList.length && !sList.length && !tList.length && !kList.length;

  const finish = () => {
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };
  const openContact = (i: number) => { finish(); setPayToIdx(i); setPayAmt(""); go("chat"); };
  const openTxn = (i: number) => { finish(); go(`txn:${i}`); };
  const openStock = (sym: string) => { finish(); go(`stk:${sym}`); };
  const openSvc = (s: Svc) => {
    finish();
    if (s.pre === "mobile" || s.pre === "upi") { setNumInput(""); setNumModal(s.pre); return; }
    if (s.pre === "addbank") searchNpciBanks("");
    if (s.pre === "collect") loadCollectAndComplaints();
    if (s.tab) tab(s.r); else go(s.r);
  };

  const first = cList[0]
    ? () => openContact(cList[0].i)
    : sList[0] && tokens.length
    ? () => openSvc(sList[0])
    : tList[0]
    ? () => openTxn(tList[0].i)
    : kList[0]
    ? () => openStock(String(kList[0][0]))
    : null;

  return (
    <>
      <label className="sb2 live">
        <Icon n="search" s={18} />
        <input
          ref={inputRef}
          type="text"
          value={q}
          placeholder="Search contacts, bills & UTR"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && first) first(); }}
          style={{ flex: 1, minWidth: 0, width: "auto", border: 0, background: "transparent", outline: "none", boxShadow: "none", margin: 0, padding: 0, fontSize: 14, fontWeight: 400, color: "var(--tx)" }}
        />
        {open || q ? (
          <button type="button" aria-label="Clear search" onClick={finish} style={{ fontSize: 12, lineHeight: 1, padding: "6px 0 6px 4px", color: "var(--mu)" }}>
            ✕
          </button>
        ) : null}
      </label>

      {open ? (
        <div className="srp" onTouchMove={() => inputRef.current?.blur()}>
          {nothing ? (
            <p className="mu" style={{ textAlign: "center", marginTop: 36 }}>&ldquo;{q.trim()}&rdquo; ke liye kuch nahi mila</p>
          ) : null}

          {cList.length ? <Head>Contacts</Head> : null}
          {cList.map(({ c, i }) => (
            <button key={"c" + i} type="button" className="row" onClick={() => openContact(i)}>
              <span className="av" style={{ background: "#fce7f0", color: "#9d1048" }}>{c[0][0]}</span>
              <span className="m"><b>{c[0]}</b><small>{c[1]} • {c[2]}</small></span>
            </button>
          ))}

          {sList.length ? <Head>{tokens.length ? "Services & Bills" : "Suggestions"}</Head> : null}
          {sList.map((s) => (
            <button key={"s" + s.t} type="button" className="row" onClick={() => openSvc(s)}>
              <span className="it"><Icon n={s.ic} /></span>
              <span className="m"><b>{s.t}</b></span>
            </button>
          ))}

          {tList.length ? <Head>Transactions</Head> : null}
          {tList.map(({ t, i }: any) => (
            <button key={"t" + i} type="button" className="row" onClick={() => openTxn(i)}>
              <BrandLogo brand={t.n} />
              <span className="m"><b>{t.n}</b><small>{t.bank} • {t.cat} • {t.d}</small></span>
              <span className={`r ${t.cr ? "cr" : ""}`}>{t.cr ? "+" : "−"}{inr(t.amt)}</span>
            </button>
          ))}

          {kList.length ? <Head>Stocks</Head> : null}
          {kList.map((s) => (
            <button key={"k" + s[0]} type="button" className="row" onClick={() => openStock(String(s[0]))}>
              <span className="it"><Icon n="trend" /></span>
              <span className="m"><b>{s[0]}</b><small>{s[1]}</small></span>
              <span className="r">{inr(Number(s[2]))}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
