import React, { useEffect, useMemo, useState } from "react";
import cx from "classnames";
import { breadboxAPI, cached } from "@depmap/api";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  show: boolean;
  isLoading: boolean;
  isUnknownDataset: boolean;
  shouldGroupByDataType: boolean;
  options: {
    label: string;
    value: string;
    isDisabled: boolean;
    isDefault: boolean;
  }[];
  value: string | null;
  onChange: (dataset_id: string | null) => void;
  showDefaultHint: boolean;
  showNoDefaultHint: boolean;
  onClickShowModal?: () => void;
}

type GroupedOptions = { label: string; options: Props["options"] }[];

function DataVersionSelect({
  show,
  isLoading,
  isUnknownDataset,
  shouldGroupByDataType,
  value,
  options,
  onChange,
  showDefaultHint,
  showNoDefaultHint,
  onClickShowModal = undefined,
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

    return groupedOptions || options;
  }, [isUnknownDataset, groupedOptions, options, value]);

  useEffect(() => {
    if (!shouldGroupByDataType) {
      setGroupedOptions(null);
      return;
    }

    (async () => {
      const datasets = await cached(breadboxAPI).getDatasets();

      const groups: Record<string, typeof options> = {};

      options.forEach((option) => {
        const dataset = datasets.find(
          (d) => d.id === option.value || d.given_id === option.value
        )!;
        groups[dataset.data_type] ||= [];
        groups[dataset.data_type].push(option);
      });

      const groupedOpts = Object.keys(groups)
        .sort()
        .map((dataType) => {
          return { label: dataType, options: groups[dataType] };
        });

      setGroupedOptions(groupedOpts);
    })();
  }, [options, shouldGroupByDataType]);

  let displayValue = value;

  if (isLoading) {
    displayValue = null;
  }

  if (isUnknownDataset && optionsToShow?.[0]) {
    displayValue = (optionsToShow as any)?.[0]?.options?.[0];
  }

  return (
    <PlotConfigSelect
      data-version-select
      isClearable
      hasError={isUnknownDataset}
      show={show}
      enable={options.length > 1 && !isLoading}
      isLoading={isLoading}
      value={displayValue}
      options={optionsToShow}
      onChange={onChange}
      label={
        <span>
          Data Version
          {onClickShowModal && (
            <button
              type="button"
              className={styles.detailsButton}
              onClick={onClickShowModal}
            >
              details
            </button>
          )}
        </span>
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
              <span className={styles.noDefaultChip}>no default</span>
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
        if (option.isDisabled) {
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

        if (context === "value" || !option.isDefault) {
          return option.label;
        }

        return (
          <div>
            {option.label}
            <i
              className={cx(
                "glyphicon",
                "glyphicon-star",
                styles.defaultDataset
              )}
            />
          </div>
        );
      }}
    />
  );
}

export default DataVersionSelect;
