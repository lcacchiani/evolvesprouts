import { Fragment, type ReactNode } from 'react';

const DEFAULT_HIGHLIGHT_CLASSNAME = 'es-hero-highlight-word';

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
