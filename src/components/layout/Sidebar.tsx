"use client";

import { type ReactNode } from "react";
import {
  HiOutlineCalendar,
  HiOutlineClipboardList,
  HiOutlineCog,
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
  HiOutlineViewGrid
} from "react-icons/hi";

interface NavItem {
  icon: ReactNode;
  label: string;
  id: string;
}

const navItems: NavItem[] = [
  { icon: <HiOutlineViewGrid size={22} />, label: "Dashboard", id: "dashboard" },
  { icon: <HiOutlineCalendar size={22} />, label: "Events", id: "events" },
  { icon: <HiOutlineUsers size={22} />, label: "Guests", id: "guests" },
  { icon: <HiOutlineCurrencyDollar size={22} />, label: "Budget", id: "budget" },
  { icon: <HiOutlineClipboardList size={22} />, label: "Tasks", id: "tasks" },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <nav
      className="flex flex-col items-center py-4 gap-2 h-full"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--color-bg-surface)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Avatar / Logo */}
      <button
        className="flex items-center justify-center mb-4"
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-md)",
          background: "var(--color-accent)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "var(--font-lg)",
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => onTabChange("dashboard")}
      >
        BP
      </button>

      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            title={item.label}
            className="flex items-center justify-center transition-colors"
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: isActive ? "var(--color-accent-soft)" : "transparent",
              color: isActive
                ? "var(--color-accent)"
                : "var(--color-text-secondary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {item.icon}
          </button>
        );
      })}

      <div className="flex-1" />

      {/* Settings */}
      <button
        title="Settings"
        onClick={() => onTabChange("settings")}
        className="flex items-center justify-center transition-colors"
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          background: activeTab === "settings" ? "var(--color-accent-soft)" : "transparent",
          color: activeTab === "settings" ? "var(--color-accent)" : "var(--color-text-secondary)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <HiOutlineCog size={22} />
      </button>
    </nav>
  );
}
