"use client";

import { inr } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { Sparkline } from "@/components/Sparkline";
import { CATALOG, ST } from "@/lib/constants";
import type { EkApp } from "@/hooks/useEkApp";
import { EkProvider } from "@/context/EkContext";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { MoreScreen } from "@/components/screens/MoreScreen";
import { BillMobileScreen } from "@/components/screens/BillMobileScreen";
import { BillTrainScreen } from "@/components/screens/BillTrainScreen";
import { BillDthScreen } from "@/components/screens/BillDthScreen";
import { BillElectricityScreen } from "@/components/screens/BillElectricityScreen";
import { BillFastagScreen } from "@/components/screens/BillFastagScreen";
import { BillGasScreen } from "@/components/screens/BillGasScreen";
import { InvestScreen } from "@/components/screens/InvestScreen";
import { AddbankScreen } from "@/components/screens/AddbankScreen";
import { CollectScreen } from "@/components/screens/CollectScreen";
import { ComplaintsScreen } from "@/components/screens/ComplaintsScreen";
import { ForgotpinScreen } from "@/components/screens/ForgotpinScreen";
import { UpiliteScreen } from "@/components/screens/UpiliteScreen";
import { AutopayScreen } from "@/components/screens/AutopayScreen";
import { NotifScreen } from "@/components/screens/NotifScreen";
import { CatScreen } from "@/components/screens/CatScreen";
import { ScanScreen } from "@/components/screens/ScanScreen";
import { PayScreen } from "@/components/screens/PayScreen";
import { AmtScreen } from "@/components/screens/AmtScreen";
import { DoneScreen } from "@/components/screens/DoneScreen";
import { TxnsScreen } from "@/components/screens/TxnsScreen";
import { StocksScreen } from "@/components/screens/StocksScreen";
import { SipScreen } from "@/components/screens/SipScreen";
import { GoldScreen } from "@/components/screens/GoldScreen";
import { LoansScreen } from "@/components/screens/LoansScreen";
import { CardsScreen } from "@/components/screens/CardsScreen";
import { SplitScreen } from "@/components/screens/SplitScreen";
import { CibilScreen } from "@/components/screens/CibilScreen";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";

export function EkAppView({ app }: { app: EkApp }) {
  const {
    showSplash,
    splashFade,
    unlocked,
    setUnlocked,
    lockPin,
    checkedBalances,
    setCheckedBalances,
    balCheckModal,
    setBalCheckModal,
    balSheetOpen,
    setBalSheetOpen,
    setHeroBalMode,
    setHeroSingleBankId,
    balPinBusy,
    setBalPinBusy,
    balPinError,
    setBalPinError,
    compCat,
    setCompCat,
    compDesc,
    setCompDesc,
    simMode,
    setSimMode,
    loadCollectAndComplaints,
    authState,
    authMode,
    setAuthMode,
    authPhone,
    setAuthPhone,
    authName,
    setAuthName,
    authPass,
    setAuthPass,
    authPin,
    setAuthPin,
    authErr,
    setAuthErr,
    authBusy,
    accountIds,
    payBusy,
    pinErr,
    setPinErr,
    curPin,
    setCurPin,
    payKey,
    pinTask,
    setPinTask,
    view,
    contacts,
    setContacts,
    banks,
    getLiveBanks,
    holdings,
    txns,
    unread,
    banner,
    setBanner,
    toast,
    chartRange,
    setChartRange,
    numModal,
    setNumModal,
    numInput,
    setNumInput,
    selfFrom,
    setSelfFrom,
    selfTo,
    setSelfTo,
    selfAmt,
    setSelfAmt,
    payToIdx,
    setPayToIdx,
    payAmt,
    setPayAmt,
    payBankIdx,
    pinSheet,
    setPinSheet,
    pin,
    tone,
    showToast,
    go,
    back,
    tab,
    newKey,
    apiCall,
    submitAuth,
    act,
    payDone,
    downloadReceipt,
    handlePinKey,
    handleLockKey,
    initials,
    baseView,
    subParam,
    isRootTab,
    headerTitle,
  } = app;

  return (
    <EkProvider app={app}>
      <div id="app">
        {showSplash && (
          <div id="sp" className={splashFade ? "hide" : ""}>
            <div>
              <div className="lg">E</div>
              <b style={{ fontSize: 24, letterSpacing: -0.5 }}>Ek App</b>
              <p style={{ color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 4 }}>
                Sab kuch, ek hi jagah
              </p>
            </div>
          </div>
        )}

        {authState === "loading" ? null : authState === "out" ? (
          <>
            <div id="stb">
              <span>9:41</span>
              <div className="notch"></div>
              <span>5G • 100%</span>
            </div>
            <div style={{ padding: "26px 20px 20px", textAlign: "center", overflowY: "auto", height: "calc(100% - 32px)" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--pr)", color: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700, margin: "0 auto 12px" }}>
                E
              </div>
              <b style={{ fontSize: 19 }}>{authMode === "login" ? "Welcome back" : "Create your Ek account"}</b>
              <p className="mu" style={{ marginTop: 4 }}>
                {authMode === "login" ? "Login karke apna paisa dekho" : "Demo accounts aur data aapko mil jayega"}
              </p>
              <div style={{ textAlign: "left", marginTop: 16 }}>
                {authMode === "register" && (
                  <input placeholder="Full name" maxLength={60} value={authName} onChange={(e) => setAuthName(e.target.value)} />
                )}
                <input
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ""))}
                />
                <input
                  type="password"
                  placeholder={authMode === "login" ? "Password" : "Password (min 8 characters)"}
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                />
                {authMode === "register" && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Set 4-digit UPI PIN"
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ""))}
                  />
                )}
              </div>
              {authErr && <p style={{ color: "var(--rd)", marginTop: 10, fontSize: 12.5 }}>{authErr}</p>}
              <button className="btn" style={{ marginTop: 14 }} disabled={authBusy} onClick={submitAuth}>
                {authBusy ? "Please wait…" : authMode === "login" ? "Login" : "Create account"}
              </button>
              <button
                className="btn o"
                style={{ marginTop: 8 }}
                onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthErr(""); }}
              >
                {authMode === "login" ? "New here? Create account" : "Already have an account? Login"}
              </button>
            </div>
            <div id="hbar"></div>
          </>
        ) : !unlocked ? (
          <>
            <div id="stb">
              <span>9:41</span>
              <div className="notch"></div>
              <span>5G • 100%</span>
            </div>
            <div style={{ padding: "48px 20px 20px", textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--pr)", color: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700, margin: "0 auto 12px" }}>
                E
              </div>
              <b style={{ fontSize: 19 }}>Ek App Locked</b>
              <p className="mu" style={{ marginTop: 4 }}>Enter 4-digit Passcode or Biometric</p>
              <div className="dots" style={{ margin: "24px 0" }}>
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={i < lockPin.length ? "f" : ""}></i>
                ))}
              </div>
              <div style={{ margin: "4px 0 8px" }}>
                    <select
                      value={simMode}
                      onChange={(e) => setSimMode(e.target.value as any)}
                      style={{ padding: "6px 10px", fontSize: 12, marginTop: 2 }}
                    >
                      <option value="">⚡ Normal Instant UPI Payment</option>
                      <option value="pending">⏳ Simulate: Pending (Settles in 20s)</option>
                      <option value="deferred_failed">↩️ Simulate: Pending → Failed + Auto Refund</option>
                      <option value="failed">✖ Simulate: Bank Declined (₹0 Debited)</option>
                      <option value="bank_down">🚫 Simulate: Remitter Bank Server Down</option>
                    </select>
                  </div>
                  <div className="kp">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
                  <button key={k} onClick={() => handleLockKey(k)}>{k}</button>
                ))}
              </div>
              <button
                className="btn o"
                style={{ marginTop: 14 }}
                onClick={() => {
                  tone(980, 0.15);
                  setUnlocked(true);
                }}
              >
                🔓 Instant Biometric Unlock
              </button>
            </div>
            <div id="hbar"></div>
          </>
        ) : (
          <>
            {banner && (
              <div
                onClick={() => { setBanner(null); go("notif"); }}
                style={{
                  position: "absolute", left: 10, right: 10, top: 34, background: "var(--cd)",
                  border: "1px solid var(--ln)", boxShadow: "0 10px 30px rgba(15,23,42,.25)",
                  borderRadius: 15, padding: "10px 12px", display: "flex", gap: 10,
                  alignItems: "center", zIndex: 45, cursor: "pointer"
                }}
              >
                <span className="it"><Icon n="bell" /></span>
                <span className="m"><b>{banner.title}</b><small>{banner.body}</small></span>
                <small>now</small>
              </div>
            )}

            <div id="stb">
              <span>9:41</span>
              <div className="notch"></div>
              <span>5G • 100%</span>
            </div>

            {/* HEADER: NO BACK BUTTON ON THE 4 ROOT TABS, WORKING BACK BUTTON ON ALL INNER SCREENS! */}
            <div id="hd">
              {isRootTab ? (
                <>
                  <span
                    className="av"
                    title="Open My Profile & QR"
                    style={{ background: "#fce7f0", color: "#9d1048", cursor: "pointer", border: "2px solid var(--pr)" }}
                    onClick={() => go("profile")}
                  >
                    {initials}
                  </span>
                  {view === "home" ? (
                    <button className="sb2" onClick={() => tab("txns")}>
                      <Icon n="search" s={15} /> Search contacts, bills & UTR
                    </button>
                  ) : (
                    <span className="g">{headerTitle}</span>
                  )}
                  <button className="ib" onClick={() => go("notif")}>
                    <Icon n="bell" s={19} />
                    {unread > 0 && <b>{unread}</b>}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="ib"
                    onClick={back}
                    style={{ background: "var(--cd)", border: "1px solid var(--ln)" }}
                  >
                    <Icon n="back" s={20} />
                  </button>
                  <span className="g">{headerTitle}</span>
                  <button className="ib" onClick={() => go("notif")}>
                    <Icon n="bell" s={19} />
                    {unread > 0 && <b>{unread}</b>}
                  </button>
                </>
              )}
            </div>

            <div id="mn" className="sl">
              {/* ================= HOME TAB ================= */}
              {baseView === "home" && <HomeScreen />}

              {/* ================= DEDICATED USER PROFILE HUB (WHEN CLICKING TOP-LEFT AM AVATAR!) ================= */}
              {baseView === "profile" && <ProfileScreen />}

              {/* ================= SETTINGS TAB (bottom nav) ================= */}
              {baseView === "more" && <MoreScreen />}

              {/* ================= 1. REAL MOBILE RECHARGE WITH OPERATOR LOGOS ================= */}
              {baseView === "bill" && subParam === "mobile" && <BillMobileScreen />}

              {/* ================= 2. REAL IRCTC TRAIN BOOKING ================= */}
              {baseView === "bill" && subParam === "train" && <BillTrainScreen />}

              {/* ================= 3. REAL DTH / CABLE TV WITH LOGOS ================= */}
              {baseView === "bill" && subParam === "dth" && <BillDthScreen />}

              {/* ================= 4. ELECTRICITY BILL ================= */}
              {baseView === "bill" && subParam === "electricity" && <BillElectricityScreen />}

              {/* ================= 5. FASTAG RECHARGE ================= */}
              {baseView === "bill" && subParam === "fastag" && <BillFastagScreen />}

              {/* ================= 6. LPG GAS BOOKING ================= */}
              {baseView === "bill" && subParam === "gas" && <BillGasScreen />}

              {/* ================= WEALTH TAB ================= */}
              {baseView === "invest" && <InvestScreen />}

              {/* ================= NATIVE SCREEN 1: LINK NEW BANK ACCOUNT (90+ NPCI BANKS) ================= */}
              {baseView === "addbank" && <AddbankScreen />}

              {/* ================= NATIVE SCREEN 2: UPI COLLECT REQUESTS (REQUEST & APPROVE) ================= */}
              {baseView === "collect" && <CollectScreen />}

              {/* ================= NATIVE SCREEN 3: UPI DISPUTES & COMPLAINTS ================= */}
              {baseView === "complaints" && <ComplaintsScreen />}

              {/* ================= NATIVE SCREEN 4: FORGOT / RESET UPI PIN ================= */}
              {baseView === "forgotpin" && <ForgotpinScreen />}

              {baseView === "upilite" && <UpiliteScreen />}

              {/* ================= OTT SUBSCRIPTIONS & AUTOPAY WITH LOGOS (Crunchyroll, Spotify, YT, Netflix!) ================= */}
              {baseView === "autopay" && <AutopayScreen />}

              {baseView === "txn" && subParam !== undefined && (() => {
                const t = txns[Number(subParam)] || txns[0];
                return (
                  <>
                    <div style={{ textAlign: "center", padding: "20px 0 12px" }}>
                      <div style={{ display: "inline-block" }}>
                        <BrandLogo brand={t.n} size={58} />
                      </div>
                      <p style={{ marginTop: 10, fontWeight: 500 }}>{t.cr ? "Received from" : "Paid to"} {t.n}</p>
                      <h1 style={{ fontSize: 34, fontWeight: 600, margin: "4px 0" }} className={t.cr ? "cr" : ""}>
                        {inr(t.amt)}
                      </h1>
                      <p className="cr" style={{ fontWeight: 500 }}>✓ Completed • {t.d}</p>
                    </div>
                    <div className="c">
                      <div className="row"><small className="m">Payment Mode</small><b style={{ fontSize: 13 }}>{t.mode || "EkPay UPI"}</b></div>
                      <div className="row"><small className="m">Bank / Wallet</small><b style={{ fontSize: 13 }}>{t.bank}</b></div>
                      <div className="row"><small className="m">Category</small><b style={{ fontSize: 13 }}>{t.cat}</b></div>
                      <div className="row"><small className="m">UTR / Ref ID</small><b style={{ fontSize: 13 }}>{t.ref}</b></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" onClick={() => downloadReceipt(t)}>📄 Download Receipt</button>
                      <button className="btn o" onClick={() => go("split")}>👥 Split Bill</button>
                    </div>
                    <div className="c p" style={{ marginTop: 12 }}>
                      <b>🛡️ Have an issue with this transaction?</b>
                      <small style={{ display: "block", marginBottom: 8 }}>Raise an official NPCI / EkPay dispute ticket</small>
                      <select value={compCat} onChange={(e) => setCompCat(e.target.value)} style={{ marginBottom: 8 }}>
                        <option value="debited_not_received">Amount debited but not received by payee</option>
                        <option value="failed_but_debited">Transaction failed but money deducted</option>
                        <option value="pending_too_long">Transaction stuck in Pending state</option>
                        <option value="wrong_payee">Sent to wrong UPI ID / account</option>
                        <option value="duplicate_charge">Paid twice (Duplicate charge)</option>
                        <option value="other">Other UPI issue</option>
                      </select>
                      <input
                        placeholder="Describe issue (min 10 chars)..."
                        value={compDesc}
                        onChange={(e) => setCompDesc(e.target.value)}
                      />
                      <button
                        className="btn"
                        onClick={async () => {
                          if (compDesc.trim().length < 10) return showToast("Please write at least 10 characters");
                          const r = await fetch("/api/complaints", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ txnId: t.id, category: compCat, description: compDesc.trim() }),
                          });
                          const d = await r.json();
                          if (r.ok) {
                            setCompDesc("");
                            await loadCollectAndComplaints();
                            showToast(`Ticket Raised: ${d.complaint.ticket}`);
                            go("complaints");
                          } else {
                            showToast(d?.error?.message || "Could not raise complaint");
                          }
                        }}
                      >
                        Raise UPI Dispute Ticket
                      </button>
                    </div>
                  </>
                );
              })()}

              {baseView === "notif" && <NotifScreen />}

              {baseView === "cat" && subParam && CATALOG[subParam] && <CatScreen />}

              {baseView === "stk" && subParam && (() => {
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
              })()}

              {baseView === "scan" && <ScanScreen />}

              {baseView === "pay" && <PayScreen />}

              {baseView === "amt" && <AmtScreen />}

              {baseView === "done" && txns[0] && <DoneScreen />}

              {baseView === "txns" && <TxnsScreen />}

              {baseView === "stocks" && <StocksScreen />}

              {baseView === "sip" && <SipScreen />}

              {baseView === "gold" && <GoldScreen />}

              {baseView === "loans" && <LoansScreen />}

              {baseView === "cards" && <CardsScreen />}

              {baseView === "split" && <SplitScreen />}

              {/* ================= 180-DEGREE SPEEDOMETER CIBIL SCORE SCREEN ================= */}
              {baseView === "cibil" && <CibilScreen />}

              {baseView === "analytics" && <AnalyticsScreen />}
            </div>

            <nav>
              <button className={baseView === "home" ? "on" : ""} onClick={() => tab("home")}><Icon n="home" />Home</button>
              <button className={baseView === "txns" ? "on" : ""} onClick={() => tab("txns")}><Icon n="rec" />Passbook</button>
              <button className="pay" onClick={() => go("scan")}><span><Icon n="scan" /></span>Scan</button>
              <button className={baseView === "invest" ? "on" : ""} onClick={() => tab("invest")}><Icon n="trend" />Wealth</button>
              <button className={baseView === "more" ? "on" : ""} onClick={() => tab("more")}><Icon n="gear" />Settings</button>
            </nav>
            <div id="hbar"></div>
          </>
        )}

        {numModal && (
          <div id="sh">
            <div className="sb">
              {numModal === "self" ? (
                <>
                  <b style={{ fontSize: 16 }}>Self Account Transfer</b>
                  <p className="mu">Instant zero-fee transfer between your own linked banks</p>
                  <small style={{ display: "block", marginTop: 10 }}>From Bank</small>
                  <button className="row" onClick={() => setSelfFrom((selfFrom + 1) % banks.length)}>
                    <b>{banks[selfFrom][0]} ({inr(banks[selfFrom][1])})</b>
                    <small style={{ color: "var(--pr)" }}>Switch</small>
                  </button>
                  <small style={{ display: "block", marginTop: 6 }}>To Bank</small>
                  <button className="row" onClick={() => setSelfTo((selfTo + 1) % banks.length)}>
                    <b>{banks[selfTo][0]} ({inr(banks[selfTo][1])})</b>
                    <small style={{ color: "var(--pr)" }}>Switch</small>
                  </button>
                  <input type="number" value={selfAmt} onChange={(e) => setSelfAmt(e.target.value)} placeholder="Amount" />
                  <button
                    className="btn"
                    onClick={() => {
                      const a = Number(selfAmt);
                      if (selfFrom === selfTo) return showToast("Select different banks");
                      if (!a || banks[selfFrom][1] < a) return showToast("Insufficient balance");
                      act(async () => {
                        const r = await apiCall("POST", "/api/transfers/self", {
                          fromAccountId: accountIds[selfFrom], toAccountId: accountIds[selfTo], amount: a, idempotencyKey: newKey(),
                        });
                        if (!r.ok) return showToast(r.message);
                        await payDone("Self Transfer Complete", `${inr(a)} moved from ${banks[selfFrom][0]} to ${banks[selfTo][0]}`);
                        setNumModal(null);
                      });
                    }}
                  >
                    Transfer Now
                  </button>
                  <button className="btn o" onClick={() => setNumModal(null)}>Cancel</button>
                </>
              ) : numModal === "confirmpin" && pinTask ? (
                <>
                  <b style={{ fontSize: 16 }}>{pinTask.label}</b>
                  <h2 style={{ margin: "6px 0" }}>{inr(pinTask.amount)}</h2>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Enter 4-digit UPI PIN"
                    maxLength={4}
                    value={curPin}
                    onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))}
                  />
                  <button
                    className="btn"
                    onClick={() => {
                      if (curPin.length !== 4) return showToast("Enter 4 digits");
                      act(async () => {
                        const r = await pinTask.run(curPin);
                        setCurPin("");
                        if (!r.ok) return showToast(r.message);
                        setNumModal(null);
                        setPinTask(null);
                      });
                    }}
                  >
                    Confirm
                  </button>
                  <button className="btn o" onClick={() => { setNumModal(null); setPinTask(null); setCurPin(""); }}>Cancel</button>
                </>
              ) : numModal === "changepin" ? (
                <>
                  <b style={{ fontSize: 16 }}>Change 4-Digit UPI PIN</b>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Current UPI PIN"
                    maxLength={4}
                    value={curPin}
                    onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Enter new 4-digit UPI PIN"
                    maxLength={4}
                    value={numInput}
                    onChange={(e) => setNumInput(e.target.value.replace(/\D/g, ""))}
                  />
                  <button
                    className="btn"
                    onClick={async () => {
                      if (curPin.length !== 4 || numInput.length !== 4) return showToast("Enter 4 digits");
                      const r = await apiCall("POST", "/api/auth/change-pin", { currentPin: curPin, newPin: numInput });
                      if (!r.ok) return showToast(r.message);
                      setCurPin("");
                      setNumModal(null);
                      showToast("UPI PIN updated successfully!");
                    }}
                  >
                    Save UPI PIN
                  </button>
                  <button className="btn o" onClick={() => setNumModal(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <b style={{ fontSize: 16 }}>{numModal === "mobile" ? "Pay to Mobile / UPI ID" : "Pay to Bank Account"}</b>
                  <input
                    placeholder={numModal === "mobile" ? "10-digit mobile or name@ekapp" : "Account Number / IFSC"}
                    value={numInput}
                    onChange={(e) => setNumInput(e.target.value)}
                  />
                  <button
                    className="btn"
                    onClick={() => {
                      if (numInput.trim().length < 5) return showToast("Sahi details daalo");
                      const newC = [numInput.trim(), numModal === "mobile" ? "EkPay Verified" : "Bank Transfer", numInput.trim().includes("@") ? numInput.trim() : numInput.trim() + "@ekapp"];
                      setContacts([newC, ...contacts]);
                      setPayToIdx(0);
                      setPayAmt("");
                      setNumModal(null);
                      go("amt");
                    }}
                  >
                    Proceed
                  </button>
                  <button className="btn o" onClick={() => setNumModal(null)}>Cancel</button>
                </>
              )}
            </div>
          </div>
        )}

        {pinSheet && (
          <div id="sh">
            <div className="sb" style={{ textAlign: "center" }}>
              <small>Paying {contacts[payToIdx][0]}</small>
              <h2 style={{ margin: "4px 0" }}>{inr(Number(payAmt))}</h2>
              <small>{banks[payBankIdx][0]} • EkPay Secure UPI</small>
              <div className="dots">
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={i < pin.length ? "f" : ""}></i>
                ))}
              </div>
              {pinErr ? <small style={{ color: "var(--rd)" }}>{pinErr}</small> : <small>{payBusy ? "Verifying…" : "Enter 4-digit EkPay UPI PIN"}</small>}
              <div className="kp">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
                  <button key={k} onClick={() => handlePinKey(k)}>{k}</button>
                ))}
              </div>
              <button className="btn o" onClick={() => { setPinSheet(false); setPinErr(""); payKey.current = ""; }}>Cancel</button>
            </div>
          </div>
        )}

        {/* SHEET 1: CHOOSE WHICH BANK BALANCE TO CHECK (OR TOTAL STEP-BY-STEP) */}
        {balSheetOpen && (
          <div id="sh" onClick={() => setBalSheetOpen(false)}>
            <div className="sb" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b>Select Bank to Check Balance</b>
                <button className="chip" onClick={() => setBalSheetOpen(false)}>Close</button>
              </div>
              <small className="mu" style={{ display: "block", marginBottom: 10 }}>
                Enter separate UPI PIN for the bank you want to view, or verify all banks one-by-one for Total Balance:
              </small>
              <div className="c">
                {getLiveBanks().map((b) => {
                  const isUnlocked = checkedBalances[b.id] !== undefined;
                  return (
                    <div key={b.id} className="row">
                      <span className="it"><Icon n="bank" /></span>
                      <span className="m">
                        <b>{b.label}</b>
                        <small>{isUnlocked ? `Unlocked: ${inr(b.balance)}` : "Balance: ₹ ••••••"}</small>
                      </span>
                      <button
                        className="chip on"
                        onClick={() => {
                          setBalSheetOpen(false);
                          setBalPinError(""); setBalCheckModal({ id: b.id, label: b.label, pin: "" });
                        }}
                      >
                        {isUnlocked ? "✓ Checked (View)" : "Check"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => {
                  const all = getLiveBanks().map((b) => ({ id: b.id, label: b.label }));
                  if (!all.length) return;
                  setBalSheetOpen(false);
                  setBalCheckModal({
                    id: all[0].id,
                    label: all[0].label,
                    pin: "",
                    queue: all.slice(1),
                    step: 1,
                    totalSteps: all.length,
                  });
                }}
              >
                🔐 Check Total Balance (Verify All {getLiveBanks().length} Banks)
              </button>
            </div>
          </div>
        )}

        {/* SHEET 2: UPI PIN ENTRY FOR SINGLE BANK OR SEQUENTIAL ALL-BANKS */}
        {balCheckModal && (
          <div id="sh">
            <div className="sb" style={{ textAlign: "center" }}>
              {balCheckModal.totalSteps ? (
                <span className="chip on" style={{ fontSize: 11, marginBottom: 8, display: "inline-block" }}>
                  Total Balance • Bank {balCheckModal.step} of {balCheckModal.totalSteps}
                </span>
              ) : null}
              <b style={{ display: "block", fontSize: 16 }}>Enter UPI PIN for {balCheckModal.label}</b>
              <p className="mu" style={{ fontSize: 12 }}>
                {balCheckModal.totalSteps
                  ? `Line-by-Line PIN (${balCheckModal.step}/${balCheckModal.totalSteps}): Verify ${balCheckModal.label}`
                  : "Enter 4-digit UPI PIN (default: 1234)"}
              </p>
              {/* Real UPI style 4 PIN boxes */}
              <div
                style={{ display: "flex", justifyContent: "center", gap: 14, margin: "18px 0 14px" }}
                onClick={() => document.getElementById("bal-pin-hidden")?.focus()}
              >
                {[0, 1, 2, 3].map((i) => {
                  const len = (balCheckModal.pin || "").length;
                  const filled = len > i;
                  const active = len === i;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        border: active ? "2px solid var(--pr)" : "2px solid var(--ln)",
                        background: filled ? "var(--pr)" : "var(--card)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        fontWeight: 700,
                        color: "#fff",
                        boxShadow: active ? "0 0 0 4px rgba(232,26,108,.22)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {filled ? "•" : ""}
                    </div>
                  );
                })}
              </div>
              <input
                key={String(balCheckModal.id) + "-" + String(balCheckModal.step || 0)}
                id="bal-pin-hidden"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                autoComplete="off"
                value={balCheckModal.pin || ""}
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setBalPinError("");
                  setBalCheckModal({ ...balCheckModal, pin: onlyDigits });
                }}
                style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
              />
              <div className="kp" style={{ margin: "8px auto 4px", maxWidth: 280 }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) => (
                  <button
                    key={k || "blank"}
                    type="button"
                    disabled={!k}
                    onClick={() => {
                      if (!k) return;
                      if (k === "⌫") {
                        setBalCheckModal({ ...balCheckModal, pin: (balCheckModal.pin || "").slice(0, -1) });
                      } else if ((balCheckModal.pin || "").length < 4) {
                        setBalCheckModal({ ...balCheckModal, pin: (balCheckModal.pin || "") + k });
                      }
                    }}
                    style={!k ? { visibility: "hidden" } : undefined}
                  >
                    {k}
                  </button>
                ))}
              </div>
                          {balPinError ? (
                <p style={{ color: "var(--rd, #ef4444)", fontSize: 12.5, margin: "4px 0 10px", fontWeight: 600, textAlign: "center" }}>
                  {balPinError}
                </p>
              ) : (
                <div style={{ height: 22 }} />
              )}
                          <button
                className="btn"
                disabled={balPinBusy}
                onClick={async () => {
                  if (balPinBusy) return;
                  if (!(balCheckModal.pin || "").length) {
                    showToast("Pehle UPI PIN daalo");
                    return;
                  }
                  setBalPinBusy(true);
                  try {
                  const r = await fetch("/api/accounts/balance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bankAccountId: balCheckModal.id, pin: balCheckModal.pin }),
                  });
                  const d = await r.json().catch(() => ({}));
                  const liveBank = getLiveBanks().find((x) => x.id === balCheckModal.id);
                  const okPin = r.ok;

                  if (okPin && liveBank) {
                    const latestBal = typeof d.balance === "number" ? d.balance : liveBank.balance;
                    setCheckedBalances((prev) => ({ ...prev, [balCheckModal.id]: latestBal }));

                    if (balCheckModal.queue && balCheckModal.queue.length > 0) {
                      const [nextBank, ...rest] = balCheckModal.queue;
                      setBalPinError("");
                      setBalPinError("");
                      setBalCheckModal({
                        id: nextBank.id,
                        label: nextBank.label,
                        pin: "",
                        queue: rest,
                        step: (balCheckModal.step || 1) + 1,
                        totalSteps: balCheckModal.totalSteps,
                      });
                    } else if (balCheckModal.totalSteps) {
                      setHeroBalMode("total");
                      setHeroSingleBankId(null);
                      setBalCheckModal(null);
                      setBalPinError("");
                    } else {
                      setHeroSingleBankId(null);
                      setHeroBalMode("total"); // unlocked banks ka sum dikhao
                      setBalCheckModal(null);
                      setBalPinError("");
                    }
                  } else {
                    const errMsg = d?.error?.message || "Wrong UPI PIN";
                    const left = d?.error?.remainingAttempts;
                    setBalPinError(left !== undefined ? `Wrong UPI PIN • ${left} attempts left` : "Wrong UPI PIN");
                    setBalCheckModal({ ...balCheckModal, pin: "" }); // clear PIN boxes
                  }
                  } finally {
                    setBalPinBusy(false);
                  }
                }}
              >
                {balPinBusy
                  ? "Verifying…"
                  : balCheckModal.queue && balCheckModal.queue.length > 0
                  ? `Verify ${balCheckModal.label} & Next Bank →`
                  : "Verify UPI PIN & Show Balance"}
              </button>
              <button className="btn o" onClick={() => { setBalCheckModal(null); setBalPinBusy(false); setBalPinError(""); }}>Cancel</button>
            </div>
          </div>
        )}

        {toast && <div id="toast">{toast}</div>}
      </div>
    </EkProvider>
  );
}
