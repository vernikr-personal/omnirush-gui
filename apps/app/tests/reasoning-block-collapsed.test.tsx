/** @jsxImportSource react */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ReasoningBlock } from "../src/components/chat/reasoning-block";

/**
 * Other test files stub `globalThis.window` and can leak it into a shared bun
 * test worker; static rendering must not see a partial stub.
 */
function withoutWindow<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  if (descriptor?.configurable) Reflect.deleteProperty(globalThis, "window");
  try {
    return run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
  }
}

describe("reasoning block", () => {
  // The trace streams as one growing markdown block. Rendering it while it is
  // collapsed means re-lexing, sanitizing and laying out the whole trace on
  // every frame of a thinking run, which is where an Intel Mac spends its CPU.
  test("collapsed by default renders the trigger and none of the trace", () => {
    const markup = withoutWindow(() => renderToStaticMarkup(
      <ReasoningBlock text="SECRET-REASONING-BODY" isStreaming />,
    ));

    expect(markup).toContain("Reasoning trace");
    expect(markup).not.toContain("SECRET-REASONING-BODY");
  });

  test("the settled label drops the streaming ellipsis", () => {
    const markup = withoutWindow(() => renderToStaticMarkup(
      <ReasoningBlock text="SECRET-REASONING-BODY" isStreaming={false} />,
    ));

    expect(markup).toContain("Reasoning trace");
    expect(markup).not.toContain("Reasoning trace…");
    expect(markup).not.toContain("SECRET-REASONING-BODY");
  });
});
