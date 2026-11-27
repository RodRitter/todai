export type MemorySource = { taskId: string; taskTitle: string; boardId: string };

export type MemorySnapshot = {
  current: {
    document: string;
    updatedAt: string;
    source: MemorySource | null;
  } | null;
};

export const memoryCategories = ["Terms", "Practices", "Decisions", "Preferences"] as const;
export type MemoryCategory = (typeof memoryCategories)[number];
export type MemoryEntry = {
  id: string;
  revision: number;
  category: MemoryCategory;
  title: string;
  statement: string;
  details?: string;
  retired?: boolean;
  stale?: boolean;
  needsReview?: boolean;
  supersedes?: string;
  scope: string;
  source: string;
  updatedAt: string;
};
export type MemoryChange = {
  operation: "add" | "update" | "remove";
  reason: string;
  before?: MemoryEntry;
  after?: MemoryEntry;
};
export type MemorySearchResult = { entries: MemoryEntry[]; total: number; hasMore: boolean };
export type MemoryContext = { entries: MemoryEntry[]; total: number };
