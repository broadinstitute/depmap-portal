import React, { useEffect, useState } from "react";
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

  let optionsToShow = groupedOptions || options;

  if (isUnknownDataset) {
    optionsToShow = [
      {
        value,
        label: "⚠️ unknown version",
        isDisabled: true,
        isDefault: false,
        disabledReason: `Unknown data version with id ${value}.`,
      } as Props["options"][number],
    ];
  }

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

  return (
    <PlotConfigSelect
      data-version-select
      isClearable
      hasError={isUnknownDataset}
      show={show}
      enable={options.length > 1 && !isLoading}
      isLoading={isLoading}
      value={isLoading ? null : value}
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
