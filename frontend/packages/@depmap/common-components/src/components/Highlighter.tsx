import React from "react";
import WordBreaker from "./WordBreaker";

interface Props {
  text: string;
  termToHiglight: string;
  textColor?: string;
  // Set this to `true` if you want highlight within words (rather than exactly
  // matching words)
  matchPartialTerms?: boolean;
}

// Wraps `termToHiglight` in a <span> with a yellow background. Also breaks
// words just for good measure.
function Highlighter({
  text,
  termToHiglight,
  textColor = "black",
  matchPartialTerms = false,
}: Props) {
  if (!text) {
    return null;
  }

  if (!termToHiglight) {
    return text;
  }

  const escapedTerm = termToHiglight.replace(
    // See https://stackoverflow.com/a/9310752
    /[-[\]{}()*+?.,\\^$|#\s]/g,
    "\\$&"
  );

  const regex = matchPartialTerms
    ? RegExp(`${escapedTerm}`, "gi")
    : RegExp(`\\b${escapedTerm}\\b`, "gi");

  const elements: React.ReactNode[] = [];
  const matches = text.match(regex);

  text.split(regex).forEach((str, i) => {
    // eslint-disable-next-line react/no-array-index-key
    elements.push(<WordBreaker key={i} text={str} />);

    if (matches && i < matches.length) {
      elements.push(
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={`${i}-h`}
          style={{ color: textColor, backgroundColor: "yellow" }}
        >
          <WordBreaker text={matches[i]} />
        </span>
      );
    }
  });

  return <>{elements}</>;
}

export default Highlighter;
