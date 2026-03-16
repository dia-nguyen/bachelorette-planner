"use client";

import { Badge, EmptyState, accountStatusVariant } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { GuestFieldDef, AccountStatus, Membership, Role, User } from "@/lib/data";
import { useRef, useState } from "react";

const FIELD_TYPES: { value: GuestFieldDef["type"]; label: string; }[] = [
  { value: "text", label: "Short text" },
  { value: "tel", label: "Phone number" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Long text / Notes" },
];

const ROLES: { value: Role; label: string; }[] = [
  { value: "MOH_ADMIN", label: "Admin" },
  { value: "GUEST_CONFIRMED", label: "Guest" },
];

const ACCOUNT_STATUSES: { value: AccountStatus; label: string; }[] = [
  { value: "INVITED", label: "Invited" },
  { value: "CLAIMED", label: "Claimed" },
];

function SchemaManager({
  schema,
  onAdd,
  onRemove,
  onReorder,
  onClose,
}: {
  schema: GuestFieldDef[];
  onAdd: (f: Omit<GuestFieldDef, "id">) => void;
  onRemove: (id: string) => void;
  onReorder: (newSchema: GuestFieldDef[]) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<GuestFieldDef["type"]>("text");
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleAdd = () => {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), type });
    setLabel("");
    setType("text");
  };

  const handleReorder = (from: number, to: number) => {
    const next = [...schema];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <div style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p style={{ fontWeight: 700, fontSize: "var(--font-md)" }}>Guest Profile Fields</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {schema.length === 0 ? (
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>No custom fields yet. Add one below.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {schema.map((f, idx) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => { dragFrom.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (dragFrom.current !== null && dragFrom.current !== idx) {
                    handleReorder(dragFrom.current, idx);
                  }
                  dragFrom.current = null;
                  setDragOver(null);
                }}
                onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
                className="flex items-center gap-3"
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  background: dragOver === idx ? "var(--color-accent-soft)" : "var(--color-bg-muted)",
                  border: dragOver === idx ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                  cursor: "grab",
                  transition: "background 0.1s, border-color 0.1s",
                }}
              >
                <span style={{ color: "var(--color-text-secondary)", fontSize: 14, userSelect: "none", cursor: "grab" }}>⠿</span>
                <div className="flex-1">
                  <span style={{ fontWeight: 500, fontSize: "var(--font-sm)" }}>{f.label}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "1px 6px" }}>
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                  </span>
                </div>
                <button onClick={() => onRemove(f.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "var(--font-sm)", padding: "2px 6px" }}
                  title="Remove field">🗑</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-accent-soft)", border: "1px dashed var(--color-accent)" }}>
          <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 10 }}>Add a new field</p>
          <div className="flex gap-3 flex-wrap items-end">
            <label style={{ flex: "1 1 160px", fontSize: "var(--font-sm)", fontWeight: 500 }}>
              Field name
              <input
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--font-sm)", background: "var(--color-bg-surface)" }}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Phone, Room #, Notes…"
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
            </label>
            <label style={{ fontSize: "var(--font-sm)", fontWeight: 500 }}>
              Type
              <select
                style={{ display: "block", marginTop: 4, padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--font-sm)", background: "var(--color-bg-surface)", cursor: "pointer" }}
                value={type}
                onChange={(e) => setType(e.target.value as GuestFieldDef["type"])}
              >
                {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
              </select>
            </label>
            <button
              onClick={handleAdd}
              disabled={!label.trim()}
              style={{ padding: "6px 18px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: label.trim() ? "pointer" : "not-allowed", fontSize: "var(--font-sm)", opacity: label.trim() ? 1 : 0.5, height: 34 }}
            >+ Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const cellSt: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "var(--font-sm)",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--color-border)",
};

const headCellSt: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg-muted)",
  borderBottom: "2px solid var(--color-border)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  fontSize: "var(--font-sm)",
  background: "var(--color-bg-surface)",
};

const selectSt: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  fontSize: "var(--font-sm)",
  background: "var(--color-bg-surface)",
  cursor: "pointer",
  width: "100%",
};

function GuestTableRow({
  user,
  membership,
  fieldSchema,
  colSpan,
  onSave,
  onStatusChange,
}: {
  user: User;
  membership: Membership;
  fieldSchema: GuestFieldDef[];
  colSpan: number;
  onSave: (patch: { name: string; email: string; role: Role; accountStatus: AccountStatus; customFields: Record<string, string>; }) => void;
  onStatusChange: (status: AccountStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: user.name,
    email: user.email,
    role: membership.role,
    accountStatus: membership.accountStatus,
    customFields: { ...(user.customFields ?? {}) },
  });

  const openEdit = () => {
    setDraft({
      name: user.name,
      email: user.email,
      role: membership.role,
      accountStatus: membership.accountStatus,
      customFields: { ...(user.customFields ?? {}) },
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!draft.name.trim() || !draft.email.trim()) return;
    onSave(draft);
    setEditing(false);
  };

  const setCustomField = (id: string, value: string) =>
    setDraft((d) => ({ ...d, customFields: { ...d.customFields, [id]: value } }));

  return (
    <>
      {/* Main data row */}
      <tr style={{ background: editing ? "var(--color-accent-soft)" : undefined }}>
        <td style={cellSt}>
          <div className="flex items-center gap-2">
            <Avatar name={user.name} color={user.avatarColor} size={28} />
            <span style={{ fontWeight: 500 }}>{user.name}</span>
          </div>
        </td>
        <td style={{ ...cellSt, color: "var(--color-text-secondary)" }}>{user.email}</td>
        <td style={cellSt}>
          <Badge variant={membership.role === "MOH_ADMIN" ? "accent" : "neutral"}>
            {membership.role === "MOH_ADMIN" ? "Admin" : "Guest"}
          </Badge>
        </td>
        <td style={cellSt}>
          <Badge variant={accountStatusVariant(membership.accountStatus)}>
            {membership.accountStatus}
          </Badge>
        </td>
        {fieldSchema.map((f) => (
          <td key={f.id} style={{ ...cellSt, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.customFields?.[f.id] ?? <span style={{ color: "var(--color-border)" }}>—</span>}
          </td>
        ))}
        <td style={{ ...cellSt, textAlign: "right", whiteSpace: "nowrap" }}>
          <div className="flex gap-1 justify-end">
            {membership.accountStatus === "INVITED" && (
              <button onClick={() => onStatusChange("CLAIMED")} style={{ padding: "3px 8px", borderRadius: "var(--radius-sm)", background: "var(--color-status-positive)", border: "none", fontSize: 11, cursor: "pointer", color: "#166534", fontWeight: 600 }}>Mark Claimed</button>
            )}
            <button onClick={openEdit} title="Edit" style={{ background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "3px 8px", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>✏️</button>
          </div>
        </td>
      </tr>

      {/* Inline edit row */}
      {editing && (
        <tr>
          <td colSpan={colSpan} style={{ padding: "16px 20px", background: "var(--color-accent-soft)", borderBottom: "2px solid var(--color-accent)" }}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 flex-wrap">
                <label style={{ flex: "1 1 150px", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Name
                  <input style={{ ...inputSt, marginTop: 4 }} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} autoFocus />
                </label>
                <label style={{ flex: "1 1 190px", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Email
                  <input type="email" style={{ ...inputSt, marginTop: 4 }} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                </label>
                <label style={{ flex: "0 0 120px", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Role
                  <select style={{ ...selectSt, marginTop: 4 }} value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as Role }))}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                <label style={{ flex: "0 0 130px", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Status
                  <select style={{ ...selectSt, marginTop: 4 }} value={draft.accountStatus} onChange={(e) => setDraft((d) => ({ ...d, accountStatus: e.target.value as AccountStatus }))}>
                    {ACCOUNT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                {fieldSchema.map((f) => (
                  <label key={f.id} style={{ flex: "1 1 140px", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                    {f.label}
                    {f.type === "textarea" ? (
                      <textarea style={{ ...inputSt, marginTop: 4, resize: "vertical", minHeight: 56 }} rows={2} value={draft.customFields[f.id] ?? ""} onChange={(e) => setCustomField(f.id, e.target.value)} />
                    ) : (
                      <input type={f.type} style={{ ...inputSt, marginTop: 4 }} value={draft.customFields[f.id] ?? ""} onChange={(e) => setCustomField(f.id, e.target.value)} />
                    )}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} style={{ padding: "5px 16px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "var(--font-sm)" }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ padding: "5px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", cursor: "pointer", fontSize: "var(--font-sm)" }}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function GuestsView() {
  const {
    memberships, users, guestFieldSchema, tripId, currentRole,
    inviteUser, updateUser, updateMembershipStatus, updateMemberRole,
    addGuestField, removeGuestField, reorderGuestFields,
  } = useApp();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showSchemaManager, setShowSchemaManager] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = currentRole === "MOH_ADMIN";
  const isDemo = process.env.NEXT_PUBLIC_DATA_MODE !== "supabase";

  const handleGenerateLink = async () => {
    if (!email.trim()) return;
    setInviteError(null);
    setInviteLink(null);
    setCopied(false);

    if (isDemo) {
      // Demo mode: add guest locally and show a placeholder link
      inviteUser(email.trim(), email.trim());
      setInviteLink(`${window.location.origin}/invite?token=demo-token-placeholder`);
      setEmail("");
      return;
    }

    try {
      setInviteLoading(true);
      const res = await fetch(`/api/trips/${tripId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await res.json() as { link?: string; error?: string; };
      if (!res.ok) {
        setInviteError(payload.error ?? "Failed to generate invite link.");
        return;
      }
      setInviteLink(payload.link ?? null);
      setEmail("");
    } catch {
      setInviteError("Unable to generate invite link right now.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = () => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // fixed cols: Guest, Email, Role, RSVP, ...custom, Actions
  const colSpan = 4 + guestFieldSchema.length + 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700 }}>Guests</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSchemaManager((v) => !v)}
            style={{ padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: showSchemaManager ? "var(--color-bg-muted)" : "var(--color-bg-surface)", fontWeight: 500, cursor: "pointer", fontSize: "var(--font-sm)" }}
          >
            ⚙️ Manage Fields{guestFieldSchema.length > 0 ? ` (${guestFieldSchema.length})` : ""}
          </button>
          {isAdmin && (
            <button
              onClick={() => { setShowInviteForm((v) => !v); setInviteLink(null); setInviteError(null); }}
              style={{ padding: "8px 20px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 500, cursor: "pointer" }}
            >
              + Add Guest
            </button>
          )}
        </div>
      </div>

      {showSchemaManager && (
        <SchemaManager schema={guestFieldSchema} onAdd={addGuestField} onRemove={removeGuestField} onReorder={reorderGuestFields} onClose={() => setShowSchemaManager(false)} />
      )}

      {/* Invite link form (admin only) */}
      {showInviteForm && isAdmin && (
        <div style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
          {!inviteLink ? (
            <>
              <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 12 }}>Generate an invite link for a specific guest</p>
              <div className="flex gap-3 flex-wrap items-end">
                <label style={{ flex: "1 1 220px", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Guest email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@gmail.com"
                    style={{ ...inputSt, marginTop: 4 }}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleGenerateLink(); }}
                    autoFocus
                  />
                </label>
                <div className="flex gap-2" style={{ paddingBottom: 1 }}>
                  <button
                    onClick={() => void handleGenerateLink()}
                    disabled={inviteLoading || !email.trim()}
                    style={{ padding: "6px 18px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: (inviteLoading || !email.trim()) ? "not-allowed" : "pointer", fontSize: "var(--font-sm)", opacity: (inviteLoading || !email.trim()) ? 0.6 : 1 }}
                  >
                    {inviteLoading ? "Generating..." : "Generate Link"}
                  </button>
                  <button onClick={() => setShowInviteForm(false)} style={{ padding: "6px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", cursor: "pointer", fontSize: "var(--font-sm)" }}>Cancel</button>
                </div>
              </div>
              <p style={{ marginTop: 10, color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
                The link is locked to this email address. Only a user signed into Google with that email can redeem it.
              </p>
              {inviteError && <p style={{ marginTop: 10, color: "#dc2626", fontSize: "var(--font-sm)" }}>{inviteError}</p>}
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 8, color: "#15803d" }}>Invite link ready — copy and share it manually</p>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  readOnly
                  value={inviteLink}
                  style={{ ...inputSt, flex: "1 1 300px", background: "var(--color-bg-muted)", color: "var(--color-text-secondary)", fontFamily: "monospace", fontSize: 12 }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  style={{ padding: "6px 18px", borderRadius: "var(--radius-md)", background: copied ? "#15803d" : "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "var(--font-sm)", transition: "background 0.2s" }}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={() => { setInviteLink(null); setShowInviteForm(false); }}
                  style={{ padding: "6px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", cursor: "pointer", fontSize: "var(--font-sm)" }}
                >
                  Done
                </button>
              </div>
              <p style={{ marginTop: 8, color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
                Link expires in 30 days. Generating a new link for the same email replaces the previous one.
              </p>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {memberships.length === 0 ? (
        <EmptyState message="No guests yet" actionLabel="Invite your first guest" onAction={() => setShowInviteForm(true)} />
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--color-bg-surface)" }}>
            <thead>
              <tr>
                <th style={headCellSt}>Guest</th>
                <th style={headCellSt}>Email</th>
                <th style={headCellSt}>Role</th>
                <th style={headCellSt}>Status</th>
                {guestFieldSchema.map((f) => (
                  <th key={f.id} style={headCellSt}>{f.label}</th>
                ))}
                <th style={{ ...headCellSt, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m: Membership) => {
                const user = users.find((u: User) => u.id === m.userId);
                if (!user) return null;
                return (
                  <GuestTableRow
                    key={m.userId}
                    user={user}
                    membership={m}
                    fieldSchema={guestFieldSchema}
                    colSpan={colSpan}
                    onStatusChange={(status) => updateMembershipStatus(m.userId, status)}
                    onSave={({ name, email, role, accountStatus, customFields }) => {
                      updateUser(m.userId, { name, email, customFields });
                      updateMemberRole(m.userId, role);
                      updateMembershipStatus(m.userId, accountStatus);
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

