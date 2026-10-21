import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  documentScrollKey,
  readDocumentScroll,
  saveDocumentScroll,
} from "../src/react-app/domains/session/editor/scroll-position";

const STORAGE_KEY = "omnirush:editor:scroll:v1";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

let previousStorage: Storage | undefined;

beforeEach(() => {
  previousStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  if (previousStorage === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
  else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage });
});

describe("editor document scroll positions", () => {
  test("persists a separate position for each workspace, group, and document", () => {
    const first = documentScrollKey("workspace-a", 1, "src/index.ts");
    const second = documentScrollKey("workspace-a", 2, "src/index.ts");
    const third = documentScrollKey("workspace-b", 1, "src/index.ts");
    saveDocumentScroll(first, { top: 120, left: 8 });
    saveDocumentScroll(second, { top: 240, left: 16 });
    saveDocumentScroll(third, { top: 360, left: 24 });

    expect(readDocumentScroll(first)).toEqual({ top: 120, left: 8 });
    expect(readDocumentScroll(second)).toEqual({ top: 240, left: 16 });
    expect(readDocumentScroll(third)).toEqual({ top: 360, left: 24 });
  });

  test("clamps invalid negative positions and tolerates corrupt storage", () => {
    const key = documentScrollKey("workspace-a", 1, "src/index.ts");
    saveDocumentScroll(key, { top: -4, left: -12 });
    expect(readDocumentScroll(key)).toEqual({ top: 0, left: 0 });

    globalThis.localStorage.setItem(STORAGE_KEY, "{broken json");
    expect(readDocumentScroll(key)).toBeNull();
    saveDocumentScroll(key, { top: 12, left: 3 });
    expect(readDocumentScroll(key)).toEqual({ top: 12, left: 3 });
  });
});
