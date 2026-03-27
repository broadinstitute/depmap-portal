import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { DimensionType } from "@depmap/types";

export default function usePlaceholder(
  dimension_type: string | null,
  isLoading: boolean
) {
  const [dimensionType, setDimensionType] = useState<
    DimensionType | null | undefined
  >(undefined);

  useEffect(() => {
    if (dimension_type === null) {
      setDimensionType(null);
      return;
    }

    cached(breadboxAPI)
      .getDimensionTypes()
      .then((types) => {
        const typeInfo = types.find((t) => t.name === dimension_type);

        if (typeInfo) {
          setDimensionType(typeInfo);
        } else {
          const errorMsg = `Unknown dimension type "${dimension_type}"`;
          throw new Error(errorMsg);
        }
      })
      .catch((e) => {
        window.console.error(e);
        const errorMsg = "Failed to fetch dimension types from Breadbox";
        throw new Error(errorMsg);
      });
  }, [dimension_type]);

  if (isLoading) {
    return "";
  }

  const dimensionLabel = dimensionType
    ? dimensionType.display_name || dimensionType.name
    : "";

  return `Choose ${dimensionLabel} context…`;
}
