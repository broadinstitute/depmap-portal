import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";

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
          if (dimension_type === "depmap_model") {
            map[id] = label;
          } else {
            map[label] = id;
          }
        });

        setMapping(map);
      });
  }, [dimension_type]);

  return mapping;
}

export default useLabelToIdMap;
