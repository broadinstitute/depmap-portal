import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { DimensionType } from "@depmap/types";

export default function usePlaceholder(
  context_type: string,
  isLoading: boolean
) {
  const [dimensionType, setDimensionType] = useState<DimensionType | null>(
    null
  );

  useEffect(() => {
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

  if (isLoading) {
    return "";
  }

  const dimensionLabel = dimensionType
    ? dimensionType.display_name || dimensionType.name
    : "";

  return `Choose ${dimensionLabel} context…`;
}
