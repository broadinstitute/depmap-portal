import React, { useEffect, useMemo, useState } from "react";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import useDoseCurvesSelectionHandlers from "./hooks/useDoseCurvesSelectionHandlers";
import DoseViabilityTable from "../DoseViabilityTable";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { legacyPortalAPI } from "@depmap/api";
import styles from "../CompoundDoseViability.scss";
import { CurveParams, CompoundDoseCurveData } from "@depmap/types";
import CompoundPlotSelections from "../CompoundPlotSelections";
import { useDoseViabilityDataContext } from "../hooks/useDoseViabilityDataContext";
import { hiddenDoseViabilityCols, staticDoseViabilityCols } from "../utils";
import { TableFormattedData } from "src/compound/types";

interface DoseCurvesMainContentProps {
  doseUnits: string;
  showReplicates: boolean;
  showUnselectedLines: boolean;
  compoundName: string;
  handleShowUnselectedLinesOnSelectionsCleared: () => void;
}

function DoseCurvesMainContent({
  doseUnits,
  showReplicates,
  showUnselectedLines,
  compoundName,
  handleShowUnselectedLinesOnSelectionsCleared,
}: DoseCurvesMainContentProps) {
  const {
    tableFormattedData,
    doseCurveData,
    doseMin,
    doseMax,
    error,
    isLoading,
  } = useDoseViabilityDataContext();
  const api = useDeprecatedDataExplorerApi();

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [cellLineUrlRoot, setCellLineUrlRoot] = useState<string | null>(null);

  useEffect(() => {
    // If dose curve data changed, invalidate the plot
    setPlotElement(null);
  }, [doseCurveData]);

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
  } = useDoseCurvesSelectionHandlers(
    doseCurveData,
    tableFormattedData,
    api,
    handleShowUnselectedLinesOnSelectionsCleared
  );

  // Format cellLine column to link to cell line pages
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
      .filter(
        (accessor) =>
          !hiddenDoseViabilityCols.map((a) => a.accessor).includes(accessor)
      );
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
        {error ? (
          <div className={styles.mainContentGridErrorMessage}>
            Error loading dose curve data.
          </div>
        ) : (
          <>
            <div style={styles.plot}>
              <DoseCurvesPlotSection
                isLoading={isLoading}
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
            <div style={styles.selections}>
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
          handleChangeSelection={handleChangeSelection}
        />
      </div>
    </div>
  );
}

export default DoseCurvesMainContent;
