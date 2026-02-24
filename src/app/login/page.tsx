"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function LoginPage() {
  const isSupabaseMode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
  const isDemo = !isSupabaseMode || !isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/callback`;
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: false,
        },
      });

      if (authError) {
        const rawMessage = authError.message || "";
        if (rawMessage.toLowerCase().includes("signups not allowed for otp")) {
          setError("This email is not invited yet. Ask the trip admin to send you an invitation email first.");
        } else {
          setError(rawMessage || "This email is not registered.");
        }
        return;
      }

      setMessage("Check your email for a secure magic link.");
    } catch {
      setError("Unable to send magic link right now.");
    } finally {
      setLoading(false);
    }
  }

  if (isDemo) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(520px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <h1 style={{ fontSize: "var(--font-2xl)", fontWeight: 700, marginBottom: 8 }}>Demo Mode Enabled</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>
            Authentication is bypassed while `NEXT_PUBLIC_DATA_MODE=demo`.
          </p>
          <Link href="/" style={{ display: "inline-block", background: "var(--color-accent)", color: "#fff", borderRadius: "var(--radius-md)", padding: "8px 14px", textDecoration: "none", fontWeight: 600 }}>
            Enter Demo App
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
      <div style={{ width: "min(520px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
        <h1 style={{ fontSize: "var(--font-2xl)", fontWeight: 700, marginBottom: 8 }}>Bachelorette Planner</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Invite-only access. Enter your invited email to receive a magic link.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "10px 12px", fontSize: "var(--font-md)", outline: "none" }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 8, border: "none", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", padding: "10px 14px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>

          {message ? <p style={{ color: "#15803d", fontSize: "var(--font-sm)" }}>{message}</p> : null}
          {error ? <p style={{ color: "#dc2626", fontSize: "var(--font-sm)" }}>{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
