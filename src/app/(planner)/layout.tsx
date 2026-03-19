"use client";

import { AppShell } from "@/components/AppShell";
import { AppProvider } from "@/lib/context";

export default function PlannerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppProvider>
      <AppShell />
      {children}
    </AppProvider>
  );
}
