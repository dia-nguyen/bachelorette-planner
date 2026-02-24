"use client";

import { Badge, Card, EmptyState, eventStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import { useMemo } from "react";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function TimelineView() {
  const { events, users, openPanel } = useApp();

  // Group non-cancelled events by day, sorted chronologically
  const dayGroups = useMemo(() => {
    const sorted = [...events]
      .filter((e) => e.status !== "CANCELED")
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const groups: { date: string; label: string; events: typeof sorted; }[] = [];
    for (const ev of sorted) {
      const dk = dateKey(ev.startAt);
      let group = groups.find((g) => g.date === dk);
      if (!group) {
        group = { date: dk, label: formatDayHeader(ev.startAt), events: [] };
        groups.push(group);
      }
      group.events.push(ev);
    }
    return groups;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Timeline</h2>
        <EmptyState message="No events yet" actionLabel="Plan something with the + button above" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Timeline</h2>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
          Day-by-day itinerary of all events
        </p>
      </div>

      {dayGroups.map((group) => (
        <div key={group.date}>
          {/* Day header */}
          <div
            className="flex items-center gap-3"
            style={{ marginBottom: 12 }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--color-accent)",
                flexShrink: 0,
              }}
            />
            <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, margin: 0 }}>
              {group.label}
            </h3>
            <span
              style={{
                fontSize: "var(--font-sm)",
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-muted)",
                padding: "2px 10px",
                borderRadius: "var(--radius-pill)",
              }}
            >
              {group.events.length} event{group.events.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Events for this day */}
          <div
            className="flex flex-col gap-3"
            style={{ paddingLeft: 20, borderLeft: "2px solid var(--color-accent-soft)", marginLeft: 4 }}
          >
            {group.events.map((ev) => {
              const attendees = users.filter((u) => (ev.attendeeUserIds ?? []).includes(u.id));
              return (
                <button
                  key={ev.id}
                  onClick={() => openPanel("event", ev.id)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "block",
                    width: "100%",
                  }}
                >
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        {/* Time range */}
                        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-accent)", fontWeight: 600, marginBottom: 4 }}>
                          {formatTime(ev.startAt)}
                          {ev.endAt && ` — ${formatTime(ev.endAt)}`}
                        </p>
                        {/* Title */}
                        <p style={{ fontSize: "var(--font-lg)", fontWeight: 600, margin: 0 }}>{ev.title}</p>
                        {/* Location */}
                        {ev.location && (
                          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 4 }}>
                            📍 {ev.location}
                          </p>
                        )}
                        {/* Description */}
                        {ev.description && (
                          <p style={{
                            fontSize: "var(--font-sm)",
                            color: "var(--color-text-secondary)",
                            marginTop: 6,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 500,
                          }}>
                            {ev.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={eventStatusVariant(ev.status)}>{ev.status}</Badge>
                        {/* Attendee avatars */}
                        {attendees.length > 0 && (
                          <div className="flex" style={{ marginTop: 4 }}>
                            {attendees.slice(0, 5).map((u) => (
                              <div key={u.id} style={{ marginLeft: -6 }} title={u.name}>
                                <Avatar name={u.name} color={u.avatarColor} size={24} />
                              </div>
                            ))}
                            {attendees.length > 5 && (
                              <span style={{
                                fontSize: "var(--font-sm)",
                                color: "var(--color-text-secondary)",
                                marginLeft: 4,
                                alignSelf: "center",
                              }}>
                                +{attendees.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Booking info */}
                    {(ev.provider || ev.confirmationCode) && (
                      <div
                        style={{
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: "1px solid var(--color-border)",
                          fontSize: "var(--font-sm)",
                          color: "var(--color-text-secondary)",
                          display: "flex",
                          gap: 16,
                        }}
                      >
                        {ev.provider && <span>🏪 {ev.provider}</span>}
                        {ev.confirmationCode && <span>📋 {ev.confirmationCode}</span>}
                      </div>
                    )}
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
