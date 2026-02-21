"use client";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10"
      style={{ color: "var(--color-text-secondary)" }}
    >
      <p style={{ fontSize: "var(--font-md)", marginBottom: "var(--space-md)" }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            padding: "8px 20px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            fontSize: "var(--font-md)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
