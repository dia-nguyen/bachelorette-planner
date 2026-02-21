"use client";

import { Badge, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { Task, User } from "@/lib/data";
import type { TasksSummary } from "@/lib/data/types";

interface OpenTasksProps {
  tasks: Task[];
  summary: TasksSummary;
  users: User[];
  onTaskClick: (id: string) => void;
}

function formatDue(dueAt: string | null): { label: string; urgent: boolean; } {
  if (!dueAt) return { label: "No due date", urgent: false };
  const now = new Date();
  const due = new Date(dueAt);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true };
  if (diffDays <= 2) return { label: `Due in ${diffDays} days`, urgent: true };
  return { label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, urgent: false };
}

export function OpenTasks({ tasks, summary, users, onTaskClick }: OpenTasksProps) {
  const openTasks = [...tasks]
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => {
      const prioOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 600 }}>Open Tasks</h3>
        <div className="flex gap-3" style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
          <span>Urgent {summary.urgent}</span>
          <span>In Progress {summary.inProgress}</span>
          <span>Done {summary.done}</span>
        </div>
      </div>

      {openTasks.length === 0 ? (
        <EmptyState message="All tasks completed!" />
      ) : (
        <div className="flex flex-col">
          {openTasks.slice(0, 6).map((task) => {
            const assignees = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
            const { label: dueLabel, urgent } = formatDue(task.dueAt);

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
                {/* Checkbox placeholder */}
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: "2px solid var(--color-border)",
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
                <Badge variant={urgent ? "negative" : "neutral"}>{dueLabel}</Badge>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
