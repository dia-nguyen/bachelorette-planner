"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");

  // Create trip state
  const [tripName, setTripName] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Join state
  const [joinCode, setJoinCode] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  async function handleCreateTrip(e: FormEvent) {
    e.preventDefault();
    if (!tripName.trim() || !startAt || !endAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tripName.trim(),
          location: location.trim(),
          startAt,
          endAt,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create trip.");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip.");
      setSaving(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trips/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to join trip.");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join trip.");
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  const inputSt: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "8px 12px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    fontSize: "var(--font-sm)",
    background: "var(--color-bg-base)",
    color: "var(--color-text-primary)",
    boxSizing: "border-box",
  };

  const btnPrimary: React.CSSProperties = {
    marginTop: 8,
    padding: "10px 0",
    borderRadius: "var(--radius-md)",
    background: "var(--color-accent)",
    color: "#fff",
    border: "none",
    fontWeight: 600,
    cursor: saving ? "not-allowed" : "pointer",
    fontSize: "var(--font-sm)",
    opacity: saving ? 0.6 : 1,
    width: "100%",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-accent-soft)",
        padding: 24,
      }}
    >
      <div style={{ width: "min(480px, 100%)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-md)",
              background: "var(--color-accent)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            BP
          </div>
          <h1 style={{ fontSize: "var(--font-2xl)", fontWeight: 700, marginBottom: 6 }}>
            Welcome!
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
            Let&apos;s get you set up.
          </p>
        </div>

        {/* Step 1: choose path */}
        {mode === "choose" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => setMode("create")}
              style={{
                padding: "20px 24px",
                borderRadius: "var(--radius-lg)",
                border: "2px solid var(--color-accent)",
                background: "var(--color-bg-surface)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)", marginBottom: 4 }}>
                Create a new trip
              </div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
                You&apos;re the planner. Set up dates, location, and invite your crew.
              </div>
            </button>

            <button
              onClick={() => setMode("join")}
              style={{
                padding: "20px 24px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-surface)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "var(--font-md)", marginBottom: 4 }}>
                Join an existing trip
              </div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
                You have a join code from the trip organizer.
              </div>
            </button>
          </div>
        )}

        {/* Step 2a: create trip form */}
        {mode === "create" && (
          <div
            style={{
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "28px 32px",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => { setMode("choose"); setError(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 20, lineHeight: 1, padding: 0 }}
              >
                ←
              </button>
              <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Create a trip</h2>
            </div>
            <form onSubmit={(e) => void handleCreateTrip(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                Trip name *
                <input style={inputSt} value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="e.g. Emma's Bachelorette" required autoFocus />
              </label>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                Location
                <input style={inputSt} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nashville, TN" />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Start *
                  <input type="date" style={inputSt} value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
                </label>
                <label style={{ flex: 1, fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  End *
                  <input type="date" style={inputSt} value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
                </label>
              </div>
              {error && <p style={{ color: "#dc2626", fontSize: "var(--font-sm)" }}>{error}</p>}
              <button type="submit" disabled={saving || !tripName.trim() || !startAt || !endAt} style={btnPrimary}>
                {saving ? "Creating..." : "Create Trip"}
              </button>
            </form>
          </div>
        )}

        {/* Step 2b: join with code */}
        {mode === "join" && (
          <div
            style={{
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "28px 32px",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => { setMode("choose"); setError(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 20, lineHeight: 1, padding: 0 }}
              >
                ←
              </button>
              <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Join a trip</h2>
            </div>
            <form onSubmit={(e) => void handleJoin(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                Join code
                <input
                  style={{
                    ...inputSt,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    fontFamily: "monospace",
                    fontSize: "var(--font-lg)",
                    marginTop: 8,
                  }}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXXXX"
                  maxLength={12}
                  required
                  autoFocus
                />
              </label>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-xs)", marginTop: -8 }}>
                Ask the trip organizer for the 8-character code from their Settings page.
              </p>
              {error && <p style={{ color: "#dc2626", fontSize: "var(--font-sm)" }}>{error}</p>}
              <button type="submit" disabled={saving || joinCode.trim().length < 6} style={btnPrimary}>
                {saving ? "Joining..." : "Join Trip"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
