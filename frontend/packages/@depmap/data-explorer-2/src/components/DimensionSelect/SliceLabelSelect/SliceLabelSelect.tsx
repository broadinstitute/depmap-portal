import React, { useCallback, useEffect, useMemo, useRef } from "react";
import VanillaAsycSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import { DataExplorerContext } from "@depmap/types";
import { sliceLabelFromContext } from "../../../utils/context";
import extendReactSelect from "../../../utils/extend-react-select";
import {
  formatOptionLabel,
  getPlaceholder,
  toDemapModelOptions,
  toOutputValue,
  toReactSelectOptions,
  useSliceLabels,
  useSearch,
} from "./utils";

interface Props {
  slice_type: string;
  value: DataExplorerContext | null;
  onChange: (context: DataExplorerContext | null) => void;
  dataType: string | null;
  dataset_id: string | null;
  units: string | null;
  swatchColor?: string;
  label?: string;
}

const AsyncSelect = extendReactSelect(VanillaAsycSelect);

function SliceLabelSelect({
  value,
  onChange,
  slice_type,
  dataType,
  dataset_id,
  units,
  swatchColor = undefined,
  label = undefined,
}: Props) {
  const search = useSearch();
  const searchQuery = useRef("");

  useEffect(() => {
    searchQuery.current = "";
  }, [slice_type, dataType, dataset_id]);

  const {
    aliases,
    disabledReasons,
    sliceLabels,
    error,
    waitForCachedValues,
  } = useSliceLabels(slice_type, dataType, dataset_id, units);

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const results = await search(inputValue, slice_type);

      // HACK: We want the user to be able to start typing right away, before
      // waiting for the `useSliceLabels` hook to have updated. This will run
      // quickly because the initial request from that hook is already in
      // flight.
      const cached = await waitForCachedValues();

      // special case
      if (slice_type === "depmap_model") {
        return toDemapModelOptions(
          results,
          inputValue,
          cached.sliceLabels || [],
          cached.aliases || [],
          cached.disabledReasons
        );
      }

      return toReactSelectOptions(
        results,
        inputValue,
        cached.sliceLabels || [],
        cached.disabledReasons
      );
    },
    [search, slice_type, waitForCachedValues]
  );

  const defaultOptions = useMemo(() => {
    // special case
    if (slice_type === "depmap_model") {
      return toDemapModelOptions(
        [],
        null,
        sliceLabels || [],
        aliases || [],
        disabledReasons
      );
    }

    return toReactSelectOptions([], null, sliceLabels || [], disabledReasons);
  }, [aliases, slice_type, sliceLabels, disabledReasons]);

  const notFound = useMemo(() => {
    if (!dataset_id || !value || !sliceLabels) {
      return null;
    }

    if (value.context_type !== slice_type) {
      return null;
    }

    const sliceLabel = sliceLabelFromContext(value);

    if (disabledReasons[sliceLabel as string]) {
      return `${value.name} not found`;
    }

    if (new Set<string | null>(sliceLabels).has(sliceLabel)) {
      return null;
    }

    if (
      aliases &&
      aliases.length > 0 &&
      new Set<string | null>(aliases[0].values).has(
        sliceLabelFromContext(value)
      )
    ) {
      return null;
    }

    return `${value.name} not found`;
  }, [aliases, dataset_id, disabledReasons, slice_type, sliceLabels, value]);

  const displayValue =
    !value || notFound
      ? null
      : { value: sliceLabelFromContext(value) as string, label: value.name };

  return (
    <AsyncSelect
      label={label}
      value={displayValue}
      hasError={Boolean(notFound || error)}
      onChange={(option) => onChange(toOutputValue(slice_type, option))}
      menuWidth={310}
      placeholder={notFound || getPlaceholder(slice_type)}
      isLoading={!sliceLabels}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      cacheOptions={`${slice_type}-${dataType}-${units}-${dataset_id}`}
      swatchColor={swatchColor}
      isClearable
      isEditable
      editableInputValue={searchQuery.current}
      onEditInputValue={(editedText) => {
        searchQuery.current = editedText;
      }}
    />
  );
}

export default SliceLabelSelect;
