"use client";

import { Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { Task, User } from "@/lib/data";
import type { TasksSummary } from "@/lib/data/types";

interface OpenTasksProps {
  tasks: Task[];
  summary: TasksSummary;
  users: User[];
  onTaskClick: (id: string) => void;
}

const PRIORITY_STYLES: Record<Task["priority"], { label: string; fill: string; ring: string }> = {
  HIGH: {
    label: "High",
    fill: "#f87171",
    ring: "#fca5a5",
  },
  MEDIUM: {
    label: "Medium",
    fill: "#f59e0b",
    ring: "#fde68a",
  },
  LOW: {
    label: "Low",
    fill: "var(--color-accent)",
    ring: "var(--color-accent-soft)",
  },
};

function formatDue(dueAt: string | null): { label: string; urgent: boolean; } {
  if (!dueAt) return { label: "No due date", urgent: false };
  const now = new Date();
  const due = new Date(dueAt);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true };
  if (diffDays === 0) return { label: "Due today", urgent: true };
  if (diffDays <= 2) return { label: `Due in ${diffDays} ${diffDays === 1 ? "day" : "days"}`, urgent: true };
  return { label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, urgent: false };
}

export function OpenTasks({ tasks, summary: _summary, users, onTaskClick }: OpenTasksProps) {
  const openTasks = [...tasks]
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => {
      const prioOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const priorityDiff = prioOrder[a.priority] - prioOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 600 }}>Open Tasks</h3>
      </div>

      {openTasks.length === 0 ? (
        <EmptyState message="All tasks completed!" />
      ) : (
        <div className="flex flex-col">
          {openTasks.slice(0, 6).map((task) => {
            const assignees = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
            const { label: dueLabel, urgent } = formatDue(task.dueAt);
            const priorityStyle = PRIORITY_STYLES[task.priority];

            return (
              <button
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className="flex items-center gap-3 w-full text-left py-3"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--color-border)",
                  cursor: "pointer",
                }}
              >
                <span
                  title={`${priorityStyle.label} priority`}
                  aria-label={`${priorityStyle.label} priority`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: priorityStyle.fill,
                    boxShadow: `0 0 0 2px ${priorityStyle.ring}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1">
                  <p style={{ fontWeight: 500 }}>{task.title}</p>
                  <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                    {assignees.length > 0 ? (
                      <span className="flex items-center gap-1">
                        {assignees.map((a) => (
                          <Avatar key={a.id} name={a.name} color={a.avatarColor} size={18} />
                        ))}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "var(--font-xs, 11px)",
                          fontWeight: 500,
                          color: "var(--color-danger, #d97706)",
                          background: "var(--color-warning-soft, #fef3c7)",
                          padding: "2px 7px",
                          borderRadius: "var(--radius-pill)",
                          border: "1px dashed var(--color-warning, #d97706)",
                        }}
                      >
                        ⚠️ Unassigned
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: "var(--font-sm)", color: urgent ? "#b91c1c" : "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {dueLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
