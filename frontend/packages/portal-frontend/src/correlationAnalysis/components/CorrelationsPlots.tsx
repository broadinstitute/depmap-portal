import React from "react";
import CorrelationsPlot from "./CorrelationPlot";
import DoseLegend from "./DoseLegend";
import { VolcanoPlotData } from "../models/VolcanoPlot";
import styles from "../styles/CorrelationAnalysis.scss";

interface CorrelationsPlotsProps {
  correlatedDatasetsToShow: string[];
  dosesToFilter: string[];
  doseColors: { hex: string | undefined; dose: string }[];
  volcanoDataForCorrelatedDatasets: VolcanoDataForCorrelatedDataset;
  correlatedDatasetSelectedLabels: { [key: string]: string[] };
  forwardSelectedLabels: (
    correlatedDataset: string,
    newSelectedLabels: string[]
  ) => void;
}

export default function CorrelationsPlots(props: CorrelationsPlotsProps) {
  const {
    correlatedDatasetsToShow,
    dosesToFilter,
    doseColors,
    volcanoDataForCorrelatedDatasets,
    correlatedDatasetSelectedLabels,
    forwardSelectedLabels,
  } = props;

  const filteredDosesForCorrelatedDatasetVolcanoData = React.useCallback(
    (correlatedDatasetVolcanoData: { [key: string]: VolcanoPlotData }) => {
      if (dosesToFilter.length) {
        const subset: { [key: string]: VolcanoPlotData } = {};
        dosesToFilter.forEach((dose) => {
          subset[dose] = correlatedDatasetVolcanoData[dose];
        });
        return subset;
      }
      return correlatedDatasetVolcanoData;
    },
    [dosesToFilter]
  );

  const otherCorrelatedDatasetsHasSelected = (
    correlatedDataset: string
  ): boolean => {
    const hasOtherCorrDatasetSelectedFeatures = Object.entries(
      correlatedDatasetSelectedLabels
    ).some(([k, v]) => k !== correlatedDataset && v.length > 0);

    return hasOtherCorrDatasetSelectedFeatures;
  };

  return (
    <div className={styles.plotContent}>
      <div className={styles.plotContainer}>
        {correlatedDatasetsToShow.map((correlatedDataset) => {
          return (
            <div key={correlatedDataset + "-plot"} className={styles.plotItem}>
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
                <header style={{ textAlign: "center" }}>
                  {correlatedDataset}
                </header>
              </div>
              <CorrelationsPlot
                correlatedDatasetName={correlatedDataset}
                data={Object.values(
                  filteredDosesForCorrelatedDatasetVolcanoData(
                    volcanoDataForCorrelatedDatasets[correlatedDataset]
                  )
                )}
                selectedFeatures={
                  correlatedDataset in correlatedDatasetSelectedLabels
                    ? correlatedDatasetSelectedLabels[correlatedDataset]
                    : []
                }
                forwardPlotSelectedFeatures={forwardSelectedLabels}
                hasOtherSelectedCorrelatedDatasetFeatures={otherCorrelatedDatasetsHasSelected(
                  correlatedDataset
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
