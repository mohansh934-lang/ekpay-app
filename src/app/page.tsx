"use client";

import { useEkApp } from "@/hooks/useEkApp";
import { EkAppView } from "@/components/EkAppView";

export default function EkAppFullStack() {
  const app = useEkApp();
  return <EkAppView app={app} />;
}
