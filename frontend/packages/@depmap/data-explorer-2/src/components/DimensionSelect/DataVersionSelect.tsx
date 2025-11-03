import React, { useEffect, useState } from "react";
import cx from "classnames";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import { dataExplorerAPI } from "../../services/dataExplorerAPI";
import PlotConfigSelect from "../PlotConfigSelect";
import styles from "../../styles/DimensionSelect.scss";

interface Props {
  show: boolean;
  isLoading: boolean;
  options: {
    label: string;
    value: string;
    isDisabled: boolean;
    isDefault: boolean;
  }[];
  index_type: string | null;
  value: string | null;
  onChange: (dataset_id: string | null) => void;
  showDefaultHint: boolean;
  showNoDefaultHint: boolean;
  onClickShowModal?: () => void;
}

// The select component gets confused if a given_id is used in place of a
// dataset's proper id. This function will convert the former to the latter.
const useNormalizedValue = (
  value: string | null,
  index_type: string | null
) => {
  const [normalizedValue, setNormalizedValue] = useState<string | null>(value);
  useEffect(() => {
    setNormalizedValue(value);

    if (value && index_type) {
      dataExplorerAPI.fetchDatasetsByIndexType().then((allDatasets) => {
        allDatasets[index_type].forEach((dataset) => {
          if (dataset.given_id === value) {
            setNormalizedValue(dataset.id);
          }
        });
      });
    }
  }, [value, index_type]);

  return normalizedValue;
};

function DataVersionSelect({
  show,
  isLoading,
  index_type,
  value,
  options,
  onChange,
  showDefaultHint,
  showNoDefaultHint,
  onClickShowModal = undefined,
}: Props) {
  const normalizedValue = useNormalizedValue(value, index_type);

  return (
    <PlotConfigSelect
      data-version-select
      isClearable
      show={show}
      enable={options.length > 1 && !isLoading}
      isLoading={isLoading}
      value={isLoading ? null : normalizedValue}
      options={options}
      onChange={onChange}
      label={
        <span className={styles.labelWithDetailsButton}>
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
