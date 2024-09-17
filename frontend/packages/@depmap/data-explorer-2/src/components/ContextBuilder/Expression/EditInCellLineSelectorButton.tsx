import React, { useContext } from "react";
import { Button } from "react-bootstrap";
import { ApiContext } from "@depmap/api";
import { Tooltip } from "@depmap/common-components";

interface Props {
  onClick: () => void;
}

function EditInCellLineSelectorButton({ onClick }: Props) {
  const { getApi } = useContext(ApiContext);

  const urlPrefix = getApi().urlPrefix;
  const assetUrl = "img/public/icon-cohort.png";
  const imgSrc = `${urlPrefix}/static/${assetUrl}`.replace(/^\/\//, "");

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
          src={imgSrc}
        />
      </Button>
    </Tooltip>
  );
}

export default EditInCellLineSelectorButton;
