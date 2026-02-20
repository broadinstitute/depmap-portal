import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ExternalLink } from "@depmap/common-components";
import { toPortalLink } from "@depmap/globals";

interface Props {
  getValue: () => unknown;
}

const labelMap: Record<string, string> = {};

function CompoundLink({ getValue }: Props) {
  const label = getValue() as string;
  const [linkableLabel, setLinkableLabel] = useState(labelMap[label]);

  useEffect(() => {
    if (labelMap[label]) {
      return;
    }

    (async () => {
      // HACK: Leverage the search indexer to find
      // synonyms that match the given drug label.
      const results = await cached(breadboxAPI).searchDimensions({
        prefix: label,
        type_name: "compound_v2",
        limit: 100,
      });

      const goodResult = results.find((result) => {
        if (result.label.toLowerCase() === label.toLowerCase()) {
          return result;
        }

        const synonyms = result.matching_properties.find(
          ({ property }) => property === "Synonyms"
        );

        if (synonyms?.value.toLowerCase().includes(label.toLowerCase())) {
          return result;
        }

        return null;
      });

      if (goodResult) {
        labelMap[label] = goodResult.label;
        setLinkableLabel(goodResult.label);
      }
    })();
  }, [label]);

  if (!linkableLabel) {
    return label;
  }

  return (
    <ExternalLink href={toPortalLink(`/compound/${linkableLabel}`)}>
      {label}
    </ExternalLink>
  );
}

export default CompoundLink;
