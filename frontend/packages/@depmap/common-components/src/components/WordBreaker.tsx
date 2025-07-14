import React from "react";

interface Props {
  text: string | null | undefined;
}

// Interleaves <wbr> elements within a text string so it can wrap more
// naturally. Example:
// given `text` of "RNAi (Achilles+DRIVE+Marcotte, DEMETER2)"
// output is ["RNAi (Achilles+", <wbr>, "DRIVE+", <wbr>, "Marcotte, DEMETER2)"]
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/wbr
function WordBreaker({ text }: Props) {
  if (!text) {
    return null;
  }

  // Just bail out If we get passed something like a React element instead of a
  // string.
  if (typeof text !== "string") {
    return text;
  }

  const elements: React.ReactNode[] = [];
  // Split on the chars +_/@ or at camelCase word boundaries.
  const regex = /[+_/@]|[a-z](?=[A-Z])/g;
  const matches = text.match(regex);

  text.split(regex).forEach((str: string, i) => {
    if (!matches || i === matches.length) {
      elements.push(str);
    } else {
      elements.push(`${str}${matches[i]}`);
      // eslint-disable-next-line react/no-array-index-key
      elements.push(<wbr key={i} />);
    }
  });

  return <>{elements}</>;
}

export default WordBreaker;
