import React, { useCallback, useMemo } from "react";
import VanillaAsycSelect from "react-select/async";
import { WindowedMenuList } from "react-windowed-select";
import extendReactSelect from "../../../../utils/extend-react-select";
import { formatOptionLabel, toReactSelectOptions, useApi } from "../utils";

interface Props {
  value: string | null;
  onChange: (nextValue: string | null) => void;
  isLoading: boolean;
  compoundNames: string[];
  swatchColor: string | undefined;
}

const AsyncSelect = extendReactSelect(VanillaAsycSelect);

function CompoundSearcher({
  value,
  onChange,
  isLoading,
  compoundNames,
  swatchColor,
}: Props) {
  const api = useApi();
  const handleChange = useCallback(
    (option?: { label: string; value: string } | null) => {
      onChange(option?.value || null);
    },
    [onChange]
  );

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const searchResults = await api.searchDimensions({
        substring: inputValue,
        limit: 100,
        type_name: "compound",
      });

      return toReactSelectOptions(searchResults, inputValue, compoundNames, {});
    },
    [api, compoundNames]
  );

  const defaultOptions = useMemo(() => {
    return compoundNames
      ? compoundNames.map((label) => ({
          label,
          value: label,
          property: "label",
        }))
      : undefined;
  }, [compoundNames]);

  return (
    <AsyncSelect
      value={value ? { value, label: value } : null}
      onChange={handleChange}
      menuWidth={310}
      placeholder="Choose a compound..."
      isLoading={isLoading}
      loadOptions={loadOptions}
      defaultOptions={defaultOptions}
      formatOptionLabel={formatOptionLabel}
      components={{ MenuList: WindowedMenuList }}
      swatchColor={swatchColor}
      cacheOptions
      isClearable
    />
  );
}

export default CompoundSearcher;
