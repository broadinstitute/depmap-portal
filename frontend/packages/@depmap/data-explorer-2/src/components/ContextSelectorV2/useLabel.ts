import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { DimensionType } from "@depmap/types";

export default function useLabel(
  label:
    | React.ReactNode
    | ((dimensionType: DimensionType | null) => string)
    | undefined,
  context_type: string | null
) {
  const [dimensionType, setDimensionType] = useState<
    DimensionType | null | undefined
  >(undefined);

  useEffect(() => {
    if (context_type === null) {
      setDimensionType(null);
      return;
    }

    cached(breadboxAPI)
      .getDimensionTypes()
      .then((types) => {
        const typeInfo = types.find((t) => t.name === context_type);

        if (typeInfo) {
          setDimensionType(typeInfo);
        } else {
          const errorMsg = `Unknown dimension type "${context_type}"`;
          throw new Error(errorMsg);
        }
      })
      .catch((e) => {
        window.console.error(e);
        const errorMsg = "Failed to fetch dimension types from Breadbox";
        throw new Error(errorMsg);
      });
  }, [context_type]);

  if (typeof label === "function") {
    return dimensionType !== undefined ? label(dimensionType) : "...";
  }

  return label;
}
