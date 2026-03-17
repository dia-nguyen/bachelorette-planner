"use client";

import { useApp } from "@/lib/context";
import { useState } from "react";
import { HiOutlineCalendar, HiOutlineLocationMarker } from "react-icons/hi";

function getDaysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function SettingsView() {
  const { trip, updateTrip } = useApp();

  const [name, setName] = useState(trip?.name ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [startAt, setStartAt] = useState(trip?.startAt ? trip.startAt.slice(0, 10) : "");
  const [endAt, setEndAt] = useState(trip?.endAt ? trip.endAt.slice(0, 10) : "");
  const [location, setLocation] = useState(trip?.location ?? "");
  const [saved, setSaved] = useState(false);

  const daysUntil = startAt ? getDaysUntil(startAt) : null;

  const handleSave = () => {
    updateTrip({
      name: name.trim() || "My Trip",
      description: description.trim(),
      startAt: startAt ? new Date(startAt + "T12:00:00Z").toISOString() : trip?.startAt ?? "",
      endAt: endAt ? new Date(endAt + "T12:00:00Z").toISOString() : trip?.endAt ?? "",
      location: location.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg-muted)",
    color: "var(--color-text-primary)",
    fontSize: "var(--font-md)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--font-sm)",
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: "var(--font-md)", color: "var(--color-text-secondary)", margin: 0 }}>
          General information about your trip.
        </p>
      </div>

      {/* Countdown banner */}
      {daysUntil !== null && (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3"
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-accent-soft)",
            border: "1px solid var(--color-accent)",
            marginBottom: 28,
          }}
        >
          <div className="flex items-center gap-3">
            <HiOutlineCalendar size={22} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <div>
            {daysUntil > 0 ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--color-accent)",
                      lineHeight: 1,
                    }}
                  >
                    {daysUntil}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--font-md)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {daysUntil === 1 ? "day" : "days"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "var(--font-md)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  until the trip
                </div>
              </>
            ) : daysUntil === 0 ? (
              <span style={{ fontSize: "var(--font-lg)", fontWeight: 700, color: "var(--color-accent)" }}>
                Today&apos;s the day! 🎉
              </span>
            ) : (
              <span style={{ fontSize: "var(--font-md)", color: "var(--color-text-secondary)" }}>
                The trip was {Math.abs(daysUntil)} {Math.abs(daysUntil) === 1 ? "day" : "days"} ago
              </span>
            )}
            </div>
          </div>
          {location && (
            <div
              className="sm:ml-auto"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "var(--font-md)",
                color: "var(--color-text-secondary)",
              }}
            >
              <HiOutlineLocationMarker size={16} />
              {location}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-xl)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Trip Name */}
        <div>
          <label style={labelStyle}>Trip Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sophie's Bachelorette Weekend"
            style={inputStyle}
          />
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginTop: 5 }}>
            This is displayed as the header title throughout the app.
          </p>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the trip vibe, what's planned, etc."
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {/* Location */}
        <div>
          <label style={labelStyle}>Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Miami Beach, FL"
            style={inputStyle}
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Start Date</label>
            <input
              type="date"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input
              type="date"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Save button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
          <button
            onClick={handleSave}
            style={{
              padding: "10px 24px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "var(--font-md)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Save Changes
          </button>
          {saved && (
            <span style={{ fontSize: "var(--font-sm)", color: "var(--color-accent)", fontWeight: 600 }}>
              ✓ Saved
            </span>
          )}
        </div>
      </div>

      {/* Join Code — MOH shares this with guests so they can self-join */}
      {process.env.NEXT_PUBLIC_DATA_MODE === "supabase" && trip?.joinCode && (
        <div
          style={{
            marginTop: 24,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-xl)",
          }}
        >
          <label style={labelStyle}>Trip Join Code</label>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 14 }}>
            Share this code with guests. They enter it on the join screen to get access to this trip.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <code
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--color-accent)",
                fontFamily: "monospace",
                background: "var(--color-accent-soft)",
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {trip.joinCode}
            </code>
            <button
              onClick={() => void navigator.clipboard.writeText(trip.joinCode!)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-muted)",
                cursor: "pointer",
                fontSize: "var(--font-sm)",
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
