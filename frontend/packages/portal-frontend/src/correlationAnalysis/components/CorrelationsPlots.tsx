import React from "react";
import CorrelationsPlot from "./CorrelationPlot";
import DoseLegend from "./DoseLegend";
import { VolcanoPlotData } from "../models/VolcanoPlot";
import styles from "../styles/CorrelationAnalysis.scss";
import {
  DoseCategoryVolcanoData,
  VolcanoDataForCorrelatedDataset,
} from "../models/CorrelationPlot";

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

  // HACK: so that Plotly will resize the plot when the user switches to this tab.
  // Without this hack, if the plot loads while this tab is inactive, Plotly does not
  // properly calculate plot size, and this can cause the plot to drastically overflow its bounds.
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    const handler = () => setKey((k) => k + 1);
    window.addEventListener("changeTab:corr_analysis", handler);
    return () => window.removeEventListener("changeTab:corr_analysis", handler);
  }, []);

  const filteredDosesForCorrelatedDatasetVolcanoData = React.useCallback(
    (correlatedDatasetVolcanoData: DoseCategoryVolcanoData) => {
      if (dosesToFilter.length) {
        const subset: DoseCategoryVolcanoData = {};
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
    <div className={styles.plotContent} key={key}>
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
                data={
                  Object.values(
                    filteredDosesForCorrelatedDatasetVolcanoData(
                      volcanoDataForCorrelatedDatasets[correlatedDataset]
                    )
                  ) as VolcanoPlotData[]
                }
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
