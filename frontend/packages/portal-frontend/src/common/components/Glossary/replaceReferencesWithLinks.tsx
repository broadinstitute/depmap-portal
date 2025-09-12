import React from "react";
import { GlossaryItem } from "src/common/components/Glossary/types";

// Takes a string definition and replaces any
// placeholder references with hyperlinks. Example:
// where
// definition = "Here is one link: [firstLink], and another: [secondLink]."
// and
// references = {
//  firstLink: { url: "https://www.example.com" },
//  secondLink: { url: "https://www.zombo.com", text: "with text" }
// }
// outputs
// [
//   "Here is one link: ",
//   <a href="https://www.example.com">https://www.example.com</a>,
//   ", and another: ",
//   <a href="https://www.zombo.com">with text</a>,
//   "."
// ]

export default function replaceReferencesWithLinks(
  definition: string,
  references?: GlossaryItem["references"]
): React.ReactNode[] {
  const placeholders = Object.keys(references || {});
  let parts = [definition];

  placeholders.forEach((placeholder) => {
    const nestedParts = parts.map((part) => {
      if (typeof part !== "string") {
        return part;
      }

      const search = `[${placeholder}]`;
      const index = part.indexOf(search);

      if (index === -1) {
        return part;
      }

      const { url } = references![placeholder];

      return [
        part.slice(0, index),
        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
          {references![placeholder].text || url}
        </a>,
        part.slice(index + search.length),
      ];
    });

    parts = [].concat(...(nestedParts as any[]));
  });

  return parts;
}

export function replaceSuperscriptTags(definition: string): React.ReactNode[] {
  const superscriptCount = (definition.match(/<sup>/g) || []).length;
  let parts = [definition];

  for (let i = 0; i < superscriptCount; i++) {
    const superscriptStart = "<sup>";
    const nestedParts = parts.map((part) => {
      if (typeof part !== "string") {
        return part;
      }
      const lastIndex = i;
      const superIndex = part.indexOf(superscriptStart, lastIndex);
      if (superIndex === -1) {
        return part;
      }
      return [
        part.slice(0, superIndex),
        <sup key={i}>
          {part.slice(
            superIndex + superscriptStart.length,
            part.indexOf("</sup>", superIndex)
          )}
        </sup>,
        part.slice(
          part.indexOf("</sup>", superIndex) + "</sup>".length,
          part.length + "</sup>".length
        ),
      ];
    });
    parts = [].concat(...(nestedParts as any[]));
  }

  return parts;
}
