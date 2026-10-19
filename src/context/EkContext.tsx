"use client";

import React, { createContext, useContext } from "react";
import type { EkApp } from "@/hooks/useEkApp";

const EkCtx = createContext<EkApp | null>(null);

export function EkProvider({ app, children }: { app: EkApp; children: React.ReactNode }) {
  return <EkCtx.Provider value={app}>{children}</EkCtx.Provider>;
}

export function useEk(): EkApp {
  const v = useContext(EkCtx);
  if (!v) throw new Error("useEk must be used inside EkProvider");
  return v;
}
