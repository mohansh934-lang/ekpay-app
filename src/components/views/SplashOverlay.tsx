"use client";

import { useEffect } from "react";
import { useEk } from "@/context/EkContext";

export function SplashOverlay() {
  const {
    splashFade,
    setShowSplash,
    setSplashFade,
  } = useEk();

  // Fail-safe: 1.6s me splash screen automatically remove ho jayegi
  useEffect(() => {
    const t1 = setTimeout(() => setSplashFade(true), 1100);
    const t2 = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [setSplashFade, setShowSplash]);

  return (
    <div
      id="sp"
      className={splashFade ? "hide" : ""}
      onClick={() => setShowSplash(false)}
      title="Tap to continue"
    >
      <div>
        <div className="lg">E</div>
        <b style={{ fontSize: 24, letterSpacing: -0.5 }}>Ek App</b>
        <p style={{ color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 4 }}>
          Sab kuch, ek hi jagah
        </p>
      </div>
    </div>
  );
}
