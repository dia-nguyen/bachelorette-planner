/* ============================================================
   Domain Types — Core data model
   ============================================================ */

// ---- Enums ----

export type Role = "MOH_ADMIN" | "GUEST_CONFIRMED";

export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type EventStatus = "DRAFT" | "PLANNED" | "CONFIRMED" | "CANCELED";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type BudgetCategory =
  | "ACTIVITY"
  | "DECORATION"
  | "RESTAURANT"
  | "ACCOMMODATION"
  | "TRANSPORT"
  | "OUTFIT"
  | "MISC";

export type BudgetItemStatus =
  | "PLANNED"
  | "PURCHASED"
  | "REIMBURSED"
  | "SETTLED";

/** How costs are divided among attendees */
export type CostSplitType = "even" | "custom";

// ---- Entities ----

/** Definition of a custom guest profile field */
export interface GuestFieldDef {
  id: string;
  label: string;
  type: "text" | "tel" | "number" | "date" | "textarea";
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
  /** Values for trip-defined custom guest fields: fieldId → value */
  customFields?: Record<string, string>;
}

export interface Trip {
  id: string;
  name: string;
  startAt: string; // ISO date
  endAt: string;
  location: string;
  description?: string;
  createdByUserId: string;
  /** Custom fields to collect for each guest */
  guestFieldSchema?: GuestFieldDef[];
}

export interface Membership {
  tripId: string;
  userId: string;
  role: Role;
  inviteStatus: InviteStatus;
}

export interface TripEvent {
  id: string;
  tripId: string;
  title: string;
  startAt: string;
  endAt?: string; // optional — some events are open-ended
  location: string;
  description: string;
  status: EventStatus;

  // Booking / reservation (optional — merged from Booking entity)
  provider?: string;
  confirmationCode?: string;

  // Attendees — which trip members are going to this specific event
  attendeeUserIds: string[];
}

export interface Task {
  id: string;
  tripId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  assigneeUserIds: string[];
  relatedEventId: string | null;
  relatedBudgetItemId: string | null;
}

export interface BudgetItem {
  id: string;
  tripId: string;
  title: string;
  category: BudgetCategory;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  responsibleUserId: string | null;
  paidByUserId: string | null;
  status: BudgetItemStatus;
  relatedEventId: string | null;
  relatedTaskId: string | null;
  notes: string;
  /** How cost amounts are entered: as a grand total or per person */
  costMode?: "total" | "per_person";
  /** How costs are divided among attendees */
  splitType?: CostSplitType;
  /** Per-attendee planned amounts when splitType === "custom" (userId → amount) */
  plannedSplits?: Record<string, number>;
  /** Per-attendee actual amounts when splitType === "custom" (userId → amount) */
  actualSplits?: Record<string, number>;
  /**
   * For budget items NOT linked to an event, the explicit list of people
   * sharing this cost (userId[]). When relatedEventId is set, the linked
   * event's attendeeUserIds are used instead.
   */
  splitAttendeeUserIds?: string[];
}

// ---- Dashboard aggregation ----

export interface DashboardKPIs {
  daysToGo: number;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  myContribution: number;
  outstandingPayments: number;
  tasksCompletionPercent: number;
  guestsInvited: number;
  guestsConfirmed: number;
}

export interface CategoryBreakdown {
  category: BudgetCategory;
  planned: number;
  actual: number;
}

export interface PaymentSummary {
  userId: string;
  userName: string;
  planned: number;
  actual: number;
  paid: number;
  avatarColor?: string;
}

export interface TasksSummary {
  urgent: number;
  inProgress: number;
  done: number;
  total: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  nextUp: TripEvent[];
  budgetBreakdownByCategory: CategoryBreakdown[];
  myTasks: Task[];
  allTasksSummary: TasksSummary;
  paymentsSummary: PaymentSummary[];
}

// ---- Context panel ----

export type PanelContentType = "event" | "task" | "budget" | null;

export interface PanelState {
  type: PanelContentType;
  id: string | null;
}

// ---- Plan Activity (unified creation) ----

/** Input for the "Plan Activity" flow — toggle which entities to create. */
export interface PlanActivityInput {
  title: string;
  description: string;

  // Per-section title overrides (when user unlocks the field)
  eventTitleOverride?: string;
  taskTitleOverride?: string;
  budgetTitleOverride?: string;

  // 📅 Event (optional)
  createEvent: boolean;
  eventLocation?: string;
  eventStartAt?: string; // ISO
  eventEndAt?: string; // ISO
  eventStatus?: EventStatus;
  eventProvider?: string;
  eventConfirmationCode?: string;
  eventAttendeeUserIds?: string[];

  // ✅ Task (optional)
  createTask: boolean;
  taskAssigneeIds?: string[];
  taskPriority?: TaskPriority;
  taskStatus?: TaskStatus;
  taskDueAt?: string | null; // ISO

  // 💰 Budget (optional)
  createBudget: boolean;
  budgetCategory?: BudgetCategory;
  budgetPlannedAmount?: number;
  budgetActualAmount?: number;
  budgetStatus?: BudgetItemStatus;
  budgetResponsibleId?: string | null;
  budgetPaidById?: string | null;
  budgetNotes?: string;
}

// ---- Checklist ----

export type ChecklistCategory =
  | "Clothing"
  | "Toiletries"
  | "Accessories"
  | "Decorations"
  | "Supplies"
  | "Other";

export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  isChecked: boolean;
  assigneeUserId: string | null;
  category: ChecklistCategory;
}

// ---- Polls ----

export interface PollOption {
  id: string;
  label: string;
  voterUserIds: string[];
}

export interface Poll {
  id: string;
  tripId: string;
  question: string;
  createdByUserId: string;
  options: PollOption[];
  isClosed: boolean;
}

// ---- Photos ----

export interface Photo {
  id: string;
  tripId: string;
  /** base64 data URI for demo mode */
  url: string;
  caption: string;
  uploadedByUserId: string;
  relatedEventId: string | null;
  createdAt: string; // ISO
}
