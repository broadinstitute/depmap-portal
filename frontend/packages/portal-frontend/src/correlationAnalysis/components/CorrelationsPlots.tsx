import React from "react";
import CorrelationsPlot from "./CorrelationPlot";
import DoseLegend from "./DoseLegend";
import { VolcanoPlotData } from "../models/VolcanoPlot";
import styles from "../styles/CorrelationAnalysis.scss";

interface CorrelationsPlotsProps {
  featureTypesToShow: string[];
  dosesToFilter: string[];
  doseColors: { hex: string | undefined; dose: string }[];
  volcanoDataForFeatureTypes: {
    [key: string]: { [key: string]: VolcanoPlotData };
  };
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
    volcanoDataForFeatureTypes,
    featureTypeSelectedLabels,
    forwardSelectedLabels,
  } = props;

  const filteredDosesForFeatureTypeVolcanoData = React.useCallback(
    (featureTypeVolcanoData: { [key: string]: VolcanoPlotData }) => {
      if (dosesToFilter.length) {
        const subset: { [key: string]: VolcanoPlotData } = {};
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
    <div className={styles.plotContent}>
      <div className={styles.plotContainer}>
        {featureTypesToShow.map((featureType) => {
          return (
            <div key={featureType + "-plot"} className={styles.plotItem}>
              <div
                style={{
                  alignItems: "center", // vertical centering
                  justifyContent: "center", // horizontal centering
                  fontSize: "16px",
                  backgroundColor: "#eee",
                  overflowWrap: "break-word",
                  display: "flex",
                  flexGrow: 1, // makes sure header height fills rest of div height
                }}
              >
                <header style={{ textAlign: "center" }}>{featureType}</header>
              </div>
              <CorrelationsPlot
                featureType={featureType}
                data={Object.values(
                  filteredDosesForFeatureTypeVolcanoData(
                    volcanoDataForFeatureTypes[featureType]
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
