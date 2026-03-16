"use client";

import { Badge, Card, EmptyState, eventStatusVariant } from "@/components/ui";
import type { TripEvent } from "@/lib/data";

interface NextUpProps {
  events: TripEvent[];
  onEventClick: (id: string) => void;
}

function formatEventDate(iso: string): { day: string; date: string; } {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(); // MON, TUE…
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(); // JAN, FEB…
  const num = d.getDate();
  return { day, date: `${month} ${num}` };
}

export function NextUp({ events, onEventClick }: NextUpProps) {
  return (
    <Card>
      <h3
        style={{
          fontSize: "var(--font-lg)",
          fontWeight: 600,
          marginBottom: "var(--space-md)",
        }}
      >
        Next Up
      </h3>

      {events.length === 0 ? (
        <EmptyState message="No upcoming events" />
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((ev) => {
            const { day, date } = formatEventDate(ev.startAt);
            const statusLabel =
              ev.status === "DRAFT" ? "Draft" : ev.status === "PLANNED" ? "Pending" : ev.status;
            const variant = ev.status === "DRAFT" ? "negative" : eventStatusVariant(ev.status);

            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev.id)}
                className="flex items-center gap-3 w-full text-left"
                style={{
                  padding: "var(--space-sm) 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div
                  className="flex flex-col items-center"
                  style={{
                    minWidth: 44,
                    fontSize: "var(--font-sm)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.2,
                  }}
                >
                  <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{day}</span>
                  <span style={{ fontWeight: 500 }}>{date}</span>
                </div>
                <span style={{ flex: 1, fontWeight: 500 }}>{ev.title}</span>
                <Badge variant={variant}>{statusLabel}</Badge>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
