"use client";

import { AppShell } from "@/components/AppShell";
import { AppProvider } from "@/lib/context";
import { Suspense } from "react";

export default function Home() {
  return (
    <AppProvider>
      <Suspense>
        <AppShell />
      </Suspense>
    </AppProvider>
  );
}
