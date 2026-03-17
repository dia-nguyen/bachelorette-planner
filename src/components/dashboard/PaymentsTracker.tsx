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
          {/* Desktop / tablet */}
          <div className="hidden sm:flex sm:flex-col sm:gap-3">
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
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={p.userName} color={p.avatarColor} size={28} />
                    <span
                      className="truncate"
                      style={{ fontWeight: 500, fontSize: "var(--font-sm)" }}
                    >
                      {p.userName}
                    </span>
                  </div>

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

          {/* Mobile */}
          <div className="sm:hidden flex flex-col gap-2">
            {payments.map((p) => {
              const balance = p.paid - p.actual;
              return (
                <div
                  key={p.userId}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "10px 12px",
                    background: "var(--color-bg-muted)",
                  }}
                >
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <Avatar name={p.userName} color={p.avatarColor} size={24} />
                    <span style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{p.userName}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p style={{ fontSize: "var(--font-xs)", color: "var(--color-text-secondary)" }}>Planned</p>
                      <p style={{ fontSize: "var(--font-sm)", fontWeight: 500 }}>{formatCurrency(p.planned)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-xs)", color: "var(--color-text-secondary)" }}>Actual</p>
                      <p style={{ fontSize: "var(--font-sm)", fontWeight: 500 }}>{formatCurrency(p.actual)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-xs)", color: "var(--color-text-secondary)" }}>Paid Out</p>
                      <p
                        style={{
                          fontSize: "var(--font-sm)",
                          fontWeight: 600,
                          color: balance >= 0 ? "var(--color-status-positive-text, #16a34a)" : "#DC2626",
                        }}
                      >
                        {formatCurrency(p.paid)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
