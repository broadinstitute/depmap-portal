import React, { useEffect, useMemo, useState } from "react";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import useHeatmapSelectionHandlers from "./hooks/useHeatmapSelectionHandlers";
import DoseViabilityTable from "../DoseViabilityTable";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { legacyPortalAPI } from "@depmap/api";
import styles from "../CompoundDoseViability.scss";
import useHeatmapData from "./hooks/useHeatmapData";
import HeatmapPlotSection from "./HeatmapPlotSection";
import CompoundPlotSelections from "../CompoundPlotSelections";
import { useDoseViabilityDataContext } from "../hooks/useDoseViabilityDataContext";
import { hiddenDoseViabilityCols, staticDoseViabilityCols } from "../utils";
import { TableFormattedData } from "../types";

interface HeatmapTabMainContentProps {
  compoundName: string;
  handleShowUnselectedLinesOnSelectionsCleared: () => void;
  showUnselectedLines: boolean;
  doseUnits: string;
  selectedModelIds: Set<string>;
  selectedTableRows: Set<string>;
  selectedDoses?: Set<number>;
  handleSetSelectedTableRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleSetSelectedPlotModelIds: React.Dispatch<
    React.SetStateAction<Set<string>>
  >;
}

function HeatmapTabMainContent({
  handleShowUnselectedLinesOnSelectionsCleared,
  showUnselectedLines,
  doseUnits,
  selectedDoses = new Set(),
  compoundName,
  selectedModelIds,
  selectedTableRows,
  handleSetSelectedTableRows,
  handleSetSelectedPlotModelIds,
}: HeatmapTabMainContentProps) {
  const api = useDeprecatedDataExplorerApi();
  const {
    tableFormattedData,
    doseColumnNames,
    error,
    isLoading,
  } = useDoseViabilityDataContext();

  const { heatmapFormattedData, doseMin, doseMax } = useHeatmapData(
    tableFormattedData,
    doseColumnNames
  );

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);

  useEffect(() => {
    legacyPortalAPI.getCellLineUrlRoot().then((urlRoot: string) => {
      setCellLineUrlRoot(urlRoot);
    });
  }, []);

  const {
    selectedLabels,
    displayNameModelIdMap,
    handleSetSelectedPlotModels,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  } = useHeatmapSelectionHandlers(
    heatmapFormattedData,
    tableFormattedData,
    selectedModelIds,
    selectedTableRows,
    api,
    handleShowUnselectedLinesOnSelectionsCleared,
    handleSetSelectedTableRows,
    handleSetSelectedPlotModelIds
  );

  // To hide/show the appropriate cells on Filter By Dose
  const visibleZIndexes = useMemo(() => {
    if (!heatmapFormattedData) return [];
    if (selectedDoses && selectedDoses.size > 0) {
      return heatmapFormattedData.y
        .map((dose, idx) => (selectedDoses.has(dose) ? idx : -1))
        .filter((idx) => idx !== -1);
    }
    return heatmapFormattedData.y.map((_, idx) => idx);
  }, [heatmapFormattedData, selectedDoses]);

  const doseViabilityTableColumns = useMemo(() => {
    const staticColumns = staticDoseViabilityCols.map((col) => col.accessor);
    const columns = [
      {
        accessor: "cellLine",
        Header: "Cell Line",
        maxWidth: 200,
        minWidth: 150,
        Cell: (row: any) => {
          const modelId = row.row.original.modelId;
          const displayName = row.row.original.cellLine;
          return (
            <>
              {cellLineUrlRoot ? (
                <a
                  href={`${cellLineUrlRoot}${modelId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.customWideTableCellLink}
                >
                  {displayName}
                  <span
                    className={`glyphicon glyphicon-new-window ${styles.customColLinkOutIcon}`}
                  />
                </a>
              ) : (
                <p>{displayName}</p>
              )}
            </>
          );
        },
      },
      ...staticDoseViabilityCols,
      // Add dynamic dose columns
      ...(tableFormattedData && tableFormattedData.length > 0
        ? Array.from(
            new Set(
              (tableFormattedData as TableFormattedData).flatMap((row) =>
                Object.keys(row)
              )
            )
          )
            .filter(
              (colName) =>
                !staticColumns.includes(colName) && colName !== "cellLine"
            )
            .map((colName) => ({
              accessor: colName,
              Header: colName,
              maxWidth: 150,
              minWidth: 100,
            }))
        : []),
    ];
    return columns;
  }, [cellLineUrlRoot, tableFormattedData]);

  // Make sure "Cell Line" and "AUC" always come first, followed by the dose
  // columns in order of smallest to largest dose.
  const columnOrdering = useMemo(
    () => doseViabilityTableColumns.map((col) => col.accessor),
    [doseViabilityTableColumns]
  );

  const defaultCols = useMemo(() => {
    return doseViabilityTableColumns
      .map((col) => col.accessor)
      .filter(
        (accessor) =>
          !hiddenDoseViabilityCols.map((a) => a.accessor).includes(accessor)
      );
  }, [doseViabilityTableColumns]);

  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3>Viability Heatmap</h3>
        <p>
          Each cell line is organized by column, divided by dose. Hover over
          plot points for tooltip information. Click on items to select from the
          plot or table.
        </p>
      </div>
      {error ? (
        <div className={styles.errorMessage}>Error loading heatmap data.</div>
      ) : (
        <>
          <div className={styles.mainContentGrid}>
            <div className={styles.plotArea}>
              <HeatmapPlotSection
                isLoading={isLoading}
                compoundName={compoundName}
                plotElement={plotElement}
                heatmapFormattedData={heatmapFormattedData}
                doseMin={doseMin}
                doseMax={doseMax}
                doseUnits={doseUnits}
                selectedModelIds={selectedModelIds}
                handleSetSelectedPlotModels={handleSetSelectedPlotModels}
                handleSetPlotElement={setPlotElement}
                displayNameModelIdMap={displayNameModelIdMap}
                visibleZIndexes={visibleZIndexes}
                showUnselectedLines={showUnselectedLines}
              />
            </div>
            <div className={styles.selectionsArea}>
              <CompoundPlotSelections
                selectedIds={selectedModelIds}
                selectedLabels={new Set(selectedLabels)}
                onClickSaveSelectionAsContext={
                  handleClickSaveSelectionAsContext
                }
                onClickClearSelection={handleClearSelection}
                onClickSetSelectionFromContext={
                  heatmapFormattedData
                    ? handleSetSelectionFromContext
                    : undefined
                }
              />
            </div>
          </div>{" "}
        </>
      )}
      <hr className={styles.mainContentHr} />
      <div className={styles.mainContentCellLines}>
        <h3>Cell Lines</h3>
        <h4>Dose column units: Viability</h4>
        <p>
          Lines selected in the plot will appear checked in this table. Click on
          the cell line name for more information or uncheck the box to deselect
          from the plot.
        </p>
      </div>
      <div>
        <DoseViabilityTable
          error={error}
          isLoading={isLoading}
          tableData={tableFormattedData ?? []}
          doseCurveTableColumns={doseViabilityTableColumns}
          columnOrdering={columnOrdering}
          defaultCols={defaultCols}
          selectedTableRows={selectedTableRows}
          handleChangeSelection={handleChangeTableSelection}
        />
      </div>
    </div>
  );
}

export default HeatmapTabMainContent;
