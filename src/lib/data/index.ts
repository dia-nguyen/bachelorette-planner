export {
  clearAllData,
  demoRepository,
  exportStore,
  importStore,
  resetStore,
  subscribe,
} from "./demoRepository";
import { demoRepository } from "./demoRepository";
import { supabaseRepository } from "./supabaseRepository";

export const repository =
  process.env.NEXT_PUBLIC_DATA_MODE === "supabase"
    ? supabaseRepository
    : demoRepository;

export type { Repository } from "./repository";
export * from "./types";
