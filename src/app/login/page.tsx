"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.48h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.548 14.463 17.64 12.027 17.64 9.2z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function LoginForm() {
  const isSupabaseMode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
  const isDemo = !isSupabaseMode || !isSupabaseConfigured();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  // Validate next is a safe relative path to prevent open redirect attacks.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (authError) {
        setError(authError.message || "Failed to start Google sign-in.");
        setLoading(false);
      }
      // On success, browser redirects — no need to setLoading(false)
    } catch {
      setError("Unable to sign in with Google right now.");
      setLoading(false);
    }
  }

  if (isDemo) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(520px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <h1 style={{ fontSize: "var(--font-2xl)", fontWeight: 700, marginBottom: 8 }}>Demo Mode Enabled</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>
            Authentication is bypassed while <code>NEXT_PUBLIC_DATA_MODE=demo</code>.
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
      <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>

          <div style={{ width: 56, height: 56, borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", fontWeight: 700, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Image src={`/app-icon.png`} alt={"Bachelorette Party Planner Icon"} width={200} height={200} />
          </div>
          <h1 style={{ fontSize: "var(--font-2xl)", fontWeight: 700, marginBottom: 8 }}>Bachelorette Planner</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
            Sign in with your Google account to access your event.
          </p>
        </div>

        {/* Google sign-in button */}
        <button
          onClick={() => void handleGoogleSignIn()}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "#fff",
            color: "#374151",
            fontWeight: 600,
            fontSize: "var(--font-md)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <GoogleIcon />
          {loading ? "Redirecting to Google..." : "Continue with Google"}
        </button>

        {error ? (
          <p style={{ color: "#dc2626", fontSize: "var(--font-sm)", marginTop: 12, textAlign: "center" }}>{error}</p>
        ) : null}

        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
          New here? You&apos;ll need an invite link from the event organizer, or you can create a new event after signing in.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
