import type {
  BudgetItem,
  ChecklistItem,
  GuestFieldDef,
  Invite,
  Membership,
  MoodboardNote,
  Photo,
  Poll,
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
  removeGuestFromTrip(tripId: string, userId: string): void;

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

  // Checklist Items
  getChecklistItems(tripId: string): ChecklistItem[];
  addChecklistItem(item: ChecklistItem): void;
  updateChecklistItem(itemId: string, patch: Partial<ChecklistItem>): void;
  deleteChecklistItem(itemId: string): void;

  // Polls
  getPolls(tripId: string): Poll[];
  addPoll(poll: Poll): void;
  updatePoll(pollId: string, patch: Partial<Poll>): void;
  deletePoll(pollId: string): void;

  // Photos
  getPhotos(tripId: string): Photo[];
  addPhoto(photo: Photo): void;
  deletePhoto(photoId: string): void;

  // Invites
  getInvites(tripId: string): Invite[];
  addInvite(invite: Invite): void;
  getInviteByToken(token: string): Invite | undefined;
  claimInvite(token: string, claimedAt: string): void;
  // Moodboard Notes
  getMoodboardNotes(tripId: string): MoodboardNote[];
  setMoodboardNotes(tripId: string, notes: MoodboardNote[]): void;
  addMoodboardNote(note: MoodboardNote): void;
  updateMoodboardNote(noteId: string, patch: Partial<MoodboardNote>): void;
  deleteMoodboardNote(noteId: string): void;
}
