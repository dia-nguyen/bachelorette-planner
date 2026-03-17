"use client";

import { Card } from "@/components/ui";
import type { DashboardKPIs, TasksSummary } from "@/lib/data";
import { formatCurrency } from "@/lib/domain";

interface KPICardsProps {
  kpis: DashboardKPIs;
  tasksSummary: TasksSummary;
}

export function KPICards({ kpis, tasksSummary }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {/* Days Until Trip */}
      <Card>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 4 }}>
          Days until trip
        </p>
        <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
          {kpis.daysToGo}
        </p>
      </Card>

      {/* Task Status */}
      <Card>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 4 }}>
          Task Status
        </p>
        <div className="flex items-center gap-3">
          <TaskDonut summary={tasksSummary} />
          <div style={{ fontSize: "var(--font-sm)" }}>
            <div className="flex items-center gap-1">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-status-positive)", display: "inline-block" }} />
              Done {tasksSummary.done}
            </div>
            <div className="flex items-center gap-1">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-accent)", display: "inline-block" }} />
              In Progress {tasksSummary.inProgress}
            </div>
            <div className="flex items-center gap-1">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-bg-muted)", border: "1px solid var(--color-border)", display: "inline-block" }} />
              To Do {tasksSummary.total - tasksSummary.inProgress - tasksSummary.done}
            </div>
          </div>
        </div>
      </Card>

      {/* Budget Remaining */}
      <Card>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 4 }}>
          Budget remaining
        </p>
        <p style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: kpis.remaining >= 0 ? "var(--color-text-primary)" : "#DC2626" }}>
          {formatCurrency(kpis.remaining)}
        </p>
        {/* Spend progress bar */}
        <div
          style={{
            marginTop: 8,
            marginBottom: 6,
            height: 6,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-bg-muted)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${kpis.totalBudget > 0 ? Math.min((kpis.totalSpent / kpis.totalBudget) * 100, 100) : 0}%`,
              borderRadius: "var(--radius-pill)",
              background: kpis.remaining >= 0 ? "var(--color-accent)" : "#DC2626",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
          {formatCurrency(kpis.totalSpent)} spent · {formatCurrency(kpis.totalBudget)} total
        </p>
      </Card>

      {/* Tasks Completed */}
      <Card>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 4 }}>
          Tasks completed
        </p>
        <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
          {kpis.tasksCompletionPercent}%
        </p>
        {/* Progress bar */}
        <div
          style={{
            marginTop: 8,
            height: 6,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-bg-muted)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${kpis.tasksCompletionPercent}%`,
              borderRadius: "var(--radius-pill)",
              background: "var(--color-accent)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function TaskDonut({ summary }: { summary: TasksSummary; }) {
  const size = 52;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = summary.total || 1; // avoid division by zero

  const donePct = summary.done / total;
  const inProgressPct = summary.inProgress / total;

  const doneLen = donePct * circumference;
  const inProgressLen = inProgressPct * circumference;

  // Each segment starts where the previous ended
  const doneOffset = 0;
  const inProgressOffset = doneLen;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-muted)" strokeWidth={stroke} />
      {/* Done segment */}
      {doneLen > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--color-status-positive)"
          strokeWidth={stroke}
          strokeDasharray={`${doneLen} ${circumference}`}
          strokeDashoffset={-doneOffset}
          strokeLinecap="butt"
        />
      )}
      {/* In Progress segment */}
      {inProgressLen > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeDasharray={`${inProgressLen} ${circumference}`}
          strokeDashoffset={-inProgressOffset}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}
