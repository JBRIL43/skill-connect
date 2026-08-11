import { seedData, type SeedData } from "@/lib/data/mock/fixtures";
import type { GeneratedChallenge } from "@/lib/data/types";

export type MockStore = SeedData & {
  generatedChallenges: GeneratedChallenge[];
};

const STORE_KEY = "__skillConnectMockStore__";

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MockStore };

function create(): MockStore {
  return { ...seedData(), generatedChallenges: [] };
}

/**
 * Held on globalThis so it survives Next's dev-time module reloading. Writes are
 * process-local and reset on restart, which is deliberate: every rehearsal run
 * starts from the same known-good dataset (Section 11, point 5).
 */
export function store(): MockStore {
  const globalRef = globalThis as GlobalWithStore;
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = create();
  }
  return globalRef[STORE_KEY];
}

export function resetStore(): void {
  (globalThis as GlobalWithStore)[STORE_KEY] = create();
}
