import React, { useCallback } from "react";
import { Data, Filter } from "src/common/models/discoveryAppFilters";
import {
  FilterLayout,
  FilterSection,
  FilterGroup,
} from "src/common/components/FilterControls/types";
import FilterAccordions from "src/common/components/FilterControls/FilterAccordions";
import FilterAccordion from "src/common/components/FilterControls/FilterAccordion";
import FilterInputGroup from "src/common/components/FilterControls/FilterInputGroup";
import styles from "src/common/styles/FilterControls.scss";

interface Props {
  /**
   * An object whose values are arrays. Think of the keys as column names and
   * the values as the sets of rows for each column.
   */
  data: Data | null;
  /**
   * An array of filters, including the current value for each filter.
   */
  filters: Filter[] | null;
  /**
   * An array containing the keys of the filters which should be rendered was a
   * "has changes" indicator.
   */
  changedFilters: string[];
  /**
   * This describes how the filters should be represented as a set of
   * collapisble sections.
   */
  layout: FilterLayout;
  /**
   * Callback called when a filter's value is changed.
   */
  onChangeFilter: (key: string, value: any) => void;
  /**
   * Callback called when the reset button is clicked. Should restore `filters`
   * to an initial state.
   */
  onClickReset: () => void;
  /**
   * The index of the section which should be initially expanded.
   *
   * @default null
   */
  defaultExpandedIndex?: number;
  /**
   * Set this to True to turn off the histogram image that appears above the slider.
   */
  disableHistogram?: boolean;
}

function FilterControls({
  data,
  filters,
  changedFilters,
  layout,
  onChangeFilter,
  onClickReset,
  defaultExpandedIndex = undefined,
  disableHistogram = false,
}: Props) {
  const groupHasChanges = useCallback(
    (group: FilterGroup) =>
      group.keys.some((key: any) => changedFilters.indexOf(key) > -1),
    [changedFilters]
  );

  const sectionHasChanges = useCallback(
    (section: FilterSection) => section.groups.some(groupHasChanges),
    [groupHasChanges]
  );

  return (
    <div className={styles.FilterControls}>
      <div className={styles.title}>
        <span>Filters</span>
        <button
          type="button"
          className={styles.resetButton}
          onClick={onClickReset}
        >
          reset all
        </button>
      </div>
      <div className={styles.mainContent}>
        <FilterAccordions
          key={`${Boolean(filters)}`} // force remount if filters are destroyed
          disabled={!filters}
          defaultIndex={defaultExpandedIndex}
        >
          {layout.map((section, sectionIndex) => (
            <FilterAccordion
              // eslint-disable-next-line react/no-array-index-key
              key={sectionIndex}
              label={section.label}
              hasChanges={sectionHasChanges(section)}
            >
              {section.groups.map((group, groupIndex) => (
                <FilterInputGroup
                  // eslint-disable-next-line react/no-array-index-key
                  key={groupIndex}
                  data={data}
                  group={group}
                  filters={filters}
                  onChangeFilter={onChangeFilter}
                  hasChanges={groupHasChanges(group)}
                  disableHistogram={disableHistogram}
                />
              ))}
            </FilterAccordion>
          ))}
        </FilterAccordions>
      </div>
    </div>
  );
}

export default FilterControls;
