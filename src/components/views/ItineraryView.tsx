"use client";

import { Badge, Card, EmptyState, eventStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import { useEffect, useMemo, useState } from "react";
import { FaLocationDot } from "react-icons/fa6";

/** Statuses considered "at least planned" */
const ITINERARY_STATUSES = new Set(["PLANNED", "CONFIRMED"]);
const ITINERARY_VIEW_STORAGE_KEY = "itinerary-view-mode";

function hasValidDateTime(iso?: string): boolean {
  if (!iso) return false;
  return !Number.isNaN(new Date(iso).getTime());
}

function shouldIncludeInItinerary(status: string, startAt: string): boolean {
  if (ITINERARY_STATUSES.has(status)) return true;
  return status === "DRAFT" && hasValidDateTime(startAt);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const minutes = date.getMinutes();
  return date.toLocaleTimeString([], minutes === 0 ? { hour: "numeric" } : { hour: "numeric", minute: "2-digit" });
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function isSameLocalDate(startIso: string, endIso: string): boolean {
  return toLocalDateKey(new Date(startIso)) === toLocalDateKey(new Date(endIso));
}

function formatEventTimeLabel(startIso: string, endIso?: string): string {
  const start = formatTime(startIso);
  if (!endIso || !hasValidDateTime(endIso)) return start;
  if (!isSameLocalDate(startIso, endIso)) return start;
  return `${start} – ${formatTime(endIso)}`;
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
  const [isCondensed, setIsCondensed] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ITINERARY_VIEW_STORAGE_KEY);
      if (saved === "detailed") setIsCondensed(false);
      if (saved === "condensed") setIsCondensed(true);
    } catch {
      // Ignore storage errors and use default condensed mode.
    }
  }, []);

  function setViewMode(condensed: boolean): void {
    setIsCondensed(condensed);
    try {
      window.localStorage.setItem(ITINERARY_VIEW_STORAGE_KEY, condensed ? "condensed" : "detailed");
    } catch {
      // Ignore storage errors; view still updates in-memory.
    }
  }

  const dayGroups = useMemo(() => {
    if (!trip) return [];

    const tripDays = dateRange(trip.startAt, trip.endAt);

    // Filter to planned/confirmed events + draft events that already have a start time.
    const qualifying = [...events]
      .filter((e) => shouldIncludeInItinerary(e.status, e.startAt))
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
        <EmptyState message="No trip selected" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hidden sm:block" style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
          Day-by-day schedule of planned, confirmed, and timed draft events
        </p>
        <div
          className="ml-auto"
          role="group"
          aria-label="Itinerary view mode"
          style={{
            display: "inline-flex",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-pill)",
            padding: 2,
            background: "var(--color-bg-muted)",
          }}
        >
          <button
            type="button"
            aria-pressed={isCondensed}
            onClick={() => setViewMode(true)}
            style={{
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "var(--font-sm)",
              fontWeight: 600,
              color: isCondensed ? "var(--color-accent)" : "var(--color-text-secondary)",
              background: isCondensed ? "var(--color-accent-soft)" : "transparent",
            }}
          >
            Condensed
          </button>
          <button
            type="button"
            aria-pressed={!isCondensed}
            onClick={() => setViewMode(false)}
            style={{
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "var(--font-sm)",
              fontWeight: 600,
              color: !isCondensed ? "var(--color-accent)" : "var(--color-text-secondary)",
              background: !isCondensed ? "var(--color-accent-soft)" : "transparent",
            }}
          >
            Detailed
          </button>
        </div>
      </div>

      {isCondensed ? (
        <div className="flex flex-col gap-4">
          {dayGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex justify-center sm:justify-start">
                <h3
                  style={{
                    fontSize: "var(--font-sm)",
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 12px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--color-accent-soft)",
                    border: "1px solid var(--color-accent)",
                    margin: 0,
                  }}
                >
                  {group.label}
                </h3>
              </div>

              {group.events.length === 0 ? (
                <p style={{ margin: 0, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                  No events scheduled yet
                </p>
              ) : (
                <div className="flex flex-col">
                  {group.events.map((ev, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === group.events.length - 1;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => openPanel("event", ev.id)}
                        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                      >
                        <div className="grid grid-cols-[104px_18px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[128px_18px_minmax(0,1fr)] sm:gap-x-3">
                          <div style={{ paddingTop: 6 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "12px",
                                fontWeight: 500,
                                lineHeight: 1.25,
                                letterSpacing: 0.3,
                                textTransform: "uppercase",
                                color: "var(--color-text-secondary)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatEventTimeLabel(ev.startAt, ev.endAt)}
                            </p>
                          </div>

                          <div style={{ position: "relative", minHeight: 56, display: "flex", justifyContent: "center" }}>
                            <span
                              aria-hidden
                              style={{
                                position: "absolute",
                                top: isFirst ? 10 : 0,
                                bottom: isLast ? 10 : 0,
                                width: 2,
                                borderRadius: 999,
                                background: "var(--color-accent-soft)",
                              }}
                            />
                            <span
                              aria-hidden
                              style={{
                                marginTop: 10,
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "var(--color-accent)",
                                border: "2px solid var(--color-bg-surface)",
                                zIndex: 1,
                              }}
                            />
                          </div>

                          <div
                            style={{
                              paddingTop: 4,
                              paddingBottom: 10,
                              borderBottom: isLast ? "none" : "1px solid var(--color-border)",
                              minWidth: 0,
                            }}
                          >
                            <p style={{ margin: 0, fontSize: "var(--font-md)", fontWeight: 600, lineHeight: 1.25 }}>{ev.title}</p>
                            <p
                              style={{
                                margin: "4px 0 0",
                                fontSize: "var(--font-sm)",
                                color: "var(--color-text-secondary)",
                                wordBreak: "break-word",
                              }}
                            >
                              {ev.location ?? "TBD"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        dayGroups.map((group, idx) => (
          <div key={group.key}>
            {/* Day header */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3" style={{ marginBottom: 10 }}>
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
                paddingLeft: 12,
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
                    <Card style={{ padding: "clamp(14px, 3.5vw, var(--space-lg))" }}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
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
                            {formatEventTimeLabel(ev.startAt, ev.endAt)}
                          </p>
                          {/* Title */}
                          <p style={{ fontSize: "clamp(16px, 4.4vw, var(--font-lg))", fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
                            {ev.title}
                          </p>
                          {/* Location */}
                          {ev.location && (
                            <p
                              style={{
                                fontSize: "var(--font-sm)",
                                color: "var(--color-text-secondary)",
                                marginTop: 4,
                                wordBreak: "break-word",
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <FaLocationDot size={14} />
                                <span>{ev.location}</span>
                              </span>
                            </p>
                          )}
                          {/* Description */}
                          {ev.description && (
                            <p
                              style={{
                                fontSize: "var(--font-sm)",
                                color: "var(--color-text-secondary)",
                                marginTop: 6,
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                whiteSpace: "pre-line",
                                wordBreak: "break-word",
                                maxWidth: 500,
                              }}
                            >
                              {ev.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
                          <Badge variant={eventStatusVariant(ev.status)}>{ev.status}</Badge>
                          {/* Attendee avatars */}
                          {attendees.length > 0 && (
                            <div className="flex" style={{ marginTop: 0 }}>
                              {attendees.slice(0, 5).map((u, i) => (
                                <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -6 }} title={u.name}>
                                  <Avatar name={u.name} color={u.avatarColor} size={20} />
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
                          className="flex flex-col sm:flex-row"
                          style={{
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: "1px solid var(--color-border)",
                            fontSize: "var(--font-sm)",
                            color: "var(--color-text-secondary)",
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
        ))
      )}
    </div>
  );
}
