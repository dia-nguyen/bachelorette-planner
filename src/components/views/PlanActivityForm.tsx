"use client";

import { Avatar, Card } from "@/components/ui";
import { useApp } from "@/lib/context";
import type { BudgetCategory, BudgetItemStatus, CostSplitType, EventStatus, TaskPriority, TaskStatus } from "@/lib/data";
import { useState } from "react";
import { BsCalendarDate } from "react-icons/bs";
import { IoIosCheckboxOutline } from "react-icons/io";
import { PiMoneyBold } from "react-icons/pi";

const CATEGORIES: BudgetCategory[] = [
  "ACTIVITY", "DECORATION", "RESTAURANT", "ACCOMMODATION",
  "TRANSPORT", "OUTFIT", "MISC",
];

interface PlanActivityFormProps {
  onClose: () => void;
}

export function PlanActivityForm({ onClose }: PlanActivityFormProps) {
  const { users, memberships, planActivity } = useApp();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Core
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Toggles — which pieces to create
  const [wantEvent, setWantEvent] = useState(false);
  const [wantTask, setWantTask] = useState(true); // most activities need a to-do
  const [wantBudget, setWantBudget] = useState(false);

  // Per-section title unlock
  const [eventTitleUnlocked, setEventTitleUnlocked] = useState(false);
  const [eventTitleValue, setEventTitleValue] = useState("");
  const [taskTitleUnlocked, setTaskTitleUnlocked] = useState(false);
  const [taskTitleValue, setTaskTitleValue] = useState("");
  const [budgetTitleUnlocked, setBudgetTitleUnlocked] = useState(false);
  const [budgetTitleValue, setBudgetTitleValue] = useState("");

  // Event fields
  const [eventStatus, setEventStatus] = useState<EventStatus>("DRAFT");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartAt, setEventStartAt] = useState("");
  const [eventEndAt, setEventEndAt] = useState("");
  const [eventProvider, setEventProvider] = useState("");
  const [eventConfirmationCode, setEventConfirmationCode] = useState("");
  const [eventAttendees, setEventAttendees] = useState<string[]>([]);

  // Task fields
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("TODO");
  const [taskDueAt, setTaskDueAt] = useState("");

  // Budget fields
  const [budgetCategory, setBudgetCategory] = useState<BudgetCategory>("MISC");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetActualAmount, setBudgetActualAmount] = useState("");
  const [budgetCostMode, setBudgetCostMode] = useState<"total" | "per_person">("total");
  const [budgetSplitType, setBudgetSplitType] = useState<CostSplitType>("even");
  const [budgetStatus, setBudgetStatus] = useState<BudgetItemStatus>("PLANNED");
  const [budgetResponsible, setBudgetResponsible] = useState("");
  const [budgetPaidBy, setBudgetPaidBy] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");

  const acceptedUsers = users;

  const toggleAttendee = (userId: string) => {
    setEventAttendees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitError(null);
    setSubmitting(true);

    const attendeeCountForBudget = wantEvent ? eventAttendees.length : 0;
    const plannedInputAmount = parseFloat(budgetAmount) || 0;
    const actualInputAmount = parseFloat(budgetActualAmount) || 0;
    const budgetPlannedAmountTotal =
      budgetCostMode === "per_person" && attendeeCountForBudget > 0
        ? plannedInputAmount * attendeeCountForBudget
        : plannedInputAmount;
    const budgetActualAmountTotal =
      budgetCostMode === "per_person" && attendeeCountForBudget > 0
        ? actualInputAmount * attendeeCountForBudget
        : actualInputAmount;

    try {
      await planActivity({
        title: title.trim(),
        description: description.trim(),
        eventTitleOverride: eventTitleUnlocked && eventTitleValue.trim() ? eventTitleValue.trim() : undefined,
        taskTitleOverride: taskTitleUnlocked && taskTitleValue.trim() ? taskTitleValue.trim() : undefined,
        budgetTitleOverride: budgetTitleUnlocked && budgetTitleValue.trim() ? budgetTitleValue.trim() : undefined,
        createEvent: wantEvent,
        eventLocation: eventLocation.trim(),
        eventStartAt: eventStartAt ? new Date(eventStartAt).toISOString() : undefined,
        eventEndAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
        eventStatus,
        eventProvider: eventProvider.trim() || undefined,
        eventConfirmationCode: eventConfirmationCode.trim() || undefined,
        eventAttendeeUserIds: eventAttendees,
        createTask: wantTask,
        taskAssigneeIds: taskAssignees,
        taskPriority,
        taskStatus,
        taskDueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
        createBudget: wantBudget,
        budgetCategory,
        budgetPlannedAmount: budgetPlannedAmountTotal,
        budgetActualAmount: budgetActualAmountTotal,
        budgetCostMode,
        budgetSplitType,
        budgetStatus,
        budgetResponsibleId: budgetResponsible || null,
        budgetPaidById: budgetPaidBy || null,
        budgetNotes: budgetNotes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create item.");
    } finally {
      setSubmitting(false);
    }
  };

  // Count how many entities will be created
  const entityCount = [wantEvent, wantTask, wantBudget].filter(Boolean).length;
  const budgetAttendeeCount = wantEvent ? eventAttendees.length : 0;
  const plannedPreviewAmount = parseFloat(budgetAmount) || 0;
  const actualPreviewAmount = parseFloat(budgetActualAmount) || 0;
  const plannedTotalPreview =
    budgetCostMode === "per_person" && budgetAttendeeCount > 0
      ? plannedPreviewAmount * budgetAttendeeCount
      : plannedPreviewAmount;
  const actualTotalPreview =
    budgetCostMode === "per_person" && budgetAttendeeCount > 0
      ? actualPreviewAmount * budgetAttendeeCount
      : actualPreviewAmount;

  return (
    <Card
      style={{
        padding: 0,
        maxHeight: "92vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "var(--color-bg-surface)",
          borderBottom: "1px solid var(--color-border)",
          padding: "14px 18px",
        }}
      >
        <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700 }}>
          Plan Something
        </h3>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      <div style={{ padding: "16px 18px 12px", flex: 1, minHeight: 0 }}>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Describe what you&apos;re planning, then toggle which pieces to track. Everything gets linked automatically.
        </p>

        {submitError && (
          <p style={{ fontSize: "var(--font-sm)", color: "#dc2626", marginBottom: 16 }}>
            {submitError}
          </p>
        )}

        {/* Core fields */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          <label style={labelStyle}>
            What are you planning?
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dinner at La Rosa, Buy decorations, Create slideshow..."
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Details (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes or details..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
        </div>

        {/* Toggle pills */}
        <div className="mb-4">
          <p style={{ ...labelStyle, marginBottom: 8 }}>What does this involve?</p>
          <div className="flex flex-wrap gap-2">
          <TogglePill active={wantEvent} onClick={() => setWantEvent(!wantEvent)} icon={<BsCalendarDate size={14} />} label="Event / Date" />
          <TogglePill active={wantTask} onClick={() => setWantTask(!wantTask)} icon={<IoIosCheckboxOutline size={15} />} label="To-Do" />
          <TogglePill active={wantBudget} onClick={() => setWantBudget(!wantBudget)} icon={<PiMoneyBold size={14} />} label="Budget" />
          </div>
        </div>

        {/* Conditional sections */}
        <div className="flex flex-col gap-4">
        {wantEvent && (
          <section style={sectionStyle}>
            <p style={sectionHeader}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <BsCalendarDate size={14} />
                <span>Event Details</span>
              </span>
            </p>
            <SectionTitleField
              baseTitle={title}
              unlocked={eventTitleUnlocked}
              value={eventTitleValue}
              onUnlock={() => { setEventTitleUnlocked(true); setEventTitleValue(title); }}
              onLock={() => { setEventTitleUnlocked(false); setEventTitleValue(""); }}
              onChange={setEventTitleValue}
            />
            <div className="grid grid-cols-2 gap-3">
              <label style={labelStyle}>
                Location
                <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Venue" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Status
                <select value={eventStatus} onChange={(e) => setEventStatus(e.target.value as EventStatus)} style={inputStyle}>
                  <option value="DRAFT">Draft</option>
                  <option value="PLANNED">Planned</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELED">Canceled</option>
                </select>
              </label>
              <label style={labelStyle}>
                Start
                <input type="datetime-local" value={eventStartAt} onChange={(e) => setEventStartAt(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                End
                <input type="datetime-local" value={eventEndAt} onChange={(e) => setEventEndAt(e.target.value)} style={inputStyle} />
              </label>
            </div>

            {/* Reservation sub-section */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
              <p style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>
                🎫 Reservation (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label style={labelStyle}>
                  Provider / Venue
                  <input type="text" value={eventProvider} onChange={(e) => setEventProvider(e.target.value)} placeholder="Restaurant name, hotel..." style={inputStyle} />
                </label>
                <label style={labelStyle}>
                  Confirmation Code
                  <input type="text" value={eventConfirmationCode} onChange={(e) => setEventConfirmationCode(e.target.value)} placeholder="Optional" style={inputStyle} />
                </label>
              </div>
            </div>

            {/* Attendee multi-select */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
              <p style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>
                👥 Who&apos;s going?
              </p>
              <div className="flex flex-wrap gap-2">
                {acceptedUsers.map((u) => {
                  const selected = eventAttendees.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAttendee(u.id)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radius-pill)",
                        border: selected
                          ? "2px solid var(--color-accent)"
                          : "1px dashed var(--color-border)",
                        background: selected
                          ? "var(--color-accent-soft)"
                          : "var(--color-bg-surface)",
                        fontSize: "var(--font-sm)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Avatar name={u.name} color={u.avatarColor} size={18} />
                      <span>{u.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {wantTask && (
          <section style={sectionStyle}>
            <p style={sectionHeader}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IoIosCheckboxOutline size={15} />
                <span>To-Do Details</span>
              </span>
            </p>
            <SectionTitleField
              baseTitle={title}
              unlocked={taskTitleUnlocked}
              value={taskTitleValue}
              onUnlock={() => { setTaskTitleUnlocked(true); setTaskTitleValue(title); }}
              onLock={() => { setTaskTitleUnlocked(false); setTaskTitleValue(""); }}
              onChange={setTaskTitleValue}
            />
            <div className="grid grid-cols-4 gap-3">
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ ...labelStyle, marginBottom: 6 }}>Assignees</p>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => {
                    const sel = taskAssignees.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setTaskAssignees((prev) => sel ? prev.filter((id) => id !== u.id) : [...prev, u.id])}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "var(--radius-pill)",
                          border: sel ? "2px solid var(--color-accent)" : "1px dashed var(--color-border)",
                          background: sel ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
                          fontSize: "var(--font-sm)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Avatar name={u.name} color={u.avatarColor} size={16} />
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label style={labelStyle}>
                Priority
                <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as TaskPriority)} style={inputStyle}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label style={labelStyle}>
                Status
                <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as TaskStatus)} style={inputStyle}>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </label>
              <label style={labelStyle}>
                Due Date
                <input type="date" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} style={inputStyle} />
              </label>
            </div>
          </section>
        )}

        {wantBudget && (
          <section style={sectionStyle}>
            <p style={sectionHeader}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PiMoneyBold size={14} />
                <span>Budget Details</span>
              </span>
            </p>
            <SectionTitleField
              baseTitle={title}
              unlocked={budgetTitleUnlocked}
              value={budgetTitleValue}
              onUnlock={() => { setBudgetTitleUnlocked(true); setBudgetTitleValue(title); }}
              onLock={() => { setBudgetTitleUnlocked(false); setBudgetTitleValue(""); }}
              onChange={setBudgetTitleValue}
            />
            <div className="grid grid-cols-3 gap-3">
              <label style={labelStyle}>
                Category
                <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value as BudgetCategory)} style={inputStyle}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Status
                <select value={budgetStatus} onChange={(e) => setBudgetStatus(e.target.value as BudgetItemStatus)} style={inputStyle}>
                  <option value="PLANNED">Planned</option>
                  <option value="PURCHASED">Purchased</option>
                  <option value="REIMBURSED">Reimbursed</option>
                  <option value="SETTLED">Settled</option>
                </select>
              </label>
              <label style={labelStyle}>
                Enter as
                <select value={budgetCostMode} onChange={(e) => setBudgetCostMode(e.target.value as "total" | "per_person")} style={inputStyle}>
                  <option value="total">Total cost</option>
                  <option value="per_person">Per person</option>
                </select>
              </label>
              <label style={labelStyle}>
                Split
                <select value={budgetSplitType} onChange={(e) => setBudgetSplitType(e.target.value as CostSplitType)} style={inputStyle}>
                  <option value="even">Even split</option>
                  <option value="custom">Custom split</option>
                </select>
              </label>
              <label style={labelStyle}>
                {budgetCostMode === "per_person" ? "Planned Cost (per person)" : "Planned Cost"}
                <input type="number" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
                {budgetCostMode === "per_person" && budgetAttendeeCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                    Total: ${plannedTotalPreview.toFixed(2)} ({budgetAttendeeCount} attendee{budgetAttendeeCount === 1 ? "" : "s"})
                  </span>
                )}
              </label>
              <label style={labelStyle}>
                {budgetCostMode === "per_person" ? "Actual Cost (per person)" : "Actual Cost"}
                <input type="number" value={budgetActualAmount} onChange={(e) => setBudgetActualAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
                {budgetCostMode === "per_person" && budgetAttendeeCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                    Total: ${actualTotalPreview.toFixed(2)} ({budgetAttendeeCount} attendee{budgetAttendeeCount === 1 ? "" : "s"})
                  </span>
                )}
              </label>
              <label style={labelStyle}>
                Responsible
                <select value={budgetResponsible} onChange={(e) => setBudgetResponsible(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Paid By
                <select value={budgetPaidBy} onChange={(e) => setBudgetPaidBy(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {budgetCostMode === "per_person" && budgetAttendeeCount === 0 && (
              <p style={{ fontSize: "var(--font-xs)", color: "var(--color-text-secondary)", marginTop: 6 }}>
                Per-person mode uses attendee count when this is linked to an event with attendees.
              </p>
            )}
            {budgetSplitType === "custom" && (
              <p style={{ fontSize: "var(--font-xs)", color: "var(--color-text-secondary)", marginTop: 6 }}>
                Custom split is saved. You can define per-person amounts in the budget item after creating.
              </p>
            )}
            <label style={{ ...labelStyle, display: "block", marginTop: 8 }}>
              Notes (optional)
              <textarea
                value={budgetNotes}
                onChange={(e) => setBudgetNotes(e.target.value)}
                placeholder="Any notes about this expense..."
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          </section>
        )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between"
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          background: "var(--color-bg-surface)",
          borderTop: "1px solid var(--color-border)",
          padding: "12px 18px",
        }}
      >
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
          {entityCount === 0
            ? "Toggle at least one item above"
            : `Will create ${entityCount} linked item${entityCount > 1 ? "s" : ""}`}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={submitting} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !title.trim() || entityCount === 0}
            style={{
              ...primaryBtnStyle,
              opacity: submitting || !title.trim() || entityCount === 0 ? 0.5 : 1,
            }}
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ---- Section title field ----

function SectionTitleField({
  baseTitle,
  unlocked,
  value,
  onUnlock,
  onLock,
  onChange,
}: {
  baseTitle: string;
  unlocked: boolean;
  value: string;
  onUnlock: () => void;
  onLock: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div style={{ flex: 1, position: "relative" }}>
        <input
          type="text"
          value={unlocked ? value : baseTitle}
          onChange={(e) => onChange(e.target.value)}
          disabled={!unlocked}
          placeholder="Title"
          style={{
            ...inputStyle,
            background: unlocked ? "var(--color-bg-surface)" : "var(--color-bg-muted)",
            color: unlocked ? "var(--color-text-primary)" : "var(--color-text-secondary)",
            cursor: unlocked ? "text" : "default",
          }}
        />
      </div>
      <button
        type="button"
        title={unlocked ? "Use shared title" : "Customize this title"}
        onClick={unlocked ? onLock : onUnlock}
        style={{
          flexShrink: 0,
          padding: "6px 8px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: unlocked ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          color: unlocked ? "var(--color-accent)" : "var(--color-text-secondary)",
          transition: "all 0.15s ease",
        }}
      >
        {unlocked ? "🔓" : "🔒"}
      </button>
    </div>
  );
}

// ---- Toggle pill sub-component ----

function TogglePill({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        border: active ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
        background: active ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
        fontSize: "var(--font-sm)",
        fontWeight: 500,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s ease",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ---- Styles ----

const labelStyle: React.CSSProperties = {
  fontSize: "var(--font-sm)",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  fontSize: "16px",
};

const sectionStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-muted)",
};

const sectionHeader: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "var(--font-md)",
  marginBottom: 10,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: "var(--radius-md)",
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  fontWeight: 500,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  cursor: "pointer",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 18,
  cursor: "pointer",
  color: "var(--color-text-secondary)",
  padding: 4,
};
