import React, { useCallback } from "react";
import { Data, Filter } from "src/common/models/discoveryAppFilters";
import { FilterGroup } from "src/common/components/FilterControls/types";
import FilterInput from "src/common/components/FilterControls/FilterInput";
import styles from "src/common/styles/FilterControls.scss";

interface Props {
  group: FilterGroup;
  hasChanges: boolean;
  onChangeFilter: (key: string, value: any) => void;
  data: Data | null;
  filters: Filter[] | null;
  altStyle?: any;
  disableHistogram?: boolean;
  selectedColor?: string | null;
}

function FilterInputGroup({
  group,
  filters,
  hasChanges,
  onChangeFilter,
  data,
  altStyle = null,
  disableHistogram = false,
  selectedColor = null,
}: Props) {
  const updateAll = useCallback(
    (keys: string[], value: boolean) => {
      filters
        ?.filter((filter: Filter) => keys.indexOf(filter.key) > -1)
        .forEach((filter: Filter) => onChangeFilter(filter.key, value));
    },
    [filters, onChangeFilter]
  );

  if (!data || !filters) {
    return null;
  }

  return (
    <div
      className={altStyle ? altStyle.FilterInputGroup : styles.FilterInputGroup}
    >
      {group.label && (
        <div className={styles.subsectionLabel}>
          <span>{group.label}</span>
          {hasChanges && (
            <span className={styles.groupChangedIndicator}>{"\u2022"}</span>
          )}
        </div>
      )}
      {group.groupCheckboxes && (
        <div className={styles.multiSelectButtons}>
          <button type="button" onClick={() => updateAll(group.keys, true)}>
            Select all
          </button>
          {" | "}
          <button type="button" onClick={() => updateAll(group.keys, false)}>
            Clear all
          </button>
        </div>
      )}
      <div>
        {group.keys.map((key: string) => {
          const filter = filters.find((f: Filter) => key === f.key);

          if (!filter) {
            window.console.warn(
              `WARNING: Could not find filter with key "${key}".`
            );

            return null;
          }

          return (
            <FilterInput
              key={filter.key}
              data={data}
              filter={filter}
              onChangeFilter={onChangeFilter}
              disableHistogram={disableHistogram}
              selectedColor={selectedColor}
            />
          );
        })}
      </div>
      <hr />
    </div>
  );
}

export default FilterInputGroup;
