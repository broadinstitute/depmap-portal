import React, { useCallback, useMemo } from "react";
import VanillaAsycSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import { DataExplorerContext } from "@depmap/types";
import { entityLabelFromContext } from "../../../utils/context";
import extendReactSelect from "../../../utils/extend-react-select";
import {
  formatOptionLabel,
  getPlaceholder,
  toDemapModelOptions,
  toOutputValue,
  toReactSelectOptions,
  useEntityLabels,
  useSearch,
} from "./utils";

interface Props {
  entity_type: string;
  value: DataExplorerContext | null;
  onChange: (context: DataExplorerContext | null) => void;
  dataType: string | null;
  dataset_id: string | null;
  units: string | null;
  swatchColor?: string;
}

const AsyncSelect = extendReactSelect(VanillaAsycSelect);

function EntitySelect({
  value,
  onChange,
  entity_type,
  dataType,
  dataset_id,
  units,
  swatchColor = undefined,
}: Props) {
  const search = useSearch();

  const {
    aliases,
    disabledReasons,
    entityLabels,
    error,
    waitForCachedValues,
  } = useEntityLabels(entity_type, dataType, dataset_id, units);

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const results = await search(inputValue, entity_type);

      // HACK: We want the user to be able to start typing right away, before
      // waiting for the `useEntityLabels` hook to have updated. This will run
      // quickly because the initial request from that hook is already in
      // flight.
      const cached = await waitForCachedValues();

      // special case
      if (entity_type === "depmap_model") {
        return toDemapModelOptions(
          results,
          inputValue,
          cached.entityLabels || [],
          cached.aliases || [],
          cached.disabledReasons
        );
      }

      return toReactSelectOptions(
        results,
        inputValue,
        cached.entityLabels || [],
        cached.disabledReasons
      );
    },
    [search, entity_type, waitForCachedValues]
  );

  const defaultOptions = useMemo(() => {
    // special case
    if (entity_type === "depmap_model") {
      return toDemapModelOptions(
        [],
        null,
        entityLabels || [],
        aliases || [],
        disabledReasons
      );
    }

    return toReactSelectOptions([], null, entityLabels || [], disabledReasons);
  }, [aliases, entity_type, entityLabels, disabledReasons]);

  const notFound = useMemo(() => {
    if (!dataset_id || !value || !entityLabels) {
      return null;
    }

    if (value.context_type !== entity_type) {
      return null;
    }

    const label = entityLabelFromContext(value);

    if (disabledReasons[label as string]) {
      return `${value.name} not found`;
    }

    if (new Set<string | null>(entityLabels).has(label)) {
      return null;
    }

    if (
      aliases &&
      aliases.length > 0 &&
      new Set<string | null>(aliases[0].values).has(
        entityLabelFromContext(value)
      )
    ) {
      return null;
    }

    return `${value.name} not found`;
  }, [aliases, dataset_id, disabledReasons, entity_type, entityLabels, value]);

  const displayValue =
    !value || notFound
      ? null
      : { value: entityLabelFromContext(value) as string, label: value.name };

  return (
    <AsyncSelect
      value={displayValue}
      hasError={Boolean(notFound || error)}
      onChange={(option) => onChange(toOutputValue(entity_type, option))}
      menuWidth={310}
      placeholder={notFound || getPlaceholder(entity_type)}
      isLoading={!entityLabels}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      cacheOptions={`${entity_type}-${dataType}-${units}-${dataset_id}`}
      swatchColor={swatchColor}
      isClearable
    />
  );
}

export default EntitySelect;
