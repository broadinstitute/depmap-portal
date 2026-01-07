/* eslint-disable @typescript-eslint/dot-notation */
import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { DRCDatasetOptions } from "@depmap/types";
import useCorrelationAnalysisData from "../hooks/useCorrelationAnalysisData";
import {
  SortedCorrelations,
  VolcanoDataForCorrelatedDataset,
} from "../models/CorrelationPlot";
import { formatDoseString } from "../utilities/helper";
import { GeneCorrelationDatasetOption } from "../types";
import CorrelationsTable from "./CorrelationsTable";
import CorrelationsPlots from "./CorrelationsPlots";
import CorrelationFilters from "./CorrelationFilters";
import styles from "../styles/CorrelationAnalysis.scss";
import { useFilteredCorrelationData } from "../hooks/useFilteredCorrelationData";
import { useVolcanoPlotData } from "../hooks/useVolcanoPlotData";

interface CorrelationAnalysisProps {
  compoundDatasetOptions: DRCDatasetOptions[];
  geneDatasetOptions: GeneCorrelationDatasetOption[];
  featureId: string;
  featureName: string;
  featureType: "gene" | "compound";
}

export interface SelectOption {
  value: string;
  label: string;
}

export default function CorrelationAnalysis(props: CorrelationAnalysisProps) {
  const {
    featureId,
    featureName,
    compoundDatasetOptions,
    geneDatasetOptions,
    featureType,
  } = props;
  const isGene = featureType === "gene";

  const [selectedDataset, setSelectedDataset] = useState<any>(
    isGene ? geneDatasetOptions[0] : compoundDatasetOptions[0]
  );

  const [
    selectedDatasetOption,
    setSelectedDatasetOption,
  ] = useState<SelectOption>({
    value: isGene
      ? geneDatasetOptions[0].datasetId
      : compoundDatasetOptions[0].log_auc_dataset_given_id!,
    label: isGene
      ? geneDatasetOptions[0].displayName
      : compoundDatasetOptions[0].display_name,
  });

  const [selectedCorrelatedDatasets, setSelectedCorrelatedDatasets] = useState<
    string[]
  >([]);
  const [selectedDoses, setSelectedDoses] = useState<string[]>([]);
  const [allSelectedLabels, setAllSelectedLabels] = useState<
    Record<string, string[]>
  >({});

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

  const filteredTableData = useFilteredCorrelationData(
    correlationAnalysisData,
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    featureType
  );

  const volcanoData = useVolcanoPlotData(
    correlationAnalysisData,
    doseColors,
    featureType
  );

  const doses = useMemo(() => doseColors.map((dc) => dc.dose), [doseColors]);

  const selectedRows = useMemo(() => {
    const ids = filteredTableData
      .filter((d: SortedCorrelations) =>
        allSelectedLabels[d.featureDataset]?.includes(d.feature)
      )
      .map((d: SortedCorrelations) => d.id);
    return new Set(ids);
  }, [filteredTableData, allSelectedLabels]);

  const onChangeDataset = useCallback(
    (selection: SelectOption | null) => {
      if (!selection) return;
      const found = isGene
        ? geneDatasetOptions.find(
            (o: GeneCorrelationDatasetOption) => o.datasetId === selection.value
          )
        : compoundDatasetOptions.find(
            (o: DRCDatasetOptions) =>
              o.log_auc_dataset_given_id === selection.value
          );

      setSelectedDataset(found);
      setSelectedDatasetOption(selection);
      setSelectedDoses([]);
    },
    [compoundDatasetOptions, geneDatasetOptions, isGene]
  );

  const handleTableSelection = useCallback(
    (selections: string[]) => {
      const prevIds = Array.from(selectedRows);
      const isAdding = selections.length > prevIds.length;
      const targetId = isAdding
        ? selections.find((id: string) => !prevIds.includes(id))
        : prevIds.find((id: string) => !selections.includes(id));

      const item = filteredTableData.find(
        (d: SortedCorrelations) => d.id === targetId
      );
      if (!item) return;

      setAllSelectedLabels((prev: Record<string, string[]>) => ({
        ...prev,
        [item.featureDataset]: isAdding
          ? [...(prev[item.featureDataset] || []), item.feature]
          : (prev[item.featureDataset] || []).filter(
              (l: string) => l !== item.feature
            ),
      }));
    },
    [filteredTableData, selectedRows]
  );

  // Re-calculate this for the render block to match original variable name
  const datasetsToShow = selectedCorrelatedDatasets.length
    ? selectedCorrelatedDatasets
    : Object.keys(volcanoData);

  return (
    <div className={styles.tabGrid}>
      <div className={styles.tabFilters}>
        <CorrelationFilters
          selectedDatasetOption={selectedDatasetOption}
          compoundDatasetOptions={compoundDatasetOptions}
          geneDatasetOptions={geneDatasetOptions}
          onChangeDataset={onChangeDataset}
          correlatedDatasets={correlatedDatasets}
          onChangeCorrelatedDatasets={(val: string[] | null) =>
            setSelectedCorrelatedDatasets(val || [])
          }
          doses={doses}
          selectedDoses={selectedDoses}
          onChangeDoses={(val: string[] | undefined) =>
            setSelectedDoses(val || [])
          }
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
            <div className={styles.plotArea}>
              {isLoading ? (
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    height: "500px",
                  }}
                >
                  <PlotSpinner />
                </div>
              ) : hasError ? (
                <div className={styles.errorMessage}>
                  Failed to load correlation data.
                </div>
              ) : (
                <CorrelationsPlots
                  correlatedDatasetsToShow={datasetsToShow}
                  dosesToFilter={selectedDoses}
                  doseColors={doseColors}
                  volcanoDataForCorrelatedDatasets={volcanoData}
                  correlatedDatasetSelectedLabels={allSelectedLabels}
                  forwardSelectedLabels={(ds: string, labels: string[]) =>
                    setAllSelectedLabels((prev) => ({ ...prev, [ds]: labels }))
                  }
                  featureType={featureType}
                />
              )}
            </div>
          </div>

          <div>
            <hr className={styles.mainContentHr} />
            <div className={styles.mainContentCellLines}>
              <h3>Associated Features</h3>
              <p>Clicking on rows highlights features in the plots above</p>
              <div style={{ height: "10px" }}>
                {selectedRows.size > 0 && (
                  <button
                    className={styles.linkButton}
                    type="button"
                    onClick={() => setAllSelectedLabels({})}
                  >
                    Unselect all
                  </button>
                )}
              </div>
            </div>

            <div>
              <CorrelationsTable
                isLoading={isLoading}
                hasError={hasError}
                data={filteredTableData}
                featureName={featureName}
                featureType={featureType}
                selectedRows={selectedRows}
                onChangeSelections={handleTableSelection}
              />
            </div>
            {!isLoading && !hasError && (
              <p>
                Showing {filteredTableData.length} of{" "}
                {correlationAnalysisData.length} entries
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
