"use client";

import { Badge, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { Poll, PollVisibility } from "@/lib/data";
import { useMemo, useState } from "react";
import { HiOutlinePlus, HiOutlineX } from "react-icons/hi";

function didUserVote(poll: Poll, userId: string): boolean {
  return poll.options.some((option) => option.voterUserIds.includes(userId));
}

function getUserVoteOptionIds(poll: Poll, userId: string): string[] {
  return poll.options
    .filter((option) => option.voterUserIds.includes(userId))
    .map((option) => option.id);
}

function makeOptionId() {
  return `opt-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function toHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseOptionPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const typed = value as { min?: unknown; max?: unknown };
    if (typeof typed.min === "number" && Number.isFinite(typed.min)) return typed.min;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parsePriceInput(rawValue: string): {
  isValid: boolean;
  pricePerPerson?: number;
  pricePerPersonMin?: number;
  pricePerPersonMax?: number;
} {
  const raw = rawValue.trim();
  if (!raw) return { isValid: true };
  const normalized = raw
    .replace(/[–—]/g, "-")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const rangeMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (rangeMatch) {
    const min = Number.parseFloat(rangeMatch[1]);
    const max = Number.parseFloat(rangeMatch[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      return { isValid: false };
    }
    return { isValid: true, pricePerPersonMin: min, pricePerPersonMax: max };
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return { isValid: false };
  return { isValid: true, pricePerPerson: parsed };
}

function getPriceInputValue(option: {
  pricePerPerson?: unknown;
  pricePerPersonMin?: unknown;
  pricePerPersonMax?: unknown;
}): string {
  const min = typeof option.pricePerPersonMin === "number" ? option.pricePerPersonMin : null;
  const max = typeof option.pricePerPersonMax === "number" ? option.pricePerPersonMax : null;
  if (min !== null && max !== null) return `${min}-${max}`;
  const single = parseOptionPrice(option.pricePerPerson);
  return single === null ? "" : String(single);
}

function getPriceDisplay(option: {
  pricePerPerson?: unknown;
  pricePerPersonMin?: unknown;
  pricePerPersonMax?: unknown;
}): string | null {
  const min = typeof option.pricePerPersonMin === "number" && Number.isFinite(option.pricePerPersonMin)
    ? option.pricePerPersonMin
    : null;
  const max = typeof option.pricePerPersonMax === "number" && Number.isFinite(option.pricePerPersonMax)
    ? option.pricePerPersonMax
    : null;
  if (min !== null && max !== null) {
    return `$${min.toFixed(2)} - $${max.toFixed(2)} / person`;
  }
  const single = parseOptionPrice(option.pricePerPerson);
  if (single !== null) return `$${single.toFixed(2)} / person`;
  return null;
}

export function PollsView() {
  const {
    polls,
    users,
    currentUserId,
    currentRole,
    addPoll,
    updatePoll,
    deletePoll,
  } = useApp();

  const isAdmin = currentRole === "MOH_ADMIN";
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [confirmDeletePollId, setConfirmDeletePollId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [visibility, setVisibility] = useState<PollVisibility>("public");
  const [voteLimitMode, setVoteLimitMode] = useState<"single" | "multiple">("single");
  const [maxVotesInput, setMaxVotesInput] = useState("2");
  const [options, setOptions] = useState<Array<{ id?: string; label: string; link: string; pricePerPerson: string }>>([
    { label: "", link: "", pricePerPerson: "" },
    { label: "", link: "", pricePerPerson: "" },
  ]);
  const [requiredUserIds, setRequiredUserIds] = useState<string[]>([]);

  const pollFeed = useMemo(
    () => [...polls].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [polls],
  );
  const selectedResponders = useMemo(
    () => users.filter((user) => requiredUserIds.includes(user.id)),
    [users, requiredUserIds],
  );
  const availableResponders = useMemo(
    () => users.filter((user) => !requiredUserIds.includes(user.id)),
    [users, requiredUserIds],
  );
  const hasInvalidPrice = options.some((option) => {
    const parsed = parsePriceInput(option.pricePerPerson);
    return !parsed.isValid;
  });
  const parsedMaxVotesInput = Number.parseInt(maxVotesInput, 10);
  const maxVotesPerUser = voteLimitMode === "single"
    ? 1
    : (Number.isFinite(parsedMaxVotesInput) && parsedMaxVotesInput >= 2 ? parsedMaxVotesInput : 0);
  const hasInvalidVoteLimit = voteLimitMode === "multiple" && maxVotesPerUser < 2;
  const isEditing = editingPollId !== null;
  const minOptionsCount = options.map((opt) => opt.label.trim()).filter(Boolean).length;
  const isPollFormInvalid = hasInvalidPrice || hasInvalidVoteLimit || !question.trim() || minOptionsCount < 2;

  const resetCreateForm = () => {
    setEditingPollId(null);
    setQuestion("");
    setVisibility("public");
    setVoteLimitMode("single");
    setMaxVotesInput("2");
    setOptions([
      { label: "", link: "", pricePerPerson: "" },
      { label: "", link: "", pricePerPerson: "" },
    ]);
    setRequiredUserIds([]);
  };

  const closePollModal = () => {
    setShowCreateModal(false);
    resetCreateForm();
  };

  const onOpenCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const onOpenEditModal = (poll: Poll) => {
    setEditingPollId(poll.id);
    setQuestion(poll.question);
    setVisibility(poll.visibility);
    const existingMaxVotesPerUser = Number.isFinite(poll.maxVotesPerUser)
      ? Math.max(1, Math.floor(poll.maxVotesPerUser))
      : 1;
    setVoteLimitMode(existingMaxVotesPerUser > 1 ? "multiple" : "single");
    setMaxVotesInput(existingMaxVotesPerUser > 1 ? String(existingMaxVotesPerUser) : "2");
    setRequiredUserIds([...poll.requiredUserIds]);
    setOptions(
      poll.options.map((option) => ({
        id: option.id,
        label: option.label,
        link: option.link ?? "",
        pricePerPerson: getPriceInputValue(option as {
          pricePerPerson?: unknown;
          pricePerPersonMin?: unknown;
          pricePerPersonMax?: unknown;
        }),
      })),
    );
    setShowCreateModal(true);
  };

  const onCreatePoll = (isPublished: boolean) => {
    const cleanQuestion = question.trim();
    const cleanOptions = options
      .map((option) => ({
        ...parsePriceInput(option.pricePerPerson),
        id: makeOptionId(),
        label: option.label.trim(),
        voterUserIds: [],
        link: option.link.trim() ? toHref(option.link) : undefined,
      }))
      .filter((option) => option.label && option.isValid)
      .map(({ isValid: _isValid, ...option }) => option);

    if (!isAdmin || !cleanQuestion || cleanOptions.length < 2) return;

    addPoll({
      question: cleanQuestion,
      createdByUserId: currentUserId,
      options: cleanOptions,
      isClosed: false,
      isPublished,
      maxVotesPerUser,
      visibility,
      requiredUserIds,
      createdAt: new Date().toISOString(),
    });

    resetCreateForm();
    setShowCreateModal(false);
  };

  const onSavePollEdits = () => {
    if (!isAdmin || !editingPollId) return;
    const sourcePoll = polls.find((poll) => poll.id === editingPollId);
    if (!sourcePoll) return;

    const existingById = new Map(sourcePoll.options.map((option) => [option.id, option]));
    const cleanQuestion = question.trim();
    const cleanOptions = options
      .map((option) => {
        const id = option.id ?? makeOptionId();
        const existing = existingById.get(id);
        return {
          ...parsePriceInput(option.pricePerPerson),
          id,
          label: option.label.trim(),
          voterUserIds: existing?.voterUserIds ?? [],
          link: option.link.trim() ? toHref(option.link) : undefined,
        };
      })
      .filter((option) => option.label && option.isValid)
      .map(({ isValid: _isValid, ...option }) => option);

    if (!cleanQuestion || cleanOptions.length < 2) return;

    updatePoll(editingPollId, {
      question: cleanQuestion,
      options: cleanOptions,
      maxVotesPerUser,
      visibility,
      requiredUserIds,
    });
    closePollModal();
  };

  const onVote = (poll: Poll, optionId: string) => {
    if (poll.isClosed || !poll.isPublished) return;
    const selectedOptionIds = new Set(getUserVoteOptionIds(poll, currentUserId));
    const pollMaxVotes = Number.isFinite(poll.maxVotesPerUser)
      ? Math.max(1, Math.floor(poll.maxVotesPerUser))
      : 1;
    if (selectedOptionIds.has(optionId)) {
      selectedOptionIds.delete(optionId);
    } else if (selectedOptionIds.size < pollMaxVotes) {
      selectedOptionIds.add(optionId);
    } else {
      return;
    }
    const nextOptions = poll.options.map((option) => ({
      ...option,
      voterUserIds: option.voterUserIds.filter((id) => id !== currentUserId),
    })).map((option) => (
      selectedOptionIds.has(option.id)
        ? { ...option, voterUserIds: [...option.voterUserIds, currentUserId] }
        : option
    ));
    updatePoll(poll.id, { options: nextOptions });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
            Group decisions, anonymous or public voting, and required responders.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={onOpenCreateModal}
            style={primaryButtonStyle}
          >
            Create poll
          </button>
        )}
      </div>

      {pollFeed.length === 0 ? (
        <EmptyState message="No polls yet" />
      ) : (
        <div className="flex flex-col gap-3" style={{ width: "min(900px, 100%)", marginInline: "auto" }}>
          {pollFeed.map((poll) => {
            const totalVotes = poll.options.reduce((sum, option) => sum + option.voterUserIds.length, 0);
            const selectedOptionIds = new Set(getUserVoteOptionIds(poll, currentUserId));
            const pollMaxVotes = Number.isFinite(poll.maxVotesPerUser)
              ? Math.max(1, Math.floor(poll.maxVotesPerUser))
              : 1;
            const requiredSet = new Set(poll.requiredUserIds);
            const requiredCount = requiredSet.size;
            const requiredDone = poll.requiredUserIds.filter((userId) => didUserVote(poll, userId)).length;
            const isCurrentUserRequired = requiredSet.has(currentUserId);
            const creator = users.find((u) => u.id === poll.createdByUserId);

            return (
              <Card key={poll.id} style={{ width: "100%" }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700 }}>{poll.question}</h3>
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6 }}>
                      <Badge variant={poll.isClosed ? "neutral" : "accent"}>
                        {poll.isClosed ? "Closed" : "Open"}
                      </Badge>
                      {isAdmin && (
                        <Badge variant={poll.isPublished ? "accent" : "neutral"}>
                          {poll.isPublished ? "Published" : "Draft"}
                        </Badge>
                      )}
                      <Badge variant="neutral">
                        {poll.visibility === "anonymous" ? "Anonymous voting" : "Public voting"}
                      </Badge>
                      <Badge variant="neutral">
                        {pollMaxVotes === 1 ? "1 vote per person" : `Up to ${pollMaxVotes} votes per person`}
                      </Badge>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
                        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", marginTop: 6 }}>
                      Created by {creator?.name ?? "Unknown"} on{" "}
                      {new Date(poll.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {requiredCount > 0 && (
                      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)", marginTop: 4 }}>
                        Required responses: {requiredDone}/{requiredCount}
                        {isCurrentUserRequired && !didUserVote(poll, currentUserId) ? " · awaiting your vote" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                      <button
                        onClick={() => onOpenEditModal(poll)}
                        style={secondaryButtonStyle}
                      >
                        Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => updatePoll(poll.id, { isPublished: !poll.isPublished })}
                        style={secondaryButtonStyle}
                      >
                        {poll.isPublished ? "Move to draft" : "Publish"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => updatePoll(poll.id, { isClosed: !poll.isClosed })}
                        style={secondaryButtonStyle}
                      >
                        {poll.isClosed ? "Reopen" : "Close"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDeletePollId(poll.id)}
                        style={{ ...secondaryButtonStyle, color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2" style={{ marginTop: 14 }}>
                  {poll.options.map((option) => {
                    const voteCount = option.voterUserIds.length;
                    const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const isSelected = selectedOptionIds.has(option.id);
                    const priceDisplay = getPriceDisplay(option as {
                      pricePerPerson?: unknown;
                      pricePerPersonMin?: unknown;
                      pricePerPersonMax?: unknown;
                    });
                    const publicNames = users
                      .filter((user) => option.voterUserIds.includes(user.id))
                      .map((user) => user.name);

                    const isAtVoteLimit = selectedOptionIds.size >= pollMaxVotes;
                    const isVotingDisabled = poll.isClosed || !poll.isPublished || (!isSelected && isAtVoteLimit);
                    return (
                      <button
                        key={option.id}
                        onClick={() => onVote(poll, option.id)}
                        disabled={isVotingDisabled}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
                          borderRadius: "var(--radius-md)",
                          background: "var(--color-bg-surface)",
                          padding: 10,
                          cursor: isVotingDisabled ? "not-allowed" : "pointer",
                          opacity: isVotingDisabled ? 0.85 : 1,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {option.link ? (
                            <a
                              href={toHref(option.link)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontWeight: 600,
                                fontSize: "var(--font-md)",
                                color: "var(--color-accent)",
                                textDecoration: "underline",
                              }}
                            >
                              <span>{option.label}</span>
                              <span aria-hidden="true" style={{ fontSize: "0.9em", lineHeight: 1 }}>↗</span>
                            </a>
                          ) : (
                            <span style={{ fontWeight: 600, fontSize: "var(--font-md)" }}>{option.label}</span>
                          )}
                          <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
                            {voteCount} ({pct}%)
                          </span>
                        </div>
                        {priceDisplay && (
                          <p style={{ marginTop: 6, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                            {priceDisplay}
                          </p>
                        )}
                        <div
                          style={{
                            width: "100%",
                            height: 8,
                            background: "var(--color-bg-muted)",
                            borderRadius: "var(--radius-pill)",
                            marginTop: 8,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "var(--color-accent)",
                              transition: "width 0.2s ease",
                            }}
                          />
                        </div>
                        {poll.visibility === "public" && publicNames.length > 0 && (
                          <p style={{ marginTop: 8, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                            Voted: {publicNames.join(", ")}
                          </p>
                        )}
                        {poll.visibility === "anonymous" && voteCount > 0 && (
                          <p style={{ marginTop: 8, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                            Voters hidden for anonymous poll
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!poll.isPublished && (
                  <p style={{ marginTop: 8, fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                    This poll is in draft mode and not visible to guests.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showCreateModal && isAdmin && (
        <div
          onClick={closePollModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 250,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(860px, 96vw)",
              maxHeight: "88vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                background: "var(--color-bg-surface)",
                borderBottom: "1px solid var(--color-border)",
                padding: "14px 18px",
              }}
            >
              <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700 }}>
                {isEditing ? "Edit Poll" : "Create Poll"}
              </h3>
              <button
                onClick={closePollModal}
                style={{ ...secondaryButtonStyle, lineHeight: 1, paddingInline: 12 }}
              >
                Close
              </button>
            </div>

            <div
              className="flex flex-col gap-3"
              style={{
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                padding: "16px 18px",
                minHeight: 0,
                flex: 1,
              }}
            >
              <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                Question
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Where should we do brunch?"
                  style={inputStyle}
                />
              </label>

              <div>
                <p style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 6 }}>Options</p>
                <div className="flex flex-col gap-2">
                  {options.map((option, idx) => (
                    <div key={option.id ?? idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="grid gap-2 w-full sm:grid-cols-2 md:grid-cols-3" style={{ flex: 1 }}>
                        <input
                          value={option.label}
                          onChange={(e) => setOptions((prev) => prev.map((item, i) => i === idx ? { ...item, label: e.target.value } : item))}
                          placeholder={`Option ${idx + 1}`}
                          style={{ ...inputStyle, marginTop: 0 }}
                        />
                        <input
                          value={option.link}
                          onChange={(e) => setOptions((prev) => prev.map((item, i) => i === idx ? { ...item, link: e.target.value } : item))}
                          placeholder="Option link (optional)"
                          style={{ ...inputStyle, marginTop: 0 }}
                        />
                        <input
                          value={option.pricePerPerson}
                          onChange={(e) => setOptions((prev) => prev.map((item, i) => i === idx ? { ...item, pricePerPerson: e.target.value } : item))}
                          placeholder="Price / person (e.g. 45 or 45-70)"
                          style={{ ...inputStyle, marginTop: 0 }}
                        />
                      </div>
                      {options.length > 2 && (
                        <button
                          onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                          style={secondaryButtonStyle}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setOptions((prev) => [...prev, { id: makeOptionId(), label: "", link: "", pricePerPerson: "" }])}
                    style={secondaryButtonStyle}
                  >
                    + Add option
                  </button>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Vote mode
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as PollVisibility)}
                    style={{ ...inputStyle, minWidth: 210 }}
                  >
                    <option value="public">Public (show who voted)</option>
                    <option value="anonymous">Anonymous (hide names)</option>
                  </select>
                </label>
                <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  Votes per person
                  <select
                    value={voteLimitMode}
                    onChange={(e) => setVoteLimitMode(e.target.value as "single" | "multiple")}
                    style={{ ...inputStyle, minWidth: 210 }}
                  >
                    <option value="single">One vote only</option>
                    <option value="multiple">Allow multiple votes</option>
                  </select>
                </label>
                {voteLimitMode === "multiple" && (
                  <label style={{ fontSize: "var(--font-sm)", fontWeight: 600 }}>
                    Max votes
                    <input
                      type="number"
                      min={2}
                      step={1}
                      value={maxVotesInput}
                      onChange={(e) => setMaxVotesInput(e.target.value)}
                      placeholder="2"
                      style={{ ...inputStyle, minWidth: 140 }}
                    />
                  </label>
                )}
              </div>

              <div>
                <p style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 6 }}>
                  Required responders
                </p>
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
                  {selectedResponders.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setRequiredUserIds((prev) => prev.filter((id) => id !== user.id))}
                      style={selectedResponderChipStyle}
                      title={`Remove ${user.name}`}
                    >
                      <Avatar name={user.name} color={user.avatarColor} size={24} />
                      <span style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{user.name}</span>
                      <HiOutlineX size={17} style={{ color: "rgba(31, 41, 55, 0.7)" }} />
                    </button>
                  ))}
                  {selectedResponders.length === 0 && (
                    <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
                      No required responders selected yet.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableResponders.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setRequiredUserIds((prev) => [...prev, user.id])}
                      style={addResponderChipStyle}
                      title={`Add ${user.name}`}
                    >
                      <HiOutlinePlus size={16} />
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "var(--font-xs, 11px)", color: "var(--color-text-secondary)", marginTop: 6 }}>
                  Leave empty to make this poll optional for everyone.
                </p>
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-2"
              style={{
                background: "var(--color-bg-surface)",
                borderTop: "1px solid var(--color-border)",
                padding: "12px 18px calc(12px + env(safe-area-inset-bottom))",
              }}
            >
              <button
                onClick={closePollModal}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
              {isEditing ? (
                <button
                  onClick={onSavePollEdits}
                  disabled={isPollFormInvalid}
                  style={{
                    ...primaryButtonStyle,
                    opacity: isPollFormInvalid ? 0.6 : 1,
                  }}
                >
                  Save changes
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onCreatePoll(false)}
                    disabled={isPollFormInvalid}
                    style={{
                      ...secondaryButtonStyle,
                      opacity: isPollFormInvalid ? 0.6 : 1,
                    }}
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => onCreatePoll(true)}
                    disabled={isPollFormInvalid}
                    style={{
                      ...primaryButtonStyle,
                      opacity: isPollFormInvalid ? 0.6 : 1,
                    }}
                  >
                    Create & publish
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeletePollId && (
        <div
          onClick={() => setConfirmDeletePollId(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 260,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 94vw)",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              padding: "20px 20px",
            }}
          >
            <h4 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 8 }}>
              Delete poll?
            </h4>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2" style={{ marginTop: 16 }}>
              <button onClick={() => setConfirmDeletePollId(null)} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button
                onClick={() => {
                  deletePoll(confirmDeletePollId);
                  setConfirmDeletePollId(null);
                }}
                style={{ ...dangerButtonStyle }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-sm)" }}>
          Only admins can create, publish, or close polls.
        </p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  fontSize: "16px",
};

const secondaryButtonStyle: React.CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  color: "var(--color-text-primary)",
  fontSize: "var(--font-sm)",
  padding: "6px 10px",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  padding: "8px 14px",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  padding: "6px 12px",
  cursor: "pointer",
};

const selectedResponderChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "#d9c7f0",
  color: "#111827",
  cursor: "pointer",
};

const addResponderChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px dashed var(--color-border)",
  background: "var(--color-bg-surface)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-sm)",
  cursor: "pointer",
};
