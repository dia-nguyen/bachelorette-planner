"use client";

import { Badge, budgetStatusVariant, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import { formatCurrency } from "@/lib/domain";

export function BudgetView() {
  const { budgetItems, users, openPanel } = useApp();

  const totalPlanned = budgetItems.reduce((s, b) => s + b.plannedAmount, 0);
  const totalActual = budgetItems.reduce((s, b) => s + b.actualAmount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Budget</h2>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
            {formatCurrency(totalActual)} spent of {formatCurrency(totalPlanned)} planned
          </p>
        </div>
      </div>

      {budgetItems.length === 0 ? (
        <EmptyState
          message="No expenses yet"
          actionLabel="Plan something with the + button above"
        />
      ) : (
        <div className="overflow-x-auto">
          <Card style={{ minWidth: 580 }}>
            {/* Table header */}
            <div
              className="grid gap-3 py-2 mb-1"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                fontSize: "var(--font-sm)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span>Title</span>
              <span>Category</span>
              <span>Planned</span>
              <span>Actual</span>
              <span>Paid By</span>
              <span>Status</span>
            </div>
            {budgetItems.map((item) => {
              const payer = users.find((u) => u.id === item.paidByUserId);
              const hasLinks = item.relatedEventId || item.relatedTaskId;
              return (
                <button
                  key={item.id}
                  onClick={() => openPanel("budget", item.id)}
                  className="grid gap-3 py-3 w-full text-left"
                  style={{
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                    borderBottom: "1px solid var(--color-border)",
                    background: "none",
                    border: "none",
                    borderBlockEnd: "1px solid var(--color-border)",
                    cursor: "pointer",
                    fontSize: "var(--font-md)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span style={{ fontWeight: 500 }}>{item.title}</span>
                    {hasLinks && (
                      <span style={{
                        fontSize: 10,
                        color: "var(--color-accent)",
                        background: "var(--color-accent-soft)",
                        padding: "1px 5px",
                        borderRadius: "var(--radius-pill)",
                      }}>🔗</span>
                    )}
                  </span>
                  <span><Badge variant="accent">{item.category}</Badge></span>
                  <span>{formatCurrency(item.plannedAmount)}</span>
                  <span>{item.actualAmount > 0 ? formatCurrency(item.actualAmount) : "—"}</span>
                  <span className="flex items-center gap-1">
                    {payer ? (
                      <>
                        <Avatar name={payer.name} color={payer.avatarColor} size={20} />
                        <span style={{ fontSize: "var(--font-sm)" }}>{payer.name.split(" ")[0]}</span>
                      </>
                    ) : (
                      <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                    )}
                  </span>
                  <span><Badge variant={budgetStatusVariant(item.status)}>{item.status}</Badge></span>
                </button>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}
