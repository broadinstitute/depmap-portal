import React, { useEffect, useMemo, useState } from "react";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import useHeatmapSelectionHandlers from "./hooks/useHeatmapSelectionHandlers";
import DoseViabilityTable from "../DoseViabilityTable";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { legacyPortalAPI } from "@depmap/api";
import styles from "./CompoundDoseCurves.scss";
import { DRCDatasetOptions } from "@depmap/types";
import useHeatmapData from "./hooks/useHeatmapData";
import HeatmapPlotSection from "./HeatmapPlotSection";
import CompoundPlotSelections from "../CompoundPlotSelections";

interface HeatmapTabMainContentProps {
  dataset: DRCDatasetOptions | null;
  doseUnits: string;
  showInsensitiveLines: boolean;
  showUnselectedLines: boolean;
  compoundName: string;
  compoundId: string;
  handleShowUnselectedLinesOnSelectionsCleared: () => void;
  doseColumnNames: string[];
  tableFormattedData: any;
  selectedDoses?: Set<string>;
}

function DoseCurvesMainContent({
  dataset,
  doseUnits,
  showInsensitiveLines,
  showUnselectedLines,
  compoundName,
  compoundId,
  handleShowUnselectedLinesOnSelectionsCleared,
  doseColumnNames,
  tableFormattedData,
  selectedDoses,
}: HeatmapTabMainContentProps) {
  const api = useDeprecatedDataExplorerApi();

  const { heatmapFormattedData, doseMin, doseMax } = useHeatmapData(
    tableFormattedData,
    doseColumnNames
  );

  // Filter heatmapFormattedData based on selectedDoses
  const filteredHeatmapFormattedData = React.useMemo(() => {
    if (!selectedDoses || selectedDoses.size === 0 || !heatmapFormattedData) {
      return heatmapFormattedData;
    }
    // Only keep rows (doses) in y/z that match selectedDoses
    const filteredDoseIndices = heatmapFormattedData.y
      .map((dose, idx) => (selectedDoses.has(String(dose)) ? idx : -1))
      .filter((idx) => idx !== -1);
    return {
      ...heatmapFormattedData,
      y: heatmapFormattedData.y.filter((dose, idx) =>
        filteredDoseIndices.includes(idx)
      ),
      z: filteredDoseIndices.map((idx) => heatmapFormattedData.z[idx]),
    };
  }, [heatmapFormattedData, selectedDoses]);

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
    memoizedTableData,
  } = useHeatmapSelectionHandlers(
    heatmapFormattedData,
    tableFormattedData,
    api,
    handleShowUnselectedLinesOnSelectionsCleared
  );

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
      ...Object.keys(tableFormattedData || {})
        .filter((colName) => !staticColumns.includes(colName))
        .map((colName) => ({
          accessor: colName,
          Header: colName,
          maxWidth: 150,
          minWidth: 100,
        })),
    ];
    return columns;
  }, [cellLineUrlRoot, tableFormattedData]);

  // Make sure "Cell Line" and "AUC" always come first, followed by the dose
  // columns in order of smallest to largest dose.
  const columnOrdering = useMemo(
    () => doseViabilityTableColumns.map((col) => col.accessor),
    [doseViabilityTableColumns]
  );

  // TODO: FINISH THIS
  const visibleModelsData = useMemo(() => {
    /* do something */
  }, []);

  const defaultCols = useMemo(() => {
    return doseViabilityTableColumns
      .map((col) => col.accessor)
      .filter((accessor) => accessor !== "modelId");
  }, [doseViabilityTableColumns]);

  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3>Dose Curve</h3>
        <p>
          Each cell line is represented as a line, with doses on the x axis and
          viability on the y axis. Hover over plot points for tooltip
          information. Click on items to select from the plot or table.
        </p>
      </div>
      <div className={styles.mainContentGrid}>
        <>
          <div style={{ gridArea: "plot" }}>
            <HeatmapPlotSection
              isLoading={false}
              compoundName={compoundName}
              plotElement={plotElement}
              heatmapFormattedData={filteredHeatmapFormattedData}
              doseMin={doseMin}
              doseMax={doseMax}
              selectedModelIds={selectedModelIds}
              handleSetSelectedPlotModels={handleSetSelectedPlotModels}
              handleSetPlotElement={(element: ExtendedPlotType | null) => {
                setPlotElement(element);
              }}
            />
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
          error={false}
          isLoading={false}
          doseTable={tableFormattedData}
          memoizedTableData={memoizedTableData ?? []}
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

export default DoseCurvesMainContent;
