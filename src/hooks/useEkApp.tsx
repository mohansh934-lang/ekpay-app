"use client";

import { useState, useEffect, useRef } from "react";
import { inr, mapServerTxn } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { INITIAL_CONTACTS, SCREEN_TITLES, ROOT_TABS, PREFS_KEY, settingsPayload, ST, type ThemePref } from "@/lib/constants";

/** Saari state + actions (page.tsx se jaisa tha waisa hi yahan move hua hai). */
export function useEkApp() {
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
  const [navAnim, setNavAnim] = useState<"" | "slide-in" | "slide-out" | "fade-switch">("");
  const [refreshing, setRefreshing] = useState(false);

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

  const [numModal, setNumModal] = useState<null | "mobile" | "upi" | "bank" | "self" | "changepin" | "confirmpin">(null);
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

  // Theme + status/nav bar = app background
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      root.dataset.theme = resolved;
      const barColor = resolved === "dark" ? "#12050a" : "#fdf5f8";
      root.style.background = barColor;
      document.body.style.background = barColor;

      // Safely update meta tags without destroying Next.js-managed DOM elements
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (meta) {
        meta.content = barColor;
      } else {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = barColor;
        document.head.appendChild(meta);
      }

      const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
      if (apple) {
        apple.content = resolved === "dark" ? "black-translucent" : "default";
      }
    };
    apply();
    if (theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashFade(true), 1100);
    const t2 = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Development safe: unregister any stale service workers and clear cache storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) reg.unregister();
        }).catch(() => {});
      }
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) caches.delete(key);
        }).catch(() => {});
      }
    }
  }, []);

  // EK-ZOOM-FIX: screen ki width/height ke hisab se UI scale (kam se kam 1x, zyada se zyada 1.7x, kuch cut nahi hoga)
  useEffect(() => {
    const BASE_W = 376, BASE_H = 680, MAX = 1.7;
    let lastW = 0; // EK-ZOOM-KB
    const apply = () => {
      const el = document.activeElement;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (typing && lastW && Math.abs(window.innerWidth - lastW) < 2) return; // keyboard khula: scale mat badlo
      lastW = window.innerWidth;
      const z = Math.max(1, Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H, MAX));
      document.documentElement.style.setProperty("--ek-z", z.toFixed(2));
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  // EK-KEYBOARD-NAV: keyboard khulte hi bottom nav chhupao (CSS :has purane mobile browsers me nahi chalta)
  useEffect(() => {
    const root = document.documentElement;
    let maxH = window.visualViewport?.height ?? window.innerHeight;
    const isField = (el: Element | null) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (h > maxH) maxH = h;
      const shrunk = maxH - h > 120; // keyboard ne screen chhoti ki
      root.classList.toggle("ek-typing", isField(document.activeElement) || shrunk);
    };
    const later = () => setTimeout(update, 60);
    const resetMax = () => { maxH = window.visualViewport?.height ?? window.innerHeight; later(); };
    document.addEventListener("focusin", later);
    document.addEventListener("focusout", later);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("orientationchange", resetMax);
    update();
    return () => {
      document.removeEventListener("focusin", later);
      document.removeEventListener("focusout", later);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", resetMax);
      root.classList.remove("ek-typing");
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

  // Haptic feedback — phone ka vibration motor (real app feel)
  const vibrate = (pattern: number | number[] = 10) => {
    try { navigator?.vibrate?.(pattern); } catch {}
  };

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };

  const pushNotif = (title: string, body: string) => {
    setNotifs((p) => [{ title, body, time: "Just now" }, ...p]);
    setUnread((u) => u + 1);
    if (!payAlerts) return; // alerts OFF: inbox me aayega, banner/sound nahi
    tone(988, 0.14); // floating banner band: sirf inbox + sound
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
    vibrate(8);
    if (r === "notif") setUnread(0);
    setNavAnim("slide-in");
    setNavHist((prev) => [...prev, r]);
    setTimeout(() => setNavAnim(""), 300);
  };

  const back = () => {
    stopCamera();
    tone(520, 0.04);
    vibrate(8);
    setNavAnim("slide-out");
    setTimeout(() => {
      setNavHist((prev) => (prev.length > 1 ? prev.slice(0, -1) : ["home"]));
      setNavAnim("");
    }, 220);
  };

  const tab = (r: string) => {
    stopCamera();
    tone(620, 0.04);
    vibrate(8);
    setNavAnim("fade-switch");
    setNavHist([r]);
    setTimeout(() => setNavAnim(""), 220);
  };

  // EK-BACK-HANDLER: phone ka back button / gesture
  // Kahi bhi ho -> seedha Home. Home par ho -> pehli baar toast, 2 sec ke andar dobara back -> app se bahar.
  const navRef = useRef({ view: "home", ready: false, modal: false });
  navRef.current = {
    view: navHist[navHist.length - 1],
    ready: authState === "in" && unlocked,
    modal: !!(pinSheet || numModal || balSheetOpen || balCheckModal),
  };
  const exitArmed = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (!(window.history.state && window.history.state.ek === 1)) {
      window.history.pushState({ ek: 1 }, "");
    }
    const onPop = () => {
      // EK-SEARCH-BACK: home ka search khula hai to back sirf usko band kare
      if ((window as any).__ekSearchOpen) {
        window.history.pushState({ ek: 1 }, "");
        window.dispatchEvent(new Event("ek-close-search"));
        return;
      }
      const { view: v, ready, modal } = navRef.current;
      // Koi PIN page / modal khula hai: back sirf usko band karega (app se bahar nahi jayega)
      if (ready && modal) {
        window.history.pushState({ ek: 1 }, "");
        setPinSheet(false);
        setPin("");
        setPinErr("");
        payKey.current = "";
        setNumModal(null);
        setBalSheetOpen(false);
        setBalCheckModal(null);
        setBalPinBusy(false);
        setBalPinError("");
        return;
      }
      if (ready && v !== "home") {
        window.history.pushState({ ek: 1 }, "");
        stopCamera();
        setPinSheet(false);
        setNumModal(null);
        setBalSheetOpen(false);
        setBalCheckModal(null);
        setNavHist(["home"]);
        return;
      }
      if (!exitArmed.current) {
        exitArmed.current = true;
        window.history.pushState({ ek: 1 }, "");
        showToast("Bahar jaane ke liye ek baar aur back dabao");
        timer = setTimeout(() => { exitArmed.current = false; }, 2000);
        return;
      }
      window.removeEventListener("popstate", onPop);
      window.history.back();
      setTimeout(() => { try { window.close(); } catch {} }, 200);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Pull-to-refresh — pura data server se reload karo
  const pullRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadAll();
    await loadCollectAndComplaints();
    setRefreshing(false);
    showToast("Data refreshed ✓");
  };

  // Web Share API — native share sheet (WhatsApp, etc.)
  const shareReceipt = async (t: any) => {
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
    if (navigator.share) {
      try {
        await navigator.share({ title: `EkPay Receipt – ${inr(t.amt)}`, text: content });
        return;
      } catch (e: any) { if (e?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(content); showToast("Receipt copied to clipboard ✓"); } catch { showToast("Share not available"); }
  };

  // Contact Picker API — phone ki contact list se pick karo (Android Chrome)
  const pickContact = async () => {
    try {
      if ("contacts" in navigator && "ContactsManager" in window) {
        const props = ["name", "tel"];
        const contacts_ = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts_ && contacts_.length > 0) {
          const c = contacts_[0];
          const name = c.name?.[0] || "Contact";
          let phone = c.tel?.[0] || "";
          phone = phone.replace(/[\s\-\(\)]/g, "").replace(/^\+91/, "").replace(/^91(?=\d{10}$)/, "");
          if (/^[6-9]\d{9}$/.test(phone)) {
            const upi = phone + "@ekpay";
            setContacts((prev: any) => [[name, `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`, upi], ...prev]);
            setPayToIdx(0);
            go("pay");
            showToast(`${name} selected ✓`);
            return true;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") showToast("Contact picker not available");
    }
    return false;
  };

  const handlePinKey = async (k: string) => {
    if (k === "." || payBusy) return;
    tone(680, 0.04);
    vibrate(5);
    setPinErr("");
    if (k !== "Pay") {
      setPin(k === "⌫" ? pin.slice(0, -1) : (pin + k).slice(0, 4));
      return;
    }
    if (pin.length !== 4) { setPinErr("4-digit UPI PIN daalo"); return; }
    const next = pin;

    setPayBusy(true);
    if (!payKey.current) payKey.current = newKey(); // network retry par double-charge nahi hoga
    const a = Number(payAmt);
    const isBill = contacts[payToIdx][1] === "Verified Bill/Merchant";
    const r = await apiCall("POST", "/api/payments", {
      amount: a,
      receiver: contacts[payToIdx][0].slice(0, 80),
      vpa: /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/.test(String(contacts[payToIdx][2] || "")) ? String(contacts[payToIdx][2]).toLowerCase() : undefined,
      pin: next,
      note: payNote ? payNote.slice(0, 100) : undefined,
      category: isBill ? "Bills" : "Transfer",
      bankAccountId: accountIds[payBankIdx],
      idempotencyKey: payKey.current,
    });
    setPayBusy(false);

    if (!r.ok) {
      tone(300, 0.2);
      vibrate([80, 30, 80, 30, 80]); // triple-buzz for error
      setPin("");
      if (r.code === "INVALID_PIN" || r.code === "LOCKED" || r.code === "NETWORK") return setPinErr(r.message);
      setPinSheet(false);
      payKey.current = "";
      return showToast(r.message);
    }
    payKey.current = "";
    await loadAll();
    vibrate([50, 30, 50]); // double-buzz for success
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
    vibrate(5);
    const next = k === "⌫" ? lockPin.slice(0, -1) : (lockPin + k).slice(0, 4);
    setLockPin(next);
    if (next.length === 4) {
      tone(980, 0.15);
      vibrate([50, 30, 50]);
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
  // Numeric subParam (txn:0, txn:1...) title me mat dikhao
  const titleKey = subParam && !/^\d+$/.test(subParam) ? subParam : baseView;
  const headerTitle =
    baseView === "stk"
      ? subParam
      : SCREEN_TITLES[titleKey] || SCREEN_TITLES[baseView] || titleKey;

  return {
    showSplash,
    setShowSplash,
    splashFade,
    setSplashFade,
    unlocked,
    setUnlocked,
    lockPin,
    setLockPin,
    soundOn,
    setSoundOn,
    intlUpi,
    setIntlUpi,
    upiLiteBal,
    setUpiLiteBal,
    sessionUser,
    setSessionUser,
    serverBanks,
    setServerBanks,
    npciBanks,
    setNpciBanks,
    bankQuery,
    setBankQuery,
    pickedBank,
    setPickedBank,
    discoveredAccs,
    setDiscoveredAccs,
    checkedBalances,
    setCheckedBalances,
    balCheckModal,
    setBalCheckModal,
    balSheetOpen,
    setBalSheetOpen,
    heroBalMode,
    setHeroBalMode,
    heroSingleBankId,
    setHeroSingleBankId,
    balPinBusy,
    setBalPinBusy,
    balPinError,
    setBalPinError,
    collectVpa,
    setCollectVpa,
    collectAmt,
    setCollectAmt,
    collectNote,
    setCollectNote,
    collectList,
    setCollectList,
    collectPinMap,
    setCollectPinMap,
    complaintsList,
    setComplaintsList,
    compCat,
    setCompCat,
    compDesc,
    setCompDesc,
    resetPass,
    setResetPass,
    resetNewPin,
    setResetNewPin,
    simMode,
    setSimMode,
    refreshServerState,
    loadCollectAndComplaints,
    searchNpciBanks,
    theme,
    setTheme,
    payAlerts,
    setPayAlerts,
    prefsReady,
    setPrefsReady,
    settingsSaved,
    authState,
    setAuthState,
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
    setAuthBusy,
    me,
    setMe,
    accountIds,
    setAccountIds,
    payBusy,
    setPayBusy,
    pinErr,
    setPinErr,
    curPin,
    setCurPin,
    payKey,
    loanId,
    setLoanId,
    pinTask,
    setPinTask,
    busyRef,
    budgetTimer,
    navHist,
    setNavHist,
    view,
    mobNum,
    setMobNum,
    mobOp,
    setMobOp,
    mobTab,
    setMobTab,
    trFrom,
    setTrFrom,
    trTo,
    setTrTo,
    trDate,
    setTrDate,
    trClass,
    setTrClass,
    trPassenger,
    setTrPassenger,
    dthOp,
    setDthOp,
    dthId,
    setDthId,
    elecBoard,
    setElecBoard,
    elecId,
    setElecId,
    fastagBank,
    setFastagBank,
    vehNo,
    setVehNo,
    fastagAmt,
    setFastagAmt,
    gasOp,
    setGasOp,
    gasId,
    setGasId,
    contacts,
    setContacts,
    banks,
    setBanks,
    getLiveBanks,
    holdings,
    setHoldings,
    sips,
    setSips,
    mandates,
    setMandates,
    goldGrams,
    setGoldGrams,
    emiPaid,
    setEmiPaid,
    cardDue,
    setCardDue,
    budget,
    setBudget,
    txns,
    setTxns,
    notifs,
    setNotifs,
    unread,
    setUnread,
    banner,
    setBanner,
    hideBal,
    setHideBal,
    searchQ,
    setSearchQ,
    filterCat,
    setFilterCat,
    toast,
    setToast,
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
    qrMode,
    setQrMode,
    camActive,
    setCamActive,
    videoRef,
    payToIdx,
    setPayToIdx,
    payAmt,
    setPayAmt,
    payNote,
    setPayNote,
    payBankIdx,
    setPayBankIdx,
    useLite,
    setUseLite,
    pinSheet,
    setPinSheet,
    pin,
    setPin,
    sipP,
    setSipP,
    sipN,
    setSipN,
    sipR,
    setSipR,
    loanP,
    setLoanP,
    loanN,
    setLoanN,
    loanR,
    splitAmt,
    setSplitAmt,
    tone,
    showToast,
    pushNotif,
    stopCamera,
    startCamera,
    go,
    back,
    tab,
    newKey,
    apiCall,
    loadAll,
    submitAuth,
    act,
    payDone,
    triggerCheckout,
    downloadReceipt,
    shareReceipt,
    pickContact,
    pullRefresh,
    refreshing,
    navAnim,
    vibrate,
    handlePinKey,
    handleLockKey,
    myName,
    myUpi,
    myPhone,
    initials,
    totalBal,
    stockVal,
    portfolioTotal,
    catSpends,
    totalSpent,
    totalReceived,
    settingToggle,
    baseView,
    subParam,
    isRootTab,
    headerTitle,
  };
}

export type EkApp = ReturnType<typeof useEkApp>;
