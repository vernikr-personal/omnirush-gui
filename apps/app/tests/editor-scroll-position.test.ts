import { afterEach, describe, expect, it } from "bun:test";
import { documentScrollKey, readDocumentScroll, saveDocumentScroll } from "../src/react-app/domains/session/editor/scroll-position";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });

afterEach(() => storage.clear());

describe("editor document scroll positions", () => {
  it("persists a separate position for each workspace, group, and document", () => {
    const first = documentScrollKey("workspace-a", 1, "src/app.ts");
    const secondGroup = documentScrollKey("workspace-a", 2, "src/app.ts");
    const secondWorkspace = documentScrollKey("workspace-b", 1, "src/app.ts");
    saveDocumentScroll(first, { top: 120.5, left: 8 });
    saveDocumentScroll(secondGroup, { top: 600, left: 0 });
    saveDocumentScroll(secondWorkspace, { top: 900, left: 2 });

    expect(readDocumentScroll(first)).toEqual({ top: 120.5, left: 8 });
    expect(readDocumentScroll(secondGroup)).toEqual({ top: 600, left: 0 });
    expect(readDocumentScroll(secondWorkspace)).toEqual({ top: 900, left: 2 });
    expect(readDocumentScroll(documentScrollKey("workspace-a", 1, "README.md"))).toBeNull();
  });

  it("clamps invalid negative positions and tolerates corrupt storage", () => {
    const key = documentScrollKey("workspace-a", 1, "src/app.ts");
    saveDocumentScroll(key, { top: -4, left: -20 });
    expect(readDocumentScroll(key)).toEqual({ top: 0, left: 0 });

    storage.setItem("omnirush:editor:scroll:v1", "not-json");
    expect(readDocumentScroll(key)).toBeNull();
  });
});
