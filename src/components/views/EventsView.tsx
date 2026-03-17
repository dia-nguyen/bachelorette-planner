"use client";

import { Badge, Card, EmptyState, eventStatusVariant } from "@/components/ui";
import { useApp } from "@/lib/context";
import { BsCalendarDate } from "react-icons/bs";
import { FaLocationDot } from "react-icons/fa6";
import { PiUsersBold } from "react-icons/pi";

function formatCompactTime(date: Date) {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "\u00A0");
}

export function EventsView() {
  const { events, openPanel } = useApp();

  return (
    <div className="flex flex-col gap-4">
      {events.length === 0 ? (
        <EmptyState
          message="No events planned yet"
          actionLabel="Plan something with the + button above"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .map((ev) => {
              const start = new Date(ev.startAt);
              return (
                <Card key={ev.id} hoverable onClick={() => openPanel("event", ev.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 style={{ fontWeight: 600 }}>{ev.title}</h3>
                    <Badge variant={eventStatusVariant(ev.status)}>{ev.status}</Badge>
                  </div>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FaLocationDot size={14} />
                      <span>{ev.location}</span>
                    </span>
                  </p>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 4 }}>
                    <span style={{ whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <BsCalendarDate size={14} />
                        <span>{start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      </span>
                    </span>
                    {" · "}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {formatCompactTime(start)}
                    </span>
                  </p>
                  {(ev.attendeeUserIds?.length ?? 0) > 0 && (
                    <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 4 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <PiUsersBold size={14} />
                        <span>{ev.attendeeUserIds.length} attending</span>
                      </span>
                    </p>
                  )}
                  {ev.description && (
                    <p
                      style={{
                        fontSize: "var(--font-sm)",
                        color: "var(--color-text-secondary)",
                        marginTop: 8,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        whiteSpace: "pre-line",
                        wordBreak: "break-word",
                      }}
                    >
                      {ev.description}
                    </p>
                  )}
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
