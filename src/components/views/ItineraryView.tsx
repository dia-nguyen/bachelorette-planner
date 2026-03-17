"use client";

import { Badge, Card, EmptyState, eventStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import { useMemo } from "react";

/** Statuses considered "at least planned" */
const ITINERARY_STATUSES = new Set(["PLANNED", "CONFIRMED"]);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/** Return YYYY-MM-DD for a Date in local time */
function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Generate every date between start and end (inclusive) */
function dateRange(startIso: string, endIso: string): Date[] {
  const dates: Date[] = [];
  const cur = new Date(startIso);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endIso);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function ItineraryView() {
  const { trip, events, users, openPanel } = useApp();

  const dayGroups = useMemo(() => {
    if (!trip) return [];

    const tripDays = dateRange(trip.startAt, trip.endAt);

    // Filter to events with at least PLANNED status, sorted by start time
    const qualifying = [...events]
      .filter((e) => ITINERARY_STATUSES.has(e.status))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return tripDays.map((day) => {
      const key = toLocalDateKey(day);
      const dayEvents = qualifying.filter((e) => toLocalDateKey(new Date(e.startAt)) === key);
      return { date: day, key, label: formatDayHeader(day), events: dayEvents };
    });
  }, [trip, events]);

  if (!trip) {
    return (
      <div className="flex flex-col gap-4">
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Itinerary</h2>
        <EmptyState message="No trip selected" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Itinerary</h2>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
          Day-by-day schedule of planned and confirmed events
        </p>
      </div>

      {dayGroups.map((group, idx) => (
        <div key={group.key}>
          {/* Day header */}
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: group.events.length > 0 ? "var(--color-accent)" : "var(--color-bg-muted)",
                color: group.events.length > 0 ? "#fff" : "var(--color-text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "var(--font-sm)",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </div>
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
              {group.events.length === 0
                ? "Free day"
                : `${group.events.length} event${group.events.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Events for this day */}
          <div
            className="flex flex-col gap-3"
            style={{
              paddingLeft: 20,
              borderLeft: `2px solid ${group.events.length > 0 ? "var(--color-accent-soft)" : "var(--color-border)"}`,
              marginLeft: 13,
              minHeight: group.events.length === 0 ? 40 : undefined,
            }}
          >
            {group.events.length === 0 && (
              <p
                style={{
                  fontSize: "var(--font-sm)",
                  color: "var(--color-text-secondary)",
                  fontStyle: "italic",
                  margin: "4px 0",
                }}
              >
                No events scheduled yet
              </p>
            )}

            {group.events.map((ev) => {
              const attendees = users.filter((u) => (ev.attendeeUserIds ?? []).includes(u.id));
              return (
                <button
                  key={ev.id}
                  onClick={() => openPanel("event", ev.id)}
                  style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                >
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        {/* Time range */}
                        <p
                          style={{
                            fontSize: "var(--font-sm)",
                            color: "var(--color-accent)",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          {formatTime(ev.startAt)}
                          {ev.endAt && ` – ${formatTime(ev.endAt)}`}
                        </p>
                        {/* Title */}
                        <p style={{ fontSize: "var(--font-lg)", fontWeight: 600, margin: 0 }}>
                          {ev.title}
                        </p>
                        {/* Location */}
                        {ev.location && (
                          <p
                            style={{
                              fontSize: "var(--font-sm)",
                              color: "var(--color-text-secondary)",
                              marginTop: 4,
                            }}
                          >
                            📍 {ev.location}
                          </p>
                        )}
                        {/* Description */}
                        {ev.description && (
                          <p
                            style={{
                              fontSize: "var(--font-sm)",
                              color: "var(--color-text-secondary)",
                              marginTop: 6,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 500,
                            }}
                          >
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
                              <span
                                style={{
                                  fontSize: "var(--font-sm)",
                                  color: "var(--color-text-secondary)",
                                  marginLeft: 4,
                                  alignSelf: "center",
                                }}
                              >
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
