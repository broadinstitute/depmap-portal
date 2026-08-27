import { useCallback, useEffect, useRef, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { fetchDimensionIdentifiers } from "./api-helpers";
import convertSearchResultToOptions, {
  checkValueCompatibility,
} from "./convertSearchResultToOptions";
import { tokenize } from "./utils";

// react-select builds a full menu-option object (with several bound
// closures) for every entry in `options`. Handing it every identifier for
// a dimension type -- which can be hundreds of thousands of rows -- makes
// the Select extremely slow to render and bloats memory. Real searches
// already go through `useSearch` below, which is bounded by the backend's
// `limit` param, so the *default* (pre-search) list only needs to show a
// small, useful sample.
const MAX_DEFAULT_OPTIONS = 100;

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
      // `convertSearchResultToOptions`. Only convert a bounded slice of
      // identifiers -- see MAX_DEFAULT_OPTIONS above.
      const result = identifiers
        .slice(0, MAX_DEFAULT_OPTIONS)
        .map((identifier) => {
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

/**
 * Determines whether the currently selected value is still valid/enabled
 * for the given slice type, data type, and dataset. This is checked
 * directly against the backend rather than by scanning `defaultOptions`,
 * since `defaultOptions` is now truncated (see MAX_DEFAULT_OPTIONS above)
 * and may not contain the current value even when it's perfectly valid.
 *
 * Also returns the value's label so callers can continue to show it (e.g.
 * in a search box) when it turns out to be disabled.
 */
export const useValueValidity = (
  slice_type: string,
  dataType: string | null,
  dataset_id: string | null,
  value: { id: string; label: string } | null
) => {
  const [invalidValue, setInvalidValue] = useState(false);
  const [disabledValueLabel, setDisabledValueLabel] = useState<string | null>(
    null
  );
  const requestId = useRef(0);

  useEffect(() => {
    if (!dataset_id || !value) {
      setInvalidValue(false);
      setDisabledValueLabel(null);
      return;
    }

    requestId.current += 1;
    const thisRequestId = requestId.current;

    (async () => {
      const { isDisabled } = await checkValueCompatibility(
        value.id,
        slice_type,
        dataType,
        dataset_id
      );

      // Ignore stale responses (e.g. the user changed `value`/`dataset_id`
      // again before this request resolved).
      if (thisRequestId !== requestId.current) {
        return;
      }

      setInvalidValue(isDisabled);
      setDisabledValueLabel(isDisabled ? value.label : null);
    })();
  }, [slice_type, dataType, dataset_id, value]);

  return { invalidValue, disabledValueLabel };
};
