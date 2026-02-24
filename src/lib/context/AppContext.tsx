"use client";

import { useAuth } from "@/lib/context/AuthContext";
import {
  clearAllData,
  exportStore,
  importStore,
  repository,
  resetStore,
  subscribe,
  type BudgetItem,
  type ChecklistItem,
  type DashboardData,
  type GuestFieldDef,
  type Membership,
  type PanelState,
  type Photo,
  type PlanActivityInput,
  type Poll,
  type Role,
  type Task,
  type Trip,
  type TripEvent,
  type User,
} from "@/lib/data";
import { computeDashboard } from "@/lib/domain";
import {
  createClient as createSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
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
const repo = repository;

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

  // Checklist items
  checklistItems: ChecklistItem[];
  addChecklistItem: (data: Omit<ChecklistItem, "id" | "tripId">) => void;
  updateChecklistItem: (id: string, patch: Partial<ChecklistItem>) => void;
  deleteChecklistItem: (id: string) => void;

  // Polls
  polls: Poll[];
  addPoll: (data: Omit<Poll, "id" | "tripId">) => void;
  updatePoll: (id: string, patch: Partial<Poll>) => void;
  deletePoll: (id: string) => void;

  // Photos
  photos: Photo[];
  addPhoto: (data: Omit<Photo, "id" | "tripId">) => void;
  deletePhoto: (id: string) => void;

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
  const { user } = useAuth();
  const isSupabaseMode =
    process.env.NEXT_PUBLIC_DATA_MODE === "supabase" && isSupabaseConfigured();

  const [tripId] = useState<string>(DEMO_TRIP_ID);
  const [currentUserId] = useState<string>(DEMO_USER_ID);
  const [tick, setTick] = useState(0);

  const [supabaseTripId, setSupabaseTripId] = useState<string | null>(null);
  const [supabaseTrip, setSupabaseTrip] = useState<Trip | null>(null);
  const [supabaseUsers, setSupabaseUsers] = useState<User[]>([]);
  const [supabaseMemberships, setSupabaseMemberships] = useState<Membership[]>([]);
  const [supabaseEvents, setSupabaseEvents] = useState<TripEvent[]>([]);
  const [supabaseTasks, setSupabaseTasks] = useState<Task[]>([]);
  const [supabaseBudgetItems, setSupabaseBudgetItems] = useState<BudgetItem[]>([]);
  const [supabaseChecklistItems, setSupabaseChecklistItems] = useState<ChecklistItem[]>([]);
  const [supabasePolls, setSupabasePolls] = useState<Poll[]>([]);
  const [supabasePhotos, setSupabasePhotos] = useState<Photo[]>([]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Subscribe to repository changes
  useEffect(() => {
    if (isSupabaseMode) return;
    return subscribe(refresh);
  }, [isSupabaseMode, refresh]);

  useEffect(() => {
    if (!isSupabaseMode || !user?.id) return;

    let isCancelled = false;

    const run = async () => {
      const supabase = createSupabaseClient();

      const [myMembership, createdTrip] = await Promise.all([
        supabase
          .from("memberships")
          .select("trip_id")
          .eq("profile_id", user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("trips")
          .select("id")
          .eq("created_by", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (isCancelled) return;

      const activeTripId = myMembership.data?.trip_id ?? createdTrip.data?.id ?? null;
      setSupabaseTripId(activeTripId);

      if (!activeTripId) {
        setSupabaseTrip(null);
        setSupabaseUsers([]);
        setSupabaseMemberships([]);
        setSupabaseEvents([]);
        setSupabaseTasks([]);
        setSupabaseBudgetItems([]);
        setSupabaseChecklistItems([]);
        setSupabasePolls([]);
        setSupabasePhotos([]);
        return;
      }

      const [tripRes, membershipsRes, eventsRes, tasksRes, budgetRes, checklistRes, pollsRes, photosRes] =
        await Promise.all([
          supabase.from("trips").select("*").eq("id", activeTripId).maybeSingle(),
          supabase.from("memberships").select("*").eq("trip_id", activeTripId),
          supabase.from("events").select("*").eq("trip_id", activeTripId),
          supabase.from("tasks").select("*").eq("trip_id", activeTripId),
          supabase.from("budget_items").select("*").eq("trip_id", activeTripId),
          supabase.from("checklist_items").select("*").eq("trip_id", activeTripId),
          supabase.from("polls").select("*").eq("trip_id", activeTripId),
          supabase.from("photos").select("*").eq("trip_id", activeTripId),
        ]);

      if (isCancelled) return;

      if (tripRes.data) {
        setSupabaseTrip({
          id: tripRes.data.id,
          name: tripRes.data.name,
          startAt: String(tripRes.data.start_at),
          endAt: String(tripRes.data.end_at),
          location: tripRes.data.location,
          description: tripRes.data.description ?? "",
          createdByUserId: tripRes.data.created_by,
          guestFieldSchema: (tripRes.data.guest_field_schema ?? []) as GuestFieldDef[],
        });
      }

      const mappedMemberships: Membership[] = (membershipsRes.data ?? []).map((m) => ({
        tripId: m.trip_id,
        userId: m.profile_id,
        role: m.role,
        inviteStatus: m.invite_status,
      }));

      if (
        tripRes.data?.created_by &&
        !mappedMemberships.some((m) => m.userId === tripRes.data.created_by)
      ) {
        mappedMemberships.unshift({
          tripId: activeTripId,
          userId: tripRes.data.created_by,
          role: "MOH_ADMIN",
          inviteStatus: "ACCEPTED",
        });
      }

      setSupabaseMemberships(mappedMemberships);

      const profileIds = Array.from(new Set(mappedMemberships.map((m) => m.userId)));
      if (profileIds.length > 0) {
        const profilesRes = await supabase
          .from("profiles")
          .select("id,name,email,avatar_color,custom_fields")
          .in("id", profileIds);

        if (isCancelled) return;

        const mappedUsers: User[] = (profilesRes.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          avatarColor: p.avatar_color ?? undefined,
          customFields: (p.custom_fields ?? {}) as Record<string, string>,
        }));

        for (const member of mappedMemberships) {
          if (!mappedUsers.some((u) => u.id === member.userId)) {
            const isCurrent = member.userId === user.id;
            mappedUsers.push({
              id: member.userId,
              name: isCurrent
                ? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "You"
                : "Guest",
              email: isCurrent ? user.email ?? "" : "",
            });
          }
        }

        setSupabaseUsers(mappedUsers);
      } else {
        setSupabaseUsers([]);
      }

      setSupabaseEvents(
        (eventsRes.data ?? []).map((e) => ({
          id: e.id,
          tripId: e.trip_id,
          title: e.title,
          startAt: e.start_at,
          endAt: e.end_at ?? undefined,
          location: e.location,
          description: e.description ?? "",
          status: e.status,
          provider: e.provider ?? undefined,
          confirmationCode: e.confirmation_code ?? undefined,
          attendeeUserIds: (e.attendee_user_ids ?? []) as string[],
        })),
      );

      setSupabaseTasks(
        (tasksRes.data ?? []).map((t) => ({
          id: t.id,
          tripId: t.trip_id,
          title: t.title,
          description: t.description ?? "",
          status: t.status,
          priority: t.priority,
          dueAt: t.due_at,
          assigneeUserIds: (t.assignee_user_ids ?? []) as string[],
          relatedEventId: t.related_event_id,
          relatedBudgetItemId: t.related_budget_item_id,
        })),
      );

      setSupabaseBudgetItems(
        (budgetRes.data ?? []).map((b) => ({
          id: b.id,
          tripId: b.trip_id,
          title: b.title,
          category: b.category,
          plannedAmount: Number(b.planned_amount ?? 0),
          actualAmount: Number(b.actual_amount ?? 0),
          currency: b.currency ?? "USD",
          responsibleUserId: b.responsible_user_id,
          paidByUserId: b.paid_by_user_id,
          status: b.status,
          relatedEventId: b.related_event_id,
          relatedTaskId: b.related_task_id,
          notes: b.notes ?? "",
          costMode: b.cost_mode ?? undefined,
          splitType: b.split_type ?? undefined,
          plannedSplits: (b.planned_splits ?? undefined) as Record<string, number> | undefined,
          actualSplits: (b.actual_splits ?? undefined) as Record<string, number> | undefined,
          splitAttendeeUserIds: (b.split_attendee_user_ids ?? []) as string[],
        })),
      );

      setSupabaseChecklistItems(
        (checklistRes.data ?? []).map((c) => ({
          id: c.id,
          tripId: c.trip_id,
          title: c.title,
          isChecked: c.is_checked,
          assigneeUserId: c.assignee_user_id,
          category: c.category,
        })),
      );

      setSupabasePolls(
        (pollsRes.data ?? []).map((p) => ({
          id: p.id,
          tripId: p.trip_id,
          question: p.question,
          createdByUserId: p.created_by_user_id,
          options: (p.options ?? []) as Poll["options"],
          isClosed: p.is_closed,
        })),
      );

      setSupabasePhotos(
        (photosRes.data ?? []).map((p) => ({
          id: p.id,
          tripId: p.trip_id,
          url: p.url,
          caption: p.caption ?? "",
          uploadedByUserId: p.uploaded_by_user_id,
          relatedEventId: p.related_event_id,
          createdAt: p.created_at,
        })),
      );
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [isSupabaseMode, user, tick]);

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

  // Read data — re-reads on every tick
  const demoEvents = useMemo(() => {
    void tick;
    return repo.getEvents(tripId);
  }, [tick, tripId]);
  const demoTasks = useMemo(() => {
    void tick;
    return repo.getTasks(tripId);
  }, [tick, tripId]);
  const demoBudgetItems = useMemo(() => {
    void tick;
    return repo.getBudgetItems(tripId);
  }, [tick, tripId]);
  const demoMemberships = useMemo(() => {
    void tick;
    return repo.getMemberships(tripId);
  }, [tick, tripId]);
  const demoUsers = useMemo(() => {
    void tick;
    return repo.getUsers(tripId);
  }, [tick, tripId]);
  const demoChecklistItems = useMemo(() => {
    void tick;
    return repo.getChecklistItems(tripId);
  }, [tick, tripId]);
  const demoPolls = useMemo(() => {
    void tick;
    return repo.getPolls(tripId);
  }, [tick, tripId]);
  const demoPhotos = useMemo(() => {
    void tick;
    return repo.getPhotos(tripId);
  }, [tick, tripId]);

  const effectiveTripId = isSupabaseMode ? supabaseTripId ?? DEMO_TRIP_ID : tripId;
  const effectiveCurrentUserId = isSupabaseMode ? user?.id ?? DEMO_USER_ID : currentUserId;

  const trip = isSupabaseMode ? supabaseTrip : (repo.getTrip(tripId) ?? null);
  const events = isSupabaseMode ? supabaseEvents : demoEvents;
  const tasks = isSupabaseMode ? supabaseTasks : demoTasks;
  const budgetItems = isSupabaseMode ? supabaseBudgetItems : demoBudgetItems;
  const memberships = isSupabaseMode ? supabaseMemberships : demoMemberships;
  const users = isSupabaseMode ? supabaseUsers : demoUsers;
  const checklistItems = isSupabaseMode ? supabaseChecklistItems : demoChecklistItems;
  const polls = isSupabaseMode ? supabasePolls : demoPolls;
  const photos = isSupabaseMode ? supabasePhotos : demoPhotos;

  const guestFieldSchema: GuestFieldDef[] = trip?.guestFieldSchema ?? [];

  const currentRole: Role = useMemo(() => {
    const m = memberships.find((mb) => mb.userId === effectiveCurrentUserId);
    return m?.role ?? "GUEST_CONFIRMED";
  }, [memberships, effectiveCurrentUserId]);

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
      effectiveCurrentUserId
    );
  }, [trip, memberships, users, events, tasks, budgetItems, effectiveCurrentUserId]);

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

  // Checklist
  const addChecklistItem = useCallback(
    (data: Omit<ChecklistItem, "id" | "tripId">) => {
      repo.addChecklistItem({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const updateChecklistItem = useCallback(
    (id: string, patch: Partial<ChecklistItem>) => repo.updateChecklistItem(id, patch),
    []
  );
  const deleteChecklistItem = useCallback(
    (id: string) => repo.deleteChecklistItem(id),
    []
  );

  // Polls
  const addPoll = useCallback(
    (data: Omit<Poll, "id" | "tripId">) => {
      repo.addPoll({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const updatePoll = useCallback(
    (id: string, patch: Partial<Poll>) => repo.updatePoll(id, patch),
    []
  );
  const deletePoll = useCallback(
    (id: string) => repo.deletePoll(id),
    []
  );

  // Photos
  const addPhoto = useCallback(
    (data: Omit<Photo, "id" | "tripId">) => {
      repo.addPhoto({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const deletePhoto = useCallback(
    (id: string) => repo.deletePhoto(id),
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
    tripId: effectiveTripId,
    currentUserId: effectiveCurrentUserId,
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
    checklistItems,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    polls,
    addPoll,
    updatePoll,
    deletePoll,
    photos,
    addPhoto,
    deletePhoto,
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
