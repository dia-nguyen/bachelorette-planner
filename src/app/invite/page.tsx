"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface InviteMetadata {
  email: string;
  claimed: boolean;
  expired: boolean;
  trip: { id: string; name: string; location: string; start_at: string; } | null;
}

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const isSupabaseMode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
  const isConfigured = isSupabaseConfigured();

  const [meta, setMeta] = useState<InviteMetadata | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Load invite metadata and current auth session in parallel
  useEffect(() => {
    if (!token) {
      setMetaError("No invite token found in this link.");
      setLoading(false);
      return;
    }

    if (!isSupabaseMode || !isConfigured) {
      setMetaError("Invite links are only available in production mode.");
      setLoading(false);
      return;
    }

    async function load() {
      const supabase = createClient();
      const [metaRes, sessionRes] = await Promise.all([
        fetch(`/api/invite?token=${encodeURIComponent(token!)}`),
        supabase.auth.getSession(),
      ]);

      if (!metaRes.ok) {
        const err = (await metaRes.json()) as { error?: string; };
        setMetaError(err.error ?? "Invalid or expired invite link.");
        setLoading(false);
        return;
      }

      const data = (await metaRes.json()) as InviteMetadata;
      setMeta(data);
      setCurrentUserEmail(sessionRes.data.session?.user?.email ?? null);
      setLoading(false);
    }

    void load();
  }, [token, isSupabaseMode, isConfigured]);

  // Auto-claim if the user is already signed in and the email matches
  useEffect(() => {
    if (!meta || !token || !currentUserEmail || meta.claimed || meta.expired) return;
    if (currentUserEmail.toLowerCase() !== meta.email.toLowerCase()) return;

    // Email matches — auto-redeem
    void handleClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, currentUserEmail]);

  async function handleClaim() {
    if (!token) return;
    setRedeeming(true);
    setRedeemError(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await res.json()) as { ok?: boolean; tripId?: string; error?: string; };
      if (!res.ok) {
        setRedeemError(payload.error ?? "Failed to join trip.");
        setRedeeming(false);
        return;
      }
      // Successfully joined — go to the trip
      router.push("/");
    } catch {
      setRedeemError("Something went wrong. Please try again.");
      setRedeeming(false);
    }
  }

  function handleSignIn() {
    // Redirect to Google login, then back to this invite link after auth
    const next = `/invite?token=${encodeURIComponent(token ?? "")}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <p style={{ color: "var(--color-text-secondary)" }}>Loading invite...</p>
      </main>
    );
  }

  if (metaError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>Invalid Invite Link</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>{metaError}</p>
        </div>
      </main>
    );
  }

  if (!meta) return null;

  // Already claimed
  if (meta.claimed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>Already Claimed</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}>
            This invite has already been used. If you have access, sign in to continue.
          </p>
          <button
            onClick={handleSignIn}
            style={{ padding: "10px 24px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  // Expired
  if (meta.expired) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>Invite Expired</h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            This invite link has expired. Ask the event organizer to generate a new invite link for <strong>{meta.email}</strong>.
          </p>
        </div>
      </main>
    );
  }

  // Not signed in
  if (!currentUserEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20 }}>
              BP
            </div>
            <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>You&apos;re Invited!</h1>
            {meta.trip ? (
              <p style={{ color: "var(--color-text-secondary)" }}>
                Join <strong>{meta.trip.name}</strong> in {meta.trip.location}.
              </p>
            ) : (
              <p style={{ color: "var(--color-text-secondary)" }}>You&apos;ve been invited to a bachelorette event.</p>
            )}
          </div>

          <div style={{ background: "var(--color-bg-muted)", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 20, fontSize: "var(--font-sm)" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>This invite is for </span>
            <strong>{meta.email}</strong>
            <span style={{ color: "var(--color-text-secondary)" }}>. Sign in with that Google account to accept.</span>
          </div>

          <button
            onClick={handleSignIn}
            style={{ width: "100%", padding: "12px 20px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "var(--font-md)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </main>
    );
  }

  // Signed in but wrong email
  if (currentUserEmail.toLowerCase() !== meta.email.toLowerCase()) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
        <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>Wrong Account</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 4 }}>
            You are signed in as <strong>{currentUserEmail}</strong>.
          </p>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}>
            This invite was sent to <strong>{meta.email}</strong>. Please sign out and sign in with the correct Google account.
          </p>
          <button
            onClick={handleSignIn}
            style={{ padding: "10px 24px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            Switch Account
          </button>
        </div>
      </main>
    );
  }

  // Correct user — showing redeeming state or error
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg-surface)" }}>
      <div style={{ width: "min(480px, 100%)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center" }}>
        {redeeming ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>Joining event...</h1>
            <p style={{ color: "var(--color-text-secondary)" }}>You&apos;re in! Taking you to the dashboard.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎊</div>
            <h1 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>You&apos;re Invited!</h1>
            {meta.trip && (
              <p style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}>
                Join <strong>{meta.trip.name}</strong> in {meta.trip.location}.
              </p>
            )}
            {redeemError && (
              <p style={{ color: "#dc2626", fontSize: "var(--font-sm)", marginBottom: 16 }}>{redeemError}</p>
            )}
            <button
              onClick={() => void handleClaim()}
              style={{ padding: "10px 32px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "var(--font-md)" }}
            >
              Accept Invite
            </button>
          </>
        )}
      </div>
    </main>
  );
}

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

export default function InvitePage() {
  return (
    <Suspense>
      <InviteContent />
    </Suspense>
  );
}
