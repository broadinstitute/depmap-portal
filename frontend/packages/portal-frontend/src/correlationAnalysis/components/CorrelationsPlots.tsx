import React from "react";
import { VolcanoData } from "../../plot/models/volcanoPlotModels";
import CorrelationsPlot from "./CorrelationPlot";

interface CorrelationsPlotsProps {
  featureTypesToShow: string[];
  dosesToFilter: string[];
  volcanoDataForFeatureTypes: { [key: string]: { [key: string]: VolcanoData } };
  featureTypeSelectedLabels: { [key: string]: string[] };
  forwardSelectedLabels: (
    featureType: string,
    newSelectedLabels: string[]
  ) => void;
}

export default function CorrelationsPlots(props: CorrelationsPlotsProps) {
  const {
    featureTypesToShow,
    dosesToFilter,
    volcanoDataForFeatureTypes: volcanoDataForFeatureType,
    featureTypeSelectedLabels,
    forwardSelectedLabels,
  } = props;

  const filteredDosesForFeatureTypeVolcanoData = React.useCallback(
    (featureTypeVolcanoData: { [key: string]: VolcanoData }) => {
      if (dosesToFilter.length) {
        const subset: { [key: string]: VolcanoData } = {};
        dosesToFilter.forEach((dose) => {
          subset[dose] = featureTypeVolcanoData[dose];
        });
        return subset;
      }
      return featureTypeVolcanoData;
    },
    [dosesToFilter]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "2rem",
        marginBottom: "50px",
      }}
    >
      {featureTypesToShow.map((featureType, i) => {
        return (
          <div key={featureType + "-plot"}>
            <CorrelationsPlot
              featureType={featureType}
              data={Object.values(
                filteredDosesForFeatureTypeVolcanoData(
                  volcanoDataForFeatureType[featureType]
                )
              )}
              selectedFeatures={
                featureType in featureTypeSelectedLabels
                  ? featureTypeSelectedLabels[featureType]
                  : []
              }
              forwardPlotSelectedFeatures={forwardSelectedLabels}
            />
          </div>
        );
      })}
    </div>
  );
}
