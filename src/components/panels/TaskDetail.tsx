"use client";

import { Badge, taskStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { BudgetItem, Task, TaskPriority, TaskStatus, TripEvent, User } from "@/lib/data";
import { useState } from "react";

interface TaskDetailProps {
  task: Task;
  assignees: User[];
  linkedEvent?: TripEvent;
  linkedBudget?: BudgetItem;
  allUsers: User[];
  allEvents: TripEvent[];
  allBudgetItems: BudgetItem[];
  onUpdate: (patch: Partial<Task>) => void;
  onNavigate: (type: "event" | "budget", id: string) => void;
  canDelete: boolean;
  linkedDeleteCount: number;
  onDeleteOnly: () => void;
  onDeleteLinked: () => void;
}

const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

export function TaskDetail({
  task,
  assignees,
  linkedEvent,
  linkedBudget,
  allUsers,
  allEvents,
  allBudgetItems,
  onUpdate,
  onNavigate,
  canDelete,
  linkedDeleteCount,
  onDeleteOnly,
  onDeleteLinked,
}: TaskDetailProps) {
  function toDraft(t: Task) {
    return {
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt ? t.dueAt.slice(0, 10) : "",
      assigneeUserIds: [...(t.assigneeUserIds ?? [])],
      relatedEventId: t.relatedEventId ?? "",
      relatedBudgetItemId: t.relatedBudgetItemId ?? "",
    };
  }

  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(task));

  const handleEdit = () => {
    setDraft(toDraft(task));
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = () => {
    onUpdate({
      title: draft.title.trim() || task.title,
      description: draft.description.trim(),
      status: draft.status,
      priority: draft.priority,
      dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
      assigneeUserIds: draft.assigneeUserIds,
      relatedEventId: draft.relatedEventId || null,
      relatedBudgetItemId: draft.relatedBudgetItemId || null,
    });
    setEditing(false);
  };

  const dueDate = task.dueAt
    ? new Date(task.dueAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    : "No due date";

  // ---- EDIT MODE ----
  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 style={{ fontWeight: 700, fontSize: "var(--font-lg)" }}>Edit Task</h3>
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
            Status
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}
              style={inputStyle}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Priority
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
              style={inputStyle}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label style={labelStyle}>
            Due Date
            <input
              type="date"
              value={draft.dueAt}
              onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
              style={inputStyle}
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <p style={{ ...labelStyle, marginBottom: 6 }}>Assignees</p>
            <div className="flex flex-wrap gap-2">
              {allUsers.map((u) => {
                const selected = draft.assigneeUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setDraft((d) => ({
                      ...d,
                      assigneeUserIds: selected
                        ? d.assigneeUserIds.filter((id) => id !== u.id)
                        : [...d.assigneeUserIds, u.id],
                    }))}
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
        </div>

        <label style={labelStyle}>
          Description
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label style={labelStyle}>
            Link to Event
            <select
              value={draft.relatedEventId}
              onChange={(e) => setDraft({ ...draft, relatedEventId: e.target.value })}
              style={inputStyle}
            >
              <option value="">None</option>
              {allEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Link to Budget Item
            <select
              value={draft.relatedBudgetItemId}
              onChange={(e) => setDraft({ ...draft, relatedBudgetItemId: e.target.value })}
              style={inputStyle}
            >
              <option value="">None</option>
              {allBudgetItems.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>
        </div>
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
              {task.title}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={taskStatusVariant(task.status)}>{task.status.replace("_", " ")}</Badge>
              <Badge variant={task.priority === "HIGH" ? "negative" : task.priority === "MEDIUM" ? "warning" : "neutral"}>
                {task.priority}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button onClick={() => setShowDeleteModal(true)} style={dangerOutlineBtnStyle}>Delete</button>
            )}
            <button onClick={handleEdit} style={editBtnStyle}>✏️ Edit</button>
          </div>
        </div>

        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Due Date</p>
          <p style={{ color: "var(--color-text-secondary)" }}>{dueDate}</p>
        </div>

        {assignees.length > 0 && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Assignees</p>
            <div className="flex flex-wrap gap-3">
              {assignees.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Avatar name={a.name} color={a.avatarColor} size={28} />
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Description</p>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.5, whiteSpace: "pre-line", wordBreak: "break-word" }}>
            {task.description || "No description."}
          </p>
        </div>

        {(linkedEvent || linkedBudget) && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Linked To</p>
            <div className="flex flex-wrap gap-2">
              {linkedEvent && (
                <button onClick={() => onNavigate("event", linkedEvent.id)} style={linkChipStyle}>
                  📅 {linkedEvent.title}
                </button>
              )}
              {linkedBudget && (
                <button onClick={() => onNavigate("budget", linkedBudget.id)} style={linkChipStyle}>
                  💰 {linkedBudget.title}
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Update Status</p>
          <div className="flex gap-2">
            {TASK_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ status: s })}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)",
                  border: task.status === s ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
                  background: task.status === s ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
                  fontSize: "var(--font-sm)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div style={modalOverlayStyle} onClick={() => setShowDeleteModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 8 }}>Delete Task</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", marginBottom: 16 }}>
              Choose whether to delete only this task or remove the full linked set.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  onDeleteOnly();
                }}
                style={modalOptionOutlineStyle}
              >
                Delete Task Only
              </button>
              {linkedDeleteCount > 0 && (
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    onDeleteLinked();
                  }}
                  style={modalOptionDangerStyle}
                >
                  Delete Task + {linkedDeleteCount} Linked Item{linkedDeleteCount === 1 ? "" : "s"}
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

const editBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  fontSize: "var(--font-sm)",
  fontWeight: 500,
  cursor: "pointer",
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
