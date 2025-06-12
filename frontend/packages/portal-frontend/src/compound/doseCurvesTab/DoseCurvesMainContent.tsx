import React, { useEffect, useMemo, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { CurveParams } from "../components/DoseResponseCurve";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import useDoseCurvesData from "./hooks/useDoseCurvesData";
import useDoseCurvesSelectionHandlers from "./hooks/useDoseCurvesSelectionHandlers";
import CompoundPlotSelections from "./CompoundPlotSelections";
import DoseCurvesTable from "./DoseCurvesTable";
import { CompoundDoseCurveData, DRCDatasetOptions } from "./types";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { getDoseCurveTableColumns } from "./utils";
import styles from "./CompoundDoseCurves.scss";

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
  const dapi = getDapi();
  const api = useDeprecatedDataExplorerApi();

  const {
    error,
    isLoading,
    doseCurveData,
    doseTable,
    doseMin,
    doseMax,
  } = useDoseCurvesData(dataset, compoundId);

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);

  useEffect(() => {
    dapi.getCellLineUrlRoot().then((urlRoot: string) => {
      setCellLineUrlRoot(urlRoot);
    });
  }, [dapi]);

  // Build a modelId → displayName map for use in both selectedLabels and WideTable
  const displayNameModelIdMap = useMemo(() => {
    const map = new Map<string, string>();
    doseCurveData?.curve_params.forEach((curveParams: CurveParams) => {
      map.set(curveParams.id!, curveParams.displayName!);
    });
    return map;
  }, [doseCurveData]);

  // Add cell line display names to the dose table rows
  const tableData = useMemo(
    () =>
      (doseTable ?? []).map((row: any) => ({
        ...row,
        cellLine: displayNameModelIdMap.get(row.modelId) || row.modelId,
      })),
    [doseTable, displayNameModelIdMap]
  );

  const {
    selectedCurves,
    selectedTableRows,
    handleClickCurve,
    handleChangeSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
    memoizedTableData,
  } = useDoseCurvesSelectionHandlers(
    doseCurveData,
    tableData,
    api,
    handleShowUnselectedLinesOnSelectionsCleared
  );

  // Format cellLine column to link to cell line pages
  const doseCurveTableColumns = useMemo(() => {
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
      ...getDoseCurveTableColumns(tableData).filter(
        (col: any) => col.accessor !== "cellLine"
      ),
    ];
    return columns;
  }, [tableData, cellLineUrlRoot]);

  // Make sure "Cell Line" and "AUC" always come first, followed by the dose
  // columns in order of smallest to largest dose.
  const columnOrdering = useMemo(
    () => doseCurveTableColumns.map((col) => col.accessor),
    [doseCurveTableColumns]
  );

  // Get the selected cell line name labels for display in the Plot Selections panel.
  const selectedLabels = useMemo(() => {
    const displayNames: string[] = [];
    [...selectedCurves].forEach((modelId: string) => {
      const displayName = displayNameModelIdMap.get(modelId);
      if (displayName) {
        displayNames.push(displayName);
      }
    });
    return displayNames;
  }, [selectedCurves, displayNameModelIdMap]);

  const visibleCurveData = useMemo(() => {
    if (!showUnselectedLines && doseCurveData && selectedCurves.size > 0) {
      const visibleCurveParams = doseCurveData?.curve_params.filter(
        (c: CurveParams) => selectedCurves.has(c.id!)
      );

      return {
        ...doseCurveData,
        curve_params: visibleCurveParams,
      } as CompoundDoseCurveData;
    }
    return doseCurveData;
  }, [doseCurveData, selectedCurves, showUnselectedLines]);

  const visibleDoseRepPoints = useMemo(() => {
    if (!showReplicates || !doseCurveData || selectedCurves.size === 0) {
      return null;
    }

    return Object.fromEntries(
      [...selectedCurves]
        .filter((modelId) => doseCurveData.dose_replicate_points[modelId])
        .map((modelId) => [
          modelId,
          doseCurveData.dose_replicate_points[modelId],
        ])
    );
  }, [doseCurveData, selectedCurves, showReplicates]);

  const defaultCols = useMemo(() => {
    return doseCurveTableColumns
      .map((col) => col.accessor)
      .filter((accessor) => accessor !== "modelId");
  }, [doseCurveTableColumns]);

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
        {error ? (
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
                isLoading={isLoading}
                compoundName={compoundName}
                plotElement={plotElement}
                curvesData={visibleCurveData}
                doseMin={doseMin}
                doseMax={doseMax}
                doseRepPoints={visibleDoseRepPoints}
                doseUnits={doseUnits}
                selectedCurves={selectedCurves}
                handleClickCurve={handleClickCurve}
                handleSetPlotElement={(element: ExtendedPlotType | null) => {
                  setPlotElement(element);
                }}
              />
            </div>
            <div style={{ gridArea: "selections" }}>
              <CompoundPlotSelections
                selectedIds={selectedCurves}
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
        <DoseCurvesTable
          error={error}
          isLoading={isLoading}
          doseTable={doseTable}
          memoizedTableData={memoizedTableData}
          doseCurveTableColumns={doseCurveTableColumns}
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
