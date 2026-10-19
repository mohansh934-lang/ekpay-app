"use client";

import { useEk } from "@/context/EkContext";

export function SplashOverlay() {
  const {
    splashFade,
  } = useEk();

  return (
    <div id="sp" className={splashFade ? "hide" : ""}>
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
