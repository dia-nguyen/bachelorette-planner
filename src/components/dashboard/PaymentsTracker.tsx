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
        Payments Tracker
      </h3>

      {payments.length === 0 ? (
        <EmptyState message="All payments settled" />
      ) : (
        <div className="flex flex-col gap-3">
          {payments.map((p) => (
            <div key={p.userId} className="flex items-center gap-3">
              <Avatar name={p.userName} color={p.avatarColor} size={32} />
              <span className="flex-1" style={{ fontWeight: 500 }}>
                {p.userName} owes
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: "#DC2626",
                  padding: "2px 12px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--color-status-negative)",
                  fontSize: "var(--font-sm)",
                }}
              >
                {formatCurrency(p.owes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
