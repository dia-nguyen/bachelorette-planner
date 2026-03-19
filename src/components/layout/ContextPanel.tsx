"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { HiX } from "react-icons/hi";

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}

export function ContextPanel({
  isOpen,
  onClose,
  title,
  badge,
  children,
}: ContextPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.08)", zIndex: 380 }}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        ref={panelRef}
        className="fixed top-0 right-0"
        style={{
          zIndex: 400,
          width: "var(--context-panel-width)",
          maxWidth: "90vw",
          height: "100dvh",
          maxHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--color-bg-surface)",
          boxShadow: "var(--shadow-2)",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: "1px solid var(--color-border)",
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "var(--color-bg-surface)",
            paddingTop: "max(16px, env(safe-area-inset-top))",
          }}
        >
          <div className="flex items-center gap-2">
            {badge}
            <span
              style={{
                fontSize: "var(--font-md)",
                color: "var(--color-text-secondary)",
              }}
            >
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              padding: 4,
            }}
          >
            <HiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto p-5"
          style={{
            WebkitOverflowScrolling: "touch",
            paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </div>
      </aside>

      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
