import React from "react";
import { VolcanoData } from "../../plot/models/volcanoPlotModels";
import CorrelationsPlot from "./CorrelationPlot";
import DoseLegend from "./DoseLegend";

interface CorrelationsPlotsProps {
  featureTypesToShow: string[];
  dosesToFilter: string[];
  doseColors: { hex: string; dose: string }[];
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
    doseColors,
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

  const otherFeatureTypesHasSelected = (featureType: string): boolean => {
    const hasOtherFeatureTypeSelectedFeatures = Object.entries(
      featureTypeSelectedLabels
    ).some(([k, v]) => k !== featureType && v.length > 0);

    return hasOtherFeatureTypeSelectedFeatures;
  };

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "7fr 1fr", gap: "2rem" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "2rem",
          marginBottom: "50px",
        }}
      >
        {featureTypesToShow.map((featureType) => {
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
                hasOtherSelectedFeatureTypeFeatures={otherFeatureTypesHasSelected(
                  featureType
                )}
              />
            </div>
          );
        })}
      </div>
      {doseColors.length ? (
        <div>
          <DoseLegend doseColors={doseColors} />
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
