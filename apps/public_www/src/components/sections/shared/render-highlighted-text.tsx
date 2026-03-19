import { Fragment, type ReactNode } from 'react';

const DEFAULT_HIGHLIGHT_CLASSNAME = 'es-highlight-word';
const QUOTED_TEXT_PATTERN = /"([^"]+)"|“([^”]+)”|「([^」]+)」|『([^』]+)』/g;

interface TextSegment {
  type: 'plain' | 'quote';
  value: string;
}

function splitQuotedSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(QUOTED_TEXT_PATTERN)) {
    const startIndex = match.index ?? 0;
    if (startIndex > cursor) {
      segments.push({
        type: 'plain',
        value: text.slice(cursor, startIndex),
      });
    }

    const quoteValue = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (quoteValue) {
      segments.push({
        type: 'quote',
        value: quoteValue,
      });
    } else {
      segments.push({
        type: 'plain',
        value: match[0],
      });
    }

    cursor = startIndex + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({
      type: 'plain',
      value: text.slice(cursor),
    });
  }

  return segments;
}

export function renderHighlightedText(
  text: string,
  highlightPhrase?: string,
  highlightClassName: string = DEFAULT_HIGHLIGHT_CLASSNAME,
): ReactNode {
  const normalizedHighlightPhrase = highlightPhrase?.trim();
  if (!normalizedHighlightPhrase) {
    return text;
  }

  const sections = text.split(normalizedHighlightPhrase);
  if (sections.length === 1) {
    return text;
  }

  return sections.map((section, index) => (
    <Fragment key={`${section}-${index}`}>
      {section}
      {index < sections.length - 1 ? (
        <span className={highlightClassName}>{normalizedHighlightPhrase}</span>
      ) : null}
    </Fragment>
  ));
}

export function renderQuotedDescriptionText(
  text: string,
  highlightPhrase?: string,
  highlightClassName: string = DEFAULT_HIGHLIGHT_CLASSNAME,
): ReactNode {
  const segments = splitQuotedSegments(text);
  const hasQuoteSegment = segments.some((segment) => segment.type === 'quote');
  if (!hasQuoteSegment) {
    return renderHighlightedText(text, highlightPhrase, highlightClassName);
  }

  return segments.map((segment, index) => {
    if (segment.type === 'plain') {
      return (
        <Fragment key={`${segment.type}-${index}`}>
          {renderHighlightedText(segment.value, highlightPhrase, highlightClassName)}
        </Fragment>
      );
    }

    return (
      <span key={`${segment.type}-${index}`} className='es-quote'>
        <span
          aria-hidden='true'
          className='es-quote-icon es-testimonial-quote-icon'
        />
        <span className='es-quote-text'>
          {renderHighlightedText(segment.value, highlightPhrase, highlightClassName)}
        </span>
      </span>
    );
  });
}
