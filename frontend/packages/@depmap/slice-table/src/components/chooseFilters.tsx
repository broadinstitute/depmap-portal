import React from "react";
import { FormGroup, Checkbox, ControlLabel } from "react-bootstrap";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import type { RowFilters } from "./useData";
import styles from "../styles/FilterModal.scss";

interface Props {
  rowFilters: RowFilters;
}

function chooseFilters({ rowFilters }: Props) {
  return promptForValue({
    defaultValue: rowFilters,
    title: "Filter the table",
    acceptButtonText: "Save changes",
    modalProps: { className: styles.FilterModal },
    PromptComponent: ({
      value,
      onChange,
    }: PromptComponentProps<RowFilters>) => {
      return (
        <div className={styles.content}>
          <FormGroup>
            <ControlLabel>Row-based filters</ControlLabel>
            <Checkbox
              checked={value.hideUnselectedRows}
              onChange={() => {
                onChange((prev) => ({
                  ...prev,
                  hideUnselectedRows: !prev.hideUnselectedRows,
                }));
              }}
            >
              Hide unselected rows
            </Checkbox>
            <Checkbox
              checked={value.hideIncompleteRows}
              onChange={() => {
                onChange((prev) => ({
                  ...prev,
                  hideIncompleteRows: !prev.hideIncompleteRows,
                }));
              }}
            >
              Hide incomplete rows (rows containing some N/A cells)
            </Checkbox>
          </FormGroup>
        </div>
      );
    },
  });
}

export default chooseFilters;
