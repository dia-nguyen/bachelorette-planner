"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  countLabelPlural: string;
  countLabelSingular?: string;
  minWidth?: number;
}

export function MultiSelectFilter({
  options,
  selectedValues,
  onChange,
  allLabel,
  countLabelPlural,
  countLabelSingular,
  minWidth = 180,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionValues = useMemo(() => options.map((option) => option.value), [options]);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const isAllSelected = optionValues.every((value) => selectedSet.has(value));
  const selectedCount = selectedValues.length;
  const countNoun = selectedCount === 1
    ? (countLabelSingular ?? countLabelPlural.replace(/s$/, ""))
    : countLabelPlural;
  const buttonLabel = isAllSelected ? allLabel : `${selectedCount} ${countNoun}`;

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const toggleAll = () => {
    onChange(isAllSelected ? [] : optionValues);
  };

  const toggleOne = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((v) => v !== value));
      return;
    }
    onChange([...selectedValues, value]);
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          minWidth,
          fontSize: "var(--font-sm)",
          padding: "5px 12px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${isOpen ? "var(--color-accent)" : "var(--color-border)"}`,
          background: "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span>{buttonLabel}</span>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>▾</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth,
            width: "100%",
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
            padding: 6,
            zIndex: 30,
          }}
        >
          <label style={{ ...optionRowStyle(isAllSelected), borderBottom: "1px solid var(--color-border)" }}>
            <input type="checkbox" checked={isAllSelected} onChange={toggleAll} />
            <span>{allLabel}</span>
          </label>
          {options.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <label key={option.value} style={optionRowStyle(checked)}>
                <input type="checkbox" checked={checked} onChange={() => toggleOne(option.value)} />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function optionRowStyle(checked: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: "var(--radius-sm)",
    padding: "6px 8px",
    background: checked ? "var(--color-bg-muted)" : "transparent",
    color: "var(--color-text-primary)",
    fontWeight: checked ? 600 : 500,
    cursor: "pointer",
  };
}
