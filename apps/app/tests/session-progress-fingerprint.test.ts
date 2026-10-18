import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { transcriptProgress } from "../src/react-app/domains/session/status/session-progress";

function assistantWithText(text: string): UIMessage[] {
  const part = { type: "text", text, state: "streaming" } as UIMessage["parts"][number];
  return [{ id: "message-1", role: "assistant", parts: [part] }];
}

describe("transcript progress", () => {
  // The progress fingerprint runs after every coalesced flush — once per
  // animation frame while a turn streams. It used to hash the full text of the
  // growing part, which is quadratic over a long reasoning trace; these tests
  // pin the behaviour the cheap fingerprint has to keep.
  test("an appended chunk is a new revision", () => {
    const first = transcriptProgress(assistantWithText("The plan is"));
    const second = transcriptProgress(assistantWithText("The plan is simple"), first.parts);

    expect(second.revision).not.toBe(first.revision);
    expect(second.label).toBe("Response updated");
  });

  test("the same transcript is the same revision and reports no activity", () => {
    const first = transcriptProgress(assistantWithText("Unchanged text"));
    const second = transcriptProgress(assistantWithText("Unchanged text"), first.parts);

    expect(second.revision).toBe(first.revision);
    expect(second.label).toBeNull();
  });

  test("same length with a different tail is still a new revision", () => {
    const first = transcriptProgress(assistantWithText("Answer ending in one"));
    const second = transcriptProgress(assistantWithText("Answer ending in two"), first.parts);

    expect(second.revision).not.toBe(first.revision);
  });

  test("a long reasoning trace keeps producing revisions as it grows", () => {
    const base = "Let me check the file layout first. ".repeat(400);
    const first = transcriptProgress(assistantWithText(base));
    const second = transcriptProgress(assistantWithText(`${base}Then the tests.`), first.parts);

    expect(second.revision).not.toBe(first.revision);
    expect(second.label).toBe("Response updated");
  });
});
