"use client";

import { type EkApp } from "@/hooks/useEkApp";
import { EkProvider } from "@/context/EkContext";
import { SplashOverlay } from "@/components/views/SplashOverlay";
import { AuthScreen } from "@/components/views/AuthScreen";
import { LockScreen } from "@/components/views/LockScreen";
import { MainApp } from "@/components/views/MainApp";
import { NumModal } from "@/components/modals/NumModal";
import { PinSheet } from "@/components/modals/PinSheet";
import { BalSheet } from "@/components/modals/BalSheet";
import { BalPinModal } from "@/components/modals/BalPinModal";

export function EkAppView({ app }: { app: EkApp }) {
  const {
    showSplash,
    unlocked,
    balCheckModal,
    balSheetOpen,
    authState,
    toast,
    numModal,
    pinSheet,
  } = app;

  return (
    <EkProvider app={app}>
      <div id="app">
        {showSplash && <SplashOverlay />}

        {authState === "loading" ? null : authState === "out" ? <AuthScreen /> : !unlocked ? <LockScreen /> : <MainApp />}

        {numModal && <NumModal />}

        {pinSheet && <PinSheet />}

        {/* SHEET 1: CHOOSE WHICH BANK BALANCE TO CHECK (OR TOTAL STEP-BY-STEP) */}
        {balSheetOpen && <BalSheet />}

        {/* SHEET 2: UPI PIN ENTRY FOR SINGLE BANK OR SEQUENTIAL ALL-BANKS */}
        {balCheckModal && <BalPinModal />}

        {toast && <div id="toast">{toast}</div>}
      </div>
    </EkProvider>
  );
}
