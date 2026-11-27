import React, { useMemo } from "react";
import Select from "react-select";
import { DateRangePreset } from "src/dataPageV2/hooks/useReleaseVersions";
import { useReleaseVersionsContext } from "src/dataPageV2/contexts/ReleaseVersionsContext";
import styles from "src/dataPageV2/styles.scss";
import { getFilterSelectStyles, SelectOption } from "./selectStyles";
import { useTagOptions } from "src/dataPageV2/hooks/useTagOptions";

interface FilterBarHeaderProps {
  activeFilterCount: number;
  releaseCount: number;
}

const FilterBarHeader: React.FC<FilterBarHeaderProps> = ({
  activeFilterCount,
  releaseCount,
}) => (
  <div className={styles.filterHeader}>
    <div className={styles.filterTitleGroup}>
      {/* aria-hidden="true" => This Icon is decorative. Should be ignored by assistive tech */}
      <div className={styles.filterIconBadge} aria-hidden="true">
        <i className="glyphicon glyphicon-filter" />
      </div>

      <div>
        <div className={styles.filterTitleRow}>
          <h2>Filter Releases</h2>
          {activeFilterCount > 0 && (
            <span className={styles.activeFiltersPill}>
              {activeFilterCount} active
            </span>
          )}
        </div>
        <p className={styles.filterSubtitle}>
          Narrow down releases by data type or publication window
        </p>
      </div>
    </div>

    <div className={styles.resultCountPill}>
      Showing <strong>{releaseCount}</strong>{" "}
      {releaseCount === 1 ? "release" : "releases"}
    </div>
  </div>
);

const ReleaseVersionsFilterBar: React.FC = () => {
  const {
    groupedReleases,
    filters,
    dateRangeOptions,
  } = useReleaseVersionsContext();
  const {
    options: tagOptions,
    isLoading: isOptionsLoading,
    loadOptions: handleLoadTags,
  } = useTagOptions();

  const selectedTagOption = useMemo(() => {
    if (!filters.tag) return null;
    return (
      tagOptions.find((option) => option.value === filters.tag) ?? {
        value: filters.tag,
        label: filters.tag,
      }
    );
  }, [tagOptions, filters.tag]);

  const selectedDateRangeOption = useMemo(
    () =>
      dateRangeOptions?.find((option) => option.value === filters.dateRange) ??
      null,
    [dateRangeOptions, filters.dateRange]
  );

  const hastagFilter = Boolean(filters.tag);
  const hasDateFilter = Boolean(filters.dateRange) && filters.dateRange !== "";
  const activeFilterCount = (hastagFilter ? 1 : 0) + (hasDateFilter ? 1 : 0);

  const tagSelectStyles = useMemo(() => getFilterSelectStyles(hastagFilter), [
    hastagFilter,
  ]);
  const dateSelectStyles = useMemo(() => getFilterSelectStyles(hasDateFilter), [
    hasDateFilter,
  ]);

  const handleResetFilters = () => {
    filters.setTag("");
    filters.setDateRange("");
  };

  return (
    <section className={styles.filterBanner}>
      <FilterBarHeader
        activeFilterCount={activeFilterCount}
        releaseCount={Object.keys(groupedReleases).length}
      />

      <div className={styles.filterControlsRow}>
        <div className={`${styles.filterControlGroup} ${styles.tagControl}`}>
          <label htmlFor="tag-filter">Data Type</label>
          <Select<SelectOption, false>
            inputId="tag-filter"
            isClearable
            isSearchable
            menuPortalTarget={document.body}
            onMenuOpen={handleLoadTags}
            placeholder={
              isOptionsLoading ? "Loading types..." : "Select data type..."
            }
            isLoading={isOptionsLoading}
            options={tagOptions}
            value={selectedTagOption}
            styles={tagSelectStyles}
            onChange={(option) => filters.setTag(option?.value ?? "")}
          />
        </div>

        <div
          className={`${styles.filterControlGroup} ${styles.dateRangeControl}`}
        >
          <label htmlFor="date-range-filter">Release Date</label>
          <Select<SelectOption, false>
            isClearable
            inputId="date-range-filter"
            menuPortalTarget={document.body}
            options={dateRangeOptions}
            value={selectedDateRangeOption}
            styles={dateSelectStyles}
            onChange={(option) =>
              filters.setDateRange((option?.value ?? "") as DateRangePreset)
            }
            placeholder={"Select release date..."}
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className={styles.resetFiltersButton}
            onClick={handleResetFilters}
          >
            Reset all
          </button>
        )}
      </div>
    </section>
  );
};

export default ReleaseVersionsFilterBar;
