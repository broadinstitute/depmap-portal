import React from "react";
import { Button } from "react-bootstrap";

interface Props {
  isCustomData: boolean;
  numSelected: number;
  onClickVisualizeSelected: (e: React.MouseEvent) => void;
}

function VisualizeButton({
  isCustomData,
  numSelected,
  onClickVisualizeSelected,
}: Props) {
  const buttonText = [
    "Visualize",
    [null, "Density 1D", "Scatter Plot", "Heatmap"][Math.min(numSelected, 3)],
  ]
    .filter(Boolean)
    .join(" as ");

  return (
    <Button
      type="button"
      bsStyle="primary"
      disabled={numSelected < 1 || isCustomData}
      onClick={(e) =>
        onClickVisualizeSelected((e as unknown) as React.MouseEvent)
      }
    >
      {isCustomData ? "Visualize" : buttonText}
      <span className="glyphicon glyphicon-eye-open" />
    </Button>
  );
}

export default VisualizeButton;
