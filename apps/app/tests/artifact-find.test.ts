import { expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { findMatchOffsets, findTextRanges } from "../src/react-app/domains/session/artifacts/artifact-find";

if (typeof globalThis.window === "undefined" || typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/" });
}

test("finds case-insensitive occurrences and reports their offsets", () => {
  expect(findMatchOffsets("Intro TARGET, target. end", "target")).toEqual([
    { start: 6, end: 12 },
    { start: 14, end: 20 },
  ]);
});

test("returns no matches for a blank query or absent text", () => {
  expect(findMatchOffsets("some text", "   ")).toEqual([]);
  expect(findMatchOffsets("some text", "missing")).toEqual([]);
});

test("creates a DOM range for text split across inline Markdown nodes", () => {
  const root = document.createElement("div");
  root.innerHTML = "<p>Keep <strong>searching</strong> here.</p><button>searching</button>";
  const matches = findTextRanges(root, "keep searching");
  expect(matches).toHaveLength(1);
  expect(matches[0]?.toString()).toBe("Keep searching");
});
