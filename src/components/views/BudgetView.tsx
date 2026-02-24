"use client";

import { Badge, budgetStatusVariant, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { BudgetItem, TripEvent } from "@/lib/data";
import { formatCurrency } from "@/lib/domain";
import { useMemo, useState } from "react";

/** Get the attendee user IDs for a budget item (from linked event or explicit list) */
function getItemAttendees(item: BudgetItem, events: TripEvent[]): string[] {
  if (item.relatedEventId) {
    const ev = events.find((e) => e.id === item.relatedEventId);
    return ev?.attendeeUserIds ?? [];
  }
  return item.splitAttendeeUserIds ?? [];
}

/** Compute per-person planned cost for a single budget item */
function perPersonPlanned(item: BudgetItem, userId: string, events: TripEvent[]): number {
  if (item.splitType === "custom" && item.plannedSplits?.[userId] != null) {
    return item.plannedSplits[userId];
  }
  const attendees = getItemAttendees(item, events);
  const count = attendees.length || 1;
  return item.plannedAmount / count;
}

/** Compute per-person actual cost for a single budget item */
function perPersonActual(item: BudgetItem, userId: string, events: TripEvent[]): number {
  if (item.splitType === "custom" && item.actualSplits?.[userId] != null) {
    return item.actualSplits[userId];
  }
  const attendees = getItemAttendees(item, events);
  const count = attendees.length || 1;
  return item.actualAmount / count;
}

/** Check if a user is involved in this budget item */
function isUserInvolved(item: BudgetItem, userId: string, events: TripEvent[]): boolean {
  if (item.paidByUserId === userId) return true;
  if (item.responsibleUserId === userId) return true;
  const attendees = getItemAttendees(item, events);
  if (attendees.includes(userId)) return true;
  // If no attendees defined, item applies to everyone
  if (attendees.length === 0) return true;
  return false;
}

export function BudgetView() {
  const { budgetItems, users, events, openPanel } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string | "all">("all");

  // Filter items based on selected participant
  const filteredItems = useMemo(() => {
    if (selectedUserId === "all") return budgetItems;
    return budgetItems.filter((item) => isUserInvolved(item, selectedUserId, events));
  }, [budgetItems, events, selectedUserId]);

  const totalPlanned = filteredItems.reduce((s, b) => s + b.plannedAmount, 0);
  const totalActual = filteredItems.reduce((s, b) => s + b.actualAmount, 0);

  // Per-person summary when a participant is selected
  const personSummary = useMemo(() => {
    if (selectedUserId === "all") return null;
    let owes = 0;
    let paid = 0;
    let plannedShare = 0;
    for (const item of filteredItems) {
      plannedShare += perPersonPlanned(item, selectedUserId, events);
      if (item.actualAmount > 0) {
        owes += perPersonActual(item, selectedUserId, events);
      }
      if (item.paidByUserId === selectedUserId) {
        paid += item.actualAmount;
      }
    }
    return { plannedShare, owes, paid, net: paid - owes };
  }, [filteredItems, events, selectedUserId]);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Budget</h2>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
            {selectedUserId === "all"
              ? `${formatCurrency(totalActual)} spent of ${formatCurrency(totalPlanned)} planned`
              : `Showing ${filteredItems.length} items for ${selectedUser?.name ?? "participant"}`}
          </p>
        </div>

        {/* Participant filter */}
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-muted)",
            color: "var(--color-text-primary)",
            fontSize: "var(--font-md)",
            cursor: "pointer",
            outline: "none",
            minWidth: 180,
          }}
        >
          <option value="all">All Participants</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Per-person cost summary card */}
      {personSummary && selectedUser && (
        <Card>
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <Avatar name={selectedUser.name} color={selectedUser.avatarColor} size={32} />
            <span style={{ fontWeight: 600, fontSize: "var(--font-lg)" }}>{selectedUser.name}&apos;s Costs</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Planned Share</p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(personSummary.plannedShare)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Owes</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: personSummary.owes > 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{formatCurrency(personSummary.owes)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Paid</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-accent)" }}>{formatCurrency(personSummary.paid)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Net Balance</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: personSummary.net >= 0 ? "#10B981" : "#EF4444" }}>
                {personSummary.net >= 0 ? "+" : ""}{formatCurrency(personSummary.net)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState
          message={selectedUserId === "all" ? "No expenses yet" : "No expenses for this participant"}
          actionLabel="Plan something with the + button above"
        />
      ) : (
        <div className="overflow-x-auto">
          <Card style={{ minWidth: 580 }}>
            {/* Table header */}
            <div
              className="grid gap-3 py-2 mb-1"
              style={{
                gridTemplateColumns: selectedUserId === "all" ? "2fr 1fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
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
              {selectedUserId !== "all" && <span>Your Share</span>}
            </div>
            {filteredItems.map((item) => {
              const payer = users.find((u) => u.id === item.paidByUserId);
              const yourShare = selectedUserId !== "all"
                ? (item.actualAmount > 0 ? perPersonActual(item, selectedUserId, events) : perPersonPlanned(item, selectedUserId, events))
                : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => openPanel("budget", item.id)}
                  className="grid gap-3 py-3 w-full text-left"
                  style={{
                    gridTemplateColumns: selectedUserId === "all" ? "2fr 1fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
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
                  {selectedUserId !== "all" && (
                    <span style={{ fontWeight: 600, color: "var(--color-accent)" }}>{formatCurrency(yourShare)}</span>
                  )}
                </button>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}
