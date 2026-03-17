"use client";

import { Badge, Card, EmptyState, eventStatusVariant } from "@/components/ui";
import { useApp } from "@/lib/context";

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
                    📍 {ev.location}
                  </p>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 4 }}>
                    📅 {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {" · "}
                    {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  {(ev.attendeeUserIds?.length ?? 0) > 0 && (
                    <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 4 }}>
                      👥 {ev.attendeeUserIds.length} attending
                    </p>
                  )}
                  {ev.description && (
                    <p
                      style={{
                        fontSize: "var(--font-sm)",
                        color: "var(--color-text-secondary)",
                        marginTop: 8,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
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
