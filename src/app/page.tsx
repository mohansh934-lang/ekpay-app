"use client";
import React, { useState, useEffect, useRef } from "react";

import { inr, fmtWhen, mapServerTxn } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { CibilSpeedometer } from "@/components/CibilSpeedometer";
import { Sparkline } from "@/components/Sparkline";
import {
  CAT_COLORS,
  TELECOM_PLANS,
  IRCTC_TRAINS,
  INITIAL_CONTACTS,
  CATALOG,
  SCREEN_TITLES,
  ROOT_TABS,
  PREFS_KEY,
  settingsPayload,
  STATIONS,
  DTH_PACKS,
  ST,
  MF,
  type ThemePref,
} from "@/lib/constants";

export default function EkAppFullStack() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);

  const [unlocked, setUnlocked] = useState(false);
  const [lockPin, setLockPin] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [intlUpi, setIntlUpi] = useState(false);
  const [upiLiteBal, setUpiLiteBal] = useState(420);

  // --- NATIVE SQLITE BACKEND + UPI HUB STATES ---
  const [sessionUser, setSessionUser] = useState<{ name: string; phone: string; upiId: string } | null>(null);

  const [serverBanks, setServerBanks] = useState<{ id: number; label: string; balance: number; isPrimary: boolean }[]>([]);
  const [npciBanks, setNpciBanks] = useState<{ id: string; name: string; category: string; popular: boolean }[]>([]);
  const [bankQuery, setBankQuery] = useState("");
  const [pickedBank, setPickedBank] = useState<{ id: string; name: string } | null>(null);
  const [discoveredAccs, setDiscoveredAccs] = useState<{ last4: string; type: string; maskedNumber: string; ifsc: string }[] | null>(null);
  const [checkedBalances, setCheckedBalances] = useState<Record<number, number>>({});
  const [balCheckModal, setBalCheckModal] = useState<{ id: number; label: string; pin: string; queue?: { id: number; label: string }[]; step?: number; totalSteps?: number } | null>(null);
  const [balSheetOpen, setBalSheetOpen] = useState(false);
  const [heroBalMode, setHeroBalMode] = useState<"hidden" | "single" | "total">("hidden");
  const [heroSingleBankId, setHeroSingleBankId] = useState<number | null>(null);
  const [balPinBusy, setBalPinBusy] = useState(false);
  const [balPinError, setBalPinError] = useState("");

  const [collectVpa, setCollectVpa] = useState("");
  const [collectAmt, setCollectAmt] = useState("");
  const [collectNote, setCollectNote] = useState("");
  const [collectList, setCollectList] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [collectPinMap, setCollectPinMap] = useState<Record<number, string>>({});

  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [compCat, setCompCat] = useState("debited_not_received");
  const [compDesc, setCompDesc] = useState("");

  const [resetPass, setResetPass] = useState("");
  const [resetNewPin, setResetNewPin] = useState("");
  const [simMode, setSimMode] = useState<"" | "pending" | "deferred_failed" | "failed" | "bank_down">("");


  const refreshServerState = async () => {
    try {
      const r = await fetch("/api/state");
      if (!r.ok) return;
      const d = await r.json();
      if (d.user) setSessionUser(d.user);
      if (Array.isArray(d.banks) && d.banks.length) {
        setServerBanks(d.banks);
        setBanks(d.banks.map((b: any) => [b.label, b.balance]));
      }
      if (typeof d.upiLiteBalance === "number") setUpiLiteBal(d.upiLiteBalance);
      if (typeof d.goldGrams === "number") setGoldGrams(d.goldGrams);
      if (typeof d.cardDue === "number") setCardDue(d.cardDue);
      if (typeof d.budget === "number") setBudget(d.budget);
      if (Array.isArray(d.loans) && d.loans[0]) setEmiPaid(d.loans[0].paidEmis);
    } catch {}
  };

  const loadCollectAndComplaints = async () => {
    try {
      const [cRes, cmpRes] = await Promise.all([fetch("/api/collect"), fetch("/api/complaints")]);
      if (cRes.ok) {
        const cd = await cRes.json();
        setCollectList({ incoming: cd.incoming || [], outgoing: cd.outgoing || [] });
      }
      if (cmpRes.ok) {
        const cmpd = await cmpRes.json();
        setComplaintsList(cmpd.complaints || []);
      }
    } catch {}
  };

  const searchNpciBanks = async (q = "") => {
    try {
      const r = await fetch(`/api/banks?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const d = await r.json();
        setNpciBanks(d.banks || []);
      }
    } catch {}
  };

  useEffect(() => {
    refreshServerState();
    loadCollectAndComplaints();
    searchNpciBanks("");
  }, []);

  // ---- Settings (is browser me save hote hain: localStorage "ek_prefs") ----
  const [theme, setTheme] = useState<ThemePref>("light");
  const [payAlerts, setPayAlerts] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);
  // Server pe jo settings last save/load hui (JSON). null = is login me abhi server se load nahi hui.
  const settingsSaved = useRef<string | null>(null);

  // ---- Auth / server connection ----
  const [authState, setAuthState] = useState<"loading" | "out" | "in">("loading");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authPin, setAuthPin] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [me, setMe] = useState<{ name: string; phone: string; upiId: string } | null>(null);
  const [accountIds, setAccountIds] = useState<number[]>([]);
  const [payBusy, setPayBusy] = useState(false);
  const [pinErr, setPinErr] = useState("");
  const [curPin, setCurPin] = useState("");
  const payKey = useRef("");
  const [loanId, setLoanId] = useState<number | null>(null);
  const [pinTask, setPinTask] = useState<null | {
    label: string;
    amount: number;
    run: (pin: string) => Promise<{ ok: boolean; message: string }>;
  }>(null);
  const busyRef = useRef(false);
  const budgetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [navHist, setNavHist] = useState<string[]>(["home"]);
  const view = navHist[navHist.length - 1];

  // Utility States
  const [mobNum, setMobNum] = useState("9876543210");
  const [mobOp, setMobOp] = useState<"Jio" | "Airtel" | "Vi" | "BSNL">("Jio");
  const [mobTab, setMobTab] = useState("All");

  const [trFrom, setTrFrom] = useState("BPL");
  const [trTo, setTrTo] = useState("NGP");
  const [trDate, setTrDate] = useState("2026-10-24");
  const [trClass, setTrClass] = useState<"sl" | "a3" | "a2">("sl");
  const [trPassenger, setTrPassenger] = useState("Mohan Sen");

  const [dthOp, setDthOp] = useState("Tata Play");
  const [dthId, setDthId] = useState("1092837465");

  const [elecBoard, setElecBoard] = useState("MPPKVVCL (Madhya Pradesh)");
  const [elecId, setElecId] = useState("N2488109234");

  const [fastagBank, setFastagBank] = useState("ICICI Bank FASTag");
  const [vehNo, setVehNo] = useState("MP 04 CJ 7721");
  const [fastagAmt, setFastagAmt] = useState(500);

  const [gasOp, setGasOp] = useState("Indane Gas (IndianOil)");
  const [gasId, setGasId] = useState("7000192837465");

  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [banks, setBanks] = useState<[string, number][]>([
    ["HDFC Bank ••4521", 48230],
    ["SBI ••7790", 12540],
    ["ICICI Bank ••3306", 8915],
  ]);

  const getLiveBanks = () =>
    banks.map((b, i) => ({
      id: serverBanks[i]?.id ?? accountIds[i] ?? i + 1,
      label: b[0],
      balance: b[1],
      isPrimary: serverBanks[i]?.isPrimary ?? i === 0,
    }));

  // Jab bhi paisa kharch/receive ho, unlocked banks ka balance live update
  useEffect(() => {
    setCheckedBalances((prev) => {
      const next = { ...prev };
      let changed = false;
      banks.forEach((b, i) => {
        const id = serverBanks[i]?.id ?? accountIds[i] ?? i + 1;
        if (next[id] !== undefined && next[id] !== b[1]) {
          next[id] = b[1];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [banks, serverBanks]);
  const [holdings, setHoldings] = useState<Record<string, { qty: number; avg: number }>>({
    RELIANCE: { qty: 12, avg: 2780 },
    TCS: { qty: 8, avg: 3910 },
    ZOMATO: { qty: 60, avg: 215 },
  });
  const [sips, setSips] = useState([
    { name: "Parag Parikh Flexi Cap", amt: 2000, day: "5 Nov", active: true },
    { name: "Nippon India Small Cap", amt: 1000, day: "5 Nov", active: true },
  ]);

  // Subscriptions & Autopay Mandates with Brand Logos (Crunchyroll, Spotify, YouTube, Netflix!)
  const [mandates, setMandates] = useState([
    { id: "m1", brand: "Crunchyroll", merchant: "Crunchyroll Mega Fan", amt: 99, cycle: "Monthly • 8th", active: true },
    { id: "m2", brand: "Spotify", merchant: "Spotify Premium Individual", amt: 119, cycle: "Monthly • 12th", active: true },
    { id: "m3", brand: "YouTube", merchant: "YouTube Premium", amt: 149, cycle: "Monthly • 18th", active: true },
    { id: "m4", brand: "Netflix", merchant: "Netflix Mobile Plan", amt: 149, cycle: "Monthly • 25th", active: true },
  ]);

  const [goldGrams, setGoldGrams] = useState(4.5);
  const [emiPaid, setEmiPaid] = useState(14);
  const [cardDue, setCardDue] = useState(18420);
  const [budget, setBudget] = useState(25000);

  const [txns, setTxns] = useState<any[]>([
    { id: 101, mode: "EkPay UPI", n: "Swiggy", cat: "Food", cr: false, amt: 385, d: "Today, 2:15 PM", bank: "HDFC Bank ••4521", ref: "420091821901" },
    { id: 102, mode: "NEFT Credit", n: "Salary – TCS", cat: "Income", cr: true, amt: 62000, d: "Yesterday, 10:00 AM", bank: "HDFC Bank ••4521", ref: "420091821902" },
    { id: 103, mode: "UPI Lite", n: "Crunchyroll", cat: "Bills", cr: false, amt: 99, d: "15 Oct, 6:40 PM", bank: "UPI Lite Wallet", ref: "420091821903" },
    { id: 104, mode: "EkPay UPI", n: "Amazon Retail", cat: "Shopping", cr: false, amt: 1299, d: "14 Oct, 1:20 PM", bank: "HDFC Bank ••4521", ref: "420091821904" },
    { id: 105, mode: "BBPS Auto", n: "Airtel Xstream Fiber", cat: "Bills", cr: false, amt: 999, d: "12 Oct, 11:05 AM", bank: "ICICI Bank ••3306", ref: "420091821905" },
    { id: 106, mode: "EkPay UPI", n: "Priya Verma", cat: "Transfer", cr: true, amt: 2500, d: "10 Oct, 4:50 PM", bank: "HDFC Bank ••4521", ref: "420091821906" },
  ]);

  const [notifs, setNotifs] = useState([
    { title: "EkPay UPI Lite Active", body: "Pin-less payments up to ₹500 enabled on your account", time: "2h ago" },
    { title: "Crunchyroll Autopay Active", body: "₹99 monthly mandate verified on your UPI ID", time: "Yesterday" },
    { title: "Electricity Bill Due", body: "MPPKVVCL bill of ₹1,420 due in 3 days", time: "Yesterday" },
  ]);
  const [unread, setUnread] = useState(3);
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(null);

  const [hideBal, setHideBal] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [toast, setToast] = useState("");
  const [chartRange, setChartRange] = useState("1M");

  const [numModal, setNumModal] = useState<null | "mobile" | "bank" | "self" | "changepin" | "confirmpin">(null);
  const [numInput, setNumInput] = useState("");
  const [selfFrom, setSelfFrom] = useState(0);
  const [selfTo, setSelfTo] = useState(1);
  const [selfAmt, setSelfAmt] = useState("2000");

  const [qrMode, setQrMode] = useState<"scan" | "myqr">("scan");
  const [camActive, setCamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [payToIdx, setPayToIdx] = useState(0);
  const [payAmt, setPayAmt] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payBankIdx, setPayBankIdx] = useState(0);
  const [useLite, setUseLite] = useState(false);
  const [pinSheet, setPinSheet] = useState(false);
  const [pin, setPin] = useState("");

  const [sipP, setSipP] = useState(5000);
  const [sipN, setSipN] = useState(10);
  const [sipR, setSipR] = useState(12);
  const [loanP, setLoanP] = useState(500000);
  const [loanN, setLoanN] = useState(60);
  const [loanR] = useState(10.5);
  const [splitAmt, setSplitAmt] = useState(1200);

  // Saved settings load karo (sirf ek baar)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.theme === "light" || p.theme === "dark" || p.theme === "system") setTheme(p.theme);
        if (typeof p.soundOn === "boolean") setSoundOn(p.soundOn);
        if (typeof p.hideBal === "boolean") setHideBal(p.hideBal);
        if (typeof p.intlUpi === "boolean") setIntlUpi(p.intlUpi);
        if (typeof p.payAlerts === "boolean") setPayAlerts(p.payAlerts);
      }
    } catch {
      /* corrupt ya blocked storage: defaults pe chalo */
    }
    setPrefsReady(true);
  }, []);

  // Settings badalte hi save karo (load hone ke baad hi, warna defaults purani settings ko overwrite kar dete)
  useEffect(() => {
    if (!prefsReady) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, soundOn, hideBal, intlUpi, payAlerts }));
    } catch {
      /* storage full/blocked: ignore */
    }
  }, [prefsReady, theme, soundOn, hideBal, intlUpi, payAlerts]);

  // Theme lagao. "System" me phone ki dark/light setting follow hoti hai.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    };
    apply();
    if (theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashFade(true), 1250);
    const t2 = setTimeout(() => setShowSplash(false), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const tone = (f: number, d = 0.08) => {
    if (!soundOn) return;
    try {
      const a = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = f;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + d);
    } catch {}
  };

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };

  const pushNotif = (title: string, body: string) => {
    setNotifs((p) => [{ title, body, time: "Just now" }, ...p]);
    setUnread((u) => u + 1);
    if (!payAlerts) return; // alerts OFF: inbox me aayega, banner/sound nahi
    setBanner({ title, body });
    tone(988, 0.14);
    setTimeout(() => setBanner(null), 3800);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCamActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      showToast("Camera permission denied or unavailable");
    }
  };

  // Reliable Navigation Stack & Back Function!
  const go = (r: string) => {
    stopCamera();
    tone(620, 0.04);
    if (r === "notif") setUnread(0);
    setNavHist((prev) => [...prev, r]);
  };

  const back = () => {
    stopCamera();
    tone(520, 0.04);
    setNavHist((prev) => (prev.length > 1 ? prev.slice(0, -1) : ["home"]));
  };

  const tab = (r: string) => {
    stopCamera();
    tone(620, 0.04);
    setNavHist([r]);
  };

  const newKey = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

  // Har server call yahin se. Session expire hua (401 UNAUTHORIZED) to login screen par bhej deta hai.
  const apiCall = async (method: string, url: string, body?: unknown) => {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data?.error?.code === "UNAUTHORIZED") {
        settingsSaved.current = null;
        setAuthState("out");
        setUnlocked(false);
      }
      return {
        ok: res.ok && data.success !== false,
        status: res.status,
        data,
        code: data?.error?.code as string | undefined,
        message: (data?.error?.message as string) || "Kuch gadbad hui, dobara try karo",
      };
    } catch {
      return { ok: false, status: 0, data: {} as any, code: "NETWORK", message: "Network error, dobara try karo" };
    }
  };

  // Server se poora data laata hai (balances, holdings, transactions...) aur screen update karta hai.
  const loadAll = async () => {
    const st = await apiCall("GET", "/api/state");
    if (!st.ok) {
      settingsSaved.current = null;
      setAuthState("out");
      return false;
    }
    const d = st.data;
    setMe(d.user);
    setAccountIds(d.banks.map((b: any) => b.id));
    setBanks(d.banks.map((b: any) => [b.label, b.balance] as [string, number]));
    setPayBankIdx((i) => (i < d.banks.length ? i : 0));
    // Server wali settings (sirf login ke baad pehli load me; baad ki loads user ke taaza badlav ko overwrite na karein)
    if (d.settings && settingsSaved.current === null) {
      const sv = d.settings;
      setTheme(sv.theme);
      setSoundOn(sv.soundOn);
      setHideBal(sv.hideBalance);
      setIntlUpi(sv.intlUpi);
      setPayAlerts(sv.payAlerts);
      settingsSaved.current = JSON.stringify(
        settingsPayload(sv.theme, sv.soundOn, sv.hideBalance, sv.intlUpi, sv.payAlerts)
      );
    }
    setHoldings(Object.fromEntries(d.holdings.map((h: any) => [h.symbol, { qty: h.qty, avg: h.avgPrice }])));
    setSips(d.sips.map((x: any) => ({ name: x.name, amt: x.amount, day: `${x.dayOfMonth}th`, active: true })));
    setGoldGrams(d.goldGrams);
    setCardDue(d.cardDue);
    setBudget(d.budget);
    setUpiLiteBal(d.upiLiteBalance);
    if (d.loans?.[0]) {
      setEmiPaid(d.loans[0].paidEmis);
      setLoanId(d.loans[0].id);
    }
    const tx = await apiCall("GET", "/api/transactions?limit=50");
    if (tx.ok) setTxns(tx.data.transactions.map(mapServerTxn));
    setAuthState("in");
    setUnlocked(true);
    return true;
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settings badalte hi (thodi der ruk kar) server pe save karo
  useEffect(() => {
    if (authState !== "in" || settingsSaved.current === null) return;
    const payload = settingsPayload(theme, soundOn, hideBal, intlUpi, payAlerts);
    const sig = JSON.stringify(payload);
    if (sig === settingsSaved.current) return;
    const t = setTimeout(async () => {
      const r = await apiCall("PATCH", "/api/settings", payload);
      if (r.ok) settingsSaved.current = sig;
      else showToast("Settings server pe save nahi ho payi");
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, theme, soundOn, hideBal, intlUpi, payAlerts]);

  const submitAuth = async () => {
    if (authBusy) return;
    setAuthErr("");
    if (!/^[6-9]\d{9}$/.test(authPhone)) return setAuthErr("Valid 10-digit mobile number daalo");
    if (authMode === "register") {
      if (authName.trim().length < 2) return setAuthErr("Apna naam daalo");
      if (authPass.length < 8) return setAuthErr("Password kam se kam 8 characters ka hona chahiye");
      if (!/^\d{4}$/.test(authPin)) return setAuthErr("4-digit UPI PIN set karo");
    }
    setAuthBusy(true);
    const r =
      authMode === "login"
        ? await apiCall("POST", "/api/auth/login", { phone: authPhone, password: authPass })
        : await apiCall("POST", "/api/auth/register", {
            phone: authPhone, name: authName.trim(), password: authPass, upiPin: authPin,
          });
    if (!r.ok) {
      setAuthBusy(false);
      return setAuthErr(r.message);
    }
    setAuthPass("");
    setAuthPin("");
    const loaded = await loadAll();
    setAuthBusy(false);
    if (!loaded) return setAuthErr("Data load nahi ho paya, dobara try karo");
    setNavHist(["home"]);
  };

  // Ek time par ek hi server action (double-tap se double payment nahi hoga).
  const act = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await fn();
    } finally {
      busyRef.current = false;
    }
  };

  // Server action ke baad: sab kuch server se dobara load + notification.
  const payDone = async (title: string, body: string) => {
    await loadAll();
    pushNotif(title, body);
  };

  const triggerCheckout = (merchantTitle: string, amountNum: number, noteStr: string) => {
    const newC = [merchantTitle, "Verified Bill/Merchant", merchantTitle.toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) + "@ekpay"];
    setContacts((prev) => [newC, ...prev]);
    setPayToIdx(0);
    setPayAmt(String(amountNum));
    setPayNote(noteStr);
    go("amt");
  };

  const downloadReceipt = (t: any) => {
    const content = [
      "====================================",
      "       EK APP - OFFICIAL RECEIPT    ",
      "====================================",
      `Status          : COMPLETED ✓`,
      `Amount          : ${inr(t.amt)}`,
      `${t.cr ? "Received From" : "Paid To"}   : ${t.n}`,
      `Payment Mode    : ${t.mode || "EkPay UPI"}`,
      `Account         : ${t.bank}`,
      `Category        : ${t.cat}`,
      `UTR / Ref No.   : ${t.ref}`,
      `Date & Time     : ${t.d}`,
      "====================================",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EkApp_Receipt_${t.ref}.txt`;
    a.click();
    showToast("Official receipt downloaded!");
  };

  const handlePinKey = async (k: string) => {
    if (k === "." || payBusy) return;
    tone(680, 0.04);
    setPinErr("");
    const next = k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 4);
    setPin(next);
    if (next.length !== 4) return;

    setPayBusy(true);
    if (!payKey.current) payKey.current = newKey(); // network retry par double-charge nahi hoga
    const a = Number(payAmt);
    const isBill = contacts[payToIdx][1] === "Verified Bill/Merchant";
    const r = await apiCall("POST", "/api/payments", {
      amount: a,
      receiver: contacts[payToIdx][0].slice(0, 80),
      pin: next,
      note: payNote ? payNote.slice(0, 100) : undefined,
      category: isBill ? "Bills" : "Transfer",
      bankAccountId: accountIds[payBankIdx],
      idempotencyKey: payKey.current,
    });
    setPayBusy(false);

    if (!r.ok) {
      tone(300, 0.2);
      setPin("");
      if (r.code === "INVALID_PIN" || r.code === "LOCKED" || r.code === "NETWORK") return setPinErr(r.message);
      setPinSheet(false);
      payKey.current = "";
      return showToast(r.message);
    }
    payKey.current = "";
    await loadAll();
    pushNotif("Payment Successful", `${inr(a)} debited from ${banks[payBankIdx][0]}`);
    setPinSheet(false);
    setPin("");
    setPayAmt("");
    setPayNote("");
    setNavHist(["home", "done"]);
  };

  const handleLockKey = (k: string) => {
    if (k === ".") return;
    tone(700, 0.04);
    const next = k === "⌫" ? lockPin.slice(0, -1) : (lockPin + k).slice(0, 4);
    setLockPin(next);
    if (next.length === 4) {
      tone(980, 0.15);
      setTimeout(() => {
        setUnlocked(true);
        setLockPin("");
      }, 180);
    }
  };

  const myName = me?.name ?? "Ek User";
  const myUpi = me?.upiId ?? "user@ekpay";
  const myPhone = me ? `+91 ${me.phone.slice(0, 5)} ${me.phone.slice(5)}` : "";
  const initials = myName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const totalBal = banks.reduce((a, b) => a + b[1], 0);
  const stockVal = Object.entries(holdings).reduce((s, [k, v]) => {
    const st = ST.find((x) => x[0] === k);
    return s + (st ? Number(st[2]) * v.qty : 0);
  }, 0);
  const portfolioTotal = stockVal + goldGrams * 7820 + 64000;

  const catSpends: Record<string, number> = {};
  txns.filter((t) => !t.cr && t.cat !== "Self Transfer").forEach((t) => {
    catSpends[t.cat] = (catSpends[t.cat] || 0) + t.amt;
  });
  const totalSpent = Object.values(catSpends).reduce((a, b) => a + b, 0) || 1;
  const totalReceived = txns.filter((t) => t.cr && t.cat !== "Self Transfer").reduce((a, b) => a + b.amt, 0);

  const settingToggle = (icon: string, title: string, sub: string, on: boolean, onToggle: () => void) => (
    <button className="row" onClick={onToggle}>
      <span className="it"><Icon n={icon} /></span>
      <span className="m">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <b className={on ? "cr" : "mu"}>{on ? "ON" : "OFF"}</b>
    </button>
  );

  const [baseView, subParam] = view.split(":");
  const isRootTab = ROOT_TABS.has(view);
  const headerTitle = baseView === "stk" ? subParam : (SCREEN_TITLES[subParam || baseView] || (subParam || baseView));

  return (
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
            {baseView === "home" && (
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
                  <button onClick={() => go("scan")}><span className="it"><Icon n="scan" /></span>Scan QR</button>
                  <button onClick={() => go("pay")}><span className="it"><Icon n="up" /></span>To Contact</button>
                  <button onClick={() => { setNumInput(""); setNumModal("mobile"); }}><span className="it"><Icon n="phone" /></span>To Mobile/ID</button>
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
            )}

            {/* ================= DEDICATED USER PROFILE HUB (WHEN CLICKING TOP-LEFT AM AVATAR!) ================= */}
            {baseView === "profile" && (
              <>
                <div className="c p" style={{ textAlign: "center" }}>
                  <span className="av" style={{ width: 62, height: 62, background: "#fce7f0", color: "#9d1048", fontSize: 22, margin: "0 auto 8px" }}>
                    {initials}
                  </span>
                  <b style={{ fontSize: 17 }}>{myName}</b>
                  <p className="mu">UPI ID: {myUpi} • {myPhone}</p>

                  {/* Personal Receive QR Code right inside Profile! */}
                  <svg viewBox="0 0 120 120" width="148" height="148" style={{ margin: "12px auto 8px", background: "#fff", padding: 8, borderRadius: 12, border: "1px solid var(--ln)" }}>
                    <rect x="10" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
                    <rect x="80" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
                    <rect x="10" y="80" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
                    <rect x="20" y="20" width="10" height="10" fill="#e81a6c" />
                    <rect x="90" y="20" width="10" height="10" fill="#e81a6c" />
                    <rect x="20" y="90" width="10" height="10" fill="#e81a6c" />
                    <path d="M50 20h10v20H50zM50 50h20v20H50zM80 50h20v10H80zM50 80h15v25H50zM75 75h30v30H75z" fill="#0f172a" />
                  </svg>
                  <small style={{ display: "block" }}>Scan with any UPI app to pay {myName}</small>
                </div>

                <h3>My Payment Methods & Wallets</h3>
                <div className="c">
                  <button className="row" onClick={() => go("upilite")}>
                    <span className="it"><Icon n="rup" /></span>
                    <span className="m">
                      <b>⚡ UPI Lite (Pin-less Wallet)</b>
                      <small>Instant payments up to ₹500 without PIN</small>
                    </span>
                    <b className="cr">{inr(upiLiteBal)} →</b>
                  </button>
                  <button className="row" onClick={() => go("autopay")}>
                    <span className="it"><Icon n="rec" /></span>
                    <span className="m">
                      <b>OTT Subscriptions & Autopay</b>
                      <small>JioHotstar, Netflix, Prime Video, Crunchyroll, ZEE5, SonyLIV</small>
                    </span>
                    <span className="mu">Manage →</span>
                  </button>
                  
                </div>

                <h3>Linked Bank Accounts <button onClick={() => { searchNpciBanks(""); go("addbank"); }}>+ Add Bank</button></h3>
                <div className="c">
                  {getLiveBanks().map((b, i) => (
                    <div key={b.id || i} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="it"><Icon n="bank" /></span>
                        <span className="m">
                          <b>{b.label} {b.isPrimary && <small className="cr">(Primary)</small>}</b>
                          <small>
                            {checkedBalances[b.id] !== undefined ? `Verified Live Balance: ${inr(b.balance)}` : "Balance: ₹ •••••• (Tap Check Bal)"}
                          </small>
                        </span>
                        <button
                          className="chip on"
                          onClick={() => { setBalPinError(""); setBalCheckModal({ id: b.id, label: b.label, pin: "" }); }}
                        >
                          Check Bal
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6, paddingLeft: 46 }}>
                        {!b.isPrimary && (
                          <button
                            className="chip"
                            style={{ fontSize: 11, padding: "4px 9px" }}
                            onClick={async () => {
                              const r = await fetch("/api/accounts/primary", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ bankAccountId: b.id }),
                              });
                              if (r.ok) {
                                await refreshServerState();
                                showToast(b.label + " set as Primary!");
                              }
                            }}
                          >
                            Make Primary
                          </button>
                        )}
                        <button
                          className="chip"
                          style={{ fontSize: 11, padding: "4px 9px" }}
                          onClick={async () => {
                            await fetch("/api/accounts/deposit", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ bankAccountId: b.id, amount: 10000 }),
                            });
                            await refreshServerState();
                            showToast("₹10,000 credited to " + b.label);
                          }}
                        >
                          + Deposit ₹10k
                        </button>
                        <button
                          className="chip"
                          style={{ fontSize: 11, padding: "4px 9px", color: "var(--rd)" }}
                          onClick={async () => {
                            const r = await fetch(`/api/accounts/${b.id}`, { method: "DELETE" });
                            const d = await r.json();
                            if (r.ok) {
                              await refreshServerState();
                              showToast("Bank account unlinked");
                            } else {
                              showToast(d?.error?.message || "Cannot unlink");
                            }
                          }}
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ================= SETTINGS TAB (bottom nav) ================= */}
            {baseView === "more" && (
              <>
                <div className="c p">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="av" style={{ width: 48, height: 48, background: "#fce7f0", color: "#9d1048", fontSize: 17 }}>
                      {initials}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{myName}</b>
                      <small style={{ display: "block" }}>{myUpi} • {myPhone}</small>
                    </div>
                    <button
                      className="chip"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(myUpi);
                          showToast("UPI ID copied");
                        } catch {
                          showToast("Copy nahi ho paya");
                        }
                      }}
                    >
                      Copy ID
                    </button>
                  </div>
                  <button className="btn o" style={{ marginTop: 10 }} onClick={() => go("profile")}>
                    View Profile & My QR
                  </button>
                </div>

                <h3>Security & Privacy</h3>
                <div className="c">
                  <button className="row" onClick={() => { loadCollectAndComplaints(); go("complaints"); }}>
                    <span className="it"><Icon n="shield" /></span>
                    <span className="m">
                      <b>UPI Disputes & Complaint Tickets</b>
                      <small>Track raised NPCI tickets ({complaintsList.length} total)</small>
                    </span>
                    <span className="mu">Open →</span>
                  </button>
                  <button className="row" onClick={() => { setNumInput(""); setCurPin(""); setNumModal("changepin"); }}>
                    <span className="it"><Icon n="lock" /></span>
                    <span className="m">
                      <b>Change UPI PIN</b>
                      <small>Update your UPI PIN</small>
                    </span>
                    <span className="mu">Reset →</span>
                  </button>
                  {settingToggle("eye", "Balance Privacy Mode", "Mask bank balances on screen", hideBal, () => {
                    setHideBal(!hideBal);
                    showToast("Privacy Mode " + (!hideBal ? "Enabled" : "Disabled"));
                  })}
                  {settingToggle("shield", "International UPI", "Pay merchants abroad (UAE, Singapore, France)", intlUpi, () => {
                    setIntlUpi(!intlUpi);
                    showToast("International UPI " + (!intlUpi ? "Enabled" : "Disabled"));
                  })}
                  <button
                    className="row"
                    onClick={async () => {
                      await apiCall("POST", "/api/auth/logout");
                      settingsSaved.current = null;
                      setAuthState("out");
                      setUnlocked(false);
                      setMe(null);
                      setNavHist(["home"]);
                    }}
                  >
                    <span className="it"><Icon n="lock" /></span>
                    <span className="m">
                      <b>Log out</b>
                      <small>{me ? `${me.name} • ${me.phone}` : "Sign out of Ek App"}</small>
                    </span>
                    <span className="mu">Logout →</span>
                  </button>
                </div>

                <h3>Notifications</h3>
                <div className="c">
                  {settingToggle("bell", "Payment Alerts", "Banner & sound when a payment happens", payAlerts, () => {
                    setPayAlerts(!payAlerts);
                    showToast("Payment alerts " + (!payAlerts ? "ON" : "OFF"));
                  })}
                  <button className="row" onClick={() => go("notif")}>
                    <span className="it"><Icon n="bell" /></span>
                    <span className="m">
                      <b>Notification Inbox</b>
                      <small>See all your alerts</small>
                    </span>
                    <span className="mu">Open →</span>
                  </button>
                </div>

                <h3>Appearance & Sound</h3>
                <div className="c p">
                  <b>App Theme</b>
                  <small style={{ display: "block" }}>Light, Dark, ya phone ki setting follow karo</small>
                  <div className="chips">
                    {(["light", "dark", "system"] as const).map((t) => (
                      <button
                        key={t}
                        className={`chip ${theme === t ? "on" : ""}`}
                        onClick={() => {
                          setTheme(t);
                          showToast("Theme: " + (t === "light" ? "Light" : t === "dark" ? "Dark" : "System"));
                        }}
                      >
                        {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "📱 System"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="c">
                  {settingToggle("vol", "Sound & Tap Feedback", "Play chime on taps and UPI transfers", soundOn, () => {
                    setSoundOn(!soundOn);
                    showToast("Sound " + (!soundOn ? "ON" : "OFF"));
                  })}
                </div>

                <h3>About</h3>
                <div className="c">
                  <div className="row">
                    <span className="it"><Icon n="gear" /></span>
                    <span className="m">
                      <b>Ek App v0.1.0</b>
                      <small>Demo simulator: koi real bank ya paisa involved nahi hai</small>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ================= 1. REAL MOBILE RECHARGE WITH OPERATOR LOGOS ================= */}
            {baseView === "bill" && subParam === "mobile" && (
              <>
                <div className="c p">
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <BrandLogo brand={mobOp} size={44} />
                    <div style={{ flex: 1 }}>
                      <b>{mobOp} Prepaid Recharge</b>
                      <input
                        placeholder="10-digit Mobile Number"
                        maxLength={10}
                        value={mobNum}
                        onChange={(e) => setMobNum(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>
                  <small style={{ display: "block", marginTop: 10 }}>Switch Operator</small>
                  <div className="chips">
                    {(["Jio", "Airtel", "Vi", "BSNL"] as const).map((op) => (
                      <button key={op} className={`chip ${mobOp === op ? "on" : ""}`} onClick={() => setMobOp(op)}>
                        {op}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="chips">
                  {["All", "Popular", "5G Unlimited", "Annual", "Data Add-on"].map((c) => (
                    <button key={c} className={`chip ${mobTab === c ? "on" : ""}`} onClick={() => setMobTab(c)}>
                      {c}
                    </button>
                  ))}
                </div>

                <h3>{mobOp} Official Plans</h3>
                <div className="c">
                  {TELECOM_PLANS[mobOp]
                    .filter((p) => mobTab === "All" || p.cat === mobTab)
                    .map((p, i) => (
                      <div key={i} className="row" style={{ alignItems: "center" }}>
                        <BrandLogo brand={mobOp} size={36} />
                        <div style={{ minWidth: 62 }}>
                          <b style={{ fontSize: 16, color: "var(--pr)" }}>{inr(p.price)}</b>
                          <br />
                          <small>{p.val}</small>
                        </div>
                        <span className="m">
                          <b>{p.data}</b>
                          <small style={{ whiteSpace: "normal", display: "block" }}>{p.desc}</small>
                        </span>
                        <button
                          className="chip on"
                          onClick={() => {
                            if (mobNum.length !== 10) return showToast("10-digit mobile number daalo");
                            triggerCheckout(`${mobOp} (${mobNum})`, p.price, `${p.data} • ${p.val}`);
                          }}
                        >
                          Pay
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}

            {/* ================= 2. REAL IRCTC TRAIN BOOKING ================= */}
            {baseView === "bill" && subParam === "train" && (
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
            )}

            {/* ================= 3. REAL DTH / CABLE TV WITH LOGOS ================= */}
            {baseView === "bill" && subParam === "dth" && (
              <>
                <div className="c p">
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <BrandLogo brand={dthOp} size={42} />
                    <div>
                      <b>{dthOp} Recharge</b>
                      <small style={{ display: "block" }}>Instant HD/SD Pack Activation</small>
                    </div>
                  </div>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {Object.keys(DTH_PACKS).map((op) => (
                      <button key={op} className={`chip ${dthOp === op ? "on" : ""}`} onClick={() => setDthOp(op)}>
                        {op}
                      </button>
                    ))}
                  </div>
                  <small style={{ display: "block", marginTop: 8 }}>Subscriber ID / Smart Card No.</small>
                  <input value={dthId} onChange={(e) => setDthId(e.target.value)} placeholder="10-digit Subscriber ID" />
                </div>

                <h3>{dthOp} Monthly Packs</h3>
                <div className="c">
                  {DTH_PACKS[dthOp].map((pk, i) => (
                    <div key={i} className="row">
                      <BrandLogo brand={dthOp} size={36} />
                      <span className="m">
                        <b>{pk.name}</b>
                        <small>{pk.ch} • Validity: {pk.val}</small>
                      </span>
                      <button
                        className="chip on"
                        onClick={() => triggerCheckout(`${dthOp} (${dthId})`, pk.price, pk.name)}
                      >
                        Pay {inr(pk.price)}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ================= 4. ELECTRICITY BILL ================= */}
            {baseView === "bill" && subParam === "electricity" && (
              <div className="c p">
                <b>Electricity Bill Payment (BBPS)</b>
                <small style={{ display: "block", marginTop: 10 }}>Select State Electricity Board</small>
                <select value={elecBoard} onChange={(e) => setElecBoard(e.target.value)}>
                  <option>MPPKVVCL (Madhya Pradesh)</option>
                  <option>MPMKVVCL (Bhopal / Central MP)</option>
                  <option>MSEDCL (Maharashtra)</option>
                  <option>BESCOM (Bengaluru)</option>
                  <option>Tata Power / BSES Delhi</option>
                  <option>UPPCL (Uttar Pradesh)</option>
                </select>
                <small style={{ display: "block", marginTop: 10 }}>IVRS / Consumer Number</small>
                <input value={elecId} onChange={(e) => setElecId(e.target.value)} placeholder="Enter Consumer / IVRS No." />

                <div className="c" style={{ marginTop: 14, background: "var(--bg)" }}>
                  <div className="row"><small className="m">Consumer Name</small><b>Mohan Lal Verma</b></div>
                  <div className="row"><small className="m">Bill Month</small><b>October 2026</b></div>
                  <div className="row"><small className="m">Units Consumed</small><b>198 kWh</b></div>
                  <div className="row"><small className="m">Bill Amount Due</small><b style={{ fontSize: 16 }}>₹1,420</b></div>
                </div>

                <button
                  className="btn"
                  onClick={() => triggerCheckout(elecBoard, 1420, `IVRS: ${elecId}`)}
                >
                  Pay Electricity Bill (₹1,420)
                </button>
              </div>
            )}

            {/* ================= 5. FASTAG RECHARGE ================= */}
            {baseView === "bill" && subParam === "fastag" && (
              <div className="c p">
                <b>🚗 NHAI FASTag Instant Recharge</b>
                <small style={{ display: "block", marginTop: 10 }}>Select FASTag Issuing Bank</small>
                <select value={fastagBank} onChange={(e) => setFastagBank(e.target.value)}>
                  <option>ICICI Bank FASTag</option>
                  <option>HDFC Bank FASTag</option>
                  <option>SBI FASTag</option>
                  <option>Axis Bank FASTag</option>
                </select>
                <small style={{ display: "block", marginTop: 10 }}>Vehicle Registration Number</small>
                <input
                  value={vehNo}
                  onChange={(e) => setVehNo(e.target.value.toUpperCase())}
                  placeholder="e.g. MP 04 CJ 7721"
                />
                <small style={{ display: "block", marginTop: 10 }}>Select Top-up Amount</small>
                <div className="chips">
                  {[300, 500, 1000, 2000].map((a) => (
                    <button key={a} className={`chip ${fastagAmt === a ? "on" : ""}`} onClick={() => setFastagAmt(a)}>
                      ₹{a}
                    </button>
                  ))}
                </div>
                <button
                  className="btn"
                  onClick={() => triggerCheckout(`FASTag (${vehNo})`, fastagAmt, fastagBank)}
                >
                  Recharge FASTag ({inr(fastagAmt)})
                </button>
              </div>
            )}

            {/* ================= 6. LPG GAS BOOKING ================= */}
            {baseView === "bill" && subParam === "gas" && (
              <div className="c p">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <BrandLogo brand={gasOp} size={42} />
                  <div>
                    <b>Book 14.2 kg LPG Cylinder</b>
                    <small style={{ display: "block" }}>{gasOp}</small>
                  </div>
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  {["Indane Gas (IndianOil)", "Bharat Gas", "HP Gas"].map((g) => (
                    <button key={g} className={`chip ${gasOp === g ? "on" : ""}`} onClick={() => setGasOp(g)}>
                      {g.split(" ")[0]}
                    </button>
                  ))}
                </div>
                <small style={{ display: "block", marginTop: 10 }}>Registered Mobile or 17-Digit LPG ID</small>
                <input value={gasId} onChange={(e) => setGasId(e.target.value)} />

                <div className="c" style={{ marginTop: 14, background: "var(--bg)" }}>
                  <div className="row"><small className="m">Distributor</small><b>Bhopal Gas Agency</b></div>
                  <div className="row"><small className="m">Refill Price</small><b style={{ fontSize: 16 }}>₹809</b></div>
                </div>

                <button
                  className="btn"
                  onClick={() => triggerCheckout(gasOp, 809, `LPG ID: ${gasId}`)}
                >
                  Book & Pay Refill (₹809)
                </button>
              </div>
            )}

            {/* ================= WEALTH TAB ================= */}
            {baseView === "invest" && (
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
            )}

            {/* ================= NATIVE SCREEN 1: LINK NEW BANK ACCOUNT (90+ NPCI BANKS) ================= */}
            {baseView === "addbank" && (
              <>
                <div className="c p">
                  <b>🏦 Link Bank Account via Mobile Number</b>
                  <small style={{ display: "block", marginTop: 2 }}>
                    Fetching accounts linked to +91 {sessionUser?.phone || "9876500001"}
                  </small>
                  <input
                    placeholder="Search 90+ UPI Live Banks (e.g. Axis, SBI, Kotak, Gramin)..."
                    value={bankQuery}
                    onChange={(e) => {
                      setBankQuery(e.target.value);
                      searchNpciBanks(e.target.value);
                    }}
                  />
                </div>

                {pickedBank && (
                  <div className="c p" style={{ borderColor: "var(--pr)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b>{pickedBank.name}</b>
                      <button className="chip" onClick={() => { setPickedBank(null); setDiscoveredAccs(null); }}>Close</button>
                    </div>
                    {discoveredAccs === null ? (
                      <small style={{ display: "block", marginTop: 8 }}>Discovering accounts with NPCI ListAccount...</small>
                    ) : discoveredAccs.length === 0 ? (
                      <small style={{ display: "block", marginTop: 8 }}>No account found in this bank.</small>
                    ) : (
                      discoveredAccs.map((acc) => (
                        <div key={acc.last4} className="row" style={{ marginTop: 6 }}>
                          <span className="it"><Icon n="bank" /></span>
                          <span className="m">
                            <b>{acc.type} Account • {acc.maskedNumber}</b>
                            <small>IFSC: {acc.ifsc}</small>
                          </span>
                          <button
                            className="chip on"
                            onClick={async () => {
                              const r = await fetch("/api/accounts/link", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ bankId: pickedBank.id, last4: acc.last4 }),
                              });
                              const d = await r.json();
                              if (r.ok) {
                                await refreshServerState();
                                setPickedBank(null);
                                setDiscoveredAccs(null);
                                pushNotif("Bank Linked ✓", `${d.account.label} linked to your EkPay UPI`);
                                go("profile");
                              } else {
                                showToast(d?.error?.message || "Could not link bank");
                              }
                            }}
                          >
                            Link Account
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <h3>Select Your Bank ({npciBanks.length} UPI Banks)</h3>
                <div className="c">
                  {npciBanks.map((b) => (
                    <button
                      key={b.id}
                      className="row"
                      onClick={async () => {
                        setPickedBank(b);
                        setDiscoveredAccs(null);
                        const r = await fetch("/api/banks/discover", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ bankId: b.id }),
                        });
                        const d = await r.json();
                        if (r.ok) setDiscoveredAccs(d.accounts || []);
                        else showToast(d?.error?.message || "Discovery failed");
                      }}
                    >
                      <span className="it"><Icon n="bank" /></span>
                      <span className="m">
                        <b>{b.name}</b>
                        <small style={{ textTransform: "capitalize" }}>{b.category.replace("_", " ")} Bank</small>
                      </span>
                      {b.popular ? <span className="chip on" style={{ fontSize: 10.5, padding: "3px 8px" }}>★ Popular</span> : <span className="mu">Link →</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ================= NATIVE SCREEN 2: UPI COLLECT REQUESTS (REQUEST & APPROVE) ================= */}
            {baseView === "collect" && (
              <>
                <div className="c p">
                  <b>📥 Request Money (UPI Collect)</b>
                  <small style={{ display: "block", marginTop: 2 }}>Enter friend's EkPay UPI ID to request payment</small>
                  <input
                    placeholder="Payer UPI ID (e.g. 9876500002@ekpay)"
                    value={collectVpa}
                    onChange={(e) => setCollectVpa(e.target.value.trim())}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      type="number"
                      placeholder="Amount ₹"
                      value={collectAmt}
                      onChange={(e) => setCollectAmt(e.target.value)}
                    />
                    <input
                      placeholder="Note (e.g. Dinner split)"
                      value={collectNote}
                      onChange={(e) => setCollectNote(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn"
                    onClick={async () => {
                      const r = await fetch("/api/collect", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ payerVpa: collectVpa, amount: Number(collectAmt), note: collectNote || undefined }),
                      });
                      const d = await r.json();
                      if (r.ok) {
                        setCollectVpa("");
                        setCollectAmt("");
                        setCollectNote("");
                        await loadCollectAndComplaints();
                        showToast("Collect request sent!");
                      } else {
                        showToast(d?.error?.message || "Failed to send request");
                      }
                    }}
                  >
                    Send Collect Request
                  </button>
                </div>

                <h3>Incoming Requests (Pay / Decline)</h3>
                <div className="c">
                  {collectList.incoming.length === 0 ? (
                    <div className="row"><small className="m">No incoming collect requests</small></div>
                  ) : (
                    collectList.incoming.map((req) => (
                      <div key={req.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <b>{req.requester.name} requested {inr(req.amount)}</b>
                          <span className="chip on" style={{ fontSize: 10.5, padding: "2px 8px" }}>{req.status}</span>
                        </div>
                        <small>{req.note || req.requester.upiId}</small>
                        {req.status === "pending" && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                            <input
                              type="password"
                              maxLength={6}
                              placeholder="UPI PIN"
                              value={collectPinMap[req.id] || ""}
                              onChange={(e) => setCollectPinMap({ ...collectPinMap, [req.id]: e.target.value.replace(/\D/g, "") })}
                              style={{ marginTop: 0, maxWidth: 110 }}
                            />
                            <button
                              className="chip on"
                              onClick={async () => {
                                const r = await fetch(`/api/collect/${req.id}`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "approve", pin: collectPinMap[req.id] || "" }),
                                });
                                const d = await r.json();
                                if (r.ok) {
                                  await loadCollectAndComplaints();
                                  await refreshServerState();
                                  showToast("Collect Approved & Paid!");
                                } else {
                                  showToast(d?.error?.message || "Approval failed");
                                }
                              }}
                            >
                              Approve & Pay
                            </button>
                            <button
                              className="chip"
                              onClick={async () => {
                                await fetch(`/api/collect/${req.id}`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "decline" }),
                                });
                                await loadCollectAndComplaints();
                                showToast("Request Declined");
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <h3>Sent Requests (Outgoing)</h3>
                <div className="c">
                  {collectList.outgoing.length === 0 ? (
                    <div className="row"><small className="m">No sent requests yet</small></div>
                  ) : (
                    collectList.outgoing.map((req) => (
                      <div key={req.id} className="row">
                        <span className="m">
                          <b>{inr(req.amount)} from {req.payer.name}</b>
                          <small>{req.payer.upiId} • {req.status}</small>
                        </span>
                        {req.status === "pending" && (
                          <button
                            className="chip"
                            onClick={async () => {
                              await fetch(`/api/collect/${req.id}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "cancel" }),
                              });
                              await loadCollectAndComplaints();
                              showToast("Cancelled");
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ================= NATIVE SCREEN 3: UPI DISPUTES & COMPLAINTS ================= */}
            {baseView === "complaints" && (
              <>
                <div className="c p">
                  <b>🛡️ EkPay UPI Dispute Resolution Center</b>
                  <small style={{ display: "block", marginTop: 4 }}>
                    Tap any transaction in Passbook to raise a complaint. Tickets auto-progress from Open → In Review → Resolved.
                  </small>
                </div>
                <h3>Your Active & Past Tickets ({complaintsList.length})</h3>
                <div className="c">
                  {complaintsList.length === 0 ? (
                    <div className="row"><small className="m">No complaints raised yet.</small></div>
                  ) : (
                    complaintsList.map((c) => (
                      <div key={c.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <b>Ticket #{c.ticket}</b>
                          <span className="chip on" style={{ fontSize: 10.5, padding: "2px 8px" }}>{c.status.replace("_", " ")}</span>
                        </div>
                        <small>{c.category.replace(/_/g, " ")} • {inr(c.transaction.amount)} to {c.transaction.counterparty}</small>
                        <small style={{ color: "var(--tx)" }}>"{c.description}"</small>
                        {c.resolution && <small className="cr">✓ {c.resolution}</small>}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ================= NATIVE SCREEN 4: FORGOT / RESET UPI PIN ================= */}
            {baseView === "forgotpin" && (
              <div className="c p">
                <b>🔐 Reset / Forgot UPI PIN</b>
                <p className="mu" style={{ marginTop: 4 }}>
                  Verify your EkPay account password to set a new 4 or 6 digit UPI PIN and clear any PIN lockouts.
                </p>
                <small style={{ display: "block", marginTop: 10 }}>Account Password (default: StrongPass123)</small>
                <input
                  type="password"
                  placeholder="Enter account password"
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                />
                <small style={{ display: "block", marginTop: 10 }}>New 4 or 6 Digit UPI PIN</small>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter new UPI PIN (e.g. 1234)"
                  value={resetNewPin}
                  onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  className="btn"
                  onClick={async () => {
                    const r = await fetch("/api/auth/reset-pin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password: resetPass, newPin: resetNewPin }),
                    });
                    const d = await r.json();
                    if (r.ok) {
                      /* setUserPin removed — PIN server pe reset hoti hai */
                      setResetPass("");
                      setResetNewPin("");
                      showToast("UPI PIN Reset Successfully!");
                      back();
                    } else {
                      showToast(d?.error?.message || "Reset failed");
                    }
                  }}
                >
                  Verify & Reset UPI PIN
                </button>
              </div>
            )}

            {baseView === "upilite" && (
              <div className="c p">
                <b>⚡ EkPay UPI Lite</b>
                <p className="mu" style={{ marginTop: 4 }}>
                  Make superfast payments up to ₹500 without entering your 4-digit UPI PIN.
                </p>
                <h1 style={{ fontSize: 34, margin: "12px 0" }}>{inr(upiLiteBal)}</h1>
                <small>Max Wallet Limit: ₹2,000</small>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {[200, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      className="chip on"
                      onClick={() => {
                        if (banks[0][1] < amt) return showToast("Bank balance kam hai");
                        setPinTask({
                          label: "Add to UPI Lite",
                          amount: amt,
                          run: async (pin) => {
                            const r = await apiCall("POST", "/api/upi-lite/topup", { amount: amt, pin, idempotencyKey: newKey() });
                            if (r.ok) {
                              await payDone("UPI Lite Topped Up", `${inr(amt)} added to UPI Lite`);
                              showToast(`Added ${inr(amt)} to UPI Lite!`);
                            }
                            return r;
                          },
                        });
                        setCurPin("");
                        setNumModal("confirmpin");
                      }}
                    >
                      + Add ₹{amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ================= OTT SUBSCRIPTIONS & AUTOPAY WITH LOGOS (Crunchyroll, Spotify, YT, Netflix!) ================= */}
            {baseView === "autopay" && (
              <>
                <h3>Active OTT & UPI Autopay Mandates</h3>
                <div className="c">
                  {mandates.map((m, i) => (
                    <div key={m.id} className="row">
                      <BrandLogo brand={m.brand} size={40} />
                      <span className="m">
                        <b>{m.merchant}</b>
                        <small>{inr(m.amt)} • {m.cycle}</small>
                      </span>
                      <button
                        className={`chip ${m.active ? "on" : ""}`}
                        onClick={() => {
                          const next = mandates.map((x, idx) => (idx === i ? { ...x, active: !x.active } : x));
                          setMandates(next);
                          showToast(`${m.merchant} ${!m.active ? "Resumed" : "Paused"}`);
                        }}
                      >
                        {m.active ? "Active ✓" : "Paused"}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

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

            {baseView === "notif" && (
              <>
                <h3>All Alerts ({notifs.length})</h3>
                <div className="c">
                  {notifs.map((n, i) => (
                    <div key={i} className="row">
                      <span className="it"><Icon n="bell" /></span>
                      <span className="m">
                        <b>{n.title}</b>
                        <small style={{ whiteSpace: "normal" }}>{n.body}</small>
                      </span>
                      <small>{n.time}</small>
                    </div>
                  ))}
                </div>
              </>
            )}

            {baseView === "cat" && subParam && CATALOG[subParam] && (
              <>
                <h3>Verified Offerings</h3>
                <div className="c">
                  {CATALOG[subParam].map(([title, desc, badge, price], i) => (
                    <div key={i} className="row">
                      <span className="it"><Icon n="shield" /></span>
                      <span className="m">
                        <b>{title}</b>
                        <small>{desc}</small>
                      </span>
                      <button
                        className="chip on"
                        onClick={() => {
                          if (banks[0][1] < price) return showToast("Insufficient bank balance");
                          act(async () => {
                            const r = await apiCall("POST", "/api/offerings/buy", {
                              category: subParam, title, idempotencyKey: newKey(),
                            });
                            if (!r.ok) return showToast(r.message);
                            await payDone("Payment Successful", `${inr(r.data.transaction.amount)} debited for ${title}`);
                            showToast(`${title} Activated!`);
                          });
                        }}
                      >
                        {badge}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

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

            {baseView === "scan" && (
              <>
                <div className="chips" style={{ justifyContent: "center", marginBottom: 8 }}>
                  <button className={`chip ${qrMode === "scan" ? "on" : ""}`} onClick={() => setQrMode("scan")}>
                    📷 Scan Any UPI QR
                  </button>
                  <button className={`chip ${qrMode === "myqr" ? "on" : ""}`} onClick={() => { stopCamera(); setQrMode("myqr"); }}>
                    🔳 My EkPay QR
                  </button>
                </div>
                {qrMode === "scan" ? (
                  <>
                    <div className="scan">
                      {camActive && (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      )}
                      <div className="fr"></div>
                      <p style={{ position: "absolute", bottom: 16, fontSize: 12, opacity: 0.85 }}>
                        {camActive ? "Live Camera Active – Align QR Code" : "Align any BharatQR / UPI QR inside frame"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn o" onClick={() => (camActive ? stopCamera() : startCamera())}>
                        {camActive ? "Stop Camera" : "Turn On Camera"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          stopCamera();
                          setPayToIdx(5);
                          setPayAmt("340");
                          go("amt");
                        }}
                      >
                        Demo Scan (Zomato)
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="c p" style={{ textAlign: "center", padding: 20 }}>
                    <b>{myName}</b>
                    <p className="mu">{myUpi} • {banks[0][0]}</p>
                    <svg viewBox="0 0 120 120" width="170" height="170" style={{ margin: "14px auto", background: "#fff", padding: 10, borderRadius: 12, border: "1px solid var(--ln)" }}>
                      <rect x="10" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
                      <rect x="80" y="10" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
                      <rect x="10" y="80" width="30" height="30" fill="none" stroke="#0f172a" strokeWidth="6" />
                      <rect x="20" y="20" width="10" height="10" fill="#e81a6c" />
                      <rect x="90" y="20" width="10" height="10" fill="#e81a6c" />
                      <rect x="20" y="90" width="10" height="10" fill="#e81a6c" />
                      <path d="M50 20h10v20H50zM50 50h20v20H50zM80 50h20v10H80zM50 80h15v25H50zM75 75h30v30H75z" fill="#0f172a" />
                    </svg>
                    <small>Receive money directly into your primary bank account</small>
                  </div>
                )}
              </>
            )}

            {baseView === "pay" && (
              <>
                <div className="qa" style={{ marginBottom: 10 }}>
                  <button onClick={() => go("scan")}><span className="it"><Icon n="scan" /></span>Scan QR</button>
                  <button onClick={() => { setNumInput(""); setNumModal("mobile"); }}><span className="it"><Icon n="phone" /></span>Mobile/UPI</button>
                  <button onClick={() => { setNumInput(""); setNumModal("bank"); }}><span className="it"><Icon n="bank" /></span>Bank A/C</button>
                  <button onClick={() => setNumModal("self")}><span className="it"><Icon n="up" /></span>Self Xfer</button>
                </div>
                <h3>Verified Contacts</h3>
                <div className="c">
                  {contacts.map((c, i) => (
                    <button
                      key={i}
                      className="row"
                      onClick={() => {
                        setPayToIdx(i);
                        setPayAmt("");
                        go("amt");
                      }}
                    >
                      <span className="av" style={{ background: "#fce7f0", color: "#9d1048" }}>{c[0][0]}</span>
                      <span className="m">
                        <b>{c[0]}</b>
                        <small>{c[1]} • {c[2]}</small>
                      </span>
                      <span className="mu">Pay →</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {baseView === "amt" && (
              <div style={{ textAlign: "center", paddingTop: 4 }}>
                <div style={{ display: "inline-block" }}>
                  <BrandLogo brand={contacts[payToIdx][0]} size={48} />
                </div>
                <p style={{ marginTop: 6, fontWeight: 600 }}>Paying {contacts[payToIdx][0]}</p>
                <small>{contacts[payToIdx][2]} • EkPay Verified ✓</small>
                <h1 style={{ fontSize: 40, fontWeight: 600, margin: "8px 0" }}>₹{payAmt || "0"}</h1>
                <input
                  placeholder="Add a note (optional)"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  style={{ maxWidth: 220, margin: "0 auto 8px", textAlign: "center", display: "block", padding: "7px 12px" }}
                />

                <div className="chips" style={{ justifyContent: "center" }}>
                  <button className={`chip ${!useLite ? "on" : ""}`} onClick={() => setUseLite(false)}>
                    🏦 Bank Account
                  </button>
                  <button className={`chip ${useLite ? "on" : ""}`} onClick={() => setUseLite(true)}>
                    ⚡ UPI Lite ({inr(upiLiteBal)})
                  </button>
                </div>

                {!useLite && (
                  <button
                    className="row"
                    onClick={() => setPayBankIdx((payBankIdx + 1) % banks.length)}
                    style={{ background: "var(--cd)", border: "1px solid var(--ln)", borderRadius: 14, padding: "9px 12px", margin: "6px 0" }}
                  >
                    <span className="it"><Icon n="bank" /></span>
                    <span className="m">
                      <b>{banks[payBankIdx][0]}</b>
                      <small>Balance {hideBal ? "₹ ••••••" : inr(banks[payBankIdx][1])}</small>
                    </span>
                    <span className="mu">Switch Bank</span>
                  </button>
                )}

                <div className="kp">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        tone(600, 0.03);
                        if (k === "⌫") setPayAmt((p) => p.slice(0, -1));
                        else if (k === ".") {
                          if (payAmt && !payAmt.includes(".")) setPayAmt((p) => p + ".");
                        } else if (payAmt.length < 7) setPayAmt((p) => p + k);
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                <button
                  className="btn"
                  onClick={() => {
                    const a = Number(payAmt);
                    if (!a) return showToast("Amount daalo");
                    if (useLite) {
                      if (a > 500) return showToast("UPI Lite max limit is ₹500 per txn");
                      if (a > upiLiteBal) return showToast("UPI Lite balance kam hai");
                      if (payBusy) return;
                      setPayBusy(true);
                      (async () => {
                        const r = await apiCall("POST", "/api/payments", {
                          amount: a,
                          receiver: contacts[payToIdx][0].slice(0, 80),
                          method: "lite",
                          note: payNote ? payNote.slice(0, 100) : undefined,
                          category: "Transfer",
                          idempotencyKey: newKey(),
                        });
                        setPayBusy(false);
                        if (!r.ok) return showToast(r.message);
                        await loadAll();
                        pushNotif("Paid via UPI Lite (No PIN)", `${inr(a)} debited from UPI Lite`);
                        setPayAmt("");
                        setPayNote("");
                        setNavHist(["home", "done"]);
                      })();
                      return;
                    }
                    if (a > banks[payBankIdx][1]) return showToast("Account me balance kam hai");
                    setPin("");
                    setPinErr("");
                    payKey.current = "";
                    setPinSheet(true);
                  }}
                >
                  {useLite && Number(payAmt) <= 500 ? "⚡ Instant Pay (No PIN)" : "Proceed to Pay"}
                </button>
              </div>
            )}

            {baseView === "done" && txns[0] && (
              <div style={{ textAlign: "center", paddingTop: 20 }}>
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--gr)", color: "#fff", display: "grid", placeItems: "center", fontSize: 32, margin: "0 auto 12px" }}>
                  ✓
                </div>
                <b style={{ fontSize: 18 }}>Payment successful</b>
                <h1 style={{ fontSize: 36, margin: "6px 0" }}>{inr(txns[0].amt)}</h1>
                <p className="mu">Paid to {txns[0].n}</p>
                <div className="c" style={{ marginTop: 14 }}>
                  <div className="row"><small className="m">Payment Mode</small><b>{txns[0].mode || "EkPay UPI"}</b></div>
                  <div className="row"><small className="m">Debited From</small><b>{txns[0].bank}</b></div>
                  <div className="row"><small className="m">UTR / Ref ID</small><b>{txns[0].ref}</b></div>
                </div>
                <button className="btn" onClick={() => tab("home")}>Done</button>
                <button className="btn o" onClick={() => downloadReceipt(txns[0])}>Download Receipt (.txt)</button>
              </div>
            )}

            {baseView === "txns" && (
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
                    ["in", "Received (+)"],
                    ["out", "Paid (−)"],
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
            )}

            {baseView === "stocks" && (
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
            )}

            {baseView === "sip" && (
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
            )}

            {baseView === "gold" && (
              <div className="c p">
                <b>24K 99.9% Digital Gold Vault</b>
                <h2 style={{ margin: "6px 0" }}>{goldGrams.toFixed(3)} grams ({inr(goldGrams * 7820)})</h2>
                <small>Live Market Rate: ₹7,820 / gram</small>
                <button
                  className="btn"
                  onClick={() => {
                    if (banks[0][1] < 1000) return showToast("Balance kam hai");
                    act(async () => {
                      const r = await apiCall("POST", "/api/gold/buy", { amount: 1000, idempotencyKey: newKey() });
                      if (!r.ok) return showToast(r.message);
                      await payDone("Payment Successful", `${inr(1000)} debited for 24K Digital Gold`);
                      showToast("₹1,000 Digital Gold added to vault!");
                    });
                  }}
                >
                  Buy ₹1,000 Instant Gold
                </button>
              </div>
            )}

            {baseView === "loans" && (
              <>
                <div className="c p">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>Active Bike Loan</b>
                    <small>{emiPaid} / 36 EMIs Paid</small>
                  </div>
                  <div className="bar"><i style={{ width: `${(emiPaid / 36) * 100}%` }}></i></div>
                  <button
                    className="btn"
                    onClick={() => {
                      if (banks[0][1] < 3240) return showToast("Balance kam hai");
                      if (loanId === null) return showToast("Loan details load nahi hui");
                      act(async () => {
                        const r = await apiCall("POST", "/api/loans/emi", { loanId, idempotencyKey: newKey() });
                        if (!r.ok) return showToast(r.message);
                        await payDone("Payment Successful", `${inr(r.data.transaction.amount)} debited for Bike Loan EMI`);
                        showToast("EMI ₹3,240 Paid!");
                      });
                    }}
                  >
                    Pay Next EMI (₹3,240)
                  </button>
                </div>
                <div className="c p">
                  <b>Instant Cash Loan EMI Calculator</b>
                  <div className="mu" style={{ marginTop: 8 }}>Loan: <b style={{ float: "right" }}>{inr(loanP)}</b></div>
                  <input type="range" min="50000" max="2000000" step="50000" value={loanP} onChange={(e) => setLoanP(+e.target.value)} />
                  <div className="mu">Tenure: <b style={{ float: "right" }}>{loanN} months</b></div>
                  <input type="range" min="12" max="120" value={loanN} onChange={(e) => setLoanN(+e.target.value)} />
                  {(() => {
                    const i = loanR / 1200;
                    const e = (loanP * i * Math.pow(1 + i, loanN)) / (Math.pow(1 + i, loanN) - 1);
                    return <b style={{ fontSize: 20, display: "block", marginTop: 8 }}>Monthly EMI: {inr(e)}</b>;
                  })()}
                </div>
              </>
            )}

            {baseView === "cards" && (
              <>
                <div className="card3d">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>HDFC Regalia Gold</b>
                    <b>VISA</b>
                  </div>
                  <div className="chp"></div>
                  <div>
                    <div style={{ fontSize: 16, letterSpacing: 3 }}>•••• •••• •••• 4821</div>
                    <small style={{ color: "rgba(255,255,255,.7)" }}>{myName.toUpperCase()} • Limit ₹3,00,000</small>
                  </div>
                </div>
                <div className="c p">
                  <small>Statement Bill Due</small>
                  <h2>{inr(cardDue)}</h2>
                  <button
                    className="btn"
                    onClick={() => {
                      if (cardDue <= 0) return showToast("Bill already paid!");
                      if (banks[0][1] < cardDue) return showToast("Balance kam hai");
                      act(async () => {
                        const r = await apiCall("POST", "/api/card/pay", { idempotencyKey: newKey() });
                        if (!r.ok) return showToast(r.message);
                        await payDone("Payment Successful", `${inr(r.data.transaction.amount)} debited for HDFC Credit Card Bill`);
                        showToast("Credit Card Bill Cleared!");
                      });
                    }}
                  >
                    {cardDue > 0 ? `Pay Credit Card Bill (${inr(cardDue)})` : "All Dues Cleared ✓"}
                  </button>
                </div>
              </>
            )}

            {baseView === "split" && (
              <div className="c p">
                <b>Split Group Bill on EkPay</b>
                <small style={{ display: "block", marginTop: 8 }}>Total Bill Amount</small>
                <input type="number" value={splitAmt} onChange={(e) => setSplitAmt(+e.target.value)} />
                <p className="mu" style={{ marginTop: 10 }}>
                  Splitting equally with Rahul Sharma, Priya Verma & You (3 ways):
                </p>
                <h2 style={{ margin: "8px 0" }}>{inr(splitAmt / 3)} / person</h2>
                <button
                  className="btn"
                  onClick={() => {
                    pushNotif("Split Collect Sent", `Requested ${inr(splitAmt / 3)} each from Rahul & Priya`);
                    tab("home");
                  }}
                >
                  Send EkPay Collect Request
                </button>
              </div>
            )}

            {/* ================= 180-DEGREE SPEEDOMETER CIBIL SCORE SCREEN ================= */}
            {baseView === "cibil" && (
              <div className="c p" style={{ textAlign: "center" }}>
                <small>Powered by Experian & TransUnion CIBIL</small>
                <CibilSpeedometer score={785} />
                <div className="c" style={{ marginTop: 14, textAlign: "left" }}>
                  <div className="row"><span className="m">On-time EMI & Card Payments</span><b className="cr">100% (48/48)</b></div>
                  <div className="row"><span className="m">Credit Limit Utilization</span><b className="cr">6% (Ideal &lt; 30%)</b></div>
                  <div className="row"><span className="m">Credit Age</span><b>4 Years 8 Months</b></div>
                  <div className="row"><span className="m">Hard Enquiries</span><b>0 in last 6 months</b></div>
                </div>
                <button className="btn o" onClick={() => showToast("CIBIL Score is already up-to-date!")}>
                  Refresh CIBIL Report
                </button>
              </div>
            )}

            {baseView === "analytics" && (
              <>
                <div className="c p">
                  <b>Monthly Spend Limit</b>
                  {(() => {
                    const spent = txns.filter((t) => !t.cr && t.cat !== "Self Transfer").reduce((a, b) => a + b.amt, 0);
                    const pct = Math.min(100, Math.round((spent / budget) * 100));
                    return (
                      <>
                        <h2 style={{ margin: "6px 0" }}>{inr(spent)} <small>/ {inr(budget)}</small></h2>
                        <div className="bar"><i style={{ width: `${pct}%` }}></i></div>
                        <small>{pct}% of monthly budget used</small>
                        <input
                          type="range"
                          min="10000"
                          max="100000"
                          step="5000"
                          value={budget}
                          onChange={(e) => {
                            const v = +e.target.value;
                            setBudget(v);
                            if (budgetTimer.current) clearTimeout(budgetTimer.current);
                            budgetTimer.current = setTimeout(async () => {
                              const r = await apiCall("PATCH", "/api/settings", { budget: v });
                              if (!r.ok) showToast(r.message);
                            }, 500);
                          }}
                        />
                      </>
                    );
                  })()}
                </div>
              </>
            )}
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
  );
}
