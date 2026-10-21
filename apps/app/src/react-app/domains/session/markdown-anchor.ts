/**
 * In-document markdown anchors. The markdown renderer emits headings without
 * `id` attributes and marks every link external (`target="_blank"`), so a
 * `#table-of-contents` link would open a dead window instead of scrolling the
 * document. Preview surfaces resolve those clicks themselves through this
 * helper: by `id` when one exists, otherwise by the GitHub-style slug of the
 * heading text, the same way GitHub resolves document anchors.
 */

/** GitHub-style heading anchor. */
export function markdownHeadingSlug(text: string): string {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-");
}

function decodeAnchorHash(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    // A stray `%` in a hand-written anchor is its literal text, not an escape.
    return hash;
  }
}

/** The heading an in-document `#anchor` points at, or null when the document has none. */
export function findMarkdownHeading(root: ParentNode | null | undefined, hash: string): Element | null {
  if (!root) return null;
  const id = decodeAnchorHash(hash);
  const byId = root.querySelector(`[id="${CSS.escape(id)}"]`);
  if (byId) return byId;
  return (
    Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).find(
      (element) => markdownHeadingSlug(element.textContent ?? "") === id,
    ) ?? null
  );
}
