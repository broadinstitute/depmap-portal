import React, { useState, useEffect, useCallback, ReactNode } from "react";
import CorrelationsPlot from "./CorrelationPlot";
import DoseLegend from "./DoseLegend";
import { VolcanoPlotData } from "../models/VolcanoPlot";
import styles from "../styles/CorrelationAnalysis.scss";
import {
  DoseCategoryVolcanoData,
  VolcanoDataForCorrelatedDataset,
} from "../models/CorrelationPlot";

interface CorrelationsPlotsProps {
  featureType: "compound" | "gene";
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

const PlotItemWrapper = ({
  datasetName,
  children,
}: {
  datasetName: string;
  children: ReactNode;
}) => (
  <div className={styles.plotItem}>
    <div
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontSize: "16px",
        backgroundColor: "#eee",
        overflowWrap: "break-word",
        display: "flex",
        flexGrow: 1,
      }}
    >
      <header style={{ textAlign: "center" }}>{datasetName}</header>
    </div>
    {children}
  </div>
);

function GeneCorrelationsPlots({
  correlatedDatasetsToShow,
  volcanoDataForCorrelatedDatasets,
  correlatedDatasetSelectedLabels,
  forwardSelectedLabels,
  otherCorrelatedDatasetsHasSelected,
}: {
  correlatedDatasetsToShow: string[];
  volcanoDataForCorrelatedDatasets: VolcanoDataForCorrelatedDataset;
  correlatedDatasetSelectedLabels: { [key: string]: string[] };
  forwardSelectedLabels: (ds: string, labels: string[]) => void;
  otherCorrelatedDatasetsHasSelected: (ds: string) => boolean;
}) {
  return (
    <div className={styles.plotContainer}>
      {correlatedDatasetsToShow.map((datasetName) => {
        const rawData = volcanoDataForCorrelatedDatasets[datasetName] || {};
        const plotData: VolcanoPlotData[] = Object.values(rawData).map(
          (val) => ({
            ...val,
            color: val.color || "#333",
          })
        );

        return (
          <PlotItemWrapper
            key={`${datasetName}-plot`}
            datasetName={datasetName}
          >
            <CorrelationsPlot
              correlatedDatasetName={datasetName}
              data={plotData}
              selectedFeatures={
                correlatedDatasetSelectedLabels[datasetName] || []
              }
              forwardPlotSelectedFeatures={forwardSelectedLabels}
              hasOtherSelectedCorrelatedDatasetFeatures={otherCorrelatedDatasetsHasSelected(
                datasetName
              )}
            />
          </PlotItemWrapper>
        );
      })}
    </div>
  );
}

function CompoundCorrelationsPlots({
  correlatedDatasetsToShow,
  dosesToFilter,
  doseColors,
  volcanoDataForCorrelatedDatasets,
  correlatedDatasetSelectedLabels,
  forwardSelectedLabels,
  otherCorrelatedDatasetsHasSelected,
}: {
  correlatedDatasetsToShow: string[];
  dosesToFilter: string[];
  doseColors: { hex: string | undefined; dose: string }[];
  volcanoDataForCorrelatedDatasets: VolcanoDataForCorrelatedDataset;
  correlatedDatasetSelectedLabels: { [key: string]: string[] };
  forwardSelectedLabels: (ds: string, labels: string[]) => void;
  otherCorrelatedDatasetsHasSelected: (ds: string) => boolean;
}) {
  return (
    <>
      <div className={styles.plotContainer}>
        {correlatedDatasetsToShow.map((datasetName) => {
          const rawData: DoseCategoryVolcanoData =
            volcanoDataForCorrelatedDatasets[datasetName] || {};
          const targetDoses =
            dosesToFilter.length > 0 ? dosesToFilter : Object.keys(rawData);

          const plotData: VolcanoPlotData[] = targetDoses.reduce(
            (acc: VolcanoPlotData[], dose) => {
              const entry = rawData[dose];
              if (entry) {
                acc.push({
                  ...entry,
                  color: entry.color || "#777",
                });
              }
              return acc;
            },
            []
          );

          return (
            <PlotItemWrapper
              key={`${datasetName}-plot`}
              datasetName={datasetName}
            >
              <CorrelationsPlot
                correlatedDatasetName={datasetName}
                data={plotData}
                selectedFeatures={
                  correlatedDatasetSelectedLabels[datasetName] || []
                }
                forwardPlotSelectedFeatures={forwardSelectedLabels}
                hasOtherSelectedCorrelatedDatasetFeatures={otherCorrelatedDatasetsHasSelected(
                  datasetName
                )}
              />
            </PlotItemWrapper>
          );
        })}
      </div>
      {doseColors.length > 0 && (
        <div className={styles.legendWrapper}>
          <DoseLegend doseColors={doseColors} />
        </div>
      )}
    </>
  );
}

export default function CorrelationsPlots({
  featureType,
  correlatedDatasetsToShow,
  dosesToFilter,
  doseColors,
  volcanoDataForCorrelatedDatasets,
  correlatedDatasetSelectedLabels,
  forwardSelectedLabels,
}: CorrelationsPlotsProps) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const handler = () => setKey((k) => k + 1);
    window.addEventListener("changeTab:corr_analysis", handler);
    return () => window.removeEventListener("changeTab:corr_analysis", handler);
  }, []);

  const otherCorrelatedDatasetsHasSelected = useCallback(
    (datasetName: string): boolean => {
      return Object.entries(correlatedDatasetSelectedLabels).some(
        ([k, v]) => k !== datasetName && v.length > 0
      );
    },
    [correlatedDatasetSelectedLabels]
  );

  return (
    <div className={styles.plotContent} key={key}>
      {featureType === "gene" ? (
        <GeneCorrelationsPlots
          correlatedDatasetsToShow={correlatedDatasetsToShow}
          volcanoDataForCorrelatedDatasets={volcanoDataForCorrelatedDatasets}
          correlatedDatasetSelectedLabels={correlatedDatasetSelectedLabels}
          forwardSelectedLabels={forwardSelectedLabels}
          otherCorrelatedDatasetsHasSelected={
            otherCorrelatedDatasetsHasSelected
          }
        />
      ) : (
        <CompoundCorrelationsPlots
          correlatedDatasetsToShow={correlatedDatasetsToShow}
          dosesToFilter={dosesToFilter}
          doseColors={doseColors}
          volcanoDataForCorrelatedDatasets={volcanoDataForCorrelatedDatasets}
          correlatedDatasetSelectedLabels={correlatedDatasetSelectedLabels}
          forwardSelectedLabels={forwardSelectedLabels}
          otherCorrelatedDatasetsHasSelected={
            otherCorrelatedDatasetsHasSelected
          }
        />
      )}
    </div>
  );
}
