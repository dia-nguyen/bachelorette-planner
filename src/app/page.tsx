import { getPlannerTabFromQuery, getPlannerTabPath } from "@/lib/navigation/plannerTabs";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const tab = getPlannerTabFromQuery(params.tab);
  redirect(getPlannerTabPath(tab));
}
