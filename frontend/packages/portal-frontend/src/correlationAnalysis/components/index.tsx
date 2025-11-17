/* eslint-disable @typescript-eslint/dot-notation */
import * as React from "react";

import CorrelationsTable from "./CorrelationsTable";
import CorrelationsPlots from "./CorrelationsPlots";
import CorrelationFilters from "./CorrelationFilters";

import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "../styles/CorrelationAnalysis.scss";
import useCorrelationAnalysisData from "../hooks/useCorrelationAnalysisData";
import {
  SortedCorrelations,
  VolcanoDataForCorrelatedDataset,
} from "../models/CorrelationPlot";
import { DRCDatasetOptions } from "@depmap/types";
import { useState } from "react";

interface CorrelationAnalysisProps {
  datasetOptions: DRCDatasetOptions[];
  compoundId: string;
  compoundName: string;
}

export default function CorrelationAnalysis(props: CorrelationAnalysisProps) {
  const { compoundId, compoundName, datasetOptions } = props;
  const [selectedDataset, setSelectedDataset] = useState<DRCDatasetOptions>(
    datasetOptions[0]
  );

  const [
    selectedCorrelatedDatasets,
    setSelectedCorrelatedDatasets,
  ] = React.useState<string[]>([]);
  const [selectedDoses, setSelectedDoses] = React.useState<string[]>([]);
  const [allSelectedLabels, setAllSelectedLabels] = React.useState<{
    [key: string]: string[];
  }>({});
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(
    new Set()
  );

  const [
    filteredTableCorrelationAnalysisData,
    setFilteredTableCorrelationAnalysisData,
  ] = React.useState<SortedCorrelations[]>([]);

  const {
    correlationAnalysisData,
    correlatedDatasets,
    doseColors,
    isLoading,
    hasError,
  } = useCorrelationAnalysisData(selectedDataset, compoundId, compoundName);

  React.useEffect(() => {
    // if no filter applied, show all correlation analysis data
    if (
      selectedCorrelatedDatasets.length === 0 &&
      selectedDoses.length === 0 &&
      Object.keys(allSelectedLabels).length === 0
    ) {
      setFilteredTableCorrelationAnalysisData(correlationAnalysisData);
    } else {
      // keep list of all selected plot or table features
      const selectedDataWithLabelFront: any[] = [];

      // keep only selected feature types and selected doses and unselected features in plot or table
      const filtered = correlationAnalysisData.filter((data) => {
        let keepCondition;
        // We want to keep data where feature type and dose is selected
        if (selectedCorrelatedDatasets.length && selectedDoses.length) {
          keepCondition =
            selectedCorrelatedDatasets.includes(data["featureDataset"]) &&
            typeof data["dose"] === "string" &&
            selectedDoses.includes(data["dose"]);
        }
        // keep data where feature type is selected
        else if (selectedCorrelatedDatasets.length) {
          keepCondition = selectedCorrelatedDatasets.includes(
            data["featureDataset"]
          );
        }
        // keep data where dose is selected
        else if (selectedDoses.length) {
          keepCondition =
            typeof data["dose"] === "string" &&
            selectedDoses.includes(data["dose"]);
        } else {
          keepCondition = data !== null;
        }

        // We also want to remove features that are selected so that we can move those data to front of list later
        const removeCondition =
          data["featureDataset"] in allSelectedLabels &&
          allSelectedLabels[data["featureDataset"]].includes(data["feature"]);
        // data that should be moved to front must additionally be filtered
        if (removeCondition && keepCondition) {
          selectedDataWithLabelFront.push(data);
        }

        return keepCondition && !removeCondition;
      });

      // Sort by feature label first, then by dose
      selectedDataWithLabelFront.sort((a, b) => {
        if (a["feature"] === b["feature"]) {
          return a["dose"] - b["dose"]; // sort by dose within the same feature
        }
        return a["feature"].localeCompare(b["feature"]); // otherwise sort by type
      });
      const selectedIds = selectedDataWithLabelFront.map((data) => {
        return data.id;
      });
      setSelectedRows(new Set(selectedIds));

      // move selected features from plot or table up to front of data list
      setFilteredTableCorrelationAnalysisData(
        selectedDataWithLabelFront.concat(filtered)
      );
    }
  }, [
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    correlationAnalysisData,
    compoundId,
  ]);

  const volcanoDataForCorrelatedDataset = React.useMemo(() => {
    if (correlationAnalysisData.length) {
      return correlationAnalysisData.reduce(
        (acc: VolcanoDataForCorrelatedDataset, curRecord) => {
          const key = curRecord.featureDataset;
          if (!acc[key]) {
            acc[key] = {};
          }
          const doseCategory = curRecord.dose;
          if (doseCategory) {
            if (!(doseCategory in acc[key])) {
              acc[key][doseCategory] = {
                x: [],
                y: [],
                label: [],
                text: [],
                isSignificant: [],
                name: doseCategory,
                color: doseColors.find(
                  (doseColor) => doseColor.dose === doseCategory
                )?.hex,
              };
            }
            const columnNamesToPlotVariables: Record<
              string,
              keyof typeof acc[string][string]
            > = {
              correlation: "x",
              log10qvalue: "y",
              feature: "text",
            };

            Object.entries(columnNamesToPlotVariables).forEach(
              ([colName, volcanoDataProp]) => {
                const value = curRecord[colName];
                const prop = volcanoDataProp as keyof typeof acc[string][string];
                if (colName === "log10qvalue") {
                  const val = -(value as number);
                  (acc[key][doseCategory][prop] as number[]).push(val);
                } else if (colName === "feature") {
                  const label = curRecord[colName];
                  const text =
                    `<b>${label}</b><br>` +
                    `<b>Dose (uM)</b>: ${curRecord["dose"]}<br>` +
                    `<b>Correlation:</b> ${curRecord["correlation"].toFixed(
                      4
                    )}<br>` +
                    `<b>-log10(q value):</b> ${curRecord["log10qvalue"].toFixed(
                      4
                    )}<br>`;
                  (acc[key][doseCategory][prop] as string[]).push(text);
                  acc[key][doseCategory]["label"].push(label);
                } else {
                  (acc[key][doseCategory][prop] as number[]).push(value);
                }
              }
            );

            acc[key][doseCategory]["isSignificant"].push(false);
          }
          return acc;
        },
        {} as VolcanoDataForCorrelatedDataset
      );
    }
    return {};
  }, [correlationAnalysisData, doseColors]);

  let content;

  if (isLoading) {
    content = (
      <div style={{ display: "grid", placeItems: "center", height: "500px" }}>
        <PlotSpinner />
      </div>
    );
  } else if (hasError) {
    content = (
      <div className={styles.errorMessage}>
        Failed to load correlation data.
      </div>
    );
  } else {
    content = (
      <CorrelationsPlots
        correlatedDatasetsToShow={
          selectedCorrelatedDatasets.length
            ? selectedCorrelatedDatasets
            : Object.keys(volcanoDataForCorrelatedDataset)
        }
        dosesToFilter={selectedDoses}
        doseColors={doseColors}
        volcanoDataForCorrelatedDatasets={volcanoDataForCorrelatedDataset}
        correlatedDatasetSelectedLabels={allSelectedLabels}
        forwardSelectedLabels={(
          correlatedDataset: string,
          newSelectedLabels: string[]
        ) => {
          setAllSelectedLabels({
            ...allSelectedLabels,
            [correlatedDataset]: newSelectedLabels,
          });
        }}
      />
    );
  }

  return (
    <div className={styles.tabGrid}>
      <div className={styles.tabFilters}>
        <CorrelationFilters
          datasets={datasetOptions.map((d) => d.display_name)}
          onChangeDataset={(displayName: string) =>
            setSelectedDataset(
              datasetOptions.find(
                (opt: DRCDatasetOptions) => opt.display_name === displayName
              )!
            )
          }
          correlatedDatasets={correlatedDatasets}
          onChangeCorrelatedDatasets={(newCorrelatedDatasets: string[]) =>
            setSelectedCorrelatedDatasets(
              newCorrelatedDatasets !== null ? newCorrelatedDatasets : []
            )
          }
          doses={doseColors.map((doseColor) => doseColor.dose)}
          onChangeDoses={(newDoses) => setSelectedDoses(newDoses || [])}
        />
      </div>

      <div className={styles.tabMain}>
        <div className={styles.mainContentContainer}>
          <div className={styles.mainContentHeader}>
            <h3>Correlation Analysis</h3>
            <p>
              Univariate associations between sensitivity profiles and the
              genomic features or genetic dependencies are presented in the
              table and plots. Click on a plot to enlarge it. Hover over plot
              points for tooltip information.
            </p>
          </div>
          <hr style={{ borderTop: "1px solid black", marginBottom: "40px" }} />
          <div className={styles.mainContentGrid}>
            {" "}
            <div className={styles.plotArea}>{content}</div>
          </div>
          <div>
            <hr className={styles.mainContentHr} />
            <div className={styles.mainContentCellLines}>
              <h3>Associated Features</h3>
              <p>Clicking on rows highlights features in the plots above</p>
              <div style={{ height: "10px" }}>
                {selectedRows.size ? (
                  <button
                    className={styles.linkButton}
                    type="button"
                    onClick={() => {
                      setSelectedRows(new Set());
                      setAllSelectedLabels({});
                    }}
                  >
                    Unselect all
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <CorrelationsTable
                data={filteredTableCorrelationAnalysisData}
                compound={compoundName}
                selectedRows={selectedRows}
                onChangeSelections={(selections: any[]) => {
                  const prevSelections = Array.from(selectedRows);
                  // if selections size decreases then a row was deselected. Deselect all selected features for that feature type
                  if (selections.length < prevSelections.length) {
                    // should only be one unselected at a time
                    const unselectedId = prevSelections.filter(
                      (x) => !selections.includes(x)
                    )[0];
                    const correlatedDatasetFeatureToRemove = filteredTableCorrelationAnalysisData.find(
                      (data) => data.id === unselectedId
                    );
                    if (correlatedDatasetFeatureToRemove) {
                      const feature = correlatedDatasetFeatureToRemove.feature;
                      const correlatedDataset =
                        correlatedDatasetFeatureToRemove.featureDataset;
                      setAllSelectedLabels({
                        ...allSelectedLabels,
                        [correlatedDataset]: allSelectedLabels[
                          correlatedDataset
                        ].filter((label) => label !== feature),
                      });
                    }
                  }
                  // if selections size increases then a row was selected and all doses for the selected feature type's feature should be selected
                  else {
                    // should only be one new selected at a time
                    const newSelectedId = selections.filter(
                      (x) => !prevSelections.includes(x)
                    )[0];
                    const correlatedDatasetFeatureToAdd = filteredTableCorrelationAnalysisData.find(
                      (data) => data.id === newSelectedId
                    );
                    if (correlatedDatasetFeatureToAdd) {
                      const featureCorrelatedDataset =
                        correlatedDatasetFeatureToAdd.featureDataset;
                      const feature = correlatedDatasetFeatureToAdd.feature;
                      const newSelectedLabels =
                        featureCorrelatedDataset in allSelectedLabels
                          ? [
                              ...allSelectedLabels[featureCorrelatedDataset],
                            ].concat(feature)
                          : [feature];
                      setAllSelectedLabels({
                        ...allSelectedLabels,
                        [featureCorrelatedDataset]: newSelectedLabels,
                      });
                    }
                  }
                }}
              />
            </div>
            <p>
              Showing {filteredTableCorrelationAnalysisData.length} of{" "}
              {correlationAnalysisData.length} entries
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
