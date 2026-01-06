import React, { useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import { DataExplorerContextV2 } from "@depmap/types";

interface Props {
  inGroupContext?: DataExplorerContextV2;
  outGroupContext?: DataExplorerContextV2;
  entities: string;
}

function OverlappingIdentifiersWarning({
  inGroupContext = undefined,
  outGroupContext = undefined,
  entities,
}: Props) {
  const [overlap, setOverlap] = useState<string[]>([]);

  useEffect(() => {
    if (!inGroupContext || !outGroupContext) {
      setOverlap([]);
      return;
    }

    (async () => {
      const inGroupIdentifiers = await cached(breadboxAPI).evaluateContext(
        inGroupContext
      );
      const outGroupIdentifiers = await cached(breadboxAPI).evaluateContext(
        outGroupContext
      );

      const lookupLabel: Record<string, string> = {};

      inGroupIdentifiers.ids.forEach((id, index) => {
        lookupLabel[id] = inGroupIdentifiers.labels[index] || id;
      });

      outGroupIdentifiers.ids.forEach((id, index) => {
        lookupLabel[id] = outGroupIdentifiers.labels[index] || id;
      });

      const inGroup = new Set(inGroupIdentifiers.ids);
      const outGroup = new Set(outGroupIdentifiers.ids);
      const allIds = new Set([...inGroup, ...outGroup]);
      const overlappingIds = [];

      for (const id of allIds) {
        if (inGroup.has(id) && outGroup.has(id)) {
          overlappingIds.push(id);
        }
      }

      setOverlap(overlappingIds.map((id) => lookupLabel[id]));
    })();
  }, [inGroupContext, outGroupContext]);

  if (overlap.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 10, maxHeight: 200, overflow: "auto" }}>
      <Alert bsStyle="warning">
        <p>
          Warning: In and out groups have overlapping {entities}. Analysis will
          be run with overlapping {entities} removed from the out group.
        </p>
        <p>
          Overlapping {entities}: {overlap.join(", ")}
        </p>
      </Alert>
    </div>
  );
}
export default OverlappingIdentifiersWarning;
