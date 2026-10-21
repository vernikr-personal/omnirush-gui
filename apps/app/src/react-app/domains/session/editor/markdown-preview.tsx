/** @jsxImportSource react */
/**
 * A Markdown file rendered in an editor tab, read-only, following the file's text as you type (300 ms; files over
 * 1 MB update when saved). The chat's renderer (sanitised: no raw HTML, no scripts). Links: a relative link opens
 * the file in the editor, `#anchor` scrolls, http(s) opens in the browser, anything else does nothing. Images: a
 * relative one loads from the project; a remote one is not loaded (a placeholder with its address).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type * as MonacoApi from "monaco-editor/editor/editor.api.js";

import type { OmniRushServerClient } from "@/app/lib/omnirush-server";
import { renderMarkdownHtml } from "@/components/markdown/markdown";
import { isImagePath } from "./image-view";
import { documentScrollKey, readDocumentScroll, saveDocumentScroll } from "./scroll-position";

const LARGE = 1_000_000;
const MAX_IMAGES = 30;

/** `target` relative to the folder of `from` (both project paths), or null when it leaves the project. */
export function resolveProjectPath(from: string, target: string): string | null {
  const clean = target.split(/[?#]/)[0]!;
  if (!clean) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    return null;
  }
  const parts = decoded.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

export function MarkdownPreview(props: {
  client: OmniRushServerClient;
  workspaceId: string;
  group: 1 | 2;
  path: string;
  model: MonacoApi.editor.ITextModel;
  isDirty: () => boolean;
  findQuery?: string;
  activeMatchIndex?: number;
  onFindMatches?: (count: number) => void;
  onOpenFile: (path: string) => void;
  onOpenExternal: (url: string) => void;
}) {
  const [text, setText] = useState(() => props.model.getValue());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const renderedHtmlRef = useRef<string | null>(null);
  const persistentScrollKey = documentScrollKey(props.workspaceId, props.group, `preview:${props.path}`);

  useEffect(() => {
    setText(props.model.getValue());
    let timer = 0;
    const subscription = props.model.onDidChangeContent(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (props.model.getValueLength() > LARGE && props.isDirty()) return;
        setText(props.model.getValue());
      }, 300);
    });
    return () => {
      window.clearTimeout(timer);
      subscription.dispose();
    };
  }, [props.model, props.isDirty]);

  // Images are rewritten before the HTML reaches the page (a <template> loads nothing): a remote one becomes a
  // placeholder with its address, a relative one keeps its path in data-src and loads from the project below.
  const html = useMemo(() => {
    const template = document.createElement("template");
    template.innerHTML = renderMarkdownHtml(text, "surface");
    for (const image of Array.from(template.content.querySelectorAll("img"))) {
      const src = image.getAttribute("src") ?? "";
      image.removeAttribute("srcset");
      image.removeAttribute("src");
      // Inline images (data:image/…) load nothing from anywhere: shown as they are.
      if (/^data:image\/(png|jpe?g|gif|webp|avif|bmp)[;,]/i.test(src)) {
        image.setAttribute("src", src);
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//")) {
        const note = document.createElement("span");
        note.className = "my-2 inline-block rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground";
        note.textContent = `Remote image not loaded: ${src}`;
        note.dataset.editorRemoteImage = src;
        (image.closest("button") ?? image).replaceWith(note);
        continue;
      }
      image.dataset.src = src;
    }
    return { __html: template.innerHTML };
  }, [text]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const saved = readDocumentScroll(persistentScrollKey);
    if (saved) {
      container.scrollTop = saved.top;
      container.scrollLeft = saved.left;
    }
    scrollTopRef.current = container.scrollTop;
    let timer: number | null = null;
    const onScroll = () => {
      scrollTopRef.current = container.scrollTop;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        saveDocumentScroll(persistentScrollKey, { top: container.scrollTop, left: container.scrollLeft });
      }, 120);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (timer !== null) window.clearTimeout(timer);
      saveDocumentScroll(persistentScrollKey, { top: container.scrollTop, left: container.scrollLeft });
    };
  }, [persistentScrollKey]);

  // Replacing the rendered Markdown DOM while the source changes must not jump
  // a reader back to the top of the document.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const nextHtml = html.__html;
    if (renderedHtmlRef.current !== null && renderedHtmlRef.current !== nextHtml && container) {
      container.scrollTop = scrollTopRef.current;
    }
    renderedHtmlRef.current = nextHtml;
  }, [html]);

  // Project images, read once per path while the preview is open (typing re-renders the HTML, not the images).
  const imageUrls = useRef(new Map<string, Promise<string | null>>());
  useEffect(() => {
    const urls = imageUrls.current;
    return () => {
      for (const url of urls.values()) void url.then((value) => value && URL.revokeObjectURL(value));
      urls.clear();
    };
  }, [props.client, props.workspaceId]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let loaded = 0;
    for (const image of Array.from(root.querySelectorAll<HTMLImageElement>("img[data-src]"))) {
      const target = resolveProjectPath(props.path, image.dataset.src ?? "");
      if (!target || !isImagePath(target) || loaded >= MAX_IMAGES) continue;
      loaded += 1;
      let url = imageUrls.current.get(target);
      if (!url) {
        url = props.client.editorRaw(props.workspaceId, target).then(
          (result) => URL.createObjectURL(new Blob([result.data], { type: result.contentType ?? "application/octet-stream" })),
          () => {
            // Not cached: the image may appear or be fixed while the preview is open.
            imageUrls.current.delete(target);
            return null;
          },
        );
        imageUrls.current.set(target, url);
      }
      void url.then((value) => {
        if (!cancelled && value) image.src = value;
      });
    }
    return () => {
      cancelled = true;
    };
  }, [html, props.client, props.path, props.workspaceId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const mark of Array.from(root.querySelectorAll<HTMLElement>("mark[data-editor-find-highlight]"))) {
      mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    }
    root.normalize();

    const query = props.findQuery?.trim() ?? "";
    if (!query) {
      props.onFindMatches?.(0);
      return;
    }
    const needle = query.toLocaleLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        return node.textContent && !parent?.closest("button,script,style")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      if (walker.currentNode instanceof Text) textNodes.push(walker.currentNode);
    }
    const marks: HTMLElement[] = [];
    for (const textNode of textNodes) {
      const text = textNode.data;
      const folded = text.toLocaleLowerCase();
      let cursor = 0;
      let match = folded.indexOf(needle, cursor);
      if (match < 0) continue;
      const fragment = document.createDocumentFragment();
      while (match >= 0) {
        if (match > cursor) fragment.append(document.createTextNode(text.slice(cursor, match)));
        const mark = document.createElement("mark");
        mark.dataset.editorFindHighlight = String(marks.length);
        mark.className = "omnirush-document-find-match";
        mark.textContent = text.slice(match, match + query.length);
        fragment.append(mark);
        marks.push(mark);
        cursor = match + query.length;
        match = folded.indexOf(needle, cursor);
      }
      if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
      textNode.replaceWith(fragment);
    }
    const activeIndex = marks.length ? ((props.activeMatchIndex ?? 0) % marks.length + marks.length) % marks.length : -1;
    marks.forEach((mark, index) => {
      mark.classList.toggle("omnirush-document-find-active", index === activeIndex);
    });
    props.onFindMatches?.(marks.length);
    if (activeIndex >= 0) marks[activeIndex]?.scrollIntoView({ block: "center" });
  }, [html, props.activeMatchIndex, props.findQuery, props.onFindMatches]);

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) {
      // The chat renderer wraps images in an "expand" button: nothing to expand here.
      if ((event.target as HTMLElement).closest("button[data-omnirush-image-preview]")) event.preventDefault();
      return;
    }
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    const inline = anchor.getAttribute("data-omnirush-inline-code-path");
    if (href.startsWith("#") && href.length > 1) {
      const id = decodeURIComponent(href.slice(1));
      const heading = rootRef.current?.querySelector(`[id="${CSS.escape(id)}"]`)
        ?? Array.from(rootRef.current?.querySelectorAll("h1,h2,h3,h4,h5,h6") ?? []).find((element) => slug(element.textContent ?? "") === id);
      heading?.scrollIntoView({ block: "start" });
      return;
    }
    if (/^https?:\/\//i.test(href)) {
      props.onOpenExternal(href);
      return;
    }
    const target = resolveProjectPath(props.path, inline ?? href);
    if (target && !/^[a-z][a-z0-9+.-]*:/i.test(inline ?? href)) props.onOpenFile(target);
  };

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto"
      data-editor-preview={props.path}
      data-editor-document-surface
      tabIndex={-1}
      onPointerDownCapture={(event) => event.currentTarget.focus({ preventScroll: true })}
    >
      <div
        ref={rootRef}
        className="markdown-content mx-auto max-w-3xl select-text px-6 py-5 text-foreground"
        onClick={onClick}
        dangerouslySetInnerHTML={html}
      />
    </div>
  );
}

/** GitHub-style heading anchor. */
function slug(text: string): string {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-");
}
