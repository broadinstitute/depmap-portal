import React, { useEffect, useMemo, useState } from "react";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import useHeatmapSelectionHandlers from "./hooks/useHeatmapSelectionHandlers";
import DoseViabilityTable from "../DoseViabilityTable";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { legacyPortalAPI } from "@depmap/api";
import styles from "../CompoundDoseViability.scss";
// import { DRCDatasetOptions } from "@depmap/types";
import useHeatmapData from "./hooks/useHeatmapData";
import HeatmapPlotSection from "./HeatmapPlotSection";
import { TableFormattedData } from "../types";
import CompoundPlotSelections from "../CompoundPlotSelections";

interface HeatmapTabMainContentProps {
  // compoundId: string; // unused
  compoundName: string;
  handleShowUnselectedLinesOnSelectionsCleared: () => void;
  doseColumnNames: string[];
  tableFormattedData: TableFormattedData | null;
  showUnselectedLines: boolean;
  error: boolean;
  isLoading: boolean;
  selectedDoses?: Set<number>;
}

function HeatmapTabMainContent({
  handleShowUnselectedLinesOnSelectionsCleared,
  doseColumnNames,
  tableFormattedData,
  showUnselectedLines,
  error,
  isLoading,
  selectedDoses = new Set(),
  compoundName,
}: HeatmapTabMainContentProps) {
  const api = useDeprecatedDataExplorerApi();

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
    selectedModelIds,
    selectedTableRows,
    selectedLabels,
    displayNameModelIdMap,
    handleSetSelectedPlotModels,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
    sortedTableData,
  } = useHeatmapSelectionHandlers(
    heatmapFormattedData,
    tableFormattedData,
    api,
    handleShowUnselectedLinesOnSelectionsCleared
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
    const staticColumns = ["cellLine", "modelId", "auc"];
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
                  style={{ textDecoration: "underline" }}
                >
                  {displayName}
                  <span
                    className="glyphicon glyphicon-new-window"
                    style={{
                      paddingLeft: "3px",
                      fontWeight: 300,
                      fontSize: "10px",
                    }}
                  />
                </a>
              ) : (
                <p>{displayName}</p>
              )}
            </>
          );
        },
      },
      {
        accessor: "modelId",
        Header: "Model ID",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "auc",
        Header: "AUC",
        maxWidth: 120,
        minWidth: 80,
      },
      // Add dynamic dose columns
      ...(sortedTableData && sortedTableData.length > 0
        ? Array.from(
            new Set(sortedTableData.flatMap((row) => Object.keys(row)))
          )
            .filter((colName) => !staticColumns.includes(colName))
            .map((colName) => ({
              accessor: colName,
              Header: colName,
              maxWidth: 150,
              minWidth: 100,
            }))
        : []),
    ];
    return columns;
  }, [cellLineUrlRoot, sortedTableData]);

  // Make sure "Cell Line" and "AUC" always come first, followed by the dose
  // columns in order of smallest to largest dose.
  const columnOrdering = useMemo(
    () => doseViabilityTableColumns.map((col) => col.accessor),
    [doseViabilityTableColumns]
  );

  const defaultCols = useMemo(() => {
    return doseViabilityTableColumns
      .map((col) => col.accessor)
      .filter((accessor) => accessor !== "modelId");
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
      <div className={styles.mainContentGrid}>
        <>
          <div style={{ gridArea: "plot" }}>
            {heatmapFormattedData && (
              <HeatmapPlotSection
                isLoading={false}
                compoundName={compoundName}
                plotElement={plotElement}
                heatmapFormattedData={heatmapFormattedData}
                doseMin={doseMin}
                doseMax={doseMax}
                selectedModelIds={selectedModelIds}
                handleSetSelectedPlotModels={handleSetSelectedPlotModels}
                handleSetPlotElement={setPlotElement}
                displayNameModelIdMap={displayNameModelIdMap}
                visibleZIndexes={visibleZIndexes}
                showUnselectedLines={showUnselectedLines}
              />
            )}
          </div>
          <div style={{ gridArea: "selections" }}>
            <CompoundPlotSelections
              selectedIds={selectedModelIds}
              selectedLabels={new Set(selectedLabels)}
              onClickSaveSelectionAsContext={handleClickSaveSelectionAsContext}
              onClickClearSelection={handleClearSelection}
              onClickSetSelectionFromContext={
                heatmapFormattedData ? handleSetSelectionFromContext : undefined
              }
            />
          </div>
        </>
      </div>
      <hr className={styles.mainContentHr} />
      <div className={styles.mainContentCellLines}>
        <h3>Cell Lines</h3>
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
          sortedTableData={sortedTableData ?? []}
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
