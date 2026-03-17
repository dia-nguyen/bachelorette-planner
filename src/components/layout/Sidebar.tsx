"use client";

import { useApp } from "@/lib/context";
import { useRef, useState, type ReactNode } from "react";
import {
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCog,
  HiOutlineColorSwatch,
  HiOutlineCurrencyDollar,
  HiOutlineLogout,
  HiOutlineMap,
  HiOutlinePlus,
  HiOutlineUsers,
  HiOutlineViewGrid,
} from "react-icons/hi";

interface NavItem {
  icon: ReactNode;
  label: string;
  id: string;
}

const navItems: NavItem[] = [
  { icon: <HiOutlineViewGrid size={22} />, label: "Dashboard", id: "dashboard" },
  { icon: <HiOutlineCalendar size={22} />, label: "Events", id: "events" },
  { icon: <HiOutlineMap size={22} />, label: "Itinerary", id: "itinerary" },
  { icon: <HiOutlineUsers size={22} />, label: "Guests", id: "guests" },
  { icon: <HiOutlineCurrencyDollar size={22} />, label: "Budget", id: "budget" },
  { icon: <HiOutlineClipboardList size={22} />, label: "Tasks", id: "tasks" },
  { icon: <HiOutlineColorSwatch size={22} />, label: "Moodboard", id: "moodboard" },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNewTrip?: () => void;
  onSignOut?: () => void;
}

export function Sidebar({ activeTab, onTabChange, onNewTrip, onSignOut }: SidebarProps) {
  const { trip, availableTrips, switchTrip } = useApp();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const currentInitial = (trip?.name ?? "BP").slice(0, 2).toUpperCase();

  return (
    <nav
      className="flex flex-col items-center py-4 gap-2 h-full"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--color-bg-surface)",
        borderRight: "1px solid var(--color-border)",
        position: "relative",
        overflow: "visible",
      }}
    >
      {/* Trip switcher button */}
      <div ref={switcherRef} style={{ position: "relative" }}>
        <button
          className="flex items-center justify-center mb-4"
          title={trip?.name ?? "Switch trip"}
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
          onClick={() => setSwitcherOpen((o) => !o)}
        >
          {currentInitial}
        </button>

        {/* Dropdown */}
        {switcherOpen && (
          <div
            style={{
              position: "fixed",
              left: "calc(var(--sidebar-width) + 8px)",
              top: 12,
              zIndex: 200,
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 220,
              padding: "6px 0",
            }}
          >
            {availableTrips.map((t) => (
              <button
                key={t.id}
                onClick={() => { switchTrip(t.id); setSwitcherOpen(false); onTabChange("dashboard"); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-sm)",
                  textAlign: "left",
                }}
              >
                {trip?.id === t.id && (
                  <HiOutlineCheckCircle size={15} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                )}
                {trip?.id !== t.id && <span style={{ width: 15, flexShrink: 0 }} />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              </button>
            ))}

            {/* New trip */}
            <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 4 }}>
              <button
                onClick={() => { setSwitcherOpen(false); onNewTrip?.(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-accent)",
                  fontSize: "var(--font-sm)",
                  textAlign: "left",
                }}
              >
                <HiOutlinePlus size={15} />
                New trip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Close switcher on outside click */}
      {switcherOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 199 }}
          onClick={() => setSwitcherOpen(false)}
        />
      )}

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

      {onSignOut && (
        <button
          title="Log Out"
          onClick={onSignOut}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: "transparent",
            color: "var(--color-text-secondary)",
            border: "none",
            cursor: "pointer",
          }}
        >
          <HiOutlineLogout size={22} />
        </button>
      )}
    </nav>
  );
}
