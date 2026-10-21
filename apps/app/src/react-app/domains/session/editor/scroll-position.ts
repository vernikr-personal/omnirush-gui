/**
 * Scroll positions for editor documents (not file contents or cursor selections).
 * localStorage is already the editor's durable, per-install preference store.
 */
export type ScrollPosition = { top: number; left: number };

const STORAGE_KEY = "omnirush:editor:scroll:v1";
const MAX_SAVED_POSITIONS = 400;

type SavedPositions = Record<string, ScrollPosition>;

function readPositions(): SavedPositions {
  if (typeof localStorage === "undefined") return {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as SavedPositions : {};
  } catch {
    return {};
  }
}

export function documentScrollKey(workspaceId: string, group: 1 | 2, documentKey: string): string {
  return JSON.stringify([workspaceId, group, documentKey]);
}

export function readDocumentScroll(key: string): ScrollPosition | null {
  const value = readPositions()[key];
  if (!value || !Number.isFinite(value.top) || !Number.isFinite(value.left)) return null;
  return { top: Math.max(0, value.top), left: Math.max(0, value.left) };
}

export function saveDocumentScroll(key: string, position: ScrollPosition): void {
  if (!Number.isFinite(position.top) || !Number.isFinite(position.left)) return;
  const all = readPositions();
  delete all[key];
  all[key] = { top: Math.max(0, position.top), left: Math.max(0, position.left) };
  const keys = Object.keys(all);
  for (const oldest of keys.slice(0, Math.max(0, keys.length - MAX_SAVED_POSITIONS))) delete all[oldest];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage may be disabled or full; the current scroll position still works in memory.
  }
}
