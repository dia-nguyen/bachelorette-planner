"use client";

import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: CSSProperties;
}

export function Card({ children, className = "", onClick, hoverable = false, style: styleProp }: CardProps) {
  return (
    <div
      className={`${className} ${hoverable ? "card-hoverable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
      style={{
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-1)",
        padding: "var(--space-lg)",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s ease",
        ...styleProp,
      }}
    >
      {children}
      <style jsx>{`
        .card-hoverable:hover {
          box-shadow: var(--shadow-2);
        }
      `}</style>
    </div>
  );
}
