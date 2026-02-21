"use client";

import { Badge, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";

export function TasksView() {
  const { tasks, users, openPanel } = useApp();

  const grouped = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    DONE: tasks.filter((t) => t.status === "DONE"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Tasks</h2>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          message="No tasks yet"
          actionLabel="Plan something with the + button above"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["TODO", "IN_PROGRESS", "DONE"] as const).map((statusKey) => (
            <div key={statusKey}>
              <div className="flex items-center gap-2 mb-3">
                <h3 style={{ fontSize: "var(--font-md)", fontWeight: 600 }}>
                  {statusKey.replace("_", " ")}
                </h3>
                <span
                  style={{
                    fontSize: "var(--font-sm)",
                    color: "var(--color-text-secondary)",
                    background: "var(--color-bg-muted)",
                    padding: "1px 8px",
                    borderRadius: "var(--radius-pill)",
                  }}
                >
                  {grouped[statusKey].length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {grouped[statusKey].map((task) => {
                  const assigneeUsers = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
                  const hasLinks = task.relatedEventId || task.relatedBudgetItemId;
                  return (
                    <Card key={task.id} hoverable onClick={() => openPanel("task", task.id)}>
                      <div className="flex items-start justify-between mb-1">
                        <span style={{ fontWeight: 500, fontSize: "var(--font-md)" }}>
                          {task.title}
                        </span>
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
                            {assigneeUsers.length >= 2 ? (
                              <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                                {assigneeUsers.length} assigned
                              </span>
                            ) : <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                              {assigneeUsers[0].name}
                            </span>}
                          </>
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
                      <div className="flex items-center gap-2 mt-2">
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
                            title={[
                              task.relatedEventId ? "Linked to event" : "",
                              task.relatedBudgetItemId ? "Linked to budget" : "",
                            ].filter(Boolean).join(", ")}
                          >
                            {[task.relatedEventId && "Event", task.relatedBudgetItemId && "Budget"].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
