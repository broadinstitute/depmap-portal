import React from "react";
import { Button } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import { toStaticUrl } from "src/common/utilities/context";

interface Props {
  onClick: () => void;
}

function EditInCellLineSelectorButton({ onClick }: Props) {
  return (
    <Tooltip
      id="edit-in-cell-line-selector-tooltip"
      content="Edit in Cell Line Selector"
      placement="top"
    >
      <Button
        id="edit-in-cell-line-selector"
        style={{ marginRight: 6, height: 38, padding: "0 9px" }}
        onClick={onClick}
      >
        <img
          style={{ width: 20, height: 20 }}
          alt="Edit in Cell Line Selector"
          src={toStaticUrl("img/public/icon-cohort.png")}
        />
      </Button>
    </Tooltip>
  );
}

export default EditInCellLineSelectorButton;
