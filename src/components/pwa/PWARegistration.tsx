"use client";

import { useEffect } from "react";

export function PWARegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const isProduction = process.env.NODE_ENV === "production";
    const isLocalhost = window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    const allowLocalhostPWA = process.env.NEXT_PUBLIC_ENABLE_PWA_LOCALHOST === "true";

    const manageServiceWorker = async () => {
      try {
        if (isLocalhost && !isProduction && !allowLocalhostPWA) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          return;
        }
        if (!isProduction) return;
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("[PWA] Service worker registration failed:", error);
      }
    };

    void manageServiceWorker();
  }, []);

  return null;
}
