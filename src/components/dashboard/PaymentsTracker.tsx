"use client";

import { Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { PaymentSummary } from "@/lib/data";
import { formatCurrency } from "@/lib/domain";

interface PaymentsTrackerProps {
  payments: PaymentSummary[];
}

export function PaymentsTracker({ payments }: PaymentsTrackerProps) {
  return (
    <Card>
      <h3
        style={{
          fontSize: "var(--font-lg)",
          fontWeight: 600,
          marginBottom: "var(--space-md)",
        }}
      >
        Budget Summary
      </h3>

      {payments.length === 0 ? (
        <EmptyState message="No budget data yet" />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div
            className="grid items-center gap-2"
            style={{
              gridTemplateColumns: "1fr auto auto auto",
              fontSize: "var(--font-xs)",
              color: "var(--color-text-tertiary)",
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
            }}
          >
            <span>Person</span>
            <span style={{ textAlign: "right", minWidth: 68 }}>Planned</span>
            <span style={{ textAlign: "right", minWidth: 68 }}>Actual</span>
            <span style={{ textAlign: "right", minWidth: 68 }}>Paid Out</span>
          </div>

          {payments.map((p) => {
            const balance = p.paid - p.actual;
            return (
              <div
                key={p.userId}
                className="grid items-center gap-2"
                style={{ gridTemplateColumns: "1fr auto auto auto" }}
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={p.userName} color={p.avatarColor} size={28} />
                  <span
                    className="truncate"
                    style={{ fontWeight: 500, fontSize: "var(--font-sm)" }}
                  >
                    {p.userName}
                  </span>
                </div>

                {/* Planned */}
                <span
                  style={{
                    textAlign: "right",
                    fontSize: "var(--font-sm)",
                    color: "var(--color-text-secondary)",
                    minWidth: 68,
                  }}
                >
                  {formatCurrency(p.planned)}
                </span>

                {/* Actual */}
                <span
                  style={{
                    textAlign: "right",
                    fontSize: "var(--font-sm)",
                    fontWeight: 500,
                    minWidth: 68,
                  }}
                >
                  {formatCurrency(p.actual)}
                </span>

                {/* Paid out by this person */}
                <span
                  style={{
                    textAlign: "right",
                    fontSize: "var(--font-sm)",
                    fontWeight: 600,
                    minWidth: 68,
                    color: balance >= 0 ? "var(--color-status-positive-text, #16a34a)" : "#DC2626",
                  }}
                >
                  {formatCurrency(p.paid)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
