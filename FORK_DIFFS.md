# Fork differences

Compared with `omnirush-ai/omnirush-gui`:

- Intel-only macOS releases; app updates use this fork's GitHub feed.
- Upstream sync is maintained as a small, testable downstream patch stack.
- Reasoning/streaming render and transcript-progress performance optimizations; reduced Intel window blur.
- Find in artifact previews; prompt Select All excludes attachment chips; editor scroll position is preserved.
- Markdown code blocks follow dark/custom themes; desktop cleanup uses fork retention policy.
- Internal links are clickable in artifact previews: `#anchor` scrolls the document, a relative link opens the file in the panel.
