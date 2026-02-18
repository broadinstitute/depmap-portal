import React from "react";
import styles from "../styles/ReactTable.scss";

type HighlightedTextProps = {
  text: string;
  searchQuery: string;
  isCurrentMatch: boolean;
};

/**
 * Highlights all occurrences of searchQuery within text.
 * Uses <mark> tags with different classes for regular matches vs current match.
 */
export function HighlightedText({
  text,
  searchQuery,
  isCurrentMatch,
}: HighlightedTextProps) {
  // If no search query, return plain text
  if (!searchQuery || searchQuery.trim() === "") {
    return <>{text}</>;
  }

  const query = searchQuery.toLowerCase();
  const lowerText = text.toLowerCase();

  // Find all occurrences of the search query
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  while (lastIndex < text.length) {
    const matchIndex = lowerText.indexOf(query, lastIndex);

    // No more matches found
    if (matchIndex === -1) {
      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
      break;
    }

    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Add the highlighted match
    const matchText = text.substring(matchIndex, matchIndex + query.length);
    parts.push(
      <mark
        key={matchIndex}
        className={
          isCurrentMatch
            ? styles.currentSearchMatchText
            : styles.searchMatchText
        }
      >
        {matchText}
      </mark>
    );

    lastIndex = matchIndex + query.length;
  }

  return <>{parts}</>;
}
