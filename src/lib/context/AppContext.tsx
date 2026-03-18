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
  type NoteImage,
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
  useRef,
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

function normalizePoll(raw: Partial<Poll> & {
  id: string;
  tripId: string;
  question: string;
  createdByUserId: string;
  options: Poll["options"];
  isClosed: boolean;
}): Poll {
  const legacyPollLinks = Array.isArray((raw as { links?: unknown; }).links)
    ? ((raw as { links?: string[]; }).links ?? [])
    : [];
  const normalizedOptions = Array.isArray(raw.options)
    ? raw.options.map((option, index) => ({
      ...option,
      link: option.link ?? legacyPollLinks[index] ?? undefined,
    }))
    : [];

  return {
    ...raw,
    options: normalizedOptions,
    visibility: raw.visibility === "anonymous" ? "anonymous" : "public",
    requiredUserIds: Array.isArray(raw.requiredUserIds) ? raw.requiredUserIds : [],
    createdAt: raw.createdAt ?? "1970-01-01T00:00:00.000Z",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPollRow(row: any): Poll {
  return normalizePoll({
    id: row.id,
    tripId: row.trip_id ?? row.tripId,
    question: row.question,
    createdByUserId: row.created_by_user_id ?? row.createdByUserId,
    options: (row.options ?? []) as Poll["options"],
    isClosed: Boolean(row.is_closed ?? row.isClosed),
    visibility: row.visibility as Poll["visibility"] | undefined,
    requiredUserIds: (row.required_user_ids ?? row.requiredUserIds ?? []) as string[],
    createdAt: row.created_at ?? row.createdAt,
  });
}

function normalizeTaskSubtasks(raw: unknown): { id: string; title: string; isDone: boolean }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const typed = entry as Record<string, unknown>;
      return {
        id: String(typed.id ?? ""),
        title: String(typed.title ?? "").trim(),
        isDone: Boolean(typed.isDone),
      };
    })
    .filter((subtask) => subtask.id && subtask.title.length > 0);
}

function deriveStatusFromSubtasks(
  subtasks: { id: string; title: string; isDone: boolean }[],
): Task["status"] | null {
  if (subtasks.length === 0) return null;
  const doneCount = subtasks.filter((subtask) => subtask.isDone).length;
  if (doneCount === subtasks.length) return "DONE";
  if (doneCount > 0) return "IN_PROGRESS";
  return "TODO";
}

function rescalePerPersonEvenAmount(totalAmount: number, previousCount: number, nextCount: number): number {
  const prev = previousCount > 0 ? previousCount : 1;
  const next = nextCount > 0 ? nextCount : 1;
  return (totalAmount / prev) * next;
}

interface SupabaseTripDataPayload {
  trip?: Record<string, unknown>;
  memberships?: Array<Record<string, unknown>>;
  profiles?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  budgetItems?: Array<Record<string, unknown>>;
  checklistItems?: Array<Record<string, unknown>>;
  polls?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
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
  inviteUser: (name: string, email: string) => Promise<void>;
  updateUser: (userId: string, patch: Partial<User>) => void;
  updateMembershipStatus: (userId: string, status: Membership["accountStatus"]) => void;
  updateMemberRole: (userId: string, role: Role) => void;
  deleteGuest: (userId: string) => Promise<void>;

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
  addMoodboardNote: (data: Omit<MoodboardNote, "id" | "tripId">) => string;
  updateMoodboardNote: (id: string, patch: Partial<MoodboardNote>) => void;
  deleteMoodboardNote: (id: string) => void;
  setMoodboardNotes: (notes: MoodboardNote[]) => void;
  uploadMoodboardImage: (noteId: string, file: File) => Promise<NoteImage>;

  // Cross-entity creation helpers
  createTaskForBudgetItem: (budgetItemId: string) => void;

  // Unified "Plan Activity" — creates any combo of event/task/budget, all pre-linked
  planActivity: (input: PlanActivityInput) => Promise<void>;

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

function uniqueIds(ids: string[] | null | undefined, validIds?: Iterable<string>): string[] {
  const allowed = validIds ? new Set(validIds) : null;
  return Array.from(
    new Set(
      (ids ?? []).filter((id): id is string =>
        Boolean(id) && (!allowed || allowed.has(id)),
      ),
    ),
  );
}

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
  const [supabaseMoodboardNotes, setSupabaseMoodboardNotes] = useState<MoodboardNote[]>([]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Subscribe to repository changes in demo mode.
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
        const payload = (await res.json()) as { trips?: unknown[]; };
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
        setSupabaseMoodboardNotes([]);
      }
      return;
    }

    let isCancelled = false;
    // Only show loading spinner when we have no data yet (initial load)
    if (!supabaseTrip) setIsLoadingData(true);

    const run = async () => {
      try {
        const [res, moodboardRes] = await Promise.all([
          fetch(`/api/trips/${activeTripId}/all`),
          fetch(`/api/trips/${activeTripId}/moodboard`),
        ]);
        if (isCancelled) return;
        if (!res.ok) throw new Error(`/api/trips/${activeTripId}/all returned ${res.status}`);
        const [data, moodboardData] = await Promise.all([
          res.json() as Promise<SupabaseTripDataPayload>,
          moodboardRes.ok
            ? (moodboardRes.json() as Promise<MoodboardNote[]>)
            : Promise.resolve([] as MoodboardNote[]),
        ]);
        if (isCancelled) return;

        if (!moodboardRes.ok) {
          console.warn(
            `[AppContext] Moodboard load skipped for trip ${activeTripId}: ${moodboardRes.status}`,
          );
        }

        const tripRow =
          data.trip && typeof data.trip === "object"
            ? (data.trip as Record<string, unknown>)
            : null;

        if (tripRow) {
          setSupabaseTrip(mapTripRow(tripRow));
        }

        const membershipRows = Array.isArray(data.memberships) ? data.memberships : [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedMemberships: Membership[] = membershipRows.map((m: any) => ({
          tripId: m.trip_id,
          userId: m.profile_id ?? m.user_id,
          role: m.role,
          accountStatus: m.account_status === "CLAIMED" ? "CLAIMED"
            : m.account_status === "INVITED" ? "INVITED"
              : m.invite_status === "ACCEPTED" ? "CLAIMED"
                : "INVITED",
        }));

        const tripCreatedBy =
          typeof tripRow?.created_by === "string" ? tripRow.created_by : null;

        if (
          tripCreatedBy &&
          !mappedMemberships.some((m) => m.userId === tripCreatedBy)
        ) {
          mappedMemberships.unshift({
            tripId: activeTripId,
            userId: tripCreatedBy,
            role: "MOH_ADMIN",
            accountStatus: "CLAIMED",
          });
        }

        setSupabaseMemberships(mappedMemberships);

        const profileRows = Array.isArray(data.profiles) ? data.profiles : [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedUsers: User[] = profileRows.map((p: any) => ({
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

        const tripMemberIds = new Set(mappedMemberships.map((member) => member.userId));

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
            attendeeUserIds: uniqueIds((e.attendee_user_ids ?? []) as string[], tripMemberIds),
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
            subtasks: normalizeTaskSubtasks(t.subtasks),
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
          (data.polls ?? []).map(mapPollRow),
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
        setSupabaseMoodboardNotes(moodboardData);
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

  // Demo-mode moodboard stays in localStorage, keyed by trip.
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
  const polls = (isSupabaseMode ? supabasePolls : demoPolls).map((poll) => normalizePoll(poll));
  const photos = isSupabaseMode ? supabasePhotos : demoPhotos;
  const moodboardNotes = isSupabaseMode ? supabaseMoodboardNotes : demoMoodboardNotes;

  const guestFieldSchema: GuestFieldDef[] = trip?.guestFieldSchema ?? [];

  const currentRole: Role = useMemo(() => {
    const m = memberships.find((mb) => mb.userId === effectiveCurrentUserId);
    return m?.role ?? "GUEST_CONFIRMED";
  }, [memberships, effectiveCurrentUserId]);
  const moodboardRequestChainsRef = useRef(new Map<string, Promise<void>>());

  const queueMoodboardRequest = useCallback(
    (noteId: string, request: () => Promise<void>) => {
      const previous = moodboardRequestChainsRef.current.get(noteId) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(request);
      moodboardRequestChainsRef.current.set(noteId, next);
      void next.finally(() => {
        if (moodboardRequestChainsRef.current.get(noteId) === next) {
          moodboardRequestChainsRef.current.delete(noteId);
        }
      });
      return next;
    },
    [],
  );

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
    async (name: string, email: string) => {
      if (isSupabaseMode && activeTripId) {
        // Optimistic: add a temporary user + membership to local state
        const tempId = uuid();
        setSupabaseUsers((prev) => [...prev, { id: tempId, name, email }]);
        setSupabaseMemberships((prev) => [
          ...prev,
          { tripId: activeTripId, userId: tempId, role: "GUEST_CONFIRMED" as Role, accountStatus: "INVITED" as const },
        ]);

        const res = await fetch(`/api/trips/${activeTripId}/guests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email }),
        });

        if (!res.ok) {
          // Revert optimistic update on failure
          setSupabaseUsers((prev) => prev.filter((u) => u.id !== tempId));
          setSupabaseMemberships((prev) => prev.filter((m) => m.userId !== tempId));
          const payload = (await res.json()) as { error?: string; };
          throw new Error(payload.error ?? "Failed to add guest.");
        }

        // Replace temp ID with the real one from the server response
        const payload = (await res.json()) as { userId?: string; };
        if (payload.userId && payload.userId !== tempId) {
          setSupabaseUsers((prev) =>
            prev.map((u) => u.id === tempId ? { ...u, id: payload.userId! } : u)
          );
          setSupabaseMemberships((prev) =>
            prev.map((m) => m.userId === tempId ? { ...m, userId: payload.userId! } : m)
          );
        }
        return;
      }

      const id = uuid();
      repo.addUser({ id, name, email, avatarColor: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0") });
      repo.addMembership({
        tripId,
        userId: id,
        role: "GUEST_CONFIRMED",
        accountStatus: "INVITED",
      });
    },
    [tripId, isSupabaseMode, activeTripId]
  );

  const saveGuestFieldSchema = useCallback(
    (nextSchema: GuestFieldDef[]) => {
      if (isSupabaseMode && activeTripId) {
        const previousTrip = supabaseTrip;
        if (previousTrip) {
          setSupabaseTrip({ ...previousTrip, guestFieldSchema: nextSchema });
        }

        void fetch(`/api/trips/${activeTripId}/all`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestFieldSchema: nextSchema }),
        }).then(async (res) => {
          const payload = (await res.json()) as {
            error?: string;
            trip?: Record<string, unknown>;
          };
          if (!res.ok) {
            throw new Error(payload.error ?? "Failed to save guest fields.");
          }
          if (payload.trip) {
            setSupabaseTrip(mapTripRow(payload.trip));
            return;
          }
          refresh();
        }).catch((error) => {
          console.error("[AppContext] Failed to save guest field schema:", error);
          setSupabaseTrip(previousTrip);
        });
        return;
      }

      repo.setGuestFieldSchema(tripId, nextSchema);
    },
    [activeTripId, isSupabaseMode, refresh, supabaseTrip, tripId]
  );

  const addGuestField = useCallback(
    (field: Omit<GuestFieldDef, "id">) => {
      const current = guestFieldSchema;
      saveGuestFieldSchema([...current, { ...field, id: uuid() }]);
    },
    [guestFieldSchema, saveGuestFieldSchema]
  );

  const removeGuestField = useCallback(
    (fieldId: string) => {
      const current = guestFieldSchema;
      saveGuestFieldSchema(current.filter((f) => f.id !== fieldId));
    },
    [guestFieldSchema, saveGuestFieldSchema]
  );

  const reorderGuestFields = useCallback(
    (schema: GuestFieldDef[]) => {
      saveGuestFieldSchema(schema);
    },
    [saveGuestFieldSchema]
  );

  const updateTrip = useCallback(
    (patch: Partial<Trip>) => {
      if (isSupabaseMode && activeTripId) {
        const previousTrip = supabaseTrip;

        if (previousTrip) {
          setSupabaseTrip({ ...previousTrip, ...patch });
        }

        const payload: Record<string, unknown> = {};
        if ("name" in patch) payload.name = patch.name;
        if ("description" in patch) payload.description = patch.description ?? "";
        if ("location" in patch) payload.location = patch.location ?? "";
        if ("startAt" in patch) payload.startAt = patch.startAt;
        if ("endAt" in patch) payload.endAt = patch.endAt;

        void fetch(`/api/trips/${activeTripId}/all`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          const result = (await res.json()) as {
            error?: string;
            trip?: Record<string, unknown>;
          };
          if (!res.ok) {
            throw new Error(result.error ?? "Failed to save trip settings.");
          }
          if (result.trip) {
            setSupabaseTrip(mapTripRow(result.trip));
            return;
          }
          refresh();
        }).catch((error) => {
          console.error("[AppContext] Failed to update trip:", error);
          setSupabaseTrip(previousTrip);
        });
        return;
      }

      repo.updateTrip(tripId, patch);
    },
    [activeTripId, isSupabaseMode, refresh, supabaseTrip, tripId]
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
        void fetch(`/api/trips/${activeTripId}/guests`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, patch: { account_status: status } }),
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

  const deleteGuest = useCallback(
    async (userId: string) => {
      if (isSupabaseMode && activeTripId) {
        const previousUsers = supabaseUsers;
        const previousMemberships = supabaseMemberships;

        setSupabaseMemberships((prev) => prev.filter((m) => m.userId !== userId));
        setSupabaseUsers((prev) => {
          const remainingMemberships = previousMemberships.filter((m) => m.userId !== userId);
          const stillReferenced = remainingMemberships.some((m) => m.userId === userId);
          return stillReferenced ? prev : prev.filter((u) => u.id !== userId);
        });

        const res = await fetch("/api/guests", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, tripId: activeTripId }),
        });

        if (!res.ok) {
          setSupabaseUsers(previousUsers);
          setSupabaseMemberships(previousMemberships);
          const payload = (await res.json()) as { error?: string; };
          throw new Error(payload.error ?? "Failed to delete guest.");
        }

        return;
      }

      repo.removeGuestFromTrip(tripId, userId);
    },
    [activeTripId, isSupabaseMode, supabaseMemberships, supabaseUsers, tripId]
  );

  const addEvent = useCallback(
    (data: Omit<TripEvent, "id" | "tripId">) => {
      const validUserIds = memberships.map((member) => member.userId);
      const normalizedData: Omit<TripEvent, "id" | "tripId"> = {
        ...data,
        attendeeUserIds: uniqueIds(data.attendeeUserIds, validUserIds),
      };

      if (isSupabaseMode && activeTripId) {
        const id = uuid();
        const newEvent: TripEvent = { ...normalizedData, id, tripId: activeTripId };
        setSupabaseEvents((prev) => [...prev, newEvent]);
        void fetch(`/api/trips/${activeTripId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...normalizedData, id }),
        });
        return;
      }
      repo.addEvent({ ...normalizedData, id: uuid(), tripId });
    },
    [tripId, isSupabaseMode, activeTripId, memberships]
  );
  const updateEvent = useCallback(
    (id: string, patch: Partial<TripEvent>) => {
      const validUserIds = memberships.map((member) => member.userId);
      const normalizedPatch = patch.attendeeUserIds
        ? { ...patch, attendeeUserIds: uniqueIds(patch.attendeeUserIds, validUserIds) }
        : patch;
      const oldEvent = events.find((e) => e.id === id);
      const previousAttendeeCount = oldEvent?.attendeeUserIds?.length ?? 0;
      const nextAttendeeCount = normalizedPatch.attendeeUserIds?.length;
      const shouldRescaleLinkedPerPersonItems =
        nextAttendeeCount != null && nextAttendeeCount !== previousAttendeeCount;
      const linkedPerPersonEvenItems = shouldRescaleLinkedPerPersonItems
        ? budgetItems.filter((item) =>
          item.relatedEventId === id
          && item.splitType === "even"
          && item.costMode === "per_person")
        : [];

      if (isSupabaseMode && activeTripId) {
        setSupabaseEvents((prev) =>
          prev.map((e) => e.id === id ? { ...e, ...normalizedPatch } : e)
        );
        if (linkedPerPersonEvenItems.length > 0 && nextAttendeeCount != null) {
          setSupabaseBudgetItems((prev) => prev.map((item) => {
            if (!linkedPerPersonEvenItems.some((linked) => linked.id === item.id)) return item;
            return {
              ...item,
              plannedAmount: rescalePerPersonEvenAmount(item.plannedAmount, previousAttendeeCount, nextAttendeeCount),
              actualAmount: rescalePerPersonEvenAmount(item.actualAmount, previousAttendeeCount, nextAttendeeCount),
            };
          }));
        }
        void fetch(`/api/trips/${activeTripId}/events`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, patch: normalizedPatch }),
        });
        if (linkedPerPersonEvenItems.length > 0 && nextAttendeeCount != null) {
          linkedPerPersonEvenItems.forEach((item) => {
            void fetch(`/api/trips/${activeTripId}/budget`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: item.id,
                patch: {
                  plannedAmount: rescalePerPersonEvenAmount(item.plannedAmount, previousAttendeeCount, nextAttendeeCount),
                  actualAmount: rescalePerPersonEvenAmount(item.actualAmount, previousAttendeeCount, nextAttendeeCount),
                },
              }),
            });
          });
        }
        return;
      }
      repo.updateEvent(id, normalizedPatch);
      if (linkedPerPersonEvenItems.length > 0 && nextAttendeeCount != null) {
        linkedPerPersonEvenItems.forEach((item) => {
          repo.updateBudgetItem(item.id, {
            plannedAmount: rescalePerPersonEvenAmount(item.plannedAmount, previousAttendeeCount, nextAttendeeCount),
            actualAmount: rescalePerPersonEvenAmount(item.actualAmount, previousAttendeeCount, nextAttendeeCount),
          });
        });
      }
    },
    [isSupabaseMode, activeTripId, memberships, events, budgetItems]
  );
  const deleteEvent = useCallback(
    (id: string) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseEvents((prev) => prev.filter((e) => e.id !== id));
        void fetch(`/api/trips/${activeTripId}/events`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        return;
      }
      repo.deleteEvent(id);
    },
    [isSupabaseMode, activeTripId]
  );

  const addTask = useCallback(
    (data: Omit<Task, "id" | "tripId">) => {
      if (isSupabaseMode && activeTripId) {
        const id = uuid();
        const newTask: Task = { ...data, id, tripId: activeTripId };
        setSupabaseTasks((prev) => [...prev, newTask]);
        void fetch(`/api/trips/${activeTripId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, id }),
        });
        return;
      }
      repo.addTask({ ...data, id: uuid(), tripId });
    },
    [tripId, isSupabaseMode, activeTripId]
  );
  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      const normalizedPatch: Partial<Task> = { ...patch };
      if ("subtasks" in normalizedPatch) {
        const nextSubtasks = normalizeTaskSubtasks(normalizedPatch.subtasks);
        normalizedPatch.subtasks = nextSubtasks;
        const nextStatus = deriveStatusFromSubtasks(nextSubtasks);
        if (nextStatus) normalizedPatch.status = nextStatus;
      }

      if (isSupabaseMode && activeTripId) {
        setSupabaseTasks((prev) =>
          prev.map((t) => t.id === id ? { ...t, ...normalizedPatch } : t)
        );
        void fetch(`/api/trips/${activeTripId}/tasks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, patch: normalizedPatch }),
        });
        return;
      }
      repo.updateTask(id, normalizedPatch);
    },
    [isSupabaseMode, activeTripId]
  );
  const deleteTask = useCallback(
    (id: string) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseTasks((prev) => prev.filter((t) => t.id !== id));
        void fetch(`/api/trips/${activeTripId}/tasks`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        return;
      }
      repo.deleteTask(id);
    },
    [isSupabaseMode, activeTripId]
  );

  const addBudgetItem = useCallback(
    (data: Omit<BudgetItem, "id" | "tripId">) => {
      if (isSupabaseMode && activeTripId) {
        const id = uuid();
        const newItem: BudgetItem = { ...data, id, tripId: activeTripId };
        setSupabaseBudgetItems((prev) => [...prev, newItem]);
        void fetch(`/api/trips/${activeTripId}/budget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, id }),
        });
        return;
      }
      repo.addBudgetItem({ ...data, id: uuid(), tripId });
    },
    [tripId, isSupabaseMode, activeTripId]
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
    (id: string) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseBudgetItems((prev) => prev.filter((b) => b.id !== id));
        void fetch(`/api/trips/${activeTripId}/budget`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        return;
      }
      repo.deleteBudgetItem(id);
    },
    [isSupabaseMode, activeTripId]
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
      if (isSupabaseMode && activeTripId) {
        const newPoll = normalizePoll({ ...data, id: uuid(), tripId: activeTripId });
        setSupabasePolls((prev) => [newPoll, ...prev]);
        void (async () => {
          const res = await fetch(`/api/trips/${activeTripId}/polls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, id: newPoll.id }),
          });
          if (!res.ok) {
            throw new Error("Failed to create poll.");
          }
          const saved = await res.json();
          setSupabasePolls((prev) => prev.map((poll) => (
            poll.id === newPoll.id ? mapPollRow(saved) : poll
          )));
        })().catch((error) => {
          console.error("[AppContext] Failed to create poll:", error);
          setSupabasePolls((prev) => prev.filter((poll) => poll.id !== newPoll.id));
        });
        return;
      }
      repo.addPoll({ ...data, id: uuid(), tripId: effectiveTripId });
    },
    [isSupabaseMode, activeTripId, effectiveTripId]
  );
  const updatePoll = useCallback(
    (id: string, patch: Partial<Poll>) => {
      if (isSupabaseMode && activeTripId) {
        const previous = supabasePolls.find((poll) => poll.id === id);
        setSupabasePolls((prev) => prev.map((poll) => poll.id === id ? normalizePoll({ ...poll, ...patch }) : poll));
        void (async () => {
          const res = await fetch(`/api/trips/${activeTripId}/polls`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, patch }),
          });
          if (!res.ok) {
            throw new Error("Failed to update poll.");
          }
          const saved = await res.json();
          setSupabasePolls((prev) => prev.map((poll) => (
            poll.id === id ? mapPollRow(saved) : poll
          )));
        })().catch((error) => {
          console.error("[AppContext] Failed to update poll:", error);
          if (previous) {
            setSupabasePolls((prev) => prev.map((poll) => (poll.id === id ? previous : poll)));
          }
        });
        return;
      }
      repo.updatePoll(id, patch);
    },
    [isSupabaseMode, activeTripId, supabasePolls]
  );
  const deletePoll = useCallback(
    (id: string) => {
      if (isSupabaseMode && activeTripId) {
        const previous = supabasePolls;
        setSupabasePolls((prev) => prev.filter((poll) => poll.id !== id));
        void (async () => {
          const res = await fetch(`/api/trips/${activeTripId}/polls`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          if (!res.ok) {
            throw new Error("Failed to delete poll.");
          }
        })().catch((error) => {
          console.error("[AppContext] Failed to delete poll:", error);
          setSupabasePolls(previous);
        });
        return;
      }
      repo.deletePoll(id);
    },
    [isSupabaseMode, activeTripId, supabasePolls]
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
      const id = uuid();

      if (isSupabaseMode && activeTripId) {
        const newNote: MoodboardNote = { ...data, id, tripId: activeTripId };
        setSupabaseMoodboardNotes((prev) => [...prev, newNote]);
        void queueMoodboardRequest(id, async () => {
          const res = await fetch(`/api/trips/${activeTripId}/moodboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, id }),
          });
          const payload = (await res.json()) as MoodboardNote & { error?: string; };
          if (!res.ok) {
            throw new Error(payload.error ?? "Failed to create moodboard note.");
          }

          setSupabaseMoodboardNotes((prev) =>
            prev.map((note) =>
              note.id === id
                ? {
                  ...payload,
                  ...note,
                  createdByUserId: payload.createdByUserId || note.createdByUserId,
                }
                : note,
            ),
          );
        }).catch((error) => {
          console.error("[AppContext] Failed to create moodboard note:", error);
          setSupabaseMoodboardNotes((prev) => prev.filter((note) => note.id !== id));
        });
        return id;
      }
      repo.addMoodboardNote({ ...data, id, tripId: effectiveTripId });
      return id;
    },
    [activeTripId, effectiveTripId, isSupabaseMode, queueMoodboardRequest]
  );
  const updateMoodboardNote = useCallback(
    (id: string, patch: Partial<MoodboardNote>) => {
      if (isSupabaseMode && activeTripId) {
        setSupabaseMoodboardNotes((prev) =>
          prev.map((note) => note.id === id ? { ...note, ...patch } : note)
        );
        void queueMoodboardRequest(id, async () => {
          const res = await fetch(`/api/trips/${activeTripId}/moodboard`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, patch }),
          });
          if (!res.ok) {
            const payload = (await res.json()) as { error?: string; };
            throw new Error(payload.error ?? "Failed to update moodboard note.");
          }
        }).catch((error) => {
          console.error("[AppContext] Failed to update moodboard note:", error);
          refresh();
        });
        return;
      }
      repo.updateMoodboardNote(id, patch);
    },
    [activeTripId, isSupabaseMode, queueMoodboardRequest, refresh]
  );
  const deleteMoodboardNote = useCallback(
    (id: string) => {
      if (isSupabaseMode && activeTripId) {
        const previousNotes = supabaseMoodboardNotes;
        setSupabaseMoodboardNotes((prev) => prev.filter((note) => note.id !== id));
        void queueMoodboardRequest(id, async () => {
          const res = await fetch(`/api/trips/${activeTripId}/moodboard`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          if (!res.ok) {
            const payload = (await res.json()) as { error?: string; };
            throw new Error(payload.error ?? "Failed to delete moodboard note.");
          }
        }).catch((error) => {
          console.error("[AppContext] Failed to delete moodboard note:", error);
          setSupabaseMoodboardNotes(previousNotes);
        });
        return;
      }
      repo.deleteMoodboardNote(id);
    },
    [activeTripId, isSupabaseMode, queueMoodboardRequest, supabaseMoodboardNotes]
  );
  const setMoodboardNotes = useCallback(
    (notes: MoodboardNote[]) => {
      if (isSupabaseMode && activeTripId) {
        const previousNotes = supabaseMoodboardNotes;
        setSupabaseMoodboardNotes(notes);
        void fetch(`/api/trips/${activeTripId}/moodboard`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notes),
        }).then(async (res) => {
          if (!res.ok) {
            const payload = (await res.json()) as { error?: string; };
            throw new Error(payload.error ?? "Failed to save moodboard notes.");
          }
        }).catch((error) => {
          console.error("[AppContext] Failed to save moodboard notes:", error);
          setSupabaseMoodboardNotes(previousNotes);
        });
        return;
      }
      repo.setMoodboardNotes(effectiveTripId, notes);
    },
    [activeTripId, effectiveTripId, isSupabaseMode, supabaseMoodboardNotes]
  );
  const uploadMoodboardImage = useCallback(
    async (noteId: string, file: File): Promise<NoteImage> => {
      if (isSupabaseMode && activeTripId) {
        const imageId = uuid();
        const formData = new FormData();
        formData.set("imageId", imageId);
        formData.set("noteId", noteId);
        formData.set("file", file);
        let uploadedImage: NoteImage | null = null;

        await queueMoodboardRequest(noteId, async () => {
          const res = await fetch(`/api/trips/${activeTripId}/moodboard/images`, {
            method: "POST",
            body: formData,
          });
          const payload = (await res.json()) as {
            id?: string;
            url?: string;
            error?: string;
          };

          if (!res.ok || !payload.id || !payload.url) {
            throw new Error(payload.error ?? "Failed to upload moodboard image.");
          }

          uploadedImage = {
            id: payload.id,
            dataUrl: payload.url,
            width: null,
            x: 0,
            y: 0,
          };
        });

        if (!uploadedImage) {
          throw new Error("Failed to upload moodboard image.");
        }

        return uploadedImage;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () =>
          reject(reader.error ?? new Error("Failed to read image."));
        reader.readAsDataURL(file);
      });

      return {
        id: uuid(),
        dataUrl,
        width: null,
        x: 0,
        y: 0,
      };
    },
    [activeTripId, isSupabaseMode]
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
        subtasks: [],
      });
      repo.updateBudgetItem(budgetItemId, { relatedTaskId: taskId });
    },
    [tripId]
  );

  // ---- Unified Plan Activity ----
  const planActivity = useCallback(
    async (input: PlanActivityInput) => {
      const eventId = input.createEvent ? uuid() : null;
      const taskId = input.createTask ? uuid() : null;
      const budgetId = input.createBudget ? uuid() : null;
      const initialTaskSubtasks = normalizeTaskSubtasks(input.taskSubtasks);
      const initialTaskStatus = deriveStatusFromSubtasks(initialTaskSubtasks) ?? (input.taskStatus || "TODO");

      if (isSupabaseMode && activeTripId) {
        const parseError = async (res: Response, fallback: string) => {
          try {
            const payload = (await res.json()) as { error?: string };
            return payload.error ?? fallback;
          } catch {
            return fallback;
          }
        };

        if (input.createEvent && eventId) {
          const eventRes = await fetch(`/api/trips/${activeTripId}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: eventId,
              title: input.eventTitleOverride || input.title,
              description: input.description,
              location: input.eventLocation || "",
              startAt: input.eventStartAt || new Date().toISOString(),
              endAt: input.eventEndAt || new Date().toISOString(),
              status: input.eventStatus || "DRAFT",
              provider: input.eventProvider || "",
              confirmationCode: input.eventConfirmationCode || "",
              attendeeUserIds: uniqueIds(input.eventAttendeeUserIds),
            }),
          });
          if (!eventRes.ok) {
            throw new Error(await parseError(eventRes, "Failed to create event."));
          }
        }

        if (input.createTask && taskId) {
          const taskRes = await fetch(`/api/trips/${activeTripId}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: taskId,
              title:
                input.taskTitleOverride ||
                (input.createEvent ? `Book: ${input.title}` : input.title),
              description: input.description,
              status: initialTaskStatus,
              priority: input.taskPriority || "MEDIUM",
              dueAt: input.taskDueAt || null,
              assigneeUserIds: input.taskAssigneeIds || [],
              relatedEventId: eventId,
              relatedBudgetItemId: null,
              subtasks: initialTaskSubtasks,
            }),
          });
          if (!taskRes.ok) {
            throw new Error(await parseError(taskRes, "Failed to create task."));
          }
        }

        if (input.createBudget && budgetId) {
          const budgetRes = await fetch(`/api/trips/${activeTripId}/budget`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: budgetId,
              title: input.budgetTitleOverride || input.title,
              category: input.budgetCategory || "OTHER",
              plannedAmount: input.budgetPlannedAmount || 0,
              actualAmount: input.budgetActualAmount || 0,
              currency: "USD",
              responsibleUserId: input.budgetResponsibleId || null,
              paidByUserId: input.budgetPaidById || null,
              status: input.budgetStatus || "PLANNED",
              relatedEventId: eventId,
              relatedTaskId: taskId,
              notes: input.budgetNotes?.trim() || "",
              costMode: input.budgetCostMode || "total",
              splitType: input.budgetSplitType || "even",
              splitAttendeeUserIds: input.eventAttendeeUserIds || [],
            }),
          });
          if (!budgetRes.ok) {
            throw new Error(await parseError(budgetRes, "Failed to create budget item."));
          }
        }

        if (input.createTask && input.createBudget && taskId && budgetId) {
          const linkRes = await fetch(`/api/trips/${activeTripId}/tasks`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: taskId,
              patch: { relatedBudgetItemId: budgetId },
            }),
          });
          if (!linkRes.ok) {
            throw new Error(await parseError(linkRes, "Failed to link task and budget item."));
          }
        }

        refresh();
        return;
      }

      // Demo mode fallback
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
          attendeeUserIds: uniqueIds(input.eventAttendeeUserIds),
        });
      }

      if (input.createTask && taskId) {
        repo.addTask({
          id: taskId,
          tripId,
          title:
            input.taskTitleOverride ||
            (input.createEvent ? `Book: ${input.title}` : input.title),
          description: input.description,
          status: initialTaskStatus,
          priority: input.taskPriority || "MEDIUM",
          dueAt: input.taskDueAt || null,
          assigneeUserIds: input.taskAssigneeIds || [],
          relatedEventId: eventId,
          relatedBudgetItemId: budgetId,
          subtasks: initialTaskSubtasks,
        });
      }

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
    },
    [activeTripId, isSupabaseMode, refresh, tripId]
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
    deleteGuest,
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
    setMoodboardNotes,
    uploadMoodboardImage,
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
