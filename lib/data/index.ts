import { mockRepository } from "@/lib/data/mock/adapter";
import type { DataRepository } from "@/lib/data/repository";
import { supabaseRepository } from "@/lib/data/supabase/adapter";

/**
 * The single switch between Dev 3's stand-in data and Dev 1's live schema.
 * Nothing above this layer knows which one is active.
 *
 * Only the literal string 'mock' opts out. The fallback has to be the real
 * schema, because the failure modes are not comparable: an unset variable on a
 * deployment served in-memory fixtures that silently discard every write, and
 * looked healthy doing it. Defaulting the other way just fails loudly on the
 * missing Supabase keys instead.
 */
export function repo(): DataRepository {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "mock"
    ? mockRepository
    : supabaseRepository;
}

export function dataSourceLabel(): string {
  return repo().kind === "supabase" ? "Supabase" : "Mock data";
}

export type { DataRepository } from "@/lib/data/repository";
