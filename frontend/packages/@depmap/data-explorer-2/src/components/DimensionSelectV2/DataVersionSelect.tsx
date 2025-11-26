import React, { useEffect, useMemo, useState } from "react";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import { dataTypeSortComparator } from "@depmap/utils";
import PlotConfigSelect from "../PlotConfigSelect";
import { fetchDatasetsByIndexType } from "./useDimensionStateManager/utils";
import { State } from "./useDimensionStateManager/types";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  show: boolean;
  isLoading: boolean;
  isUnknownDataset: boolean;
  shouldGroupByDataType: boolean;
  shouldGroupBySliceType: boolean;
  value: string | null;
  options: State["dataVersionOptions"];
  onChange: (dataset_id: string | null) => void;
  index_type: string | null;
  showDefaultHint: boolean;
  showNoDefaultHint: boolean;
  onClickShowModal?: () => void;
  selectClassName?: string;
}

type GroupedOptions = { label: string; options: Props["options"] }[];

// The select component gets confused if a regular dataset ID is used where a
// given_id would be preferred. This function will convert the former to the
// latter.
const useValueAsGivenIdWherePossible = (
  value: string | null,
  index_type: string | null
) => {
  const [compatValue, setCompatValue] = useState<string | null>(null);

  useEffect(() => {
    setCompatValue(null);

    if (value && index_type) {
      fetchDatasetsByIndexType(index_type, value).then((datasets) => {
        const dataset = datasets.find(
          (d) => d.id === value || d.given_id === value
        );

        if (dataset) {
          setCompatValue(dataset.given_id || dataset.id);
        }
      });
    }
  }, [value, index_type]);

  return value === null ? null : compatValue;
};

function DataVersionSelect({
  show,
  isLoading,
  isUnknownDataset,
  shouldGroupByDataType,
  shouldGroupBySliceType,
  value,
  options,
  onChange,
  index_type,
  showDefaultHint,
  showNoDefaultHint,
  onClickShowModal = undefined,
  selectClassName = undefined,
}: Props) {
  const [groupedOptions, setGroupedOptions] = useState<GroupedOptions | null>(
    null
  );

  const optionsToShow = useMemo(() => {
    if (isUnknownDataset) {
      const pseudoOption = {
        value,
        label: `⚠️ unknown version “${value}”`,
        isDisabled: true,
        isDefault: false,
        disabledReason: (
          <div>
            The data version “{value}” may have been renamed or removed.
          </div>
        ),
      } as Props["options"][number];

      if (groupedOptions) {
        return [
          { label: "Unknown data type", options: [pseudoOption] },
          ...groupedOptions,
        ];
      }

      return [pseudoOption, ...options];
    }

    if (groupedOptions && groupedOptions.length > 0) {
      return groupedOptions;
    }

    return options;
  }, [isUnknownDataset, groupedOptions, options, value]);

  useEffect(() => {
    if (!index_type || (!shouldGroupByDataType && !shouldGroupBySliceType)) {
      setGroupedOptions(null);
      return;
    }

    (async () => {
      const datasets = await fetchDatasetsByIndexType(index_type, value);
      const groups: Record<string, typeof options> = {};
      const groupBy = shouldGroupBySliceType
        ? "slice_type_display_name"
        : "data_type";

      options.forEach((option) => {
        const dataset = datasets.find(
          (d) => d.id === option.value || d.given_id === option.value
        )!;

        if (dataset) {
          groups[dataset[groupBy]] ||= [];
          groups[dataset[groupBy]].push(option);
        }
      });

      const groupedOpts = Object.keys(groups)
        .map((dataType) => {
          return { label: dataType, options: groups[dataType] };
        })
        .sort((a, b) => dataTypeSortComparator(a.label, b.label));

      setGroupedOptions(groupedOpts);
    })();
  }, [
    value,
    options,
    index_type,
    shouldGroupByDataType,
    shouldGroupBySliceType,
  ]);

  let displayValue:
    | string
    | null
    | { label: string; value: string } = useValueAsGivenIdWherePossible(
    value,
    index_type
  );

  if (isLoading) {
    displayValue = null;
  }

  if (isUnknownDataset && optionsToShow?.[0]) {
    type Options = { label: string; value: string }[];
    type NestedOptions = { options: Options }[];
    const opts = optionsToShow as Options | NestedOptions;

    if ("options" in opts[0]) {
      displayValue = opts[0]?.options?.[0] || null;
    } else {
      displayValue = opts[0] || null;
    }
  }

  return (
    <PlotConfigSelect
      data-version-select
      isClearable
      hasError={isUnknownDataset}
      show={show}
      enable={!isLoading}
      isLoading={isLoading}
      value={displayValue}
      options={optionsToShow}
      onChangeUsesWrappedValue
      onChange={(wrappedValue) => {
        const selection = wrappedValue as typeof options[number] | null;
        onChange(selection?.value || null);
      }}
      className={selectClassName}
      label="Data Version"
      renderDetailsButton={
        onClickShowModal
          ? () => (
              <button type="button" onClick={onClickShowModal}>
                details
              </button>
            )
          : undefined
      }
      placeholder={(() => {
        if (isLoading) {
          return "Loading…";
        }

        if (showDefaultHint) {
          return (
            <Tooltip
              id="default-dataset"
              content={
                <div>
                  Leave this set to “default” and we’ll find a match for you
                  once all other options have been selected.
                </div>
              }
              placement="top"
            >
              <span className={styles.defaultChip}>default</span>
            </Tooltip>
          );
        }

        if (showNoDefaultHint) {
          return (
            <Tooltip
              id="default-dataset"
              content={
                <div>
                  Something went wrong and a default could not be determined.
                  Please make a manual selection.
                </div>
              }
              placement="top"
            >
              <span className={styles.noDefaultChip}>no default found</span>
            </Tooltip>
          );
        }

        return "Select data version…";
      })()}
      formatOptionLabel={(
        option: {
          label: string;
          isDefault: boolean;
          isDisabled: boolean;
          disabledReason: string;
        },
        { context }: { context: "menu" | "value" }
      ) => {
        if (option.isDisabled && context === "menu") {
          return (
            <Tooltip
              className={styles.unblockable}
              id="disabled-dataset"
              content={<WordBreaker text={option.disabledReason} />}
              placement="top"
            >
              <span style={{ cursor: "not-allowed" }}>{option.label}</span>
            </Tooltip>
          );
        }

        return option.label;
      }}
    />
  );
}

export default DataVersionSelect;
