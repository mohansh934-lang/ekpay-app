"use client";

import { CATALOG } from "@/lib/constants";
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
import { useEk } from "@/context/EkContext";
import { NotifBanner } from "@/components/layout/NotifBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { TxnScreen } from "@/components/screens/TxnScreen";
import { StkScreen } from "@/components/screens/StkScreen";
import { BottomNav } from "@/components/layout/BottomNav";

export function MainApp() {
  const {
    txns,
    banner,
    baseView,
    subParam,
  } = useEk();

  return (
    <>
      {banner && <NotifBanner />}

      <div id="stb">
        <span>9:41</span>
        <div className="notch"></div>
        <span>5G • 100%</span>
      </div>

      {/* HEADER: NO BACK BUTTON ON THE 4 ROOT TABS, WORKING BACK BUTTON ON ALL INNER SCREENS! */}
      <AppHeader />

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

        {baseView === "txn" && subParam !== undefined && <TxnScreen />}

        {baseView === "notif" && <NotifScreen />}

        {baseView === "cat" && subParam && CATALOG[subParam] && <CatScreen />}

        {baseView === "stk" && subParam && <StkScreen />}

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

      <BottomNav />
      <div id="hbar"></div>
    </>
  );
}
