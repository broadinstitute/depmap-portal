import React from "react";
import WordBreaker from "./WordBreaker";

interface Props {
  text: string;
  termToHiglight: string | string[];
  style?: React.CSSProperties;
  // Set this to `true` if you want highlight within words (rather than exactly
  // matching words)
  matchPartialTerms?: boolean;
}

export const colors = [
  "#FFEE00",
  "#FF8152",
  "#32CD32",
  "#03A9F4",
  "#DF9EEA",
  "#FFA500",
  "#FF6347",
  "#D1E7B7",
];

// Wraps `termToHiglight` in a <span> with a yellow background. Also breaks
// words just for good measure.
function Highlighter({
  text,
  termToHiglight,
  style = undefined,
  matchPartialTerms = false,
}: Props) {
  if (!text) {
    return null;
  }

  if (!termToHiglight || !termToHiglight.length) {
    return text;
  }

  const terms = Array.isArray(termToHiglight)
    ? termToHiglight
    : [termToHiglight];

  const escapedTerms = terms.map((term) => {
    return term.replace(
      // See https://stackoverflow.com/a/9310752
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      "\\$&"
    );
  });

  const regexPattern = matchPartialTerms
    ? `(${escapedTerms.join("|")})`
    : `\\b(${escapedTerms.join("|")})\\b`;

  const regex = new RegExp(regexPattern, "gi");
  const parts = text.split(regex);

  const getColor = (part: string) => {
    const index =
      terms.findIndex(
        (term: string) => part.toLowerCase() === term.toLowerCase()
      ) || 0;

    return colors[index % colors.length];
  };

  return (
    <>
      {parts.map((part, i) =>
        terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={`${i}-h`}
            style={{ ...style, backgroundColor: getColor(part) }}
          >
            <WordBreaker text={part} />
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

Highlighter.colors = colors;

export default Highlighter;
