import { type DemoStore, initialDemoStore } from "./demoData";
import type { Repository } from "./repository";
import type {
  BudgetItem,
  ChecklistItem,
  GuestFieldDef,
  Invite,
  Membership,
  Photo,
  Poll,
  Task,
  Trip,
  TripEvent,
  User,
} from "./types";

const STORAGE_KEY = "bachelorette-planner-store";

function loadStore(): DemoStore {
  if (typeof window === "undefined") return structuredClone(initialDemoStore);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      // Back-fill arrays added after initial schema
      if (!parsed.checklistItems) parsed.checklistItems = [];
      if (!parsed.polls) parsed.polls = [];
      if (!parsed.photos) parsed.photos = [];
      if (!parsed.invites) parsed.invites = [];
      return parsed;
    }
  } catch {
    // corrupted — reset
  }
  const fresh = structuredClone(initialDemoStore);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveStore(store: DemoStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Singleton mutable store — lives for the lifetime of the tab. */
let _store: DemoStore | null = null;

function getStore(): DemoStore {
  if (!_store) _store = loadStore();
  return _store;
}

function persist(): void {
  if (_store) saveStore(_store);
}

// Notify listeners after mutations
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  persist();
  listeners.forEach((fn) => fn());
}

/** Reset to initial seed data */
export function resetStore(): void {
  _store = structuredClone(initialDemoStore);
  persist();
  notify();
}

/** Clear all events, tasks, and budget items (keeps users & memberships) */
export function clearAllData(): void {
  const s = getStore();
  s.events = [];
  s.tasks = [];
  s.budgetItems = [];
  s.checklistItems = [];
  s.polls = [];
  s.photos = [];
  persist();
  notify();
}

/** Return a deep clone of the current store for export */
export function exportStore(): DemoStore {
  return structuredClone(getStore());
}

/** Replace the current store with an imported snapshot and notify listeners */
export function importStore(store: DemoStore): void {
  _store = structuredClone(store);
  persist();
  notify();
}

// ---- Implementation ----

export const demoRepository: Repository = {
  // Users
  getUsers(tripId: string): User[] {
    const s = getStore();
    const memberUserIds = s.memberships
      .filter((m) => m.tripId === tripId)
      .map((m) => m.userId);
    return s.users.filter((u) => memberUserIds.includes(u.id));
  },
  getUser(userId: string): User | undefined {
    return getStore().users.find((u) => u.id === userId);
  },
  addUser(user: User): void {
    getStore().users.push(user);
    notify();
  },
  updateUser(userId: string, patch: Partial<User>): void {
    const s = getStore();
    const idx = s.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      s.users[idx] = { ...s.users[idx], ...patch };
      notify();
    }
  },

  // Trips
  getTrip(tripId: string): Trip | undefined {
    return getStore().trips.find((t) => t.id === tripId);
  },
  createTrip(trip: Trip): void {
    getStore().trips.push(trip);
    notify();
  },
  updateTrip(tripId: string, patch: Partial<Trip>): void {
    const s = getStore();
    const idx = s.trips.findIndex((t) => t.id === tripId);
    if (idx !== -1) {
      s.trips[idx] = { ...s.trips[idx], ...patch };
      notify();
    }
  },
  setGuestFieldSchema(tripId: string, schema: GuestFieldDef[]): void {
    const s = getStore();
    const idx = s.trips.findIndex((t) => t.id === tripId);
    if (idx !== -1) {
      s.trips[idx] = { ...s.trips[idx], guestFieldSchema: schema };
      notify();
    }
  },

  // Memberships
  getMemberships(tripId: string): Membership[] {
    return getStore().memberships.filter((m) => m.tripId === tripId);
  },
  addMembership(m: Membership): void {
    getStore().memberships.push(m);
    notify();
  },
  updateMembership(
    tripId: string,
    userId: string,
    patch: Partial<Membership>,
  ): void {
    const s = getStore();
    const idx = s.memberships.findIndex(
      (m) => m.tripId === tripId && m.userId === userId,
    );
    if (idx !== -1) {
      s.memberships[idx] = { ...s.memberships[idx], ...patch };
      notify();
    }
  },

  // Events
  getEvents(tripId: string): TripEvent[] {
    return getStore().events.filter((e) => e.tripId === tripId);
  },
  getEvent(eventId: string): TripEvent | undefined {
    return getStore().events.find((e) => e.id === eventId);
  },
  addEvent(event: TripEvent): void {
    getStore().events.push(event);
    notify();
  },
  updateEvent(eventId: string, patch: Partial<TripEvent>): void {
    const s = getStore();
    const idx = s.events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      s.events[idx] = { ...s.events[idx], ...patch };
      notify();
    }
  },
  deleteEvent(eventId: string): void {
    const s = getStore();
    s.events = s.events.filter((e) => e.id !== eventId);
    notify();
  },

  // Tasks
  getTasks(tripId: string): Task[] {
    return getStore().tasks.filter((t) => t.tripId === tripId);
  },
  getTask(taskId: string): Task | undefined {
    return getStore().tasks.find((t) => t.id === taskId);
  },
  addTask(task: Task): void {
    getStore().tasks.push(task);
    notify();
  },
  updateTask(taskId: string, patch: Partial<Task>): void {
    const s = getStore();
    const idx = s.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      s.tasks[idx] = { ...s.tasks[idx], ...patch };
      notify();
    }
  },
  deleteTask(taskId: string): void {
    const s = getStore();
    s.tasks = s.tasks.filter((t) => t.id !== taskId);
    notify();
  },

  // Budget Items
  getBudgetItems(tripId: string): BudgetItem[] {
    return getStore().budgetItems.filter((b) => b.tripId === tripId);
  },
  getBudgetItem(itemId: string): BudgetItem | undefined {
    return getStore().budgetItems.find((b) => b.id === itemId);
  },
  addBudgetItem(item: BudgetItem): void {
    getStore().budgetItems.push(item);
    notify();
  },
  updateBudgetItem(itemId: string, patch: Partial<BudgetItem>): void {
    const s = getStore();
    const idx = s.budgetItems.findIndex((b) => b.id === itemId);
    if (idx !== -1) {
      s.budgetItems[idx] = { ...s.budgetItems[idx], ...patch };
      notify();
    }
  },
  deleteBudgetItem(itemId: string): void {
    const s = getStore();
    s.budgetItems = s.budgetItems.filter((b) => b.id !== itemId);
    notify();
  },

  // Checklist Items
  getChecklistItems(tripId: string): ChecklistItem[] {
    return getStore().checklistItems.filter((c) => c.tripId === tripId);
  },
  addChecklistItem(item: ChecklistItem): void {
    getStore().checklistItems.push(item);
    notify();
  },
  updateChecklistItem(itemId: string, patch: Partial<ChecklistItem>): void {
    const s = getStore();
    const idx = s.checklistItems.findIndex((c) => c.id === itemId);
    if (idx !== -1) {
      s.checklistItems[idx] = { ...s.checklistItems[idx], ...patch };
      notify();
    }
  },
  deleteChecklistItem(itemId: string): void {
    const s = getStore();
    s.checklistItems = s.checklistItems.filter((c) => c.id !== itemId);
    notify();
  },

  // Polls
  getPolls(tripId: string): Poll[] {
    return getStore().polls.filter((p) => p.tripId === tripId);
  },
  addPoll(poll: Poll): void {
    getStore().polls.push(poll);
    notify();
  },
  updatePoll(pollId: string, patch: Partial<Poll>): void {
    const s = getStore();
    const idx = s.polls.findIndex((p) => p.id === pollId);
    if (idx !== -1) {
      s.polls[idx] = { ...s.polls[idx], ...patch };
      notify();
    }
  },
  deletePoll(pollId: string): void {
    const s = getStore();
    s.polls = s.polls.filter((p) => p.id !== pollId);
    notify();
  },

  // Photos
  getPhotos(tripId: string): Photo[] {
    return getStore().photos.filter((p) => p.tripId === tripId);
  },
  addPhoto(photo: Photo): void {
    getStore().photos.push(photo);
    notify();
  },
  deletePhoto(photoId: string): void {
    const s = getStore();
    s.photos = s.photos.filter((p) => p.id !== photoId);
    notify();
  },

  // Invites
  getInvites(tripId: string): Invite[] {
    return (getStore().invites ?? []).filter((i) => i.tripId === tripId);
  },
  addInvite(invite: Invite): void {
    const s = getStore();
    if (!s.invites) s.invites = [];
    // Replace any existing unclaimed invite for this email+trip
    s.invites = s.invites.filter(
      (i) => !(i.tripId === invite.tripId && i.email === invite.email),
    );
    s.invites.push(invite);
    notify();
  },
  getInviteByToken(token: string): Invite | undefined {
    return (getStore().invites ?? []).find((i) => i.token === token);
  },
  claimInvite(token: string, claimedAt: string): void {
    const s = getStore();
    const idx = (s.invites ?? []).findIndex((i) => i.token === token);
    if (idx !== -1) {
      s.invites[idx] = { ...s.invites[idx], claimedAt };
      notify();
    }
  },
};
