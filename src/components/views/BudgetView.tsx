"use client";

import { Badge, budgetStatusVariant, Card, EmptyState, MultiSelectFilter } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/context";
import type { BudgetCategory, BudgetItem, BudgetItemStatus, TripEvent } from "@/lib/data";
import { formatBudgetLabel, formatCurrency } from "@/lib/domain";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

const cellSt: CSSProperties = {
  padding: "10px 12px",
  fontSize: "var(--font-sm)",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--color-border)",
};

const headCellSt: CSSProperties = {
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

/** Get the attendee user IDs for a budget item (from linked event or explicit list) */
function getItemAttendees(
  item: BudgetItem,
  events: TripEvent[],
  validUserIds: Set<string>,
): string[] {
  const dedupe = (ids: string[] | undefined) =>
    Array.from(new Set((ids ?? []).filter((id) => validUserIds.has(id))));
  if (item.relatedEventId) {
    const ev = events.find((e) => e.id === item.relatedEventId);
    return dedupe(ev?.attendeeUserIds);
  }
  return dedupe(item.splitAttendeeUserIds);
}

/** Compute per-person planned cost for a single budget item */
function perPersonPlanned(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
  validUserIds: Set<string>,
): number {
  if (item.splitType === "custom" && item.plannedSplits?.[userId] != null) {
    return item.plannedSplits[userId];
  }
  const attendees = getItemAttendees(item, events, validUserIds);
  const count = attendees.length || 1;
  return item.plannedAmount / count;
}

/** Compute per-person actual cost for a single budget item */
function perPersonActual(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
  validUserIds: Set<string>,
): number {
  if (item.splitType === "custom" && item.actualSplits?.[userId] != null) {
    return item.actualSplits[userId];
  }
  const attendees = getItemAttendees(item, events, validUserIds);
  const count = attendees.length || 1;
  return item.actualAmount / count;
}

/** Check if a user is involved in this budget item */
function isUserInvolved(
  item: BudgetItem,
  userId: string,
  events: TripEvent[],
  validUserIds: Set<string>,
): boolean {
  if (item.paidByUserId === userId) return true;
  if (item.responsibleUserId === userId) return true;
  const attendees = getItemAttendees(item, events, validUserIds);
  if (attendees.includes(userId)) return true;
  // If no attendees defined, item applies to everyone
  if (attendees.length === 0) return true;
  return false;
}

export function BudgetView() {
  const { budgetItems, users, events, openPanel } = useApp();
  const participantValues = useMemo(() => users.map((user) => user.id), [users]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<BudgetCategory[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<BudgetItemStatus[]>([]);
  const [sortField, setSortField] = useState<"title" | "category" | "planned" | "actual" | "paidBy" | "status">("planned");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const validUserIds = useMemo(() => new Set(users.map((user) => user.id)), [users]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(budgetItems.map((item) => item.category))).sort(),
    [budgetItems],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(budgetItems.map((item) => item.status))).sort(),
    [budgetItems],
  );

  useEffect(() => {
    setSelectedUserIds((prev) => {
      if (participantValues.length === 0) return [];
      if (prev.length === 0) return participantValues;
      const next = prev.filter((value) => participantValues.includes(value));
      return next.length === 0 ? participantValues : next;
    });
  }, [participantValues]);

  useEffect(() => {
    setSelectedCategories((prev) => {
      if (categoryOptions.length === 0) return [];
      if (prev.length === 0) return categoryOptions;
      const next = prev.filter((value) => categoryOptions.includes(value));
      return next.length === 0 ? categoryOptions : next;
    });
  }, [categoryOptions]);

  useEffect(() => {
    setSelectedStatuses((prev) => {
      if (statusOptions.length === 0) return [];
      if (prev.length === 0) return statusOptions;
      const next = prev.filter((value) => statusOptions.includes(value));
      return next.length === 0 ? statusOptions : next;
    });
  }, [statusOptions]);

  // Base filter: selected participant
  const baseFilteredItems = useMemo(() => {
    if (selectedUserIds.length >= participantValues.length) return budgetItems;
    return budgetItems.filter((item) =>
      selectedUserIds.some((userId) => isUserInvolved(item, userId, events, validUserIds)));
  }, [budgetItems, events, selectedUserIds, participantValues.length, validUserIds]);

  // Additional filters + sorting
  const displayedItems = useMemo(() => {
    const filtered = baseFilteredItems.filter((item) => {
      if (selectedCategories.length < categoryOptions.length && !selectedCategories.includes(item.category)) return false;
      if (selectedStatuses.length < statusOptions.length && !selectedStatuses.includes(item.status)) return false;
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "title") return a.title.localeCompare(b.title) * dir;
      if (sortField === "category") return a.category.localeCompare(b.category) * dir;
      if (sortField === "planned") return (a.plannedAmount - b.plannedAmount) * dir;
      if (sortField === "actual") return (a.actualAmount - b.actualAmount) * dir;
      if (sortField === "status") return a.status.localeCompare(b.status) * dir;
      if (sortField === "paidBy") {
        const aPayer = users.find((u) => u.id === a.paidByUserId)?.name ?? "";
        const bPayer = users.find((u) => u.id === b.paidByUserId)?.name ?? "";
        return aPayer.localeCompare(bPayer) * dir;
      }
      return 0;
    });
    return sorted;
  }, [
    baseFilteredItems,
    selectedCategories,
    selectedStatuses,
    categoryOptions.length,
    statusOptions.length,
    sortField,
    sortDirection,
    users,
  ]);

  const totalPlanned = displayedItems.reduce((s, b) => s + b.plannedAmount, 0);
  const totalActual = displayedItems.reduce((s, b) => s + b.actualAmount, 0);
  const activeFilterCount = [
    selectedUserIds.length < participantValues.length,
    selectedCategories.length < categoryOptions.length,
    selectedStatuses.length < statusOptions.length,
  ].filter(Boolean).length;

  // Per-person summary when a participant is selected
  const summaryUserId = useMemo(() => {
    if (selectedUserIds.length !== 1) return null;
    if (selectedUserIds.length >= participantValues.length) return null;
    return selectedUserIds[0];
  }, [selectedUserIds, participantValues.length]);

  const personSummary = useMemo(() => {
    if (!summaryUserId) return null;
    let owes = 0;
    let paid = 0;
    let plannedShare = 0;
    for (const item of displayedItems) {
      plannedShare += perPersonPlanned(item, summaryUserId, events, validUserIds);
      if (item.actualAmount > 0) {
        owes += perPersonActual(item, summaryUserId, events, validUserIds);
      }
      if (item.paidByUserId === summaryUserId) {
        paid += item.actualAmount;
      }
    }
    return { plannedShare, owes, paid, net: paid - owes };
  }, [displayedItems, events, summaryUserId, validUserIds]);

  const selectedUser = users.find((u) => u.id === summaryUserId);
  const toggleSort = (field: "title" | "category" | "planned" | "actual" | "paidBy" | "status") => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "planned" || field === "actual" ? "desc" : "asc");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>
            {!summaryUserId
              ? `${formatCurrency(totalActual)} spent of ${formatCurrency(totalPlanned)} planned`
              : `Showing ${displayedItems.length} items for ${selectedUser?.name ?? "participant"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            selectedValues={selectedUserIds}
            onChange={setSelectedUserIds}
            allLabel="All Participants"
            countLabelPlural="Participants"
            countLabelSingular="Participant"
          />

          <MultiSelectFilter
            options={categoryOptions.map((category) => ({
              value: category,
              label: formatBudgetLabel(category),
            }))}
            selectedValues={selectedCategories}
            onChange={(next) => setSelectedCategories(next as BudgetCategory[])}
            allLabel="All Categories"
            countLabelPlural="Categories"
            countLabelSingular="Category"
            minWidth={170}
          />

          <MultiSelectFilter
            options={statusOptions.map((status) => ({
              value: status,
              label: formatBudgetLabel(status),
            }))}
            selectedValues={selectedStatuses}
            onChange={(next) => setSelectedStatuses(next as BudgetItemStatus[])}
            allLabel="All Statuses"
            countLabelPlural="Statuses"
            countLabelSingular="Status"
            minWidth={160}
          />

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSelectedUserIds(participantValues);
                setSelectedCategories(categoryOptions);
                setSelectedStatuses(statusOptions);
              }}
              style={toolbarClearBtnStyle}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Per-person cost summary card */}
      {personSummary && selectedUser && (
        <Card>
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <Avatar name={selectedUser.name} color={selectedUser.avatarColor} size={32} />
            <span style={{ fontWeight: 600, fontSize: "var(--font-lg)" }}>{selectedUser.name}&apos;s Costs</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Planned Share</p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(personSummary.plannedShare)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Owes</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: personSummary.owes > 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>{formatCurrency(personSummary.owes)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Paid</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-accent)" }}>{formatCurrency(personSummary.paid)}</p>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>Net Balance</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: personSummary.net >= 0 ? "#10B981" : "#EF4444" }}>
                {personSummary.net >= 0 ? "+" : ""}{formatCurrency(personSummary.net)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {displayedItems.length === 0 ? (
        <EmptyState
          message={activeFilterCount > 0 ? "No expenses match current filters" : (!summaryUserId ? "No expenses yet" : "No expenses for this participant")}
          actionLabel="Plan something with the + button above"
        />
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          <table style={{ width: "100%", minWidth: summaryUserId ? 840 : 720, borderCollapse: "collapse", background: "var(--color-bg-surface)" }}>
            <thead>
              <tr>
                <th style={headCellSt}>
                  <button type="button" onClick={() => toggleSort("title")} style={headSortButtonStyle}>
                    Title{renderSortArrow("title", sortField, sortDirection)}
                  </button>
                </th>
                <th style={headCellSt}>
                  <button type="button" onClick={() => toggleSort("category")} style={headSortButtonStyle}>
                    Category{renderSortArrow("category", sortField, sortDirection)}
                  </button>
                </th>
                <th style={headCellSt}>
                  <button type="button" onClick={() => toggleSort("planned")} style={headSortButtonStyle}>
                    Planned{renderSortArrow("planned", sortField, sortDirection)}
                  </button>
                </th>
                <th style={headCellSt}>
                  <button type="button" onClick={() => toggleSort("actual")} style={headSortButtonStyle}>
                    Actual{renderSortArrow("actual", sortField, sortDirection)}
                  </button>
                </th>
                <th style={headCellSt}>
                  <button type="button" onClick={() => toggleSort("paidBy")} style={headSortButtonStyle}>
                    Paid By{renderSortArrow("paidBy", sortField, sortDirection)}
                  </button>
                </th>
                <th style={headCellSt}>
                  <button type="button" onClick={() => toggleSort("status")} style={headSortButtonStyle}>
                    Status{renderSortArrow("status", sortField, sortDirection)}
                  </button>
                </th>
                {summaryUserId && <th style={headCellSt}>Your Share</th>}
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => {
                const payer = users.find((u) => u.id === item.paidByUserId);
                const yourShare = summaryUserId
                  ? (
                    item.actualAmount > 0
                      ? perPersonActual(item, summaryUserId, events, validUserIds)
                      : perPersonPlanned(item, summaryUserId, events, validUserIds)
                  )
                  : 0;

                return (
                  <tr
                    key={item.id}
                    onClick={() => openPanel("budget", item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPanel("budget", item.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    style={{ cursor: "pointer" }}
                  >
                    <td style={cellSt}>
                      <span style={{ fontWeight: 500 }}>{item.title}</span>
                    </td>
                    <td style={cellSt}>
                      <Badge variant="accent">{formatBudgetLabel(item.category)}</Badge>
                    </td>
                    <td style={cellSt}>{formatCurrency(item.plannedAmount)}</td>
                    <td style={{ ...cellSt, color: item.actualAmount > 0 ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                      {item.actualAmount > 0 ? formatCurrency(item.actualAmount) : "—"}
                    </td>
                    <td style={cellSt}>
                      {payer ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={payer.name} color={payer.avatarColor} size={24} />
                          <span>{payer.name.split(" ")[0]}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={cellSt}>
                      <Badge variant={budgetStatusVariant(item.status)}>{formatBudgetLabel(item.status)}</Badge>
                    </td>
                    {summaryUserId && (
                      <td style={{ ...cellSt, fontWeight: 600, color: "var(--color-accent)" }}>
                        {formatCurrency(yourShare)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const toolbarClearBtnStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "transparent",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-sm)",
  cursor: "pointer",
};

const headSortButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "inherit",
  textTransform: "inherit",
  letterSpacing: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

function renderSortArrow(
  field: "title" | "category" | "planned" | "actual" | "paidBy" | "status",
  sortField: "title" | "category" | "planned" | "actual" | "paidBy" | "status",
  sortDirection: "asc" | "desc",
): string {
  if (field !== sortField) return "";
  return sortDirection === "asc" ? " ▲" : " ▼";
}
