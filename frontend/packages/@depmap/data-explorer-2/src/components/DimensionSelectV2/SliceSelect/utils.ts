import { useCallback, useContext, useEffect, useState } from "react";
import { ApiContext } from "@depmap/api";
import { DataExplorerContextV2 } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { useDimensionType } from "../../../utils/misc";

export const getIdentifier = (context: DataExplorerContextV2 | null) => {
  if (!context?.expr) {
    return null;
  }

  if (typeof context.expr !== "object") {
    return null;
  }

  return context.expr["=="]?.[1] || null;
};

export const useLabel = (index_type: string | null) => {
  const { dimensionType, isDimensionTypeLoading } = useDimensionType(
    index_type
  );

  if (isDimensionTypeLoading) {
    return "...";
  }

  if (!dimensionType) {
    return "Dimension";
  }

  return dimensionType.axis === "sample" ? "Feature" : "Sample";
};

export const useDefaultOptions = (slice_type: string) => {
  const api = useDataExplorerApi();
  const [defaultOptions, setDefaultOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [isLoadingDefaultOptions, setIsLoadingDefaultOptions] = useState(true);

  useEffect(() => {
    api.fetchDimensionIdentifiers(slice_type).then((identifiers) => {
      const options = identifiers.map(({ id, label }) => ({
        value: id,
        label,
      }));

      setDefaultOptions(options);
      setIsLoadingDefaultOptions(false);
    });
  }, [api, slice_type]);

  return { defaultOptions, isLoadingDefaultOptions };
};

function tokenize(input: string | null) {
  const str = input || "";
  const tokens = str.split(/\s+/g).filter(Boolean);
  const uniqueTokens = new Set(tokens);

  return [...uniqueTokens];
}

export const useSearch = () => {
  const apiContext = useContext(ApiContext);

  return useCallback(
    (input: string, type_name: string) => {
      return apiContext.getApi().searchDimensions({
        substring: tokenize(input),
        type_name,
        limit: 100,
      });
    },
    [apiContext]
  );
};

export const usePlaceholder = (slice_type: string) => {
  const { dimensionType, isDimensionTypeLoading } = useDimensionType(
    slice_type
  );

  if (isDimensionTypeLoading || !dimensionType) {
    return "Select…";
  }

  return `Choose ${dimensionType.display_name}…`;
};

export const toOutputValue = (
  slice_type: string,
  selectedOption?: { label: string; value: string } | null
) => {
  if (!selectedOption) {
    return null;
  }

  const { label, value } = selectedOption;

  return {
    dimension_type: slice_type,
    name: label || value,
    expr: { "==": [{ var: "given_id" }, value] },
    vars: {},
  };
};
