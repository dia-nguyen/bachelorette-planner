"use client";

import {
  clearAllData,
  demoRepository,
  exportStore,
  importStore,
  resetStore,
  subscribe,
  type BudgetItem,
  type DashboardData,
  type GuestFieldDef,
  type Membership,
  type PanelState,
  type PlanActivityInput,
  type Role,
  type Task,
  type Trip,
  type TripEvent,
  type User,
} from "@/lib/data";
import { computeDashboard } from "@/lib/domain";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";

// ---- Default trip & user for demo ----
const DEMO_TRIP_ID = "trip1";
const DEMO_USER_ID = "u1"; // Sarah Kim (MOH_ADMIN)

interface AppContextValue {
  // Current session
  tripId: string;
  currentUserId: string;
  currentRole: Role;

  // Trip info
  trip: Trip | null;
  updateTrip: (patch: Partial<Trip>) => void;

  // Dashboard (memoized aggregation)
  dashboard: DashboardData;

  // Entity lists
  events: TripEvent[];
  tasks: Task[];
  budgetItems: BudgetItem[];
  memberships: Membership[];
  users: User[];

  // Guest field schema (custom fields per trip)
  guestFieldSchema: GuestFieldDef[];
  addGuestField: (field: Omit<GuestFieldDef, "id">) => void;
  removeGuestField: (fieldId: string) => void;
  reorderGuestFields: (schema: GuestFieldDef[]) => void;

  // Panel
  panel: PanelState;
  openPanel: (type: PanelState["type"], id: string) => void;
  closePanel: () => void;

  // Mutations — guests
  inviteUser: (name: string, email: string) => void;
  updateUser: (userId: string, patch: Partial<User>) => void;
  updateMembershipStatus: (userId: string, status: Membership["inviteStatus"]) => void;
  updateMemberRole: (userId: string, role: Role) => void;

  // Mutations — events
  addEvent: (data: Omit<TripEvent, "id" | "tripId">) => void;
  updateEvent: (id: string, patch: Partial<TripEvent>) => void;
  deleteEvent: (id: string) => void;

  // Mutations — tasks
  addTask: (data: Omit<Task, "id" | "tripId">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  // Mutations — budget items
  addBudgetItem: (data: Omit<BudgetItem, "id" | "tripId">) => void;
  updateBudgetItem: (id: string, patch: Partial<BudgetItem>) => void;
  deleteBudgetItem: (id: string) => void;

  // Cross-entity creation helpers
  createTaskForBudgetItem: (budgetItemId: string) => void;

  // Unified "Plan Activity" — creates any combo of event/task/budget, all pre-linked
  planActivity: (input: PlanActivityInput) => void;

  // Data management
  clearAllData: () => void;
  resetDemoData: () => void;
  exportData: () => void;
  importData: (json: string) => void;

  // Refresh
  refresh: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode; }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Subscribe to repository changes
  useEffect(() => subscribe(refresh), [refresh]);

  // Panel state
  const [panel, setPanel] = useState<PanelState>({ type: null, id: null });
  const openPanel = useCallback(
    (type: PanelState["type"], id: string) => setPanel({ type, id }),
    []
  );
  const closePanel = useCallback(
    () => setPanel({ type: null, id: null }),
    []
  );

  const repo = demoRepository;
  const tripId = DEMO_TRIP_ID;
  const currentUserId = DEMO_USER_ID;

  // Read data — re-reads on every tick
  const events = useMemo(() => repo.getEvents(tripId), [tick, tripId]);
  const tasks = useMemo(() => repo.getTasks(tripId), [tick, tripId]);
  const budgetItems = useMemo(() => repo.getBudgetItems(tripId), [tick, tripId]);
  const memberships = useMemo(() => repo.getMemberships(tripId), [tick, tripId]);
  const users = useMemo(() => repo.getUsers(tripId), [tick, tripId]);
  const trip = repo.getTrip(tripId);

  const guestFieldSchema: GuestFieldDef[] = trip?.guestFieldSchema ?? [];

  const currentRole: Role = useMemo(() => {
    const m = memberships.find((mb) => mb.userId === currentUserId);
    return m?.role ?? "GUEST_CONFIRMED";
  }, [memberships, currentUserId]);

  // Dashboard aggregation (memoized)
  const dashboard = useMemo(() => {
    if (!trip) {
      return {
        kpis: {
          daysToGo: 0,
          totalBudget: 0,
          totalSpent: 0,
          remaining: 0,
          myContribution: 0,
          outstandingPayments: 0,
          tasksCompletionPercent: 0,
          guestsInvited: 0,
          guestsConfirmed: 0,
        },
        nextUp: [],
        budgetBreakdownByCategory: [],
        myTasks: [],
        allTasksSummary: { urgent: 0, inProgress: 0, done: 0, total: 0 },
        paymentsSummary: [],
      } satisfies DashboardData;
    }
    return computeDashboard(
      trip,
      memberships,
      users,
      events,
      tasks,
      budgetItems,
      currentUserId
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, tripId]);

  // ---- Mutation handlers ----

  const inviteUser = useCallback(
    (name: string, email: string) => {
      const id = uuid();
      repo.addUser({ id, name, email, avatarColor: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0") });
      repo.addMembership({
        tripId,
        userId: id,
        role: "GUEST_CONFIRMED",
        inviteStatus: "PENDING",
      });
    },
    [tripId]
  );

  const addGuestField = useCallback(
    (field: Omit<GuestFieldDef, "id">) => {
      const current = repo.getTrip(tripId)?.guestFieldSchema ?? [];
      repo.setGuestFieldSchema(tripId, [...current, { ...field, id: uuid() }]);
    },
    [tripId]
  );

  const removeGuestField = useCallback(
    (fieldId: string) => {
      const current = repo.getTrip(tripId)?.guestFieldSchema ?? [];
      repo.setGuestFieldSchema(tripId, current.filter((f) => f.id !== fieldId));
    },
    [tripId]
  );

  const reorderGuestFields = useCallback(
    (schema: GuestFieldDef[]) => {
      repo.setGuestFieldSchema(tripId, schema);
    },
    [tripId]
  );

  const updateTrip = useCallback(
    (patch: Partial<Trip>) => repo.updateTrip(tripId, patch),
    [tripId]
  );

  const updateUser = useCallback(
    (userId: string, patch: Partial<User>) => repo.updateUser(userId, patch),
    []
  );

  const updateMembershipStatus = useCallback(
    (userId: string, status: Membership["inviteStatus"]) => {
      repo.updateMembership(tripId, userId, { inviteStatus: status });
    },
    [tripId]
  );

  const updateMemberRole = useCallback(
    (userId: string, role: Role) => {
      repo.updateMembership(tripId, userId, { role });
    },
    [tripId]
  );

  const addEvent = useCallback(
    (data: Omit<TripEvent, "id" | "tripId">) => {
      repo.addEvent({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const updateEvent = useCallback(
    (id: string, patch: Partial<TripEvent>) => repo.updateEvent(id, patch),
    []
  );
  const deleteEvent = useCallback(
    (id: string) => repo.deleteEvent(id),
    []
  );

  const addTask = useCallback(
    (data: Omit<Task, "id" | "tripId">) => {
      repo.addTask({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => repo.updateTask(id, patch),
    []
  );
  const deleteTask = useCallback(
    (id: string) => repo.deleteTask(id),
    []
  );

  const addBudgetItem = useCallback(
    (data: Omit<BudgetItem, "id" | "tripId">) => {
      repo.addBudgetItem({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const updateBudgetItem = useCallback(
    (id: string, patch: Partial<BudgetItem>) => repo.updateBudgetItem(id, patch),
    []
  );
  const deleteBudgetItem = useCallback(
    (id: string) => repo.deleteBudgetItem(id),
    []
  );

  // Create a Task linked to a BudgetItem (and back-link the BudgetItem)
  const createTaskForBudgetItem = useCallback(
    (budgetItemId: string) => {
      const bi = repo.getBudgetItems(tripId).find((b) => b.id === budgetItemId);
      if (!bi) return;
      const taskId = uuid();
      repo.addTask({
        id: taskId,
        tripId,
        title: `Task for: ${bi.title}`,
        description: `Auto-created from budget item "${bi.title}"`,
        status: "TODO",
        priority: "MEDIUM",
        dueAt: null,
        assigneeUserIds: bi.responsibleUserId ? [bi.responsibleUserId] : [],
        relatedEventId: bi.relatedEventId,
        relatedBudgetItemId: budgetItemId,
      });
      repo.updateBudgetItem(budgetItemId, { relatedTaskId: taskId });
    },
    [tripId]
  );

  // ---- Unified Plan Activity ----
  const planActivity = useCallback(
    (input: PlanActivityInput) => {
      const eventId = input.createEvent ? uuid() : null;
      const taskId = input.createTask ? uuid() : null;
      const budgetId = input.createBudget ? uuid() : null;

      // 1) Event (now includes reservation/booking fields)
      if (input.createEvent && eventId) {
        repo.addEvent({
          id: eventId,
          tripId,
          title: input.eventTitleOverride || input.title,
          description: input.description,
          location: input.eventLocation || "",
          startAt: input.eventStartAt || new Date().toISOString(),
          endAt: input.eventEndAt || new Date().toISOString(),
          status: input.eventStatus || "DRAFT",
          provider: input.eventProvider || undefined,
          confirmationCode: input.eventConfirmationCode || undefined,
          attendeeUserIds: input.eventAttendeeUserIds || [],
        });
      }

      // 2) Budget
      if (input.createBudget && budgetId) {
        repo.addBudgetItem({
          id: budgetId,
          tripId,
          title: input.budgetTitleOverride || input.title,
          category: input.budgetCategory || "MISC",
          plannedAmount: input.budgetPlannedAmount || 0,
          actualAmount: input.budgetActualAmount || 0,
          currency: "USD",
          responsibleUserId: input.budgetResponsibleId || null,
          paidByUserId: input.budgetPaidById || null,
          status: input.budgetStatus || "PLANNED",
          relatedEventId: eventId,
          relatedTaskId: taskId,
          notes: input.budgetNotes?.trim() || "",
        });
      }

      // 3) Task
      if (input.createTask && taskId) {
        repo.addTask({
          id: taskId,
          tripId,
          title: input.taskTitleOverride || (input.createEvent ? `Book: ${input.title}` : input.title),
          description: input.description,
          status: input.taskStatus || "TODO",
          priority: input.taskPriority || "MEDIUM",
          dueAt: input.taskDueAt || null,
          assigneeUserIds: input.taskAssigneeIds || [],
          relatedEventId: eventId,
          relatedBudgetItemId: budgetId,
        });
      }
    },
    [tripId]
  );

  const value: AppContextValue = {
    tripId,
    currentUserId,
    currentRole,
    trip: trip ?? null,
    updateTrip,
    dashboard,
    events,
    tasks,
    budgetItems,
    memberships,
    users,
    guestFieldSchema,
    addGuestField,
    removeGuestField,
    reorderGuestFields,
    panel,
    openPanel,
    closePanel,
    inviteUser,
    updateUser,
    updateMembershipStatus,
    updateMemberRole,
    addEvent,
    updateEvent,
    deleteEvent,
    addTask,
    updateTask,
    deleteTask,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    createTaskForBudgetItem,
    planActivity,
    clearAllData: () => { clearAllData(); closePanel(); },
    resetDemoData: () => { resetStore(); closePanel(); },
    exportData: () => {
      const data = exportStore();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bachelorette-planner-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    importData: (json: string) => {
      try {
        const parsed = JSON.parse(json);
        importStore(parsed);
        closePanel();
      } catch {
        alert("Invalid JSON file. Please select a valid export file.");
      }
    },
    refresh,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
