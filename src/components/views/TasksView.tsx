"use client";

import { Badge, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { Task } from "@/lib/data";
import { useMemo, useRef, useState } from "react";

// ---- Constants ----

const COLUMN_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const COLUMN_ACCENT: Record<string, string> = {
  TODO: "var(--color-text-secondary)",
  IN_PROGRESS: "var(--color-accent)",
  DONE: "#16a34a",
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

type ViewMode = "kanban" | "list" | "mine";

// ---- Sub-components ----

function TaskCard({
  task,
  users,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: Task;
  users: ReturnType<typeof useApp>["users"];
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const assigneeUsers = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
  const hasLinks = task.relatedEventId || task.relatedBudgetItemId;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab", transition: "opacity 0.15s" }}
    >
      <Card hoverable onClick={() => !isDragging && onClick()}>
        <div className="flex items-start justify-between mb-1">
          <span style={{ fontWeight: 500, fontSize: "var(--font-md)" }}>{task.title}</span>
          <Badge
            variant={
              task.priority === "HIGH" ? "negative" : task.priority === "MEDIUM" ? "warning" : "neutral"
            }
          >
            {task.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {assigneeUsers.length > 0 ? (
            <>
              {assigneeUsers.map((u) => (
                <Avatar key={u.id} name={u.name} color={u.avatarColor} size={18} />
              ))}
              <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                {assigneeUsers.length >= 2 ? `${assigneeUsers.length} assigned` : assigneeUsers[0].name}
              </span>
            </>
          ) : (
            <span
              style={{
                fontSize: "var(--font-xs, 11px)",
                fontWeight: 500,
                color: "#d97706",
                background: "#fef3c7",
                padding: "2px 7px",
                borderRadius: "var(--radius-pill)",
                border: "1px dashed #d97706",
              }}
            >
              ⚠️ Unassigned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {task.dueAt && (
            <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
              Due {new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {hasLinks && (
            <span
              style={{
                fontSize: 11,
                color: "var(--color-accent)",
                background: "var(--color-accent-soft)",
                padding: "1px 6px",
                borderRadius: "var(--radius-pill)",
              }}
            >
              {[task.relatedEventId && "Event", task.relatedBudgetItemId && "Budget"].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---- Main component ----

export function TasksView() {
  const { tasks, users, currentUserId, updateTask, openPanel } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Drag state (kanban only)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const dragTask = useRef<Task | null>(null);

  // Filtered tasks
  const filtered = useMemo(() => {
    let result = tasks;
    if (viewMode === "mine") {
      result = result.filter((t) => (t.assigneeUserIds ?? []).includes(currentUserId));
    }
    if (filterAssignee !== "all") {
      result = result.filter((t) => (t.assigneeUserIds ?? []).includes(filterAssignee));
    }
    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority);
    }
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus);
    }
    return result;
  }, [tasks, viewMode, filterAssignee, filterPriority, filterStatus, currentUserId]);

  const grouped = {
    TODO: filtered.filter((t) => t.status === "TODO"),
    IN_PROGRESS: filtered.filter((t) => t.status === "IN_PROGRESS"),
    DONE: filtered.filter((t) => t.status === "DONE"),
  };

  // DnD handlers
  function handleDragStart(e: React.DragEvent, task: Task) {
    dragTask.current = task;
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
    dragTask.current = null;
  }
  function handleDragOver(e: React.DragEvent, col: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverColumn(col);
  }
  function handleDrop(e: React.DragEvent, col: string) {
    e.preventDefault();
    if (dragTask.current && dragTask.current.status !== col) {
      updateTask(dragTask.current.id, { status: col as Task["status"] });
    }
    setDraggingId(null);
    setOverColumn(null);
    dragTask.current = null;
  }

  const activeFilters = [filterAssignee, filterPriority, filterStatus].filter((v) => v !== "all").length;
  const currentUser = users.find((u) => u.id === currentUserId);

  // ---- Toolbar ----
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {/* View toggle */}
      <div
        className="flex items-center"
        style={{
          background: "var(--color-bg-muted)",
          borderRadius: "var(--radius-md)",
          padding: 3,
          gap: 2,
        }}
      >
        {([["kanban", "Kanban"], ["list", "List"], ["mine", "My Tasks"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "4px 12px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--font-sm)",
              fontWeight: viewMode === mode ? 600 : 400,
              background: viewMode === mode ? "var(--color-bg-surface)" : "transparent",
              color: viewMode === mode ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              boxShadow: viewMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            {mode === "mine" && currentUser ? `${currentUser.name.split(" ")[0]}'s Tasks` : label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Filters */}
      <select
        value={filterAssignee}
        onChange={(e) => setFilterAssignee(e.target.value)}
        style={{
          fontSize: "var(--font-sm)",
          padding: "5px 10px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${filterAssignee !== "all" ? "var(--color-accent)" : "var(--color-border)"}`,
          background: filterAssignee !== "all" ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
        }}
      >
        <option value="all">All Assignees</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>

      <select
        value={filterPriority}
        onChange={(e) => setFilterPriority(e.target.value)}
        style={{
          fontSize: "var(--font-sm)",
          padding: "5px 10px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${filterPriority !== "all" ? "var(--color-accent)" : "var(--color-border)"}`,
          background: filterPriority !== "all" ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
        }}
      >
        <option value="all">All Priorities</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>

      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        style={{
          fontSize: "var(--font-sm)",
          padding: "5px 10px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${filterStatus !== "all" ? "var(--color-accent)" : "var(--color-border)"}`,
          background: filterStatus !== "all" ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
        }}
      >
        <option value="all">All Statuses</option>
        <option value="TODO">To Do</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="DONE">Done</option>
      </select>

      {activeFilters > 0 && (
        <button
          onClick={() => { setFilterAssignee("all"); setFilterPriority("all"); setFilterStatus("all"); }}
          style={{
            fontSize: "var(--font-sm)",
            padding: "5px 10px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
          }}
        >
          Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );

  // ---- Kanban view ----
  const kanbanView = (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      style={{
        alignItems: "stretch",
        minHeight: "calc(100dvh - 260px)",
      }}
    >
      {(["TODO", "IN_PROGRESS", "DONE"] as const).map((statusKey) => {
        const isOver = overColumn === statusKey;
        return (
          <div
            key={statusKey}
            onDragOver={(e) => handleDragOver(e, statusKey)}
            onDragLeave={() => setOverColumn(null)}
            onDrop={(e) => handleDrop(e, statusKey)}
            style={{
              borderRadius: "var(--radius-md)",
              padding: 8,
              transition: "background 0.15s",
              background: isOver ? "var(--color-accent-soft)" : "transparent",
              outline: isOver ? "2px dashed var(--color-accent)" : "2px dashed transparent",
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLUMN_ACCENT[statusKey], flexShrink: 0 }} />
              <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600 }}>{COLUMN_LABELS[statusKey]}</h3>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", background: "var(--color-bg-muted)", padding: "1px 8px", borderRadius: "var(--radius-pill)" }}>
                {grouped[statusKey].length}
              </span>
            </div>
            <div className="flex flex-col gap-2" style={{ flex: 1 }}>
              {grouped[statusKey].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  isDragging={draggingId === task.id}
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  onClick={() => openPanel("task", task.id)}
                />
              ))}
              {grouped[statusKey].length === 0 && (
                <div style={{ height: 64, borderRadius: "var(--radius-md)", border: "2px dashed var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)", fontSize: "var(--font-sm)" }}>
                  Drop here
                </div>
              )}
              {grouped[statusKey].length > 0 && (
                <div
                  aria-hidden
                  style={{ flex: 1, borderRadius: "var(--radius-md)" }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ---- List view ----
  const sortedList = [...filtered].sort((a, b) => {
    const statusOrder = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  const listView = (
    <Card>
      <div
        className="grid"
        style={{
          gridTemplateColumns: "1fr 100px 90px 100px 120px",
          gap: "0 12px",
          fontSize: "var(--font-xs)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--color-text-tertiary)",
          paddingBottom: 8,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span>Task</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Assignees</span>
        <span>Due</span>
      </div>
      {sortedList.length === 0 ? (
        <EmptyState message="No tasks match filters" />
      ) : (
        sortedList.map((task) => {
          const assigneeUsers = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
          return (
            <div
              key={task.id}
              className="grid"
              onClick={() => openPanel("task", task.id)}
              style={{
                gridTemplateColumns: "1fr 100px 90px 100px 120px",
                gap: "0 12px",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontWeight: 500, fontSize: "var(--font-sm)" }}>{task.title}</span>
              <span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    background:
                      task.status === "DONE" ? "#dcfce7" :
                        task.status === "IN_PROGRESS" ? "var(--color-accent-soft)" : "var(--color-bg-muted)",
                    color:
                      task.status === "DONE" ? "#16a34a" :
                        task.status === "IN_PROGRESS" ? "var(--color-accent)" : "var(--color-text-secondary)",
                  }}
                >
                  {COLUMN_LABELS[task.status]}
                </span>
              </span>
              <span>
                <Badge variant={task.priority === "HIGH" ? "negative" : task.priority === "MEDIUM" ? "warning" : "neutral"}>
                  {task.priority}
                </Badge>
              </span>
              <span className="flex items-center gap-1">
                {assigneeUsers.length > 0 ? (
                  assigneeUsers.slice(0, 3).map((u) => (
                    <Avatar key={u.id} name={u.name} color={u.avatarColor} size={20} />
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "#d97706" }}>Unassigned</span>
                )}
              </span>
              <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                {task.dueAt
                  ? new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "—"}
              </span>
            </div>
          );
        })
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      {tasks.length === 0 ? (
        <EmptyState message="No tasks yet" actionLabel="Plan something with the + button above" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No tasks match the current filters" />
      ) : viewMode === "list" ? (
        listView
      ) : (
        // kanban for both "kanban" and "mine"
        kanbanView
      )}
    </div>
  );
}
