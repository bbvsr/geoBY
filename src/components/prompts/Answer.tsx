"use client";
import { Fragment, useMemo } from "react";
import { plainMarkdown, segmentAnswer } from "@/lib/highlight";

/** Cevap metni: marka işaretleyiciyle, rakipler altı çizili, bağlantılar tıklanabilir. */
export function Answer({
  text,
  brand,
  rivals,
}: {
  text: string;
  brand: { name: string; domain: string };
  rivals: { name: string; domain: string }[];
}) {
  const segments = useMemo(() => segmentAnswer(plainMarkdown(text), brand, rivals), [text, brand, rivals]);
  return (
    <div className="max-w-[68ch] text-[14.5px] leading-[1.65] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">
      {segments.map((s, i) =>
        s.kind === "brand" ? (
          <mark key={i} className="brand font-medium text-ink">
            {s.text}
          </mark>
        ) : s.kind === "rival" ? (
          <mark key={i} className="rival">
            {s.text}
          </mark>
        ) : s.kind === "link" ? (
          <a key={i} href={s.text} target="_blank" rel="noopener noreferrer nofollow" className="text-ink underline decoration-ink-4 underline-offset-2">
            {s.text}
          </a>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        )
      )}
    </div>
  );
}
