export const PLANNER_TABS = [
  "dashboard",
  "itinerary",
  "tasks",
  "events",
  "budget",
  "polls",
  "moodboard",
  "guests",
  "settings",
] as const;

export type PlannerTab = (typeof PLANNER_TABS)[number];

export const DEFAULT_PLANNER_TAB: PlannerTab = "dashboard";

export const PLANNER_TAB_PATHS: Record<PlannerTab, string> = {
  dashboard: "/dashboard",
  itinerary: "/itinerary",
  tasks: "/tasks",
  events: "/events",
  budget: "/budget",
  polls: "/polls",
  moodboard: "/moodboard",
  guests: "/guests",
  settings: "/settings",
};

export function isPlannerTab(value: string): value is PlannerTab {
  return (PLANNER_TABS as readonly string[]).includes(value);
}

export function getPlannerTabFromPathname(pathname: string): PlannerTab {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  if (isPlannerTab(firstSegment)) return firstSegment;
  return DEFAULT_PLANNER_TAB;
}

export function getPlannerTabFromQuery(tab: string | string[] | undefined): PlannerTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  if (value && isPlannerTab(value)) return value;
  return DEFAULT_PLANNER_TAB;
}

export function getPlannerTabPath(tab: string): string {
  if (isPlannerTab(tab)) return PLANNER_TAB_PATHS[tab];
  return PLANNER_TAB_PATHS[DEFAULT_PLANNER_TAB];
}
