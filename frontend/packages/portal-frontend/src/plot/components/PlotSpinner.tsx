import React, { useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@depmap/common-components";
import { calcPlotHeight } from "src/plot/components/ScatterPlot";

interface Props {
  height?: "auto" | "100%";
}

function PlotSpinner({ height = "auto" }: Props) {
  const [spinnerHeight, setSpinnerHeight] = useState<number | string>(300);
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (ref.current) {
      setSpinnerHeight(
        height === "auto" ? calcPlotHeight(ref.current) : height
      );
    }
  }, [height]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: spinnerHeight,
      }}
      ref={ref}
    >
      <Spinner position="relative" left="-2px" />
    </div>
  );
}

export default PlotSpinner;
