import React from "react";
import cx from "classnames";
import { Tooltip } from "@depmap/common-components";
import { pluralize } from "../../utils/misc";
import styles from "../../styles/DatasetMetadataSelector.scss";

interface Props {
  valueType: string | null;
  sliceTypeLabel: string;
}

function BinaryColorsHelpTip({ valueType, sliceTypeLabel }: Props) {
  if (valueType !== "binary") {
    return null;
  }

  const indefiniteArticle = ["a", "e", "i", "o", "u"].includes(
    sliceTypeLabel.toLowerCase()
  )
    ? "an"
    : "a";

  return (
    <Tooltip
      id="BinaryColorsHelpTip"
      content={
        <div>
          Because these {pluralize(sliceTypeLabel)} overlap, a unique color
          cannot be assigned to each one.
          <br />
          <br />
          Please select {indefiniteArticle} {sliceTypeLabel} of interest and it
          will be colored as the in-group.
        </div>
      }
      placement="right"
    >
      <div className={styles.BinaryColorsHelpTip}>
        <span
          className={cx("glyphicon", "glyphicon-info-sign")}
          style={{ marginInlineStart: 8, top: 2, color: "#7B317C" }}
        />
      </div>
    </Tooltip>
  );
}

export default BinaryColorsHelpTip;
