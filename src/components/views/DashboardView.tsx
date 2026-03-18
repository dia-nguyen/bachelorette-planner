"use client";

import {
  BudgetSnapshot,
  KPICards,
  NextUp,
  OpenTasks,
  PaymentsTracker,
} from "@/components/dashboard";
import { useApp } from "@/lib/context";

export function DashboardView() {
  const { dashboard, tasks, users, openPanel } = useApp();

  return (
    <div className="flex flex-col gap-3 md:gap-6">
      {/* Top row: KPIs */}
      <KPICards kpis={dashboard.kpis} tasksSummary={dashboard.allTasksSummary} />

      {/* Middle row: Next Up + Budget Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <NextUp
          events={dashboard.nextUp}
          onEventClick={(id) => openPanel("event", id)}
        />
        <BudgetSnapshot
          breakdown={dashboard.budgetBreakdownByCategory}
          totalBudget={dashboard.kpis.totalBudget}
          totalSpent={dashboard.kpis.totalSpent}
        />
      </div>

      {/* Bottom row: Tasks + Payments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <OpenTasks
          tasks={tasks}
          summary={dashboard.allTasksSummary}
          users={users}
          onTaskClick={(id) => openPanel("task", id)}
        />
        <PaymentsTracker payments={dashboard.paymentsSummary} />
      </div>
    </div>
  );
}
