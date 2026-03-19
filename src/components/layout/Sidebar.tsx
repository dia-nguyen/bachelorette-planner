"use client";

import { useApp } from "@/lib/context";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import {
  HiOutlineCalendar,
  HiOutlineChartSquareBar,
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
  { icon: <HiOutlineMap size={22} />, label: "Itinerary", id: "itinerary" },
  { icon: <HiOutlineClipboardList size={22} />, label: "Tasks", id: "tasks" },
  { icon: <HiOutlineCalendar size={22} />, label: "Events", id: "events" },
  { icon: <HiOutlineCurrencyDollar size={22} />, label: "Budget", id: "budget" },
  { icon: <HiOutlineChartSquareBar size={22} />, label: "Polls", id: "polls" },
  { icon: <HiOutlineColorSwatch size={22} />, label: "Moodboard", id: "moodboard" },
  { icon: <HiOutlineUsers size={22} />, label: "Guests", id: "guests" },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNewTrip?: () => void;
  onSignOut?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ activeTab, onTabChange, onNewTrip, onSignOut, isMobile = false }: SidebarProps) {
  const { trip, availableTrips, switchTrip } = useApp();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  if (isMobile) {
    const primaryMobileItems: NavItem[] = navItems.filter((item) =>
      ["dashboard", "tasks", "itinerary", "budget"].includes(item.id),
    );
    const moreMobileItems: NavItem[] = [
      ...navItems.filter((item) =>
        ["events", "polls", "moodboard", "guests"].includes(item.id),
      ),
      { icon: <HiOutlineCog size={20} />, label: "Settings", id: "settings" },
    ];
    const isMoreActive = !primaryMobileItems.some((item) => item.id === activeTab);

    return (
      <>
        {moreOpen && (
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 260,
              background: "rgba(0,0,0,0.28)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                background: "var(--color-bg-surface)",
                borderTopLeftRadius: "16px",
                borderTopRightRadius: "16px",
                borderTop: "1px solid var(--color-border)",
                boxShadow: "0 -10px 30px rgba(0,0,0,0.18)",
                padding: "10px 12px calc(14px + env(safe-area-inset-bottom))",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 999,
                  background: "var(--color-border)",
                  margin: "0 auto 10px",
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                {moreMobileItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMoreOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        height: 42,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        background: isActive ? "var(--color-accent-soft)" : "var(--color-bg-surface)",
                        color: isActive ? "var(--color-accent)" : "var(--color-text-primary)",
                        padding: "0 10px",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <nav
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 140,
            background: "var(--color-bg-surface)",
            borderTop: "none",
            paddingBottom: 0,
            paddingTop: 0,
          }}
        >
          <div className="grid grid-cols-5" style={{ padding: 0 }}>
            {primaryMobileItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  style={{
                    minWidth: 0,
                    height: "calc(58px + env(safe-area-inset-bottom))",
                    borderRadius: 0,
                    border: "none",
                    background: isActive ? "var(--color-accent-soft)" : "transparent",
                    color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    cursor: "pointer",
                  }}
                >
                  {item.icon}
                  <span style={{ fontSize: 11, lineHeight: 1.1 }}>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setMoreOpen((open) => !open)}
              style={{
                minWidth: 0,
                height: "calc(58px + env(safe-area-inset-bottom))",
                borderRadius: 0,
                border: "none",
                background: isMoreActive || moreOpen ? "var(--color-accent-soft)" : "transparent",
                color: isMoreActive || moreOpen ? "var(--color-accent)" : "var(--color-text-secondary)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>⋯</span>
              <span style={{ fontSize: 11, lineHeight: 1.1 }}>More</span>
            </button>
          </div>
        </nav>
      </>
    );
  }

  return (
    <nav
      className="flex flex-col items-center py-4 gap-2 h-full"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--color-bg-surface)",
        borderRight: "1px solid var(--color-border)",
        position: "relative",
        overflow: "visible",
        zIndex: 120,
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
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
          <Image src={`/app-icon.png`} alt={trip?.name ?? "Bachelorette Party Planner Icon"} width={200} height={200} />
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
          <div key={item.id} className="group relative">
            <button
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              className="peer flex items-center justify-center transition-colors"
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
            <span
              role="tooltip"
              style={{
                position: "absolute",
                left: "calc(100% + 8px)",
                top: "50%",
                transform: "translateY(-50%)",
                padding: "4px 8px",
                borderRadius: "8px",
                background: "var(--color-text-primary)",
                color: "var(--color-bg-surface)",
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
                pointerEvents: "none",
                transition: "opacity 120ms ease",
                zIndex: 220,
              }}
              className="invisible opacity-0 peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100"
            >
              {item.label}
            </span>
          </div>
        );
      })}

      <div className="flex-1" />

      {/* Settings */}
      <div className="group relative">
        <button
          aria-label="Settings"
          onClick={() => onTabChange("settings")}
          className="peer flex items-center justify-center transition-colors"
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
        <span
          role="tooltip"
          style={{
            position: "absolute",
            left: "calc(100% + 8px)",
            top: "50%",
            transform: "translateY(-50%)",
            padding: "4px 8px",
            borderRadius: "8px",
            background: "var(--color-text-primary)",
            color: "var(--color-bg-surface)",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
            pointerEvents: "none",
            transition: "opacity 120ms ease",
            zIndex: 220,
          }}
          className="invisible opacity-0 peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100"
        >
          Settings
        </span>
      </div>

      {onSignOut && (
        <div className="group relative">
          <button
            aria-label="Log Out"
            onClick={onSignOut}
            className="peer flex items-center justify-center transition-colors"
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
          <span
            role="tooltip"
            style={{
              position: "absolute",
              left: "calc(100% + 8px)",
              top: "50%",
              transform: "translateY(-50%)",
              padding: "4px 8px",
              borderRadius: "8px",
              background: "var(--color-text-primary)",
              color: "var(--color-bg-surface)",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
              pointerEvents: "none",
              transition: "opacity 120ms ease",
              zIndex: 220,
            }}
            className="invisible opacity-0 peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100"
          >
            Log Out
          </span>
        </div>
      )}
    </nav>
  );
}
