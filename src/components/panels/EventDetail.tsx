"use client";

import { Avatar, Badge, eventStatusVariant } from "@/components/ui";
import type { BudgetItem, EventStatus, Task, TripEvent, User } from "@/lib/data";
import { formatCurrency } from "@/lib/domain";
import { useState } from "react";
import { HiPencilAlt } from "react-icons/hi";
import { IoIosCheckboxOutline } from "react-icons/io";
import { FaLocationDot } from "react-icons/fa6";
import { PiMoneyBold } from "react-icons/pi";
import { PiUsersBold } from "react-icons/pi";

interface EventDetailProps {
  event: TripEvent;
  budgetItem?: BudgetItem;
  relatedTasks: Task[];
  allUsers: User[];
  onNavigate: (type: "task" | "budget", id: string) => void;
  onToggleAttendee: (userId: string) => void;
  onUpdate: (patch: Partial<TripEvent>) => void;
  canDelete: boolean;
  linkedDeleteCount: number;
  onDeleteOnly: () => void;
  onDeleteLinked: () => void;
}

const EVENT_STATUSES: EventStatus[] = ["DRAFT", "PLANNED", "CONFIRMED", "CANCELED"];

function formatCompactTime(date: Date) {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "\u00A0");
}

function addHoursToLocalDatetime(localDatetime: string, hours: number): string {
  const parsed = new Date(localDatetime);
  if (Number.isNaN(parsed.getTime())) return localDatetime;
  parsed.setHours(parsed.getHours() + hours);
  return toLocalDatetime(parsed.toISOString());
}

export function EventDetail({
  event,
  budgetItem,
  relatedTasks,
  allUsers,
  onNavigate,
  onToggleAttendee,
  onUpdate,
  canDelete,
  linkedDeleteCount,
  onDeleteOnly,
  onDeleteLinked,
}: EventDetailProps) {
  function toDraft(ev: TripEvent) {
    return {
      title: ev.title,
      location: ev.location,
      description: ev.description,
      status: ev.status,
      startAt: toLocalDatetime(ev.startAt),
      endAt: ev.endAt ? toLocalDatetime(ev.endAt) : "",
      provider: ev.provider ?? "",
      confirmationCode: ev.confirmationCode ?? "",
    };
  }

  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(event));

  const handleEdit = () => {
    setDraft(toDraft(event));
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = () => {
    onUpdate({
      title: draft.title.trim() || event.title,
      location: draft.location.trim(),
      description: draft.description.trim(),
      status: draft.status,
      startAt: draft.startAt ? new Date(draft.startAt).toISOString() : event.startAt,
      endAt: draft.endAt ? new Date(draft.endAt).toISOString() : undefined,
      // Send explicit empty strings so PATCH clears DB values instead of skipping keys.
      provider: draft.provider.trim(),
      confirmationCode: draft.confirmationCode.trim(),
    });
    setEditing(false);
  };

  const startDate = new Date(event.startAt);
  const endDate = event.endAt ? new Date(event.endAt) : null;
  const duration =
    endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
      : null;

  const attendeeIds = event.attendeeUserIds ?? [];
  const attendees = allUsers.filter((u) => attendeeIds.includes(u.id));
  const nonAttendees = allUsers.filter((u) => !attendeeIds.includes(u.id));

  // ---- EDIT MODE ----
  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 style={{ fontWeight: 700, fontSize: "var(--font-lg)" }}>Edit Event</h3>
          <div className="flex gap-2">
            <button onClick={handleSave} style={saveBtnStyle}>Save</button>
            <button onClick={handleCancel} style={cancelBtnStyle}>Cancel</button>
          </div>
        </div>

        <label style={labelStyle}>
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Status
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as EventStatus })}
            style={inputStyle}
          >
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Location
          <input
            type="text"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Venue or address"
            style={inputStyle}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label style={labelStyle}>
            Start
            <input
              type="datetime-local"
              value={draft.startAt}
              onChange={(e) => {
                const newStart = e.target.value;
                setDraft((d) => ({
                  ...d,
                  startAt: newStart,
                  // if end is empty or before the new start, keep it at least 1 hour after start
                  endAt: d.endAt && d.endAt >= newStart ? d.endAt : addHoursToLocalDatetime(newStart, 1),
                }));
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            End <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>(optional)</span>
            <input
              type="datetime-local"
              value={draft.endAt}
              min={draft.startAt}
              onFocus={() => {
                if (!draft.endAt && draft.startAt) {
                  setDraft((d) => ({ ...d, endAt: addHoursToLocalDatetime(d.startAt, 1) }));
                }
              }}
              onChange={(e) => setDraft((d) => ({ ...d, endAt: e.target.value }))}
              style={inputStyle}
            />
          </label>
        </div>

        <label style={labelStyle}>
          Description
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-muted)",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 8 }}>
            🎫 Reservation
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label style={labelStyle}>
              Provider
              <input
                type="text"
                value={draft.provider}
                onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
                placeholder="e.g. OpenTable"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Confirmation Code
              <input
                type="text"
                value={draft.confirmationCode}
                onChange={(e) => setDraft({ ...draft, confirmationCode: e.target.value })}
                placeholder="e.g. ABC123"
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", padding: "4px 10px", background: "var(--color-bg-muted)", borderRadius: "var(--radius-md)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <PiMoneyBold size={14} />
          <span>Cost is managed in the linked budget item.</span>
        </p>

        {/* Attendees (live, not part of draft) */}
        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Attending</p>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attendees.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1"
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--color-accent-soft)",
                    fontSize: "var(--font-sm)",
                    fontWeight: 500,
                  }}
                >
                  <Avatar name={u.name} color={u.avatarColor} size={20} />
                  {u.name}
                  <button
                    onClick={() => onToggleAttendee(u.id)}
                    style={{ marginLeft: 2, fontSize: "var(--font-xs)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "0 2px", lineHeight: 1 }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          {nonAttendees.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nonAttendees.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onToggleAttendee(u.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px dashed var(--color-border)",
                    background: "var(--color-bg-surface)",
                    fontSize: "var(--font-sm)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Avatar name={u.name} color={u.avatarColor} size={18} />
                  <span>+ {u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- VIEW MODE ----
  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 style={{ fontSize: "var(--font-xl)", fontWeight: 700, marginBottom: 8 }}>
              {event.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={eventStatusVariant(event.status)}>{event.status}</Badge>
              <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", whiteSpace: "nowrap" }}>
                · {startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", whiteSpace: "nowrap" }}>
                · {formatCompactTime(startDate)}
                {endDate && <>{" – "}{formatCompactTime(endDate)}</>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button onClick={() => setShowDeleteModal(true)} style={dangerOutlineBtnStyle}>Delete</button>
            )}
            <button onClick={handleEdit} style={editBtnStyle} title="Edit" aria-label="Edit">
              <HiPencilAlt size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {event.location && (
            <span style={factChipStyle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FaLocationDot size={14} />
                <span>{event.location}</span>
              </span>
            </span>
          )}
          {duration !== null && <span style={factChipStyle}>⏱ {duration}h</span>}
          {attendees.length > 0 && (
            <span style={factChipStyle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PiUsersBold size={14} />
                <span>{attendees.length} attending</span>
              </span>
            </span>
          )}
        </div>

        {(event.provider || event.confirmationCode) && (
          <div style={{ background: "var(--color-accent-soft)", borderRadius: "var(--radius-md)", padding: "12px 16px", border: "1px solid var(--color-accent)" }}>
            <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", marginBottom: 6 }}>🎫 Reservation</p>
            <div className="flex flex-wrap gap-4">
              {event.provider && <span style={{ fontSize: "var(--font-sm)" }}><strong>Provider:</strong> {event.provider}</span>}
              {event.confirmationCode && (
                <span style={{ fontSize: "var(--font-sm)" }}>
                  <strong>Code:</strong>{" "}
                  <code style={{ background: "var(--color-bg-muted)", padding: "2px 6px", borderRadius: 4 }}>{event.confirmationCode}</code>
                </span>
              )}
            </div>
          </div>
        )}

        {budgetItem ? (
          <div style={{ background: "var(--color-bg-muted)", borderRadius: "var(--radius-md)", padding: "var(--space-md)" }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontWeight: 600, fontSize: "var(--font-sm)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PiMoneyBold size={14} />
                <span>Cost</span>
              </p>
              <div className="flex gap-2">
                {(budgetItem.splitType ?? "even") === "even" ? (
                  <Badge variant="accent">Even split</Badge>
                ) : (
                  <Badge variant="warning">Custom split</Badge>
                )}
                <button
                  onClick={() => onNavigate("budget", budgetItem.id)}
                  style={{ ...linkChipStyle, fontSize: "var(--font-xs)", padding: "3px 8px" }}
                >
                  View budget →
                </button>
              </div>
            </div>

            {(budgetItem.splitType ?? "even") === "even" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Planned</p>
                  <p style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(budgetItem.plannedAmount)}</p>
                  {attendees.length > 0 && (
                    <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                      {formatCurrency(budgetItem.plannedAmount / attendees.length)}/person
                    </p>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Actual</p>
                  <p style={{ fontSize: 20, fontWeight: 700 }}>
                    {budgetItem.actualAmount > 0 ? formatCurrency(budgetItem.actualAmount) : "—"}
                  </p>
                  {budgetItem.actualAmount > 0 && attendees.length > 0 && (
                    <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                      {formatCurrency(budgetItem.actualAmount / attendees.length)}/person
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "1fr 70px 70px", borderBottom: "1px solid var(--color-border)", paddingBottom: 6, marginBottom: 4 }}
                >
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)" }}>Person</span>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>Planned</span>
                  <span style={{ fontSize: "var(--font-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>Actual</span>
                </div>
                {attendees.map((u) => (
                  <div key={u.id} className="grid gap-3 items-center py-1" style={{ gridTemplateColumns: "1fr 70px 70px", borderBottom: "1px solid var(--color-border)" }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} color={u.avatarColor} size={20} />
                      <span style={{ fontSize: "var(--font-sm)" }}>{u.name}</span>
                    </div>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 500, textAlign: "right" }}>
                      {budgetItem.plannedSplits?.[u.id] ? formatCurrency(budgetItem.plannedSplits[u.id]) : "—"}
                    </span>
                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 500, textAlign: "right" }}>
                      {budgetItem.actualSplits?.[u.id] ? formatCurrency(budgetItem.actualSplits[u.id]) : "—"}
                    </span>
                  </div>
                ))}
                <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: "1fr 70px 70px" }}>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, textAlign: "right" }}>{formatCurrency(budgetItem.plannedAmount)}</span>
                  <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, textAlign: "right" }}>{budgetItem.actualAmount > 0 ? formatCurrency(budgetItem.actualAmount) : "—"}</span>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Attending</p>
          {attendees.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {attendees.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1" style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", background: "var(--color-accent-soft)", fontSize: "var(--font-sm)", fontWeight: 500 }}>
                  <Avatar name={u.name} color={u.avatarColor} size={20} />
                  {u.name}
                  <button onClick={() => onToggleAttendee(u.id)} style={{ marginLeft: 2, fontSize: "var(--font-xs)", color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }} title="Remove from event">✕</button>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 8 }}>No attendees selected yet.</p>
          )}
          {nonAttendees.length > 0 && (
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginBottom: 6 }}>Add attendees:</p>
              <div className="flex flex-wrap gap-2">
                {nonAttendees.map((u) => (
                  <button key={u.id} onClick={() => onToggleAttendee(u.id)} style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", border: "1px dashed var(--color-border)", background: "var(--color-bg-surface)", fontSize: "var(--font-sm)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Avatar name={u.name} color={u.avatarColor} size={18} />
                    <span>+ {u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {event.description && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Description</p>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-md)", lineHeight: 1.5, whiteSpace: "pre-line", wordBreak: "break-word" }}>{event.description}</p>
          </div>
        )}

        {(budgetItem || relatedTasks.length > 0) && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Linked Items</p>
            <div className="flex flex-wrap gap-2">
              {budgetItem && (
                <button onClick={() => onNavigate("budget", budgetItem.id)} style={linkChipStyle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <PiMoneyBold size={14} />
                    <span>{budgetItem.title}</span>
                  </span>
                </button>
              )}
              {relatedTasks.map((t) => (
                <button key={t.id} onClick={() => onNavigate("task", t.id)} style={linkChipStyle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IoIosCheckboxOutline size={15} />
                    <span>{t.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div style={modalOverlayStyle} onClick={() => setShowDeleteModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 8 }}>Delete Event</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", marginBottom: 16 }}>
              Choose whether to delete only this event or remove the full linked set.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  onDeleteOnly();
                }}
                style={modalOptionOutlineStyle}
              >
                Delete Event Only
              </button>
              {linkedDeleteCount > 0 && (
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    onDeleteLinked();
                  }}
                  style={modalOptionDangerStyle}
                >
                  Delete Event + {linkedDeleteCount} Linked Item{linkedDeleteCount === 1 ? "" : "s"}
                </button>
              )}
            </div>
            <div className="flex justify-end" style={{ marginTop: 16 }}>
              <button onClick={() => setShowDeleteModal(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  fontSize: "var(--font-md)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  display: "block",
};

const factChipStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-bg-muted)",
  fontSize: "var(--font-sm)",
  color: "var(--color-text-secondary)",
};

const linkChipStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-accent-soft)",
  border: "1px solid var(--color-accent)",
  fontSize: "var(--font-sm)",
  cursor: "pointer",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const editBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "var(--radius-md)",
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: "var(--font-sm)",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: "var(--font-sm)",
};

const dangerOutlineBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(220, 38, 38, 0.28)",
  background: "var(--color-bg-surface)",
  color: "var(--color-danger, #dc2626)",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17, 24, 39, 0.38)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "min(420px, 100%)",
  background: "var(--color-bg-surface)",
  borderRadius: "var(--radius-lg)",
  padding: 20,
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
};

const modalOptionDangerStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--color-danger, #dc2626)",
  color: "#fff",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
};

const modalOptionOutlineStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(220, 38, 38, 0.28)",
  background: "var(--color-bg-surface)",
  color: "var(--color-danger, #dc2626)",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
};
