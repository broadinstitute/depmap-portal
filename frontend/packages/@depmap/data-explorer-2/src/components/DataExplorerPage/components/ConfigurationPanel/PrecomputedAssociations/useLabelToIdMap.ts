import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";

// Builds a label → id map for a given dimension type. Used by
// `PrecomputedAssociations` to resolve a legacy `entity_label`-style
// context expression to an id for downstream comparison. Callers that
// pass `dimension_type === "depmap_model"` should NOT use this hook —
// for that legacy edge case the "entity_label" value is already a
// depmap id and no lookup is needed. See the consumer for the inline
// check.
function useLabelToIdMap(dimension_type: string | undefined) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!dimension_type) {
      setMapping({});
      return;
    }

    cached(breadboxAPI)
      .getDimensionTypeIdentifiers(dimension_type)
      .then((identifiers) => {
        const map: Record<string, string> = {};

        identifiers.forEach(({ id, label }) => {
          map[label] = id;
        });

        setMapping(map);
      });
  }, [dimension_type]);

  return mapping;
}

export default useLabelToIdMap;
