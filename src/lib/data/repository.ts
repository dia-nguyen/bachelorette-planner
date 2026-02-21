import type {
  BudgetItem,
  GuestFieldDef,
  Membership,
  Task,
  Trip,
  TripEvent,
  User,
} from "./types";

/**
 * Repository interface — all data access goes through here.
 * UI components never import demoData directly.
 */
export interface Repository {
  // Users
  getUsers(tripId: string): User[];
  getUser(userId: string): User | undefined;
  addUser(user: User): void;
  updateUser(userId: string, patch: Partial<User>): void;

  // Trips
  getTrip(tripId: string): Trip | undefined;
  createTrip(trip: Trip): void;
  updateTrip(tripId: string, patch: Partial<Trip>): void;
  setGuestFieldSchema(tripId: string, schema: GuestFieldDef[]): void;

  // Memberships
  getMemberships(tripId: string): Membership[];
  addMembership(m: Membership): void;
  updateMembership(
    tripId: string,
    userId: string,
    patch: Partial<Membership>,
  ): void;

  // Events
  getEvents(tripId: string): TripEvent[];
  getEvent(eventId: string): TripEvent | undefined;
  addEvent(event: TripEvent): void;
  updateEvent(eventId: string, patch: Partial<TripEvent>): void;
  deleteEvent(eventId: string): void;

  // Tasks
  getTasks(tripId: string): Task[];
  getTask(taskId: string): Task | undefined;
  addTask(task: Task): void;
  updateTask(taskId: string, patch: Partial<Task>): void;
  deleteTask(taskId: string): void;

  // Budget Items
  getBudgetItems(tripId: string): BudgetItem[];
  getBudgetItem(itemId: string): BudgetItem | undefined;
  addBudgetItem(item: BudgetItem): void;
  updateBudgetItem(itemId: string, patch: Partial<BudgetItem>): void;
  deleteBudgetItem(itemId: string): void;
}
