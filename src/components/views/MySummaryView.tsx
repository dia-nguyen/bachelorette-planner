"use client";

import { Badge, Card, eventStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { BudgetItem, TripEvent } from "@/lib/data";
import { formatCurrency } from "@/lib/domain";
import { useMemo } from "react";

function getItemAttendees(item: BudgetItem, events: TripEvent[]): string[] {
  if (item.relatedEventId) {
    const ev = events.find((e) => e.id === item.relatedEventId);
    return ev?.attendeeUserIds ?? [];
  }
  return item.splitAttendeeUserIds ?? [];
}

function perPersonCost(item: BudgetItem, userId: string, events: TripEvent[], field: "planned" | "actual"): number {
  const splits = field === "planned" ? item.plannedSplits : item.actualSplits;
  if (item.splitType === "custom" && splits?.[userId] != null) {
    return splits[userId];
  }
  const attendees = getItemAttendees(item, events);
  const count = attendees.length || 1;
  const amount = field === "planned" ? item.plannedAmount : item.actualAmount;
  return amount / count;
}

function isUserInvolved(item: BudgetItem, userId: string, events: TripEvent[]): boolean {
  if (item.paidByUserId === userId || item.responsibleUserId === userId) return true;
  const attendees = getItemAttendees(item, events);
  if (attendees.includes(userId)) return true;
  if (attendees.length === 0) return true;
  return false;
}

const taskPriorityColor: Record<string, string> = {
  HIGH: "var(--color-status-negative)",
  MEDIUM: "var(--color-status-warning)",
  LOW: "var(--color-bg-muted)",
};

export function MySummaryView() {
  const { currentUserId, users, memberships, events, tasks, budgetItems, openPanel } = useApp();
  const me = users.find((u) => u.id === currentUserId);
  const myMembership = memberships.find((m) => m.userId === currentUserId);

  // My events (where I'm an attendee)
  const myEvents = useMemo(
    () =>
      events
        .filter((e) => (e.attendeeUserIds ?? []).includes(currentUserId) && e.status !== "CANCELED")
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [events, currentUserId],
  );

  // My tasks
  const myTasks = useMemo(
    () =>
      tasks
        .filter((t) => (t.assigneeUserIds ?? []).includes(currentUserId))
        .sort((a, b) => {
          const statusOrder: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
          return (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
        }),
    [tasks, currentUserId],
  );

  // My cost summary
  const costSummary = useMemo(() => {
    const relevant = budgetItems.filter((item) => isUserInvolved(item, currentUserId, events));
    let plannedShare = 0;
    let owes = 0;
    let paid = 0;
    for (const item of relevant) {
      plannedShare += perPersonCost(item, currentUserId, events, "planned");
      if (item.actualAmount > 0) {
        owes += perPersonCost(item, currentUserId, events, "actual");
      }
      if (item.paidByUserId === currentUserId) {
        paid += item.actualAmount;
      }
    }
    return { plannedShare, owes, paid, net: paid - owes, itemCount: relevant.length };
  }, [budgetItems, events, currentUserId]);

  const todoCount = myTasks.filter((t) => t.status === "TODO").length;
  const inProgressCount = myTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const doneCount = myTasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {me && <Avatar name={me.name} color={me.avatarColor} size={48} />}
        <div>
          <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700, margin: 0 }}>{me?.name ?? "My Summary"}</h2>
          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
            <Badge variant="accent">{myMembership?.role === "MOH_ADMIN" ? "Admin" : "Guest"}</Badge>
            <Badge variant={myMembership?.inviteStatus === "ACCEPTED" ? "positive" : "warning"}>
              {myMembership?.inviteStatus ?? "—"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>My Events</p>
          <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{myEvents.length}</p>
        </Card>
        <Card>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Tasks To Do</p>
          <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: todoCount > 0 ? "var(--color-text-primary)" : "#10B981" }}>
            {todoCount + inProgressCount}
          </p>
        </Card>
        <Card>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>My Planned Share</p>
          <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{formatCurrency(costSummary.plannedShare)}</p>
        </Card>
        <Card>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Net Balance</p>
          <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: costSummary.net >= 0 ? "#10B981" : "#EF4444" }}>
            {costSummary.net >= 0 ? "+" : ""}{formatCurrency(costSummary.net)}
          </p>
        </Card>
      </div>

      {/* My Events */}
      <div>
        <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 12 }}>My Events</h3>
        {myEvents.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-md)" }}>No events assigned to you yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => openPanel("event", ev.id)}
                style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
              >
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontWeight: 600, margin: 0 }}>{ev.title}</p>
                      <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {new Date(ev.startAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {new Date(ev.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                    </div>
                    <Badge variant={eventStatusVariant(ev.status)}>{ev.status}</Badge>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* My Tasks */}
      <div>
        <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 12 }}>
          My Tasks
          <span style={{ fontWeight: 400, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginLeft: 8 }}>
            {doneCount}/{myTasks.length} done
          </span>
        </h3>
        {myTasks.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-md)" }}>No tasks assigned to you.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => openPanel("task", t.id)}
                style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
              >
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: taskPriorityColor[t.priority] ?? "var(--color-bg-muted)",
                          border: t.priority === "LOW" ? "1px solid var(--color-border)" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 500,
                          textDecoration: t.status === "DONE" ? "line-through" : "none",
                          color: t.status === "DONE" ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                        }}
                      >
                        {t.title}
                      </span>
                    </div>
                    <Badge
                      variant={t.status === "DONE" ? "positive" : t.status === "IN_PROGRESS" ? "accent" : "warning"}
                    >
                      {t.status.replace("_", " ")}
                    </Badge>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* My Costs breakdown */}
      <div>
        <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 12 }}>My Cost Breakdown</h3>
        <Card>
          <div className="grid grid-cols-3 gap-4" style={{ textAlign: "center" }}>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>I Owe</p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(costSummary.owes)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>I&apos;ve Paid</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-accent)" }}>{formatCurrency(costSummary.paid)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Net</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: costSummary.net >= 0 ? "#10B981" : "#EF4444" }}>
                {costSummary.net >= 0 ? "+" : ""}{formatCurrency(costSummary.net)}
              </p>
            </div>
          </div>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 12, textAlign: "center" }}>
            Across {costSummary.itemCount} budget items
          </p>
        </Card>
      </div>
    </div>
  );
}
