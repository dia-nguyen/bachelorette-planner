"use client";

import { Card } from "@/components/ui";
import type { CategoryBreakdown } from "@/lib/data";
import { formatBudgetLabel, formatCurrency } from "@/lib/domain";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  ACCOMMODATION: "#A78BFA",
  RESTAURANT: "#F59E0B",
  ACTIVITY: "#3B82F6",
  DECORATION: "#EC4899",
  TRANSPORT: "#6366F1",
  OUTFIT: "#10B981",
  MISC: "#9CA3AF",
};

interface BudgetSnapshotProps {
  breakdown: CategoryBreakdown[];
  totalBudget: number;
  totalSpent: number;
}

export function BudgetSnapshot({ breakdown, totalBudget, totalSpent }: BudgetSnapshotProps) {
  const chartData = breakdown.map((b) => ({
    name: formatBudgetLabel(b.category),
    value: b.actual > 0 ? b.actual : b.planned,
    color: CATEGORY_COLORS[b.category] ?? "#9CA3AF",
  }));

  return (
    <Card className="h-full flex flex-col">
      <h3
        style={{
          fontSize: "var(--font-lg)",
          fontWeight: 600,
          marginBottom: "var(--space-sm)",
        }}
      >
        Budget snapshot
      </h3>

      <div className="flex flex-wrap items-stretch gap-6" style={{ flex: 1, minHeight: 0 }}>
        {/* Left: total numbers */}
        <div className="flex flex-col justify-center" style={{ minWidth: 160, flex: "1 1 160px" }}>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
            Total budget
          </p>
          <p style={{ fontSize: 32, fontWeight: 700 }}>{formatCurrency(totalBudget)}</p>
          <div
            style={{
              marginTop: 6,
              height: 4,
              borderRadius: "var(--radius-pill)",
              background: "var(--color-bg-muted)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%`,
                borderRadius: "var(--radius-pill)",
                background: "var(--color-accent)",
              }}
            />
          </div>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 4 }}>
            {formatCurrency(totalSpent)} spent
          </p>
        </div>

        {/* Chart — grows to fill */}
        <div style={{ flex: "2 1 180px", position: "relative", minHeight: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="90%"
                outerRadius="100%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--font-sm)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(totalBudget)}</span>
            <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
              {formatCurrency(totalSpent)} spent
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col justify-center gap-2" style={{ minWidth: 140, flex: "1 1 120px" }}>
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center gap-2" style={{ fontSize: "var(--font-base, 14px)" }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: d.color,
                  flexShrink: 0,
                }}
              />
              <span>{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
