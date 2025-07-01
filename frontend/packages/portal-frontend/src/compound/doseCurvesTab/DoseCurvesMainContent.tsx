import React, { useEffect, useMemo, useState } from "react";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import useDoseCurvesData from "./hooks/useDoseCurvesData";
import useDoseCurvesSelectionHandlers from "./hooks/useDoseCurvesSelectionHandlers";
import DoseViabilityTable from "../DoseViabilityTable";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { legacyPortalAPI } from "@depmap/api";
import styles from "../CompoundDoseViability.scss";
import {
  CurveParams,
  CompoundDoseCurveData,
  DRCDatasetOptions,
} from "@depmap/types";
import CompoundPlotSelections from "../CompoundPlotSelections";
import { useDoseTableDataContext } from "../hooks/useDoseTableDataContext";

interface DoseCurvesMainContentProps {
  dataset: DRCDatasetOptions | null;
  doseUnits: string;
  showReplicates: boolean;
  showUnselectedLines: boolean;
  compoundName: string;
  compoundId: string;
  handleShowUnselectedLinesOnSelectionsCleared: () => void;
}

function DoseCurvesMainContent({
  dataset,
  doseUnits,
  showReplicates,
  showUnselectedLines,
  compoundName,
  compoundId,
  handleShowUnselectedLinesOnSelectionsCleared,
}: DoseCurvesMainContentProps) {
  const {
    doseColumnNames,
    tableFormattedData,
    error,
    isLoading,
  } = useDoseTableDataContext();
  const api = useDeprecatedDataExplorerApi();

  const {
    doseCurveDataError,
    doseCurveDataIsLoading,
    doseCurveData,
    doseMin,
    doseMax,
  } = useDoseCurvesData(dataset, compoundId, doseColumnNames);

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
    handleClickCurve,
    handleChangeSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
    sortedTableData,
  } = useDoseCurvesSelectionHandlers(
    doseCurveData,
    tableFormattedData,
    api,
    handleShowUnselectedLinesOnSelectionsCleared
  );

  // Format cellLine column to link to cell line pages
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

  const visibleCurveData = useMemo(() => {
    if (!showUnselectedLines && doseCurveData && selectedModelIds.size > 0) {
      const visibleCurveParams = doseCurveData?.curve_params.filter(
        (c: CurveParams) => selectedModelIds.has(c.id!)
      );

      return {
        ...doseCurveData,
        curve_params: visibleCurveParams,
      } as CompoundDoseCurveData;
    }
    return doseCurveData;
  }, [doseCurveData, selectedModelIds, showUnselectedLines]);

  const visibleDoseRepPoints = useMemo(() => {
    if (!showReplicates || !doseCurveData || selectedModelIds.size === 0) {
      return null;
    }

    return Object.fromEntries(
      [...selectedModelIds]
        .filter((modelId) => doseCurveData.dose_replicate_points[modelId])
        .map((modelId) => [
          modelId,
          doseCurveData.dose_replicate_points[modelId],
        ])
    );
  }, [doseCurveData, selectedModelIds, showReplicates]);

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
        {doseCurveDataError ? (
          <div
            className={styles.errorMessage}
            style={{
              gridArea: "plot / plot / selections / selections",
              width: "100%",
            }}
          >
            Error loading dose curve data.
          </div>
        ) : (
          <>
            <div style={{ gridArea: "plot" }}>
              <DoseCurvesPlotSection
                isLoading={doseCurveDataIsLoading}
                compoundName={compoundName}
                plotElement={plotElement}
                curvesData={visibleCurveData}
                doseMin={doseMin}
                doseMax={doseMax}
                doseRepPoints={visibleDoseRepPoints}
                doseUnits={doseUnits}
                selectedModelIds={selectedModelIds}
                handleClickCurve={handleClickCurve}
                handleSetPlotElement={(element: ExtendedPlotType | null) => {
                  setPlotElement(element);
                }}
              />
            </div>
            <div style={{ gridArea: "selections" }}>
              <CompoundPlotSelections
                selectedIds={selectedModelIds}
                selectedLabels={new Set(selectedLabels)}
                onClickSaveSelectionAsContext={
                  handleClickSaveSelectionAsContext
                }
                onClickClearSelection={handleClearSelection}
                onClickSetSelectionFromContext={
                  doseCurveData?.curve_params
                    ? handleSetSelectionFromContext
                    : undefined
                }
              />
            </div>
          </>
        )}
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
          handleChangeSelection={handleChangeSelection}
        />
      </div>
    </div>
  );
}

export default DoseCurvesMainContent;
