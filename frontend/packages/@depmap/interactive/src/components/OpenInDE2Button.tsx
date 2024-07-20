import React from "react";
import { Button } from "react-bootstrap";

interface Props {
  xSliceId: string;
  ySliceId: string;
  colorSliceId: string;
  filterSliceId: string;
  regressionLine: boolean;
}

function OpenInDE2Button({
  xSliceId,
  ySliceId,
  colorSliceId,
  filterSliceId,
  regressionLine,
}: Props) {
  const handleClick = () => {
    const params = new URLSearchParams({
      x: xSliceId,
      y: ySliceId,
      color: colorSliceId,
      filter: filterSliceId,
      regressionLine: regressionLine.toString(),
    });

    fetch(`../data_explorer_2/url_from_slice_ids?${params}`)
      .then((response) => response.text())
      .then((url) => {
        window.open(url, "_blank", "noreferrer");
      });
  };

  return (
    <Button
      bsStyle="primary"
      bsSize="sm"
      disabled={!xSliceId}
      onClick={handleClick}
    >
      Open in Data Explorer 2
    </Button>
  );
}

export default OpenInDE2Button;
