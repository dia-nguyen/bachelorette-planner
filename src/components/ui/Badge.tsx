"use client";

import type { BudgetItemStatus, EventStatus, AccountStatus, TaskStatus } from "@/lib/data";

type BadgeVariant = "neutral" | "positive" | "warning" | "negative" | "accent";

const variantStyles: Record<BadgeVariant, { bg: string; color: string; }> = {
  neutral: { bg: "var(--color-bg-muted)", color: "var(--color-text-secondary)" },
  positive: { bg: "var(--color-status-positive)", color: "#166534" },
  warning: { bg: "var(--color-status-warning)", color: "#92400E" },
  negative: { bg: "var(--color-status-negative)", color: "#991B1B" },
  accent: { bg: "var(--color-accent-soft)", color: "#6D28D9" },
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--font-sm)",
        fontWeight: 500,
        background: styles.bg,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// Convenience mappers

export function eventStatusVariant(s: EventStatus): BadgeVariant {
  switch (s) {
    case "CONFIRMED": return "positive";
    case "PLANNED": return "warning";
    case "DRAFT": return "neutral";
    case "CANCELED": return "negative";
  }
}

export function taskStatusVariant(s: TaskStatus): BadgeVariant {
  switch (s) {
    case "DONE": return "positive";
    case "IN_PROGRESS": return "accent";
    case "TODO": return "neutral";
  }
}

export function budgetStatusVariant(s: BudgetItemStatus): BadgeVariant {
  switch (s) {
    case "SETTLED":
    case "REIMBURSED": return "positive";
    case "PURCHASED": return "accent";
    case "PLANNED": return "warning";
  }
}

export function accountStatusVariant(s: AccountStatus): BadgeVariant {
  switch (s) {
    case "CLAIMED": return "positive";
    case "INVITED": return "warning";
  }
}
