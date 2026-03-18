"use client";

import { Badge, budgetStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { BudgetCategory, BudgetItem, BudgetItemStatus, CostSplitType, Task, TripEvent, User } from "@/lib/data";
import { formatBudgetLabel, formatCurrency } from "@/lib/domain";
import { useState } from "react";
import { HiPencilAlt } from "react-icons/hi";
import { BsCalendarDate } from "react-icons/bs";
import { IoIosCheckboxOutline } from "react-icons/io";
import { PiMoneyBold } from "react-icons/pi";

interface BudgetDetailProps {
  item: BudgetItem;
  responsible?: User;
  paidBy?: User;
  linkedEvent?: TripEvent;
  linkedTask?: Task;
  allUsers: User[];
  allEvents: TripEvent[];
  allTasks: Task[];
  /** Users attending the linked event — used for cost splitting */
  linkedEventAttendees: User[];
  onNavigate: (type: "event" | "task", id: string) => void;
  onCreateTask: () => void;
  onUpdate: (patch: Partial<BudgetItem>) => void;
  canDelete: boolean;
  linkedDeleteCount: number;
  onDeleteOnly: () => void;
  onDeleteLinked: () => void;
}

const CATEGORIES: BudgetCategory[] = [
  "ACTIVITY", "DECORATION", "RESTAURANT", "ACCOMMODATION",
  "TRANSPORT", "OUTFIT", "MISC",
];
const STATUSES: BudgetItemStatus[] = ["PLANNED", "PURCHASED", "REIMBURSED", "SETTLED"];

export function BudgetDetail({
  item, responsible, paidBy,
  linkedEvent, linkedTask,
  allUsers, allEvents, allTasks,
  linkedEventAttendees,
  onNavigate, onCreateTask, onUpdate,
  canDelete, linkedDeleteCount, onDeleteOnly, onDeleteLinked,
}: BudgetDetailProps) {
  function toDraft(b: BudgetItem) {
    return {
      title: b.title,
      category: b.category,
      plannedAmount: b.plannedAmount,
      actualAmount: b.actualAmount,
      status: b.status,
      responsibleUserId: b.responsibleUserId ?? "",
      paidByUserId: b.paidByUserId ?? "",
      relatedEventId: b.relatedEventId ?? "",
      relatedTaskId: b.relatedTaskId ?? "",
      notes: b.notes,
      costMode: (b.costMode ?? "total") as "total" | "per_person",
      splitType: (b.splitType ?? "even") as CostSplitType,
      plannedSplits: { ...(b.plannedSplits ?? {}) } as Record<string, number>,
      actualSplits: { ...(b.actualSplits ?? {}) } as Record<string, number>,
      splitAttendeeUserIds: [...(b.splitAttendeeUserIds ?? [])] as string[],
    };
  }

  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(item));

  const handleEdit = () => {
    setDraft(toDraft(item));
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = () => {
    onUpdate({
      title: draft.title.trim() || item.title,
      category: draft.category,
      plannedAmount: draft.plannedAmount,
      actualAmount: draft.actualAmount,
      status: draft.status,
      responsibleUserId: draft.responsibleUserId || null,
      paidByUserId: draft.paidByUserId || null,
      relatedEventId: draft.relatedEventId || null,
      relatedTaskId: draft.relatedTaskId || null,
      notes: draft.notes.trim(),
      costMode: draft.costMode,
      splitType: draft.splitType,
      plannedSplits: draft.splitType === "custom" ? draft.plannedSplits : undefined,
      actualSplits: draft.splitType === "custom" ? draft.actualSplits : undefined,
      splitAttendeeUserIds: draft.relatedEventId ? undefined : draft.splitAttendeeUserIds,
    });
    setEditing(false);
  };

  const attendees = linkedEventAttendees;

  // In edit mode we derive attendees from the live draft values so the split
  // table reacts immediately when the user changes the linked event or picks
  // standalone attendees.
  const editAttendees = (() => {
    if (draft.relatedEventId) {
      const ev = allEvents.find((e) => e.id === draft.relatedEventId);
      return allUsers.filter((u) => (ev?.attendeeUserIds ?? []).includes(u.id));
    }
    return allUsers.filter((u) => draft.splitAttendeeUserIds.includes(u.id));
  })();
  const editAttendeeCount = editAttendees.length;
  const getDraftAttendeeCount = (d: typeof draft): number => {
    if (d.relatedEventId) {
      const ev = allEvents.find((e) => e.id === d.relatedEventId);
      return ev?.attendeeUserIds?.length ?? 0;
    }
    return d.splitAttendeeUserIds.length;
  };
  const rescaleDraftForPerPersonEven = (
    d: typeof draft,
    nextCount: number,
    previousCount: number,
  ): typeof draft => {
    if (!(d.costMode === "per_person" && d.splitType === "even")) return d;
    const prev = previousCount > 0 ? previousCount : 1;
    const next = nextCount > 0 ? nextCount : 1;
    return {
      ...d,
      plannedAmount: (d.plannedAmount / prev) * next,
      actualAmount: (d.actualAmount / prev) * next,
    };
  };

  const setPlannedSplit = (userId: string, val: number) =>
    setDraft((d) => {
      const s = { ...d.plannedSplits, [userId]: val };
      return { ...d, plannedSplits: s, plannedAmount: Object.values(s).reduce((a, v) => a + (v || 0), 0) };
    });

  const setActualSplit = (userId: string, val: number) =>
    setDraft((d) => {
      const s = { ...d.actualSplits, [userId]: val };
      return { ...d, actualSplits: s, actualAmount: Object.values(s).reduce((a, v) => a + (v || 0), 0) };
    });

  const switchSplitType = (st: CostSplitType) => {
    const initSplits = (existing: Record<string, number>, people: User[]) => {
      const s: Record<string, number> = {};
      people.forEach((u) => { s[u.id] = existing[u.id] ?? 0; });
      return s;
    };
    setDraft((d) => {
      const people = d.relatedEventId
        ? allUsers.filter((u) => (allEvents.find((e) => e.id === d.relatedEventId)?.attendeeUserIds ?? []).includes(u.id))
        : allUsers.filter((u) => d.splitAttendeeUserIds.includes(u.id));
      return {
        ...d,
        splitType: st,
        plannedSplits: st === "custom" ? initSplits(d.plannedSplits, people) : d.plannedSplits,
        actualSplits: st === "custom" ? initSplits(d.actualSplits, people) : d.actualSplits,
      };
    });
  };

  // ---- EDIT MODE ----
  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 style={{ fontWeight: 700, fontSize: "var(--font-lg)" }}>Edit Budget Item</h3>
          <div className="flex gap-2">
            <button onClick={handleSave} style={saveBtnStyle}>Save</button>
            <button onClick={handleCancel} style={cancelBtnStyle}>Cancel</button>
          </div>
        </div>

        <label style={labelStyle}>
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            style={inputStyle}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label style={labelStyle}>
            Category
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as BudgetCategory })}
              style={inputStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{formatBudgetLabel(c)}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Status
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as BudgetItemStatus })}
              style={inputStyle}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{formatBudgetLabel(s)}</option>
              ))}
            </select>
          </label>
        </div>

        {/* ---- Cost section ---- */}
        <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-bg-muted)" }}>
          <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <PiMoneyBold size={14} />
            <span>Cost</span>
          </p>
          <div className="flex gap-3 flex-wrap mb-3">
            <label style={labelStyle}>
              Enter&nbsp;as
              <select
                value={draft.costMode}
                onChange={(e) => setDraft((d) => ({ ...d, costMode: e.target.value as "total" | "per_person" }))}
                style={{ ...inputStyle, marginTop: 4 }}
              >
                <option value="total">Total cost</option>
                <option value="per_person">Per person</option>
              </select>
            </label>
            <label style={labelStyle}>
              Split
              <select
                value={draft.splitType}
                onChange={(e) => switchSplitType(e.target.value as CostSplitType)}
                style={{ ...inputStyle, marginTop: 4 }}
              >
                <option value="even">Even split</option>
                <option value="custom">Custom split</option>
              </select>
            </label>
            {editAttendeeCount > 0 && (
              <div style={{ alignSelf: "flex-end", paddingBottom: 6, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                {editAttendeeCount} attendee{editAttendeeCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Attendee picker — always visible for standalone items (no linked event) */}
          {!draft.relatedEventId && (
            <div className="mb-3">
              <p style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>👥 Who&apos;s splitting this?</p>
              <div className="flex flex-wrap gap-2">
                {allUsers.map((u) => {
                  const selected = draft.splitAttendeeUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setDraft((d) => {
                        const previousCount = getDraftAttendeeCount(d);
                        const nextIds = selected
                          ? d.splitAttendeeUserIds.filter((id) => id !== u.id)
                          : [...d.splitAttendeeUserIds, u.id];
                        const nextDraft = { ...d, splitAttendeeUserIds: nextIds };
                        return rescaleDraftForPerPersonEven(nextDraft, nextIds.length, previousCount);
                      })}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radius-pill)",
                        border: selected ? "2px solid var(--color-accent)" : "1px dashed var(--color-border)",
                        background: selected ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
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
          )}

          {draft.splitType === "even" ? (
            <div className="grid grid-cols-2 gap-3">
              <label style={labelStyle}>
                {draft.costMode === "per_person" ? "Planned (per person)" : "Planned (total)"}
                <input
                  type="number"
                  value={draft.costMode === "per_person" && editAttendeeCount > 0
                    ? (draft.plannedAmount / editAttendeeCount || "")
                    : (draft.plannedAmount || "")}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDraft((d) => ({
                      ...d,
                      plannedAmount: d.costMode === "per_person" && editAttendeeCount > 0 ? val * editAttendeeCount : val,
                    }));
                  }}
                  placeholder="0.00"
                  style={inputStyle}
                />
                {draft.costMode === "per_person" && editAttendeeCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                    Total: {formatCurrency(draft.plannedAmount)}
                  </span>
                )}
                {draft.costMode === "total" && editAttendeeCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                    {formatCurrency(draft.plannedAmount / editAttendeeCount)}/person
                  </span>
                )}
              </label>
              <label style={labelStyle}>
                {draft.costMode === "per_person" ? "Actual (per person)" : "Actual (total)"}
                <input
                  type="number"
                  value={draft.costMode === "per_person" && editAttendeeCount > 0
                    ? (draft.actualAmount / editAttendeeCount || "")
                    : (draft.actualAmount || "")}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDraft((d) => ({
                      ...d,
                      actualAmount: d.costMode === "per_person" && editAttendeeCount > 0 ? val * editAttendeeCount : val,
                    }));
                  }}
                  placeholder="0.00"
                  style={inputStyle}
                />
                {draft.costMode === "per_person" && editAttendeeCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                    Total: {formatCurrency(draft.actualAmount)}
                  </span>
                )}
                {draft.costMode === "total" && editAttendeeCount > 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                    {formatCurrency(draft.actualAmount / editAttendeeCount)}/person
                  </span>
                )}
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Attendee picker — always visible for standalone items */}
              {!draft.relatedEventId && (
                <div>
                  <p style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 8 }}>👥 Who&apos;s splitting this?</p>
                  <div className="flex flex-wrap gap-2">
                    {allUsers.map((u) => {
                      const selected = draft.splitAttendeeUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setDraft((d) => {
                            const previousCount = getDraftAttendeeCount(d);
                            const nextIds = selected
                              ? d.splitAttendeeUserIds.filter((id) => id !== u.id)
                              : [...d.splitAttendeeUserIds, u.id];
                            const nextDraft = { ...d, splitAttendeeUserIds: nextIds };
                            return rescaleDraftForPerPersonEven(nextDraft, nextIds.length, previousCount);
                          })}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "var(--radius-pill)",
                            border: selected ? "2px solid var(--color-accent)" : "1px dashed var(--color-border)",
                            background: selected ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
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
              )}
              {editAttendees.length === 0 ? (
                <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                  {draft.relatedEventId
                    ? "The linked event has no attendees yet. Add attendees to the event first."
                    : "Select people above to define custom splits."}
                </p>
              ) : (
                <div>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "1fr 100px 100px", alignItems: "center", paddingBottom: 6, borderBottom: "1px solid var(--color-border)", marginBottom: 6 }}
                  >
                    <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)" }}>Person</span>
                    <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>Planned</span>
                    <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>Actual</span>
                  </div>
                  {editAttendees.map((u) => (
                    <div
                      key={u.id}
                      className="grid gap-2"
                      style={{ gridTemplateColumns: "1fr 100px 100px", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--color-border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} color={u.avatarColor} size={22} />
                        <span style={{ fontSize: "var(--font-sm)" }}>{u.name}</span>
                      </div>
                      <input
                        type="number"
                        value={draft.plannedSplits[u.id] ?? ""}
                        onChange={(e) => setPlannedSplit(u.id, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        style={{ width: "100%", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontSize: "var(--font-sm)", textAlign: "right" }}
                      />
                      <input
                        type="number"
                        value={draft.actualSplits[u.id] ?? ""}
                        onChange={(e) => setActualSplit(u.id, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        style={{ width: "100%", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontSize: "var(--font-sm)", textAlign: "right" }}
                      />
                    </div>
                  ))}
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: "1fr 100px 100px", paddingTop: 8, marginTop: 2 }}
                  >
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Total</span>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, textAlign: "right" }}>{formatCurrency(draft.plannedAmount)}</span>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, textAlign: "right" }}>{draft.actualAmount > 0 ? formatCurrency(draft.actualAmount) : "—"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label style={labelStyle}>
            Responsible
            <select
              value={draft.responsibleUserId}
              onChange={(e) => setDraft({ ...draft, responsibleUserId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select...</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Paid By
            <select
              value={draft.paidByUserId}
              onChange={(e) => setDraft({ ...draft, paidByUserId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select...</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label style={labelStyle}>
            Link to Event
            <select
              value={draft.relatedEventId}
              onChange={(e) => {
                const nextEventId = e.target.value;
                setDraft((d) => {
                  const previousCount = getDraftAttendeeCount(d);
                  const nextCount = nextEventId
                    ? (allEvents.find((ev) => ev.id === nextEventId)?.attendeeUserIds?.length ?? 0)
                    : d.splitAttendeeUserIds.length;
                  const nextDraft = { ...d, relatedEventId: nextEventId };
                  return rescaleDraftForPerPersonEven(nextDraft, nextCount, previousCount);
                });
              }}
              style={inputStyle}
            >
              <option value="">None</option>
              {allEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Link to Task
            <select
              value={draft.relatedTaskId}
              onChange={(e) => setDraft({ ...draft, relatedTaskId: e.target.value })}
              style={inputStyle}
            >
              <option value="">None</option>
              {allTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={labelStyle}>
          Notes
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </div>
    );
  }

  // ---- VIEW MODE ----
  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>
              {item.title}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={budgetStatusVariant(item.status)}>{formatBudgetLabel(item.status)}</Badge>
              <Badge variant="accent">{formatBudgetLabel(item.category)}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button onClick={() => setShowDeleteModal(true)} style={dangerOutlineBtnStyle}>Delete</button>
            )}
            <button onClick={handleEdit} style={editBtnStyle} title="Edit" aria-label="Edit">
              <HiPencilAlt size={14} />
            </button>
          </div>
        </div>

        <div
          style={{
            background: "var(--color-accent-soft)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-md)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PiMoneyBold size={14} />
              <span>Cost</span>
            </p>
            <div className="flex gap-2">
              <Badge variant="neutral">
                {(item.costMode ?? "total") === "per_person" ? "Per Person" : "Total"}
              </Badge>
              <Badge variant={(item.splitType ?? "even") === "even" ? "accent" : "warning"}>
                {(item.splitType ?? "even") === "even" ? "Even split" : "Custom split"}
              </Badge>
            </div>
          </div>

          {(item.splitType ?? "even") === "even" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Planned</p>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(item.plannedAmount)}</p>
                {attendees.length > 0 && (
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                    {formatCurrency(item.plannedAmount / attendees.length)}/person
                  </p>
                )}
              </div>
              <div>
                <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Actual</p>
                <p style={{ fontSize: 20, fontWeight: 700 }}>
                  {item.actualAmount > 0 ? formatCurrency(item.actualAmount) : "—"}
                </p>
                {item.actualAmount > 0 && attendees.length > 0 && (
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                    {formatCurrency(item.actualAmount / attendees.length)}/person
                  </p>
                )}
              </div>
            </div>
          ) : (
            attendees.length === 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Planned</p>
                  <p style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(item.plannedAmount)}</p>
                </div>
                <div>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Actual</p>
                  <p style={{ fontSize: 20, fontWeight: 700 }}>{item.actualAmount > 0 ? formatCurrency(item.actualAmount) : "—"}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "1fr 70px 70px", borderBottom: "1px solid var(--color-border)", paddingBottom: 6, marginBottom: 4 }}
                >
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)" }}>Person</span>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>Planned</span>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>Actual</span>
                </div>
                {attendees.map((u) => (
                  <div key={u.id} className="grid gap-3 items-center py-1" style={{ gridTemplateColumns: "1fr 70px 70px", borderBottom: "1px solid var(--color-border)" }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} color={u.avatarColor} size={22} />
                      <span style={{ fontSize: "var(--font-sm)" }}>{u.name}</span>
                    </div>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 500, textAlign: "right" }}>
                      {item.plannedSplits?.[u.id] ? formatCurrency(item.plannedSplits[u.id]) : "—"}
                    </span>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 500, textAlign: "right" }}>
                      {item.actualSplits?.[u.id] ? formatCurrency(item.actualSplits[u.id]) : "—"}
                    </span>
                  </div>
                ))}
                <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: "1fr 70px 70px" }}>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, textAlign: "right" }}>{formatCurrency(item.plannedAmount)}</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, textAlign: "right" }}>{item.actualAmount > 0 ? formatCurrency(item.actualAmount) : "—"}</span>
                </div>
              </div>
            )
          )}
        </div>

        {responsible && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Responsible</p>
            <div className="flex items-center gap-2">
              <Avatar name={responsible.name} color={responsible.avatarColor} size={28} />
              <span>{responsible.name}</span>
            </div>
          </div>
        )}

        {paidBy && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Paid By</p>
            <div className="flex items-center gap-2">
              <Avatar name={paidBy.name} color={paidBy.avatarColor} size={28} />
              <span>{paidBy.name}</span>
            </div>
          </div>
        )}

        {item.notes && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Notes</p>
            <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{item.notes}</p>
          </div>
        )}

        {(linkedEvent || linkedTask) && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Linked To</p>
            <div className="flex flex-wrap gap-2">
              {linkedEvent && (
                <button onClick={() => onNavigate("event", linkedEvent.id)} style={linkChipStyle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <BsCalendarDate size={14} />
                    <span>{linkedEvent.title}</span>
                  </span>
                </button>
              )}
              {linkedTask && (
                <button onClick={() => onNavigate("task", linkedTask.id)} style={linkChipStyle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IoIosCheckboxOutline size={15} />
                    <span>{linkedTask.title}</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Actions</p>
          <div className="flex gap-2">
            {!linkedTask && (
              <button onClick={onCreateTask} style={actionBtnStyle}>
                + Create Related Task
              </button>
            )}
            {linkedTask && (
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                Task already linked.
              </p>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div style={modalOverlayStyle} onClick={() => setShowDeleteModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 8 }}>Delete Budget Item</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", marginBottom: 16 }}>
              Choose whether to delete only this budget item or remove the full linked set.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  onDeleteOnly();
                }}
                style={modalOptionOutlineStyle}
              >
                Delete Budget Only
              </button>
              {linkedDeleteCount > 0 && (
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    onDeleteLinked();
                  }}
                  style={modalOptionDangerStyle}
                >
                  Delete Budget + {linkedDeleteCount} Linked Item{linkedDeleteCount === 1 ? "" : "s"}
                </button>
              )}
            </div>
            <div className="flex justify-end" style={{ marginTop: 16 }}>
              <button onClick={() => setShowDeleteModal(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  fontSize: "var(--font-md)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  display: "block",
};

const linkChipStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-accent-soft)",
  border: "1px solid var(--color-accent)",
  fontSize: "var(--font-sm)",
  cursor: "pointer",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const actionBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px dashed var(--color-accent)",
  background: "var(--color-bg-surface)",
  fontSize: "var(--font-sm)",
  cursor: "pointer",
  fontWeight: 500,
  color: "var(--color-accent)",
};

const editBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "var(--radius-md)",
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: "var(--font-sm)",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: "var(--font-sm)",
};

const dangerOutlineBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(220, 38, 38, 0.28)",
  background: "var(--color-bg-surface)",
  color: "var(--color-danger, #dc2626)",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17, 24, 39, 0.38)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "min(420px, 100%)",
  background: "var(--color-bg-surface)",
  borderRadius: "var(--radius-lg)",
  padding: 20,
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
};

const modalOptionDangerStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--color-danger, #dc2626)",
  color: "#fff",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOptionOutlineStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(220, 38, 38, 0.28)",
  background: "var(--color-bg-surface)",
  color: "var(--color-danger, #dc2626)",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
};
