import React, { useCallback } from "react";
import VolcanoPlot from "./VolcanoPlot";
import { VolcanoPlotData, VolcanoPlotPoint } from "../models/VolcanoPlot";
import { formatVolcanoTrace } from "../utilities/volcanoPlotUtils";

interface CorrelationsPlotProps {
  correlatedDatasetName: string;
  data: VolcanoPlotData[];
  selectedFeatures: string[];
  hasOtherSelectedCorrelatedDatasetFeatures: boolean;
  forwardPlotSelectedFeatures: (
    correlatedDataset: string,
    newSelectedLabels: string[]
  ) => void;
}

export default function CorrelationsPlot(props: CorrelationsPlotProps) {
  const {
    correlatedDatasetName,
    data,
    selectedFeatures,
    hasOtherSelectedCorrelatedDatasetFeatures,
    forwardPlotSelectedFeatures,
  } = props;

  const onPointClick = useCallback(
    (point: VolcanoPlotPoint, keyModifier: boolean) => {
      const selectedLabel = point.text;
      // NOTE: valid key modifiers are ctrlKey/metaKey/shiftKey
      if (keyModifier) {
        if (selectedFeatures.includes(selectedLabel)) {
          // deselect point if point is already selected
          forwardPlotSelectedFeatures(
            correlatedDatasetName,
            selectedFeatures.filter((label) => label !== selectedLabel)
          );
        } else {
          // add point to be among selected
          forwardPlotSelectedFeatures(correlatedDatasetName, [
            ...selectedFeatures,
            selectedLabel,
          ]);
        }
      } else {
        // only select one label at a time if key modifier not used
        forwardPlotSelectedFeatures(correlatedDatasetName, [selectedLabel]);
      }
    },
    [selectedFeatures, correlatedDatasetName, forwardPlotSelectedFeatures]
  );

  return (
    <div style={{ maxWidth: "100%" }}>
      <VolcanoPlot
        volcanoTrace={formatVolcanoTrace(
          data,
          selectedFeatures,
          hasOtherSelectedCorrelatedDatasetFeatures
        )}
        onPointClick={onPointClick}
      />
    </div>
  );
}
