import type { ReactNode } from "react";

function sanitizeAiSummaryLines(lines: string[]): string[] {
  const cleaned: string[] = [];
  let lastWasBlank = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (!lastWasBlank) {
        cleaned.push("");
        lastWasBlank = true;
      }
      continue;
    }

    if (/^\*{3,}$/.test(trimmed)) {
      continue;
    }

    cleaned.push(rawLine);
    lastWasBlank = false;
  }

  return cleaned;
}

function normalizeAiSummaryLines(lines: string[]): string[] {
  const normalized: string[] = [];
  let expectedIndex = 1;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      normalized.push("");
      expectedIndex = 1;
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingTextRaw = headingMatch[1];
      const headingText = headingTextRaw.replace(
        /^(\s*)(\d+)\.\s+/,
        (_m, pre, num) => `${pre || ""}${num}\u200B. `,
      );
      normalized.push(headingText);
      expectedIndex = 1;
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const text = orderedMatch[2];
      normalized.push(`${expectedIndex}. ${text}`);
      expectedIndex += 1;
      continue;
    }

    normalized.push(rawLine);
  }

  return normalized;
}

export function renderFormattedContent(content?: string): ReactNode {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  const listItems: string[] = [];
  const orderedItems: string[] = [];
  const bulletPattern = /^\s*([*-])\s+/;
  const orderedPattern = /^\s*(\d+)\.\s+/;
  let keyIndex = 0;

  const renderInline = (value: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push(value.slice(lastIndex, match.index));
      }

      const token = match[0];
      if (token.startsWith("**")) {
        parts.push(
          <strong key={`strong-${keyIndex++}`}>{token.slice(2, -2)}</strong>,
        );
      } else if (token.startsWith("_")) {
        parts.push(<em key={`em-${keyIndex++}`}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith("*")) {
        parts.push(<em key={`em-${keyIndex++}`}>{token.slice(1, -1)}</em>);
      }

      lastIndex = match.index + token.length;
    }

    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    return parts;
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${keyIndex++}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={`item-${keyIndex}-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems.length = 0;
  };

  const flushOrderedList = () => {
    if (!orderedItems.length) return;
    blocks.push(
      <ol key={`olist-${keyIndex++}`} className="list-decimal space-y-1 pl-5">
        {orderedItems.map((item, index) => (
          <li key={`oitem-${keyIndex}-${index}`}>{renderInline(item)}</li>
        ))}
      </ol>,
    );
    orderedItems.length = 0;
  };

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trimEnd();

    if (!trimmed.trim()) {
      flushList();
      flushOrderedList();
      blocks.push(<div key={`spacer-${keyIndex++}`} className="h-3" />);
      return;
    }

    if (bulletPattern.test(trimmed)) {
      flushOrderedList();
      listItems.push(trimmed.replace(bulletPattern, ""));
      return;
    }

    if (orderedPattern.test(trimmed)) {
      flushList();
      orderedItems.push(trimmed.replace(orderedPattern, ""));
      return;
    }

    flushList();
    flushOrderedList();
    blocks.push(
      <p key={`p-${keyIndex++}`} className="whitespace-pre-wrap">
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushList();
  flushOrderedList();

  return <div className="space-y-2">{blocks}</div>;
}

export function renderAiSummaryContent(content?: string): ReactNode {
  if (!content) return null;

  console.log(content);

  const lines = content.split("\n");
  const sanitized = sanitizeAiSummaryLines(lines);
  const normalized = normalizeAiSummaryLines(sanitized);

  return renderFormattedContent(normalized.join("\n"));
}
