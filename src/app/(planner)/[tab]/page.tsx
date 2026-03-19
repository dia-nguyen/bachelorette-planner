import { PLANNER_TABS, isPlannerTab } from "@/lib/navigation/plannerTabs";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return PLANNER_TABS.map((tab) => ({ tab }));
}

export default async function PlannerTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!isPlannerTab(tab)) {
    notFound();
  }

  return null;
}
