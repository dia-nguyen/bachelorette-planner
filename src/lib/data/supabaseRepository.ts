import { demoRepository } from "./demoRepository";
import type { Repository } from "./repository";

/**
 * Temporary adapter: keeps the app functional while auth/data migration is in progress.
 * Replace each method with real Supabase queries in the next phase.
 */
export const supabaseRepository: Repository = demoRepository;
