import React, { useCallback } from "react";
import VolcanoPlot from "./VolcanoPlot";
import { VolcanoPlotData, VolcanoPlotPoint } from "../models/VolcanoPlot";
import { formatVolcanoTrace } from "../utilities/volcanoPlotUtils";

interface CorrelationsPlotProps {
  featureType: string;
  data: VolcanoPlotData[];
  selectedFeatures: string[];
  hasOtherSelectedFeatureTypeFeatures: boolean;
  forwardPlotSelectedFeatures: (
    featureType: string,
    newSelectedLabels: string[]
  ) => void;
}

export default function CorrelationsPlot(props: CorrelationsPlotProps) {
  const {
    featureType,
    data,
    selectedFeatures,
    hasOtherSelectedFeatureTypeFeatures,
    forwardPlotSelectedFeatures,
  } = props;

  const onPointClick = useCallback(
    (point: VolcanoPlotPoint, keyModifier: boolean) => {
      const selectedLabel = point.text;
      if (keyModifier) {
        if (selectedFeatures.includes(selectedLabel)) {
          // deselect point if point is already selected
          forwardPlotSelectedFeatures(
            featureType,
            selectedFeatures.filter((label) => label !== selectedLabel)
          );
        } else {
          // add point to be among selected
          forwardPlotSelectedFeatures(featureType, [
            ...selectedFeatures,
            selectedLabel,
          ]);
        }
      } else {
        // only select one label at a time if key modifier not used
        forwardPlotSelectedFeatures(featureType, [selectedLabel]);
      }
    },
    [selectedFeatures, featureType, forwardPlotSelectedFeatures]
  );

  return (
    <div>
      <p>{selectedFeatures}</p>
      <header
        style={{
          textAlign: "center",
          fontSize: "18px",
          backgroundColor: "#eee",
        }}
      >
        {featureType}
      </header>
      <VolcanoPlot
        volcanoTrace={formatVolcanoTrace(
          data,
          selectedFeatures,
          hasOtherSelectedFeatureTypeFeatures
        )}
        onPointClick={onPointClick}
      />
    </div>
  );
}
