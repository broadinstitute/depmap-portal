import React from "react";
import cx from "classnames";
import { Tooltip } from "@depmap/common-components";
import PlotConfigSelect from "../../PlotConfigSelect";
import HelpText from "./HelpText";
import styles from "../../../styles/ContextBuilder.scss";

interface Props {
  isLoading: boolean;
  slice_type: string;
  value: string | null;
  onChange: (
    nextValue:
      | "legacy_metadata_slice"
      | "official_annotation"
      | "matrix_dataset"
  ) => void;
}

function DataSourceSelect({ isLoading, slice_type, value, onChange }: Props) {
  let options = [
    {
      label: "Annotation",
      value: "official_annotation",
    },
    {
      label: "Legacy Annotation",
      value: "legacy_metadata_slice",
    },
    {
      label: "Matrix Dataset",
      value: "matrix_dataset",
    },
  ];

  const hasBreadboxAnnotations =
    slice_type === "depmap_model" ||
    slice_type === "model_condition" ||
    slice_type === "screen" ||
    slice_type === "Screen metadata";

  if (!hasBreadboxAnnotations) {
    options = [
      {
        label: "Annotation",
        value: "legacy_metadata_slice",
      },
      {
        label: "Matrix Dataset",
        value: "matrix_dataset",
      },
    ];
  }

  return (
    <PlotConfigSelect
      show
      enable
      value={isLoading ? "" : value}
      options={options}
      isLoading={isLoading}
      onChange={onChange as (nextValue: string | null) => void}
      className={styles.varSelect}
      placeholder="Select data source…"
      menuPortalTarget={document.querySelector("#modal-container")}
      formatOptionLabel={(
        option: { label: string; value: string },
        { context }: { context: "menu" | "value" }
      ) => {
        if (context === "value") {
          return option.label;
        }

        // Only show help content if we need to explain the difference
        // between an "annotation" and a "legacy annotation."
        if (!hasBreadboxAnnotations) {
          return option.label;
        }

        return (
          <div className={styles.dataSourceOption}>
            <span>{option.label}</span>
            <Tooltip
              id={`${option.label}-tooltip`}
              className={styles.unblockable}
              content={
                <HelpText
                  dataSourceOption={option.value}
                  slice_type={slice_type}
                />
              }
              placement="right"
            >
              <span
                className={cx("glyphicon", "glyphicon-info-sign")}
                style={{ marginInlineStart: 8, top: 2, color: "#7B317C" }}
              />
            </Tooltip>
          </div>
        );
      }}
    />
  );
}

// HelpTip

export default DataSourceSelect;
