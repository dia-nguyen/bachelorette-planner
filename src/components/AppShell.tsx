"use client";

import { ContextPanel, HeaderBar, Sidebar } from "@/components/layout";
import { BudgetDetail } from "@/components/panels/BudgetDetail";
import { EventDetail } from "@/components/panels/EventDetail";
import { TaskDetail } from "@/components/panels/TaskDetail";
import { Badge, eventStatusVariant } from "@/components/ui";
import { BudgetView, DashboardView, EventsView, GuestsView, ItineraryView, MoodboardView, PollsView, SettingsView, TasksView } from "@/components/views";
import { PlanActivityForm } from "@/components/views/PlanActivityForm";
import { useApp } from "@/lib/context";
import { useAuth } from "@/lib/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { HiOutlinePlus } from "react-icons/hi";

function CreateTripModal({ onClose }: { onClose: () => void; }) {
  const { createTrip } = useApp();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startAt || !endAt) return;
    setSaving(true);
    setError(null);
    try {
      await createTrip({ name: name.trim(), location: location.trim(), startAt, endAt });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip.");
    } finally {
      setSaving(false);
    }
  };

  const inputSt: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "8px 12px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    fontSize: "var(--font-sm)",
    background: "var(--color-bg-surface)",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 90vw)",
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-lg)",
          padding: "28px 32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>New Trip</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-text-secondary)", lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
            Trip name *
            <input style={inputSt} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emma's Bachelorette" required autoFocus />
          </label>
          <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
            Location
            <input style={inputSt} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nashville, TN" />
          </label>
          <div className="flex gap-3">
            <label style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>
              Start date *
              <input type="date" style={inputSt} value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </label>
            <label style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>
              End date *
              <input type="date" style={inputSt} value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            </label>
          </div>
          {error && <p style={{ color: "#dc2626", fontSize: "var(--font-sm)" }}>{error}</p>}
          <div className="flex gap-2 justify-end" style={{ marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", cursor: "pointer", fontSize: "var(--font-sm)" }}>Cancel</button>
            <button type="submit" disabled={saving || !name.trim() || !startAt || !endAt} style={{ padding: "8px 22px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: (saving || !name.trim()) ? "not-allowed" : "pointer", fontSize: "var(--font-sm)", opacity: (saving || !name.trim()) ? 0.6 : 1 }}>
              {saving ? "Creating..." : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: "60vh", padding: "24px" }}>
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "18px",
          padding: "28px 32px",
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,245,255,0.98) 100%)",
          boxShadow: "var(--shadow-2)",
          border: "1px solid rgba(167, 139, 250, 0.18)",
        }}
      >
        <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
          <div
            aria-hidden="true"
            style={{
              position: "relative",
              width: 88,
              height: 88,
              display: "grid",
              placeItems: "center",
            }}
          >
            <div className="app-loading-halo" />
            <div className="app-loading-ring" />
            <div
              className="app-loading-core"
              style={{
                width: 38,
                height: 38,
                borderRadius: "999px",
                background: "radial-gradient(circle at 30% 30%, #ffffff 0%, #ddd6fe 45%, #a78bfa 100%)",
                boxShadow: "0 10px 24px rgba(167, 139, 250, 0.35)",
              }}
            />
          </div>
          <div aria-hidden="true" className="app-loading-dots">
            <span className="app-loading-dot app-loading-dot-one" />
            <span className="app-loading-dot app-loading-dot-two" />
            <span className="app-loading-dot app-loading-dot-three" />
          </div>
        </div>
        <div style={{ display: "grid", gap: 4, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "var(--font-lg)", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Getting the party plans ready
          </p>
          <p style={{ margin: 0, fontSize: "var(--font-md)", color: "var(--color-text-secondary)" }}>
            One sec while we fluff the details.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") ?? "dashboard";
  const [activeTab, setActiveTabState] = useState(initialTab);
  const hasMounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const app = useApp();
  const auth = useAuth();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    if (tab === "dashboard") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  const tripName = app.trip?.name ?? "Trip Planner";
  const isAdmin = app.currentRole === "MOH_ADMIN";
  const showLoadingState = !hasMounted || auth.loading || app.isLoadingTrips || app.isLoadingData;

  const TAB_TITLES: Record<string, string> = {
    dashboard: tripName,
    events: "Events",
    itinerary: "Itinerary",
    guests: "Guests",
    budget: "Budget",
    polls: "Polls",
    tasks: "Tasks",
    moodboard: "Moodboard",
    settings: "Settings",
  };

  const handleAddItem = () => {
    setShowPlanForm(true);
  };

  const handleSignOut = useCallback(() => {
    void auth.signOut();
  }, [auth]);

  const collectLinkedItemIds = useCallback((seedType: "event" | "task" | "budget", seedId: string) => {
    const eventIds = new Set<string>();
    const taskIds = new Set<string>();
    const budgetIds = new Set<string>();
    const eventQueue: string[] = [];
    const taskQueue: string[] = [];
    const budgetQueue: string[] = [];

    const enqueueEvent = (id?: string | null) => {
      if (!id || eventIds.has(id)) return;
      eventIds.add(id);
      eventQueue.push(id);
    };

    const enqueueTask = (id?: string | null) => {
      if (!id || taskIds.has(id)) return;
      taskIds.add(id);
      taskQueue.push(id);
    };

    const enqueueBudget = (id?: string | null) => {
      if (!id || budgetIds.has(id)) return;
      budgetIds.add(id);
      budgetQueue.push(id);
    };

    if (seedType === "event") enqueueEvent(seedId);
    if (seedType === "task") enqueueTask(seedId);
    if (seedType === "budget") enqueueBudget(seedId);

    while (eventQueue.length || taskQueue.length || budgetQueue.length) {
      const nextEventId = eventQueue.shift();
      if (nextEventId) {
        app.tasks
          .filter((task) => task.relatedEventId === nextEventId)
          .forEach((task) => enqueueTask(task.id));
        app.budgetItems
          .filter((item) => item.relatedEventId === nextEventId)
          .forEach((item) => enqueueBudget(item.id));
      }

      const nextTaskId = taskQueue.shift();
      if (nextTaskId) {
        const task = app.tasks.find((entry) => entry.id === nextTaskId);
        enqueueEvent(task?.relatedEventId);
        enqueueBudget(task?.relatedBudgetItemId);
        app.budgetItems
          .filter((item) => item.relatedTaskId === nextTaskId)
          .forEach((item) => enqueueBudget(item.id));
      }

      const nextBudgetId = budgetQueue.shift();
      if (nextBudgetId) {
        const item = app.budgetItems.find((entry) => entry.id === nextBudgetId);
        enqueueEvent(item?.relatedEventId);
        enqueueTask(item?.relatedTaskId);
        app.tasks
          .filter((task) => task.relatedBudgetItemId === nextBudgetId)
          .forEach((task) => enqueueTask(task.id));
      }
    }

    return { eventIds, taskIds, budgetIds };
  }, [app]);

  const linkedItemCount = useCallback((seedType: "event" | "task" | "budget", seedId: string) => {
    const linked = collectLinkedItemIds(seedType, seedId);
    return linked.eventIds.size + linked.taskIds.size + linked.budgetIds.size - 1;
  }, [collectLinkedItemIds]);

  const deleteItemOnly = useCallback((type: "event" | "task" | "budget", id: string) => {
    if (!isAdmin) return;

    if (type === "event") {
      app.tasks
        .filter((task) => task.relatedEventId === id)
        .forEach((task) => app.updateTask(task.id, { relatedEventId: null }));
      app.budgetItems
        .filter((item) => item.relatedEventId === id)
        .forEach((item) => app.updateBudgetItem(item.id, { relatedEventId: null }));
      app.deleteEvent(id);
    }

    if (type === "task") {
      const task = app.tasks.find((entry) => entry.id === id);
      app.budgetItems
        .filter((item) => item.relatedTaskId === id)
        .forEach((item) => app.updateBudgetItem(item.id, { relatedTaskId: null }));
      if (task?.relatedBudgetItemId) {
        app.updateBudgetItem(task.relatedBudgetItemId, { relatedTaskId: null });
      }
      app.deleteTask(id);
    }

    if (type === "budget") {
      const item = app.budgetItems.find((entry) => entry.id === id);
      app.tasks
        .filter((task) => task.relatedBudgetItemId === id)
        .forEach((task) => app.updateTask(task.id, { relatedBudgetItemId: null }));
      if (item?.relatedTaskId) {
        app.updateTask(item.relatedTaskId, { relatedBudgetItemId: null });
      }
      app.deleteBudgetItem(id);
    }

    app.closePanel();
  }, [app, isAdmin]);

  const deleteItemAndLinked = useCallback((type: "event" | "task" | "budget", id: string) => {
    if (!isAdmin) return;

    const linked = collectLinkedItemIds(type, id);
    linked.taskIds.forEach((taskId) => app.deleteTask(taskId));
    linked.budgetIds.forEach((budgetId) => app.deleteBudgetItem(budgetId));
    linked.eventIds.forEach((eventId) => app.deleteEvent(eventId));
    app.closePanel();
  }, [app, collectLinkedItemIds, isAdmin]);

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
          canDelete={isAdmin}
          linkedDeleteCount={linkedItemCount("event", event.id)}
          onDeleteOnly={() => deleteItemOnly("event", event.id)}
          onDeleteLinked={() => deleteItemAndLinked("event", event.id)}
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
          canDelete={isAdmin}
          linkedDeleteCount={linkedItemCount("task", task.id)}
          onDeleteOnly={() => deleteItemOnly("task", task.id)}
          onDeleteLinked={() => deleteItemAndLinked("task", task.id)}
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
          canDelete={isAdmin}
          linkedDeleteCount={linkedItemCount("budget", item.id)}
          onDeleteOnly={() => deleteItemOnly("budget", item.id)}
          onDeleteLinked={() => deleteItemAndLinked("budget", item.id)}
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
    <div className="flex app-shell-height" style={{ background: "var(--color-accent-soft)" }}>
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewTrip={() => setShowCreateTrip(true)}
        onSignOut={!auth.isDemo ? handleSignOut : undefined}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <HeaderBar
          title={TAB_TITLES[activeTab] ?? "Dashboard"}
          onAddItem={activeTab === "polls" || activeTab === "moodboard" || activeTab === "guests" ? undefined : handleAddItem}
          onClearAll={app.clearAllData}
          onRestoreDemo={app.resetDemoData}
          onExportJSON={app.exportData}
          onImportJSON={app.importData}
        />

        <main
          className={`flex-1 overflow-y-auto ${activeTab === "moodboard" ? "p-0" : "p-3 md:p-6"}`}
          style={{ background: "var(--color-bg-surface)" }}
        >
          {showLoadingState ? (
            <LoadingState />
          ) : (
            <>
              {activeTab === "dashboard" && <DashboardView />}
              {activeTab === "events" && <EventsView />}
              {activeTab === "itinerary" && <ItineraryView />}
              {activeTab === "guests" && <GuestsView />}
              {activeTab === "budget" && <BudgetView />}
              {activeTab === "polls" && <PollsView />}
              {activeTab === "tasks" && <TasksView />}
              {activeTab === "moodboard" && <MoodboardView />}
              {activeTab === "settings" && <SettingsView />}
            </>
          )}
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

      {isMobile && activeTab !== "polls" && activeTab !== "moodboard" && activeTab !== "guests" && !showPlanForm && (
        <button
          type="button"
          aria-label="Add item"
          onClick={handleAddItem}
          style={{
            position: "fixed",
            right: 16,
            bottom: 84,
            zIndex: 180,
            width: 56,
            height: 56,
            borderRadius: "999px",
            border: "none",
            background: "var(--color-accent)",
            color: "#fff",
            boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <HiOutlinePlus size={24} />
        </button>
      )}

      {/* Create Trip modal */}
      {showCreateTrip && <CreateTripModal onClose={() => setShowCreateTrip(false)} />}

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
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "92vh",
              overflow: "hidden",
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
