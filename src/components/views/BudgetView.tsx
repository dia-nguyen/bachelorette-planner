"use client";

import { Badge, budgetStatusVariant, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { BudgetItem, TripEvent } from "@/lib/data";
import { formatCurrency } from "@/lib/domain";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

const cellSt: CSSProperties = {
  padding: "10px 12px",
  fontSize: "var(--font-sm)",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--color-border)",
};

const headCellSt: CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg-muted)",
  borderBottom: "2px solid var(--color-border)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

/** Get the attendee user IDs for a budget item (from linked event or explicit list) */
function getItemAttendees(
  item: BudgetItem,
  events: TripEvent[],
  validUserIds: Set<string>,
): string[] {
  const dedupe = (ids: string[] | undefined) =>
    Array.from(new Set((ids ?? []).filter((id) => validUserIds.has(id))));
  if (item.relatedEventId) {
    const ev = events.find((e) => e.id === item.relatedEventId);
    return dedupe(ev?.attendeeUserIds);
  }
  return dedupe(item.splitAttendeeUserIds);
}

/** Compute per-person planned cost for a single budget item */
function perPersonPlanned(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
  validUserIds: Set<string>,
): number {
  if (item.splitType === "custom" && item.plannedSplits?.[userId] != null) {
    return item.plannedSplits[userId];
  }
  const attendees = getItemAttendees(item, events, validUserIds);
  const count = attendees.length || 1;
  return item.plannedAmount / count;
}

/** Compute per-person actual cost for a single budget item */
function perPersonActual(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
  validUserIds: Set<string>,
): number {
  if (item.splitType === "custom" && item.actualSplits?.[userId] != null) {
    return item.actualSplits[userId];
  }
  const attendees = getItemAttendees(item, events, validUserIds);
  const count = attendees.length || 1;
  return item.actualAmount / count;
}

/** Check if a user is involved in this budget item */
function isUserInvolved(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
  validUserIds: Set<string>,
): boolean {
  if (item.paidByUserId === userId) return true;
  if (item.responsibleUserId === userId) return true;
  const attendees = getItemAttendees(item, events, validUserIds);
  if (attendees.includes(userId)) return true;
  // If no attendees defined, item applies to everyone
  if (attendees.length === 0) return true;
  return false;
}

export function BudgetView() {
  const { budgetItems, users, events, openPanel } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string | "all">("all");
  const validUserIds = useMemo(() => new Set(users.map((user) => user.id)), [users]);

  // Filter items based on selected participant
  const filteredItems = useMemo(() => {
    if (selectedUserId === "all") return budgetItems;
    return budgetItems.filter((item) => isUserInvolved(item, selectedUserId, events, validUserIds));
  }, [budgetItems, events, selectedUserId, validUserIds]);

  const totalPlanned = filteredItems.reduce((s, b) => s + b.plannedAmount, 0);
  const totalActual = filteredItems.reduce((s, b) => s + b.actualAmount, 0);

  // Per-person summary when a participant is selected
  const personSummary = useMemo(() => {
    if (selectedUserId === "all") return null;
    let owes = 0;
    let paid = 0;
    let plannedShare = 0;
    for (const item of filteredItems) {
      plannedShare += perPersonPlanned(item, selectedUserId, events, validUserIds);
      if (item.actualAmount > 0) {
        owes += perPersonActual(item, selectedUserId, events, validUserIds);
      }
      if (item.paidByUserId === selectedUserId) {
        paid += item.actualAmount;
      }
    }
    return { plannedShare, owes, paid, net: paid - owes };
  }, [filteredItems, events, selectedUserId, validUserIds]);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
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
        <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          <table style={{ width: "100%", minWidth: selectedUserId === "all" ? 720 : 840, borderCollapse: "collapse", background: "var(--color-bg-surface)" }}>
            <thead>
              <tr>
                <th style={headCellSt}>Title</th>
                <th style={headCellSt}>Category</th>
                <th style={headCellSt}>Planned</th>
                <th style={headCellSt}>Actual</th>
                <th style={headCellSt}>Paid By</th>
                <th style={headCellSt}>Status</th>
                {selectedUserId !== "all" && <th style={headCellSt}>Your Share</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const payer = users.find((u) => u.id === item.paidByUserId);
                const yourShare = selectedUserId !== "all"
                  ? (
                    item.actualAmount > 0
                      ? perPersonActual(item, selectedUserId, events, validUserIds)
                      : perPersonPlanned(item, selectedUserId, events, validUserIds)
                  )
                  : 0;

                return (
                  <tr
                    key={item.id}
                    onClick={() => openPanel("budget", item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPanel("budget", item.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    style={{ cursor: "pointer" }}
                  >
                    <td style={cellSt}>
                      <span style={{ fontWeight: 500 }}>{item.title}</span>
                    </td>
                    <td style={cellSt}>
                      <Badge variant="accent">{item.category}</Badge>
                    </td>
                    <td style={cellSt}>{formatCurrency(item.plannedAmount)}</td>
                    <td style={{ ...cellSt, color: item.actualAmount > 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                      {item.actualAmount > 0 ? formatCurrency(item.actualAmount) : "—"}
                    </td>
                    <td style={cellSt}>
                      {payer ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={payer.name} color={payer.avatarColor} size={24} />
                          <span>{payer.name.split(" ")[0]}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={cellSt}>
                      <Badge variant={budgetStatusVariant(item.status)}>{item.status}</Badge>
                    </td>
                    {selectedUserId !== "all" && (
                      <td style={{ ...cellSt, fontWeight: 600, color: "var(--color-accent)" }}>
                        {formatCurrency(yourShare)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
