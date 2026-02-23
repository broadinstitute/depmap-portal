import React from "react";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { SliceQuery } from "@depmap/types";
import SlicePreview from "../SlicePreview";
import DataSliceSelect from "./DataSliceSelect";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  index_type_name: string;
  PlotlyLoader: any;
  idColumnLabel: string;
  existingSlices?: SliceQuery[];
  defaultValue?: SliceQuery | null;
  initialSource?: "property" | "custom";
}

function chooseDataSlice({
  index_type_name,
  PlotlyLoader,
  idColumnLabel,
  existingSlices = undefined,
  defaultValue = null,
  initialSource = "property",
}: Props) {
  const isEditMode = defaultValue !== null;

  return promptForValue({
    defaultValue,
    title: isEditMode ? "Edit column" : "Add a data column",
    acceptButtonText: isEditMode ? "Save changes" : "Add column",
    modalProps: { className: styles.AddColumnModal, bsSize: "lg" },
    shouldFocusAcceptOnChange: true,
    PromptComponent: ({
      value,
      onChange,
    }: PromptComponentProps<SliceQuery | null>) => {
      return (
        <div className={styles.content}>
          <div className={styles.menus}>
            <DataSliceSelect
              index_type_name={index_type_name}
              idColumnLabel={idColumnLabel}
              value={value}
              defaultValue={defaultValue}
              initialSource={initialSource}
              existingSlices={existingSlices}
              onChange={onChange}
            />
          </div>
          <div className={styles.preview}>
            <SlicePreview
              index_type_name={index_type_name}
              value={value}
              PlotlyLoader={PlotlyLoader}
            />
          </div>
        </div>
      );
    },
  });
}

export default chooseDataSlice;
