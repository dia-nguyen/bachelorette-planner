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
  type MoodboardNote,
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

// ---- Supabase row → domain object mapper ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTripRow(row: any): Trip {
  return {
    id: row.id,
    name: row.name,
    startAt: String(row.start_at ?? ""),
    endAt: String(row.end_at ?? ""),
    location: row.location ?? "",
    description: row.description ?? "",
    createdByUserId: row.created_by,
    joinCode: row.join_code ?? undefined,
    guestFieldSchema: (row.guest_field_schema ?? []) as GuestFieldDef[],
  };
}

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
  updateMembershipStatus: (userId: string, status: Membership["accountStatus"]) => void;
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

  // Moodboard
  moodboardNotes: MoodboardNote[];
  addMoodboardNote: (data: Omit<MoodboardNote, "id" | "tripId">) => void;
  updateMoodboardNote: (id: string, patch: Partial<MoodboardNote>) => void;
  deleteMoodboardNote: (id: string) => void;

  // Cross-entity creation helpers
  createTaskForBudgetItem: (budgetItemId: string) => void;

  // Unified "Plan Activity" — creates any combo of event/task/budget, all pre-linked
  planActivity: (input: PlanActivityInput) => void;

  // Multi-trip
  availableTrips: Trip[];
  switchTrip: (tripId: string) => void;
  createTrip: (data: { name: string; location: string; startAt: string; endAt: string; description?: string; }) => Promise<void>;
  isLoadingTrips: boolean;
  isLoadingData: boolean;

  // Data management
  clearAllData: () => void;
  resetDemoData: () => void;
  exportData: () => void;
  importData: (json: string) => void;

  // Refresh
  refresh: () => void;
}

const LAST_TRIP_KEY = "bp-last-trip-id";

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode; }) {
  const { user } = useAuth();
  const isSupabaseMode =
    process.env.NEXT_PUBLIC_DATA_MODE === "supabase" && isSupabaseConfigured();

  const [tripId] = useState<string>(DEMO_TRIP_ID);
  const [currentUserId] = useState<string>(DEMO_USER_ID);
  const [tick, setTick] = useState(0);

  // Multi-trip state
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(isSupabaseMode);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LAST_TRIP_KEY);
  });

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

  // Subscribe to repository changes (demo mode, and moodboard in all modes)
  useEffect(() => {
    return subscribe(refresh);
  }, [refresh]);

  // Effect 1: Load all trips the user belongs to or created (runs when user changes)
  useEffect(() => {
    if (!isSupabaseMode || !user?.id) {
      if (isSupabaseMode) setIsLoadingTrips(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingTrips(true);

    const run = async () => {
      try {
        const res = await fetch("/api/trips");
        if (isCancelled) return;
        if (!res.ok) throw new Error(`/api/trips returned ${res.status}`);
        const payload = (await res.json()) as { trips?: unknown[] };
        if (isCancelled) return;

        const allTrips: Trip[] = (payload.trips ?? []).map(mapTripRow);
        const storedId = typeof window !== "undefined"
          ? localStorage.getItem(LAST_TRIP_KEY)
          : null;
        const chosenId = (storedId && allTrips.some((t) => t.id === storedId))
          ? storedId
          : (allTrips[0]?.id ?? null);

        if (!isCancelled) {
          setAvailableTrips(allTrips);
          setActiveTripId(chosenId);
        }
      } catch (err) {
        console.error("[AppContext] Failed to load trips:", err);
      } finally {
        if (!isCancelled) setIsLoadingTrips(false);
      }
    };

    void run();

    return () => { isCancelled = true; };
  }, [isSupabaseMode, user?.id]);

  // Effect 2: Load entity data for the currently active trip
  useEffect(() => {
    if (!isSupabaseMode || !user?.id || !activeTripId) {
      setIsLoadingData(false);
      if (isSupabaseMode && !activeTripId) {
        setSupabaseTrip(null);
        setSupabaseUsers([]);
        setSupabaseMemberships([]);
        setSupabaseEvents([]);
        setSupabaseTasks([]);
        setSupabaseBudgetItems([]);
        setSupabaseChecklistItems([]);
        setSupabasePolls([]);
        setSupabasePhotos([]);
      }
      return;
    }

    let isCancelled = false;
    // Only show loading spinner when we have no data yet (initial load)
    if (!supabaseTrip) setIsLoadingData(true);

    const run = async () => {
      try {
        const res = await fetch(`/api/trips/${activeTripId}/all`);
        if (isCancelled) return;
        if (!res.ok) throw new Error(`/api/trips/${activeTripId}/all returned ${res.status}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await res.json()) as Record<string, any>;
        if (isCancelled) return;

        if (data.trip) {
          setSupabaseTrip(mapTripRow(data.trip));
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedMemberships: Membership[] = (data.memberships ?? []).map((m: any) => ({
          tripId: m.trip_id,
          userId: m.profile_id ?? m.user_id,
          role: m.role,
          accountStatus: m.account_status === "CLAIMED" ? "CLAIMED"
            : m.account_status === "INVITED" ? "INVITED"
            : m.invite_status === "ACCEPTED" ? "CLAIMED"
            : "INVITED",
        }));

        if (
          data.trip?.created_by &&
          !mappedMemberships.some((m) => m.userId === data.trip.created_by)
        ) {
          mappedMemberships.unshift({
            tripId: activeTripId,
            userId: data.trip.created_by,
            role: "MOH_ADMIN",
            accountStatus: "CLAIMED",
          });
        }

        setSupabaseMemberships(mappedMemberships);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedUsers: User[] = (data.profiles ?? []).map((p: any) => ({
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

        setSupabaseEvents(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.events ?? []).map((e: any) => ({
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.tasks ?? []).map((t: any) => ({
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.budgetItems ?? []).map((b: any) => {
            // Normalize DB uppercase enums → app lowercase
            const rawCostMode = (b.cost_mode ?? "") as string;
            const rawSplitType = (b.split_type ?? "") as string;
            const costMode = rawCostMode === "PER_PERSON" ? "per_person"
              : rawCostMode === "TOTAL" ? "total"
              : (rawCostMode.toLowerCase() || undefined) as BudgetItem["costMode"];
            const splitType = rawSplitType === "EQUAL" ? "even"
              : rawSplitType === "CUSTOM" ? "custom"
              : (rawSplitType.toLowerCase() || undefined) as BudgetItem["splitType"];
            return {
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
              costMode,
              splitType,
              plannedSplits: (b.planned_splits ?? undefined) as Record<string, number> | undefined,
              actualSplits: (b.actual_splits ?? undefined) as Record<string, number> | undefined,
              splitAttendeeUserIds: (b.split_attendee_user_ids ?? []) as string[],
            };
          }),
        );

        setSupabaseChecklistItems(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.checklistItems ?? []).map((c: any) => ({
            id: c.id,
            tripId: c.trip_id,
            title: c.title,
            isChecked: c.is_checked,
            assigneeUserId: c.assignee_user_id,
            category: c.category,
          })),
        );

        setSupabasePolls(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.polls ?? []).map((p: any) => ({
            id: p.id,
            tripId: p.trip_id,
            question: p.question,
            createdByUserId: p.created_by_user_id,
            options: (p.options ?? []) as Poll["options"],
            isClosed: p.is_closed,
          })),
        );

        setSupabasePhotos(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.photos ?? []).map((p: any) => ({
            id: p.id,
            tripId: p.trip_id,
            url: p.url,
            caption: p.caption ?? "",
            uploadedByUserId: p.uploaded_by_user_id,
            relatedEventId: p.related_event_id,
            createdAt: p.created_at,
          })),
        );
      } catch (err) {
        console.error("[AppContext] Failed to load trip data:", err);
      } finally {
        if (!isCancelled) setIsLoadingData(false);
      }
    };

    void run();

    return () => { isCancelled = true; };
  }, [isSupabaseMode, activeTripId, user?.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch the active trip and persist the choice
  const switchTrip = useCallback((newTripId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_TRIP_KEY, newTripId);
    }
    setActiveTripId(newTripId);
    setTick((t) => t + 1);
  }, []);

  // Create a new trip and immediately switch to it
  const createTrip = useCallback(async (data: { name: string; location: string; startAt: string; endAt: string; description?: string; }) => {
    if (!isSupabaseMode) {
      // Demo mode: use repository
      const { v4: uuid } = await import("uuid");
      const id = uuid();
      repo.createTrip({ id, ...data, createdByUserId: DEMO_USER_ID, guestFieldSchema: [] });
      repo.addMembership({ tripId: id, userId: DEMO_USER_ID, role: "MOH_ADMIN", accountStatus: "CLAIMED" });
      refresh();
      return;
    }

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const payload = (await res.json()) as { trip?: { id: string; }; error?: string; };
    if (!res.ok || !payload.trip) {
      throw new Error(payload.error ?? "Failed to create trip.");
    }

    const newId = payload.trip.id;
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_TRIP_KEY, newId);
    }
    setActiveTripId(newId);
    // Re-trigger the trips list load
    setAvailableTrips((prev) => {
      // Will be refreshed by effect 2; add optimistically so switcher updates immediately
      const tripRow: Trip = { id: newId, ...data, createdByUserId: user?.id ?? "", guestFieldSchema: [] };
      return [tripRow, ...prev];
    });
    setTick((t) => t + 1);
  }, [isSupabaseMode, refresh, user?.id]);

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

  const effectiveTripId = isSupabaseMode ? activeTripId ?? DEMO_TRIP_ID : tripId;
  const effectiveCurrentUserId = isSupabaseMode ? user?.id ?? DEMO_USER_ID : currentUserId;

  // Moodboard always uses localStorage (no Supabase table yet), keyed by effectiveTripId
  const demoMoodboardNotes = useMemo(() => {
    void tick;
    return repo.getMoodboardNotes(effectiveTripId);
  }, [tick, effectiveTripId]);

  const trip = isSupabaseMode ? supabaseTrip : (repo.getTrip(tripId) ?? null);
  const events = isSupabaseMode ? supabaseEvents : demoEvents;
  const tasks = isSupabaseMode ? supabaseTasks : demoTasks;
  const budgetItems = isSupabaseMode ? supabaseBudgetItems : demoBudgetItems;
  const memberships = isSupabaseMode ? supabaseMemberships : demoMemberships;
  const users = isSupabaseMode ? supabaseUsers : demoUsers;
  const checklistItems = isSupabaseMode ? supabaseChecklistItems : demoChecklistItems;
  const polls = isSupabaseMode ? supabasePolls : demoPolls;
  const photos = isSupabaseMode ? supabasePhotos : demoPhotos;
  // Moodboard always uses localStorage (no Supabase table yet)
  const moodboardNotes = demoMoodboardNotes;

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
          guestsClaimed: 0,
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
        accountStatus: "INVITED",
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
    (userId: string, patch: Partial<User>) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, ...patch } : u)
        );
        void fetch(`/api/trips/${activeTripId}/guests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, patch: { name: patch.name, email: patch.email, custom_fields: patch.customFields } }),
        });
        return;
      }
      repo.updateUser(userId, patch);
    },
    [isSupabaseMode, activeTripId]
  );

  const updateMembershipStatus = useCallback(
    (userId: string, status: Membership["accountStatus"]) => {
      if (isSupabaseMode && activeTripId) {
        // Optimistic update
        setSupabaseMemberships((prev) =>
          prev.map((m) => m.userId === userId ? { ...m, accountStatus: status } : m)
        );
        const dbStatus = status === "CLAIMED" ? "ACCEPTED" : status === "INVITED" ? "PENDING" : status;
        void fetch(`/api/trips/${activeTripId}/guests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, patch: { invite_status: dbStatus } }),
        });
        return;
      }
      repo.updateMembership(tripId, userId, { accountStatus: status });
    },
    [tripId, isSupabaseMode, activeTripId]
  );

  const updateMemberRole = useCallback(
    (userId: string, role: Role) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseMemberships((prev) =>
          prev.map((m) => m.userId === userId ? { ...m, role } : m)
        );
        void fetch(`/api/trips/${activeTripId}/guests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, patch: { role } }),
        });
        return;
      }
      repo.updateMembership(tripId, userId, { role });
    },
    [tripId, isSupabaseMode, activeTripId]
  );

  const addEvent = useCallback(
    (data: Omit<TripEvent, "id" | "tripId">) => {
      repo.addEvent({ ...data, id: uuid(), tripId });
    },
    [tripId]
  );
  const updateEvent = useCallback(
    (id: string, patch: Partial<TripEvent>) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseEvents((prev) =>
          prev.map((e) => e.id === id ? { ...e, ...patch } : e)
        );
        void fetch(`/api/trips/${activeTripId}/events`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, patch }),
        });
        return;
      }
      repo.updateEvent(id, patch);
    },
    [isSupabaseMode, activeTripId]
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
    (id: string, patch: Partial<Task>) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseTasks((prev) =>
          prev.map((t) => t.id === id ? { ...t, ...patch } : t)
        );
        void fetch(`/api/trips/${activeTripId}/events`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "task", id, patch }),
        });
        return;
      }
      repo.updateTask(id, patch);
    },
    [isSupabaseMode, activeTripId]
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
    (id: string, patch: Partial<BudgetItem>) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseBudgetItems((prev) =>
          prev.map((b) => b.id === id ? { ...b, ...patch } : b)
        );
        void fetch(`/api/trips/${activeTripId}/budget`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, patch }),
        });
        return;
      }
      repo.updateBudgetItem(id, patch);
    },
    [isSupabaseMode, activeTripId]
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

  // Moodboard
  const addMoodboardNote = useCallback(
    (data: Omit<MoodboardNote, "id" | "tripId">) => {
      repo.addMoodboardNote({ ...data, id: uuid(), tripId: effectiveTripId });
    },
    [effectiveTripId]
  );
  const updateMoodboardNote = useCallback(
    (id: string, patch: Partial<MoodboardNote>) => {
      repo.updateMoodboardNote(id, patch);
    },
    []
  );
  const deleteMoodboardNote = useCallback(
    (id: string) => {
      repo.deleteMoodboardNote(id);
    },
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
    moodboardNotes,
    addMoodboardNote,
    updateMoodboardNote,
    deleteMoodboardNote,
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
    availableTrips,
    switchTrip,
    createTrip,
    isLoadingTrips,
    isLoadingData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
