/**
 * Dashboard aggregation — pure functions.
 * All calculations are deterministic and unit-testable.
 */
import type {
  BudgetCategory,
  BudgetItem,
  CategoryBreakdown,
  DashboardData,
  DashboardKPIs,
  Membership,
  PaymentSummary,
  Task,
  TasksSummary,
  Trip,
  TripEvent,
  User,
} from "../data/types";

// ---- Helpers ----

/** Days between now and trip start. Returns 0 if trip has started. */
export function daysToGo(tripStartAt: string, now: Date = new Date()): number {
  const diff = new Date(tripStartAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Format currency with $ symbol */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Percentage as integer 0-100 */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

// ---- KPIs ----

export function computeKPIs(
  trip: Trip,
  memberships: Membership[],
  tasks: Task[],
  budgetItems: BudgetItem[],
  currentUserId: string,
  now: Date = new Date(),
): DashboardKPIs {
  const totalBudget = budgetItems.reduce((s, b) => s + b.plannedAmount, 0);
  const totalSpent = budgetItems.reduce((s, b) => s + b.actualAmount, 0);

  const myPaid = budgetItems
    .filter((b) => b.paidByUserId === currentUserId)
    .reduce((s, b) => s + b.actualAmount, 0);

  // Outstanding = items with status PURCHASED where paidByUser !== responsibleUser
  // Simplified: sum of actual amounts where status is PLANNED (not yet paid)
  const outstandingPayments = budgetItems
    .filter((b) => b.status === "PLANNED")
    .reduce((s, b) => s + b.plannedAmount, 0);

  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const totalTasks = tasks.length;

  const guestsInvited = memberships.length;
  const guestsClaimed = memberships.filter(
    (m) => m.accountStatus === "CLAIMED",
  ).length;

  return {
    daysToGo: daysToGo(trip.startAt, now),
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    myContribution: myPaid,
    outstandingPayments,
    tasksCompletionPercent: pct(doneTasks, totalTasks),
    guestsInvited,
    guestsClaimed,
  };
}

// ---- Next Up ----

export function computeNextUp(
  events: TripEvent[],
  now: Date = new Date(),
): TripEvent[] {
  return events
    .filter((e) => new Date(e.startAt) >= now && e.status !== "CANCELED")
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    .slice(0, 5);
}

// ---- Budget breakdown by category ----

const ALL_CATEGORIES: BudgetCategory[] = [
  "ACCOMMODATION",
  "RESTAURANT",
  "ACTIVITY",
  "DECORATION",
  "TRANSPORT",
  "OUTFIT",
  "MISC",
];

export function computeBudgetBreakdown(
  budgetItems: BudgetItem[],
): CategoryBreakdown[] {
  const map = new Map<BudgetCategory, { planned: number; actual: number }>();
  for (const cat of ALL_CATEGORIES) {
    map.set(cat, { planned: 0, actual: 0 });
  }
  for (const item of budgetItems) {
    const entry = map.get(item.category)!;
    entry.planned += item.plannedAmount;
    entry.actual += item.actualAmount;
  }
  return ALL_CATEGORIES.map((category) => ({
    category,
    ...map.get(category)!,
  })).filter((c) => c.planned > 0 || c.actual > 0);
}

// ---- Tasks summary ----

export function computeTasksSummary(tasks: Task[]): TasksSummary {
  return {
    urgent: tasks.filter((t) => t.priority === "HIGH" && t.status !== "DONE")
      .length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    done: tasks.filter((t) => t.status === "DONE").length,
    total: tasks.length,
  };
}

// ---- Budget summary per person ----

/** Get the attendee user IDs for a budget item (from linked event or explicit list) */
function getItemAttendees(item: BudgetItem, events: TripEvent[]): string[] {
  if (item.relatedEventId) {
    const ev = events.find((e) => e.id === item.relatedEventId);
    return ev?.attendeeUserIds ?? [];
  }
  return item.splitAttendeeUserIds ?? [];
}

/** Per-person planned amount for one budget item */
function ppPlanned(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
): number {
  if (item.splitType === "custom" && item.plannedSplits?.[userId] != null) {
    return item.plannedSplits[userId];
  }
  const attendees = getItemAttendees(item, events);
  const count = attendees.length || 1;
  return item.plannedAmount / count;
}

/** Per-person actual amount for one budget item */
function ppActual(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
): number {
  if (item.splitType === "custom" && item.actualSplits?.[userId] != null) {
    return item.actualSplits[userId];
  }
  const attendees = getItemAttendees(item, events);
  const count = attendees.length || 1;
  return item.actualAmount / count;
}

/** Check if a user is involved in a budget item */
function isInvolved(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
): boolean {
  if (item.paidByUserId === userId) return true;
  if (item.responsibleUserId === userId) return true;
  const attendees = getItemAttendees(item, events);
  if (attendees.includes(userId)) return true;
  if (attendees.length === 0) return true;
  return false;
}

export function computePaymentsSummary(
  budgetItems: BudgetItem[],
  users: User[],
  memberships: Membership[],
  events: TripEvent[],
): PaymentSummary[] {
  const allUserIds = memberships.map((m) => m.userId);

  return allUserIds.map((uid) => {
    const user = users.find((u) => u.id === uid);
    let planned = 0;
    let actual = 0;
    let paid = 0;
    for (const item of budgetItems) {
      if (!isInvolved(item, uid, events)) continue;
      planned += ppPlanned(item, uid, events);
      actual += ppActual(item, uid, events);
      if (item.paidByUserId === uid) {
        paid += item.actualAmount;
      }
    }
    return {
      userId: uid,
      userName: user?.name ?? "Unknown",
      planned: Math.round(planned),
      actual: Math.round(actual),
      paid: Math.round(paid),
      avatarColor: user?.avatarColor,
    };
  });
}

// ---- My tasks ----

export function computeMyTasks(tasks: Task[], currentUserId: string): Task[] {
  return tasks
    .filter(
      (t) =>
        (t.assigneeUserIds ?? []).includes(currentUserId) &&
        t.status !== "DONE",
    )
    .sort((a, b) => {
      // HIGH > MEDIUM > LOW
      const prioOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    });
}

// ---- Full dashboard ----

export function computeDashboard(
  trip: Trip,
  memberships: Membership[],
  users: User[],
  events: TripEvent[],
  tasks: Task[],
  budgetItems: BudgetItem[],
  currentUserId: string,
  now: Date = new Date(),
): DashboardData {
  return {
    kpis: computeKPIs(
      trip,
      memberships,
      tasks,
      budgetItems,
      currentUserId,
      now,
    ),
    nextUp: computeNextUp(events, now),
    budgetBreakdownByCategory: computeBudgetBreakdown(budgetItems),
    myTasks: computeMyTasks(tasks, currentUserId),
    allTasksSummary: computeTasksSummary(tasks),
    paymentsSummary: computePaymentsSummary(
      budgetItems,
      users,
      memberships,
      events,
    ),
  };
}
