import { useCallback, useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { useDimensionType } from "../../../utils/misc";
import { fetchDimensionIdentifiers } from "../api-helpers";
import convertSearchResultToOptions from "./convertSearchResultToOptions";
import { tokenize } from "./utils";

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

export const useDefaultOptions = (
  slice_type: string,
  dataType: string | null,
  dataset_id: string | null
) => {
  const [defaultOptions, setDefaultOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [isLoadingDefaultOptions, setIsLoadingDefaultOptions] = useState(true);

  useEffect(() => {
    (async () => {
      const identifiers = await fetchDimensionIdentifiers(slice_type);

      // Make this look like a search result so we can reuse the logic of
      // `convertSearchResultToOptions`.
      const result = identifiers.map((identifier) => {
        return {
          type_name: slice_type,
          id: identifier.id,
          label: identifier.label,
          matching_properties: [
            {
              property: "label",
              value: identifier.label,
            },
          ],
        };
      });

      const options = await convertSearchResultToOptions(
        [],
        result,
        slice_type,
        dataType,
        dataset_id
      );

      setDefaultOptions(options);
      setIsLoadingDefaultOptions(false);
    })();
  }, [slice_type, dataType, dataset_id]);

  return { defaultOptions, isLoadingDefaultOptions };
};

export const useSearch = (
  slice_type: string,
  dataType: string | null,
  dataset_id: string | null
) => {
  return useCallback(
    async (input: string) => {
      const tokens = tokenize(input);

      const result = await breadboxAPI.searchDimensions({
        substring: tokens,
        type_name: slice_type,
        limit: 100,
      });

      return convertSearchResultToOptions(
        tokens,
        result,
        slice_type,
        dataType,
        dataset_id
      );
    },
    [slice_type, dataType, dataset_id]
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
