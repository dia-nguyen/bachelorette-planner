"use client";

import { Badge, Card, EmptyState, MultiSelectFilter } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { Task } from "@/lib/data";
import { useEffect, useMemo, useRef, useState } from "react";

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

const listCellSt: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "var(--font-sm)",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--color-border)",
};

const listHeadCellSt: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg-muted)",
  borderBottom: "2px solid var(--color-border)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const listHeadSortButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "inherit",
  textTransform: "inherit",
  letterSpacing: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

function renderListSortArrow(
  field: ListSortField,
  activeField: ListSortField,
  direction: "asc" | "desc",
): string {
  if (field !== activeField) return "";
  return direction === "asc" ? " ▲" : " ▼";
}

type ViewMode = "kanban" | "list" | "mine";
type ListSortField = "task" | "status" | "priority" | "assignees" | "due" | "complete";
const TASKS_VIEW_MODE_KEY = "bp-tasks-view-mode";

function getTaskCompletionPercent(task: Task): number {
  const subtasks = task.subtasks ?? [];
  if (subtasks.length === 0) return task.status === "DONE" ? 100 : 0;
  const done = subtasks.filter((s) => s.isDone).length;
  return Math.round((done / subtasks.length) * 100);
}

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
  const hasSubtasks = (task.subtasks?.length ?? 0) > 0;
  const completionPercent = getTaskCompletionPercent(task);

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
          {hasSubtasks && (
            <span
              style={{
                fontSize: 11,
                color: "var(--color-accent)",
                background: "var(--color-accent-soft)",
                padding: "1px 6px",
                borderRadius: "var(--radius-pill)",
              }}
            >
              {completionPercent}%
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

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    const saved = window.localStorage.getItem(TASKS_VIEW_MODE_KEY);
    if (saved === "kanban" || saved === "list" || saved === "mine") return saved;
    return "kanban";
  });
  const assigneeValues = useMemo(() => users.map((u) => u.id), [users]);
  const priorityValues = useMemo(() => ["HIGH", "MEDIUM", "LOW"], []);
  const statusValues = useMemo(() => ["TODO", "IN_PROGRESS", "DONE"], []);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(priorityValues);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(statusValues);
  const [listSortField, setListSortField] = useState<ListSortField>("status");
  const [listSortDirection, setListSortDirection] = useState<"asc" | "desc">("asc");

  // Drag state (kanban only)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const dragTask = useRef<Task | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TASKS_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    setSelectedAssignees((prev) => {
      if (assigneeValues.length === 0) return [];
      if (prev.length === 0) return assigneeValues;
      const next = prev.filter((id) => assigneeValues.includes(id));
      return next.length === 0 ? assigneeValues : next;
    });
  }, [assigneeValues]);

  // Filtered tasks
  const filtered = useMemo(() => {
    let result = tasks;
    if (viewMode === "mine") {
      result = result.filter((t) => (t.assigneeUserIds ?? []).includes(currentUserId));
    }
    if (selectedAssignees.length < assigneeValues.length) {
      result = result.filter((t) => (t.assigneeUserIds ?? []).some((id) => selectedAssignees.includes(id)));
    }
    if (selectedPriorities.length < priorityValues.length) {
      result = result.filter((t) => selectedPriorities.includes(t.priority));
    }
    if (selectedStatuses.length < statusValues.length) {
      result = result.filter((t) => selectedStatuses.includes(t.status));
    }
    return result;
  }, [
    tasks,
    viewMode,
    selectedAssignees,
    selectedPriorities,
    selectedStatuses,
    assigneeValues.length,
    priorityValues.length,
    statusValues.length,
    currentUserId,
  ]);

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

  const activeFilters = [
    selectedAssignees.length < assigneeValues.length,
    selectedPriorities.length < priorityValues.length,
    selectedStatuses.length < statusValues.length,
  ].filter(Boolean).length;
  const currentUser = users.find((u) => u.id === currentUserId);
  const toggleListSort = (field: ListSortField) => {
    if (listSortField === field) {
      setListSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setListSortField(field);
    setListSortDirection(field === "due" || field === "complete" ? "desc" : "asc");
  };

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
      <MultiSelectFilter
        options={users.map((u) => ({ value: u.id, label: u.name }))}
        selectedValues={selectedAssignees}
        onChange={setSelectedAssignees}
        allLabel="All Assignees"
        countLabelPlural="Assignees"
        countLabelSingular="Assignee"
      />

      <MultiSelectFilter
        options={[
          { value: "HIGH", label: "High" },
          { value: "MEDIUM", label: "Medium" },
          { value: "LOW", label: "Low" },
        ]}
        selectedValues={selectedPriorities}
        onChange={setSelectedPriorities}
        allLabel="All Priorities"
        countLabelPlural="Priorities"
        countLabelSingular="Priority"
        minWidth={170}
      />

      <MultiSelectFilter
        options={[
          { value: "TODO", label: "To Do" },
          { value: "IN_PROGRESS", label: "In Progress" },
          { value: "DONE", label: "Done" },
        ]}
        selectedValues={selectedStatuses}
        onChange={setSelectedStatuses}
        allLabel="All Statuses"
        countLabelPlural="Statuses"
        countLabelSingular="Status"
        minWidth={160}
      />

      {activeFilters > 0 && (
        <button
          onClick={() => {
            setSelectedAssignees(assigneeValues);
            setSelectedPriorities(priorityValues);
            setSelectedStatuses(statusValues);
          }}
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
  const sortedList = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const dir = listSortDirection === "asc" ? 1 : -1;
      if (listSortField === "task") return a.title.localeCompare(b.title) * dir;
      if (listSortField === "status") {
        const statusOrder = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
        return (statusOrder[a.status] - statusOrder[b.status]) * dir;
      }
      if (listSortField === "priority") return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
      if (listSortField === "assignees") return ((a.assigneeUserIds?.length ?? 0) - (b.assigneeUserIds?.length ?? 0)) * dir;
      if (listSortField === "due") {
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.NEGATIVE_INFINITY;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.NEGATIVE_INFINITY;
        return (aDue - bDue) * dir;
      }
      const aCompletion = (a.subtasks?.length ?? 0) > 0 ? getTaskCompletionPercent(a) : -1;
      const bCompletion = (b.subtasks?.length ?? 0) > 0 ? getTaskCompletionPercent(b) : -1;
      return (aCompletion - bCompletion) * dir;
    });
    return list;
  }, [filtered, listSortField, listSortDirection]);

  const listView = (
    <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
      <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", background: "var(--color-bg-surface)" }}>
        <thead>
          <tr>
            <th style={listHeadCellSt}>
              <button type="button" onClick={() => toggleListSort("task")} style={listHeadSortButtonStyle}>
                Task{renderListSortArrow("task", listSortField, listSortDirection)}
              </button>
            </th>
            <th style={listHeadCellSt}>
              <button type="button" onClick={() => toggleListSort("status")} style={listHeadSortButtonStyle}>
                Status{renderListSortArrow("status", listSortField, listSortDirection)}
              </button>
            </th>
            <th style={listHeadCellSt}>
              <button type="button" onClick={() => toggleListSort("priority")} style={listHeadSortButtonStyle}>
                Priority{renderListSortArrow("priority", listSortField, listSortDirection)}
              </button>
            </th>
            <th style={listHeadCellSt}>
              <button type="button" onClick={() => toggleListSort("assignees")} style={listHeadSortButtonStyle}>
                Assignees{renderListSortArrow("assignees", listSortField, listSortDirection)}
              </button>
            </th>
            <th style={listHeadCellSt}>
              <button type="button" onClick={() => toggleListSort("due")} style={listHeadSortButtonStyle}>
                Due{renderListSortArrow("due", listSortField, listSortDirection)}
              </button>
            </th>
            <th style={listHeadCellSt}>
              <button type="button" onClick={() => toggleListSort("complete")} style={listHeadSortButtonStyle}>
                Complete{renderListSortArrow("complete", listSortField, listSortDirection)}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedList.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 0 }}>
                <EmptyState message="No tasks match filters" />
              </td>
            </tr>
          ) : (
            sortedList.map((task) => {
              const assigneeUsers = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
              return (
                <tr
                  key={task.id}
                  onClick={() => openPanel("task", task.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPanel("task", task.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  style={{ cursor: "pointer" }}
                >
                  <td style={listCellSt}>
                    <span style={{ fontWeight: 500, fontSize: "var(--font-sm)" }}>{task.title}</span>
                  </td>
                  <td style={listCellSt}>
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
                  </td>
                  <td style={listCellSt}>
                    <Badge variant={task.priority === "HIGH" ? "negative" : task.priority === "MEDIUM" ? "warning" : "neutral"}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td style={listCellSt}>
                    <span className="flex items-center gap-1">
                      {assigneeUsers.length > 0 ? (
                        assigneeUsers.slice(0, 3).map((u) => (
                          <Avatar key={u.id} name={u.name} color={u.avatarColor} size={20} />
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: "#d97706" }}>Unassigned</span>
                      )}
                    </span>
                  </td>
                  <td style={{ ...listCellSt, color: "var(--color-text-secondary)" }}>
                    {task.dueAt
                      ? new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td style={{ ...listCellSt, color: "var(--color-text-secondary)" }}>
                    {(task.subtasks?.length ?? 0) > 0 ? `${getTaskCompletionPercent(task)}%` : ""}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
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
