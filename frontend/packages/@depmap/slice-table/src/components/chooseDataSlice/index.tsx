import React from "react";
import {
  getConfirmation,
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import type { SliceQuery } from "@depmap/types";
import SlicePreview from "../SlicePreview";
import DataSliceSelect from "./DataSliceSelect";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  index_type_name: string;
  PlotlyLoader: any;
  defaultValue?: SliceQuery | null;
  onClickRemoveColumn?: () => void;
}

function chooseDataSlice({
  index_type_name,
  PlotlyLoader,
  defaultValue = null,
  onClickRemoveColumn = () => {},
}: Props) {
  const isEditMode = defaultValue !== null;

  return promptForValue({
    defaultValue,
    title: isEditMode ? "Edit column" : "Add a data column",
    acceptButtonText: isEditMode ? "Save changes" : "Add column",
    modalProps: { className: styles.AddColumnModal, bsSize: "lg" },
    PromptComponent: ({
      value,
      onChange,
    }: PromptComponentProps<SliceQuery | null>) => {
      return (
        <div className={styles.content}>
          <div className={styles.menus}>
            <DataSliceSelect
              index_type_name={index_type_name}
              value={value}
              defaultValue={defaultValue}
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
    secondaryAction: isEditMode
      ? {
          buttonText: "Remove column",
          bsStyle: "danger",
          onClick: () => {
            return getConfirmation({
              showModalBackdrop: false,
              message: "Are you sure you want to remove this column?",
              yesText: "Remove",
              noText: "Cancel",
            }).then((confirmed) => {
              let shouldCloseModal = false;

              if (confirmed) {
                onClickRemoveColumn();
                shouldCloseModal = true;
              }

              return shouldCloseModal;
            });
          },
        }
      : undefined,
  });
}

export default chooseDataSlice;
