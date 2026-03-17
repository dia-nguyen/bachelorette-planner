"use client";

import { useEffect, useRef, useState } from "react";
import { HiOutlinePlus } from "react-icons/hi";

interface HeaderBarProps {
  title: string;
  onAddItem?: () => void;
  onClearAll?: () => void;
  onRestoreDemo?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: (json: string) => void;
  onSignOut?: () => void;
}

export function HeaderBar({
  title,
  onAddItem,
  onClearAll,
  onRestoreDemo,
  onExportJSON,
  onImportJSON,
  onSignOut,
}: HeaderBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <header
      className="flex items-center justify-between px-6"
      style={{
        height: 64,
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
      }}
    >
      <h1
        className="app-header-title"
        style={{
          fontWeight: 700,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-2">
        {onAddItem && (
          <ActionButton
            icon={<HiOutlinePlus size={16} />}
            label={(
              <>
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add Item</span>
              </>
            )}
            onClick={onAddItem}
          />
        )}

        {/* More menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          {/* <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: menuOpen ? "var(--color-bg-muted)" : "var(--color-bg-surface)",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            <HiDotsHorizontal size={16} />
          </button> */}

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 220,
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 50,
                padding: "4px 0",
              }}
            >
              {onExportJSON && (
                <MenuAction
                  label="⬇️  Export JSON"
                  description="Download all data as a JSON backup"
                  onClick={() => { onExportJSON(); setMenuOpen(false); }}
                />
              )}
              {onImportJSON && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result;
                        if (typeof text === "string") onImportJSON(text);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                      setMenuOpen(false);
                    }}
                  />
                  <MenuAction
                    label="⬆️  Import JSON"
                    description="Restore from a JSON backup file"
                    onClick={() => { fileInputRef.current?.click(); }}
                  />
                </>
              )}
              {(onExportJSON || onImportJSON) && (onSignOut || onClearAll || onRestoreDemo) && (
                <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
              )}
              {onSignOut && (
                <MenuAction
                  label="Log Out"
                  description="Sign out of your account"
                  onClick={() => { onSignOut(); setMenuOpen(false); }}
                />
              )}
              {onSignOut && (onClearAll || onRestoreDemo) && (
                <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
              )}
              {onClearAll && (
                <MenuAction
                  label="🗑  Delete All Data"
                  description="Remove all events, tasks & budget items"
                  danger
                  onClick={() => { onClearAll(); setMenuOpen(false); }}
                />
              )}
              {onRestoreDemo && (
                <MenuAction
                  label="♻️  Restore Demo Data"
                  description="Reset everything to the demo dataset"
                  onClick={() => { onRestoreDemo(); setMenuOpen(false); }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-3 transition-colors"
      style={{
        height: 36,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
        color: "var(--color-text-primary)",
        fontSize: "var(--font-md)",
        cursor: "pointer",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MenuAction({
  label,
  description,
  danger,
  onClick,
}: {
  label: string;
  description?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 14px",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: danger ? "var(--color-danger, #dc2626)" : "var(--color-text-primary)",
        fontSize: "var(--font-sm)",
        fontWeight: 500,
        lineHeight: 1.4,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-muted)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {label}
      {description && (
        <span
          style={{
            display: "block",
            fontSize: "var(--font-xs, 11px)",
            color: "var(--color-text-secondary)",
            fontWeight: 400,
            marginTop: 1,
          }}
        >
          {description}
        </span>
      )}
    </button>
  );
}
