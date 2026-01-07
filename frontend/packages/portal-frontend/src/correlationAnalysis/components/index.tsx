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
import { formatDoseString } from "../utilities/helper";
import { DRCDatasetOptions } from "@depmap/types";
import { useCallback, useState, useMemo } from "react";
import { GeneCorrelationDatasetOption } from "../types";

interface CorrelationAnalysisProps {
  compoundDatasetOptions: DRCDatasetOptions[];
  geneDatasetOptions: GeneCorrelationDatasetOption[];
  featureId: string;
  featureName: string;
  featureType: "gene" | "compound";
}

export default function CorrelationAnalysis(props: CorrelationAnalysisProps) {
  const {
    featureId,
    featureName,
    compoundDatasetOptions,
    geneDatasetOptions,
    featureType,
  } = props;
  const [selectedDataset, setSelectedDataset] = useState<any>(
    featureType === "compound"
      ? compoundDatasetOptions[0]
      : geneDatasetOptions[0]
  );
  const [selectedDatasetOption, setSelectedDatasetOption] = useState<{
    value: string;
    label: string;
  }>({
    value:
      featureType === "compound"
        ? compoundDatasetOptions[0].log_auc_dataset_given_id!
        : geneDatasetOptions[0].datasetId,
    label:
      featureType === "compound"
        ? compoundDatasetOptions[0].display_name
        : geneDatasetOptions[0].displayName,
  });

  const [
    selectedCorrelatedDatasets,
    setSelectedCorrelatedDatasets,
  ] = React.useState<string[]>([]);

  // Only relevant if featureType is "compound"
  const [selectedDoses, setSelectedDoses] = React.useState<string[]>([]);

  const [allSelectedLabels, setAllSelectedLabels] = React.useState<{
    [key: string]: string[];
  }>({});

  const [
    filteredTableCorrelationAnalysisData,
    setFilteredTableCorrelationAnalysisData,
  ] = React.useState<SortedCorrelations[]>([]);

  const selectedRows = useMemo(() => {
    if (
      !filteredTableCorrelationAnalysisData ||
      !Object.keys(allSelectedLabels).length
    ) {
      return new Set<string>();
    }
    const ids = filteredTableCorrelationAnalysisData
      .filter(
        (d) =>
          d["featureDataset"] in allSelectedLabels &&
          (allSelectedLabels[d["featureDataset"]] || []).includes(d["feature"])
      )
      .map((d) => d.id);
    return new Set(ids);
  }, [filteredTableCorrelationAnalysisData, allSelectedLabels]);

  const {
    correlationAnalysisData,
    correlatedDatasets,
    doseColors,
    isLoading,
    hasError,
  } = useCorrelationAnalysisData(
    selectedDataset,
    featureId,
    featureName,
    featureType
  );

  const doses = useMemo(() => doseColors.map((doseColor) => doseColor.dose), [
    doseColors,
  ]);

  const onChangeDataset = useCallback(
    (selection: { value: string; label: string } | null) => {
      if (selection) {
        setSelectedDataset(
          featureType === "compound"
            ? compoundDatasetOptions.find(
                (opt: DRCDatasetOptions) =>
                  opt.log_auc_dataset_given_id === selection.value
              )!
            : geneDatasetOptions.find(
                (opt: GeneCorrelationDatasetOption) =>
                  opt.datasetId === selection.value
              )
        );
        setSelectedDatasetOption(selection);
        setSelectedDoses([]);
      }
    },
    [compoundDatasetOptions, geneDatasetOptions, featureType]
  );

  const onChangeCorrelatedDatasets = useCallback(
    (newCorrelatedDatasets: string[] | null) =>
      setSelectedCorrelatedDatasets(
        newCorrelatedDatasets !== null ? newCorrelatedDatasets : []
      ),
    []
  );

  const onChangeDoses = useCallback((newDoses: string[] | undefined) => {
    setSelectedDoses(newDoses || []);
  }, []);

  const handleUnselectAll = useCallback(() => {
    // Clear selected labels; selectedRows is derived from filtered data and will become empty
    setAllSelectedLabels({});
  }, []);

  React.useEffect(() => {
    const isGene = featureType === "gene";

    // Determine if we should show the full list immediately
    // If it's a gene, we only check if datasets or specific labels are filtered
    const noFiltersApplied =
      (isGene || selectedDoses.length === 0) &&
      selectedCorrelatedDatasets.length === 0 &&
      Object.keys(allSelectedLabels).length === 0;

    if (noFiltersApplied) {
      setFilteredTableCorrelationAnalysisData(correlationAnalysisData);
    } else {
      const selectedDataWithLabelFront: any[] = [];

      const filtered = correlationAnalysisData.filter((data) => {
        // If it's a gene, we ignore the dose filter (always true).
        // If it's a compound, we check if doses are selected and if this item matches.
        const matchesDose =
          isGene ||
          selectedDoses.length === 0 ||
          (typeof data["dose"] === "string" &&
            selectedDoses.includes(data["dose"]));

        const matchesDataset =
          selectedCorrelatedDatasets.length === 0 ||
          selectedCorrelatedDatasets.includes(data["featureDataset"]);

        const keepCondition = matchesDose && matchesDataset;

        const isSelectedInUI =
          data["featureDataset"] in allSelectedLabels &&
          allSelectedLabels[data["featureDataset"]].includes(data["feature"]);

        if (isSelectedInUI && keepCondition) {
          selectedDataWithLabelFront.push(data);
        }

        return keepCondition && !isSelectedInUI;
      });

      // 2. Sort selected items: by feature label, then dose (if applicable)
      selectedDataWithLabelFront.sort((a, b) => {
        if (a["feature"] === b["feature"]) {
          // Only sort by dose if doses exist and we aren't in a gene context
          if (!isGene && a["dose"] !== b["dose"]) {
            return (a["dose"] || "").localeCompare(b["dose"] || "");
          }
          return 0;
        }
        return a["feature"].localeCompare(b["feature"]);
      });

      setFilteredTableCorrelationAnalysisData(
        selectedDataWithLabelFront.concat(filtered)
      );
    }
  }, [
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    correlationAnalysisData,
    featureId,
    featureType,
  ]);

  const volcanoDataForCorrelatedDataset = React.useMemo(() => {
    const isGene = featureType === "gene";

    if (correlationAnalysisData.length) {
      return correlationAnalysisData.reduce(
        (acc: VolcanoDataForCorrelatedDataset, curRecord) => {
          const key = curRecord.featureDataset;
          if (!acc[key]) {
            acc[key] = {};
          }

          // For genes, we use a single static category since there are no doses.
          // For compounds, we fall back to the record's dose.
          const doseCategory = isGene ? "Correlation" : curRecord.dose;

          if (doseCategory) {
            if (!(doseCategory in acc[key])) {
              acc[key][doseCategory] = {
                x: [],
                y: [],
                label: [],
                text: [],
                isSignificant: [],
                name: doseCategory,
                // Genes don't have doseColors, so we provide a default color
                color: isGene
                  ? "#337ab7"
                  : doseColors.find((d) => d.dose === doseCategory)?.hex,
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

                  // Construct tooltip text
                  let text = `<b>${label}</b><br>`;

                  // Only add Dose info if this is NOT a gene
                  if (!isGene) {
                    text += `<b>Dose (uM)</b>: ${formatDoseString(
                      curRecord["dose"]
                    )}<br>`;
                  }

                  text +=
                    `<b>Correlation:</b> ${curRecord["correlation"].toFixed(
                      4
                    )}<br>` +
                    `<b>-log10(q value):</b> ${curRecord["log10qvalue"].toFixed(
                      4
                    )}<br>`;

                  (acc[key][doseCategory][prop] as string[]).push(text);
                  acc[key][doseCategory]["label"].push(label);
                } else {
                  (acc[key][doseCategory][prop] as any[]).push(value);
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
  }, [correlationAnalysisData, doseColors, featureType]); // Added featureType to dependencies

  const correlatedDatasetsToShow = useMemo(() => {
    return selectedCorrelatedDatasets.length
      ? selectedCorrelatedDatasets
      : Object.keys(volcanoDataForCorrelatedDataset);
  }, [selectedCorrelatedDatasets, volcanoDataForCorrelatedDataset]);

  const forwardSelectedLabels = useCallback(
    (correlatedDataset: string, newSelectedLabels: string[]) => {
      setAllSelectedLabels((prev) => ({
        ...prev,
        [correlatedDataset]: newSelectedLabels,
      }));
    },
    []
  );

  const handleChangeTableSelections = useCallback(
    (selections: any[]) => {
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
          setAllSelectedLabels((prevAllSelectedLabels) => ({
            ...prevAllSelectedLabels,
            [correlatedDataset]: (
              prevAllSelectedLabels[correlatedDataset] || []
            ).filter((label) => label !== feature),
          }));
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
          setAllSelectedLabels((prev) => {
            const existing = prev[featureCorrelatedDataset]
              ? [...prev[featureCorrelatedDataset]]
              : [];
            return {
              ...prev,
              [featureCorrelatedDataset]: existing.concat(feature),
            };
          });
        }
      }
    },
    [filteredTableCorrelationAnalysisData, selectedRows]
  );

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
        correlatedDatasetsToShow={correlatedDatasetsToShow}
        dosesToFilter={selectedDoses}
        doseColors={doseColors}
        volcanoDataForCorrelatedDatasets={volcanoDataForCorrelatedDataset}
        correlatedDatasetSelectedLabels={allSelectedLabels}
        forwardSelectedLabels={forwardSelectedLabels}
        featureType={featureType}
      />
    );
  }

  return (
    <div className={styles.tabGrid}>
      <div className={styles.tabFilters}>
        <CorrelationFilters
          selectedDatasetOption={selectedDatasetOption}
          compoundDatasetOptions={compoundDatasetOptions}
          geneDatasetOptions={geneDatasetOptions}
          onChangeDataset={onChangeDataset}
          correlatedDatasets={correlatedDatasets}
          onChangeCorrelatedDatasets={onChangeCorrelatedDatasets}
          doses={doses} // The list of doses allowed for the current selected dataset
          selectedDoses={selectedDoses} // The list of doses the user has selected to filter on
          onChangeDoses={onChangeDoses}
          featureType={featureType}
        />
      </div>

      <div className={styles.tabMain}>
        <div className={styles.mainContentContainer}>
          <div className={styles.mainContentHeader}>
            <h3>Correlation Analysis</h3>
            <p>
              Univariate associations between sensitivity profiles and the
              genomic features or genetic dependencies are presented in the
              table and plots. Hover over plot points for tooltip information.
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
                    onClick={handleUnselectAll}
                  >
                    Unselect all
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <CorrelationsTable
                isLoading={isLoading}
                hasError={hasError}
                data={filteredTableCorrelationAnalysisData}
                featureName={featureName}
                featureType={featureType}
                selectedRows={selectedRows}
                onChangeSelections={handleChangeTableSelections}
              />
            </div>
            {!isLoading && !hasError && (
              <p>
                Showing {filteredTableCorrelationAnalysisData.length} of{" "}
                {correlationAnalysisData.length} entries
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
