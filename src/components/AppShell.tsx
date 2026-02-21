"use client";

import { ContextPanel, HeaderBar, Sidebar } from "@/components/layout";
import { BudgetDetail } from "@/components/panels/BudgetDetail";
import { EventDetail } from "@/components/panels/EventDetail";
import { TaskDetail } from "@/components/panels/TaskDetail";
import { Badge, eventStatusVariant } from "@/components/ui";
import { BudgetView, DashboardView, EventsView, GuestsView, SettingsView, TasksView } from "@/components/views";
import { PlanActivityForm } from "@/components/views/PlanActivityForm";
import { useApp } from "@/lib/context";
import { useState } from "react";

export function AppShell() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showPlanForm, setShowPlanForm] = useState(false);
  const app = useApp();

  const tripName = app.trip?.name ?? "Trip Planner";

  const TAB_TITLES: Record<string, string> = {
    dashboard: tripName,
    events: "Events",
    guests: "Guests",
    budget: "Budget",
    tasks: "Tasks",
    settings: "Settings",
  };

  const handleAddItem = () => {
    setShowPlanForm(true);
  };

  // ---- Render panel content ----
  function renderPanelContent() {
    const {
      panel, events, tasks, budgetItems, users,
      updateTask, updateEvent, openPanel, createTaskForBudgetItem,
    } = app;

    const navigateTo = (type: "event" | "task" | "budget", id: string) => {
      openPanel(type, id);
    };

    if (panel.type === "event" && panel.id) {
      const event = events.find((e) => e.id === panel.id);
      if (!event) return <p>Event not found</p>;
      const budgetItem = budgetItems.find((b) => b.relatedEventId === event.id);
      const relatedTasks = tasks.filter((t) => t.relatedEventId === event.id);

      const handleToggleAttendee = (userId: string) => {
        const current = event.attendeeUserIds || [];
        const updated = current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId];
        updateEvent(event.id, { attendeeUserIds: updated });
      };

      return (
        <EventDetail
          event={event}
          budgetItem={budgetItem}
          relatedTasks={relatedTasks}
          allUsers={users}
          onNavigate={navigateTo}
          onToggleAttendee={handleToggleAttendee}
          onUpdate={(patch) => updateEvent(event.id, patch)}
        />
      );
    }

    if (panel.type === "task" && panel.id) {
      const task = tasks.find((t) => t.id === panel.id);
      if (!task) return <p>Task not found</p>;
      const assignees = users.filter((u) => (task.assigneeUserIds ?? []).includes(u.id));
      const linkedEvent = task.relatedEventId ? events.find((e) => e.id === task.relatedEventId) : undefined;
      const linkedBudget = task.relatedBudgetItemId ? budgetItems.find((b) => b.id === task.relatedBudgetItemId) : undefined;
      return (
        <TaskDetail
          task={task}
          assignees={assignees}
          linkedEvent={linkedEvent}
          linkedBudget={linkedBudget}
          allUsers={users}
          allEvents={events}
          allBudgetItems={budgetItems}
          onUpdate={(patch) => updateTask(task.id, patch)}
          onNavigate={navigateTo}
        />
      );
    }

    if (panel.type === "budget" && panel.id) {
      const item = budgetItems.find((b) => b.id === panel.id);
      if (!item) return <p>Budget item not found</p>;
      const responsible = users.find((u) => u.id === item.responsibleUserId);
      const paidBy = users.find((u) => u.id === item.paidByUserId);
      const linkedEvent = item.relatedEventId ? events.find((e) => e.id === item.relatedEventId) : undefined;
      const linkedTask = item.relatedTaskId ? tasks.find((t) => t.id === item.relatedTaskId) : undefined;
      const linkedEventAttendees = linkedEvent
        ? users.filter((u) => (linkedEvent.attendeeUserIds ?? []).includes(u.id))
        : users.filter((u) => (item.splitAttendeeUserIds ?? []).includes(u.id));
      return (
        <BudgetDetail
          item={item}
          responsible={responsible}
          paidBy={paidBy}
          linkedEvent={linkedEvent}
          linkedTask={linkedTask}
          allUsers={users}
          allEvents={events}
          allTasks={tasks}
          linkedEventAttendees={linkedEventAttendees}
          onNavigate={navigateTo}
          onCreateTask={() => createTaskForBudgetItem(item.id)}
          onUpdate={(patch) => app.updateBudgetItem(item.id, patch)}
        />
      );
    }

    return null;
  }

  function panelTitle(): string {
    const { panel } = app;
    if (panel.type === "event") return "Event";
    if (panel.type === "task") return "Task";
    if (panel.type === "budget") return "Budget Item";
    return "";
  }

  function panelBadge() {
    const { panel } = app;
    if (panel.type === "event") {
      const ev = app.events.find((e) => e.id === panel.id);
      if (ev) {
        return <Badge variant={eventStatusVariant(ev.status)}>E</Badge>;
      }
    }
    return null;
  }

  return (
    <div className="flex h-screen" style={{ background: "var(--color-accent-soft)" }}>
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <HeaderBar
          title={TAB_TITLES[activeTab] ?? "Dashboard"}
          onAddItem={handleAddItem}
          onClearAll={app.clearAllData}
          onRestoreDemo={app.resetDemoData}
          onExportJSON={app.exportData}
          onImportJSON={app.importData}
        />

        <main
          className="flex-1 overflow-y-auto p-3 md:p-6"
          style={{ background: "var(--color-bg-surface)" }}
        >
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "events" && <EventsView />}
          {activeTab === "guests" && <GuestsView />}
          {activeTab === "budget" && <BudgetView />}
          {activeTab === "tasks" && <TasksView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Context panel */}
      <ContextPanel
        isOpen={app.panel.type !== null}
        onClose={app.closePanel}
        title={panelTitle()}
        badge={panelBadge()}
      >
        {renderPanelContent()}
      </ContextPanel>

      {/* Plan Activity modal */}
      {showPlanForm && (
        <div
          onClick={() => setShowPlanForm(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, 90vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <PlanActivityForm onClose={() => setShowPlanForm(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
