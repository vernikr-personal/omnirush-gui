"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { MessageContent } from "@/components/ui/message"
import { cn } from "@/lib/utils"

/** Matches the panel's `duration-150` close transition, plus a frame of slack. */
const REASONING_COLLAPSE_MS = 180

type ReasoningBlockProps = {
  text: string
  isStreaming: boolean
  className?: string
}

/**
 * Thinking is collapsed by default — a single "Thinking… / Thought"
 * line with a chevron; the full reasoning renders as markdown only
 * when the user opens it.
 *
 * That default is also what keeps a run cheap. A reasoning trace streams as
 * one long markdown block, and open by default meant every animation frame
 * re-lexed, sanitized and re-laid-out the whole trace while the model thought
 * — the most expensive thing the renderer does, for text most users never
 * read. The panel keeps its children out of the tree while collapsed, so a
 * closed trace costs one line of DOM no matter how much the model writes.
 */
export function ReasoningBlock({ text, isStreaming, className }: ReasoningBlockProps) {
  const [open, setOpen] = useState(false)
  // The panel animates its own height, so the markdown has to outlive the
  // click that closes it by exactly one transition. Past that it leaves the
  // tree and stops costing anything.
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => setClosing(false), REASONING_COLLAPSE_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setClosing(true)
  }

  const mounted = open || closing

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className={cn("w-full", className)} data-reasoning-block="">
      <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <span className={cn(isStreaming && "animate-pulse")}>
          {isStreaming ? "Reasoning trace…" : "Reasoning trace"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 text-muted-foreground/70 transition-transform duration-150 group-data-panel-open:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-starting-style:h-0 data-ending-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
        {mounted ? (
          <MessageContent
            markdown
            isStreaming={isStreaming}
            className="text-muted-foreground prose mt-1 w-full min-w-0 rounded-lg bg-transparent p-0 text-sm"
          >
            {text}
          </MessageContent>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
