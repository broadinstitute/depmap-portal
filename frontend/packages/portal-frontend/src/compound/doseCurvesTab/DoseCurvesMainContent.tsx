import WideTable from "@depmap/wide-table";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDapi } from "src/common/utilities/context";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { CurveParams, CurvePlotPoints } from "../components/DoseResponseCurve";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import useDoseCurvesData from "./hooks/useDoseCurvesData";
import CompoundPlotSelections from "./CompoundPlotSelections";
import {
  CompoundDoseCurveData,
  DoseTableRow,
  DRCDatasetOptions,
} from "./types";
import { DataExplorerContext } from "@depmap/types";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { saveNewContext } from "src";
import doseCurvesPromptForSelectionFromContext from "./doseCurvesPromptForSelectionFromContext";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";

interface DoseCurvesMainContentProps {
  dataset: DRCDatasetOptions | null;
  doseUnits: string;
  showReplicates: boolean;
  showUnselectedLines: boolean;
  compoundName: string;
  compoundId: string;
  handleShowUnselectedLinesOnSelectionsCleared: () => void;
}

const sortBySelectedModel = (
  doseTable: DoseTableRow[],
  selectedModelIds: Set<string>
) => {
  return doseTable.sort((a, b) => {
    const aHasPriority = selectedModelIds.has(a.modelId);
    const bHasPriority = selectedModelIds.has(b.modelId);

    if (aHasPriority && !bHasPriority) {
      return -1; // a comes first
    }
    if (!aHasPriority && bHasPriority) {
      return 1; // b comes first
    }
    // If both or neither have a selectedModelId, it doesn't matter which comes first
    return -1;
  });
};

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

  const { error, isLoading, doseCurveData, doseTable } = useDoseCurvesData(
    dataset,
    compoundId
  );

  const [selectedCurves, setSelectedCurves] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
  );

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [doseRepPoints, setDoseRepPoints] = useState<{
    [model_id: string]: CurvePlotPoints[];
  } | null>(null);

  // Can only add selections by clicking the plot.
  const handleClickCurve = useCallback(
    (modelId: string) => {
      if (doseCurveData) {
        setSelectedCurves((xs) => {
          let ys = new Set(xs);
          if (!xs?.has(modelId)) {
            ys.add(modelId);
          }
          selectedTableRows.forEach((rowId: string) => {
            if (!ys.has(rowId)) {
              ys.add(rowId);
            }
          });
          setSelectedTableRows(ys);
          return ys;
        });
      }
    },
    [doseCurveData, setSelectedCurves, setSelectedTableRows, selectedTableRows]
  );

  // Can add/delete selections using the table.
  const handleChangeSelection = useCallback(
    (selections: string[]) => {
      if (doseCurveData) {
        setSelectedTableRows((xs) => {
          let unselectedId: string;
          let ys = new Set(xs);

          if (selections.length < xs.size) {
            unselectedId = [...xs].filter((x) => !selections.includes(x))[0];

            ys.delete(unselectedId);
          } else {
            const newSelectedId = selections.filter(
              (x) => ![...xs].includes(x)
            )[0];

            ys.add(newSelectedId);
          }

          // Add rows selected from the clicking the plot curves.
          selectedCurves.forEach((curveId: string) => {
            if (unselectedId && curveId !== unselectedId && !ys.has(curveId)) {
              ys.add(curveId);
            }
          });
          setSelectedCurves(ys);
          return ys;
        });
      }
    },
    [doseCurveData, setSelectedTableRows, setSelectedCurves, selectedCurves]
  );

  const latestPromise = useRef<Promise<{
    [model_id: string]: CurvePlotPoints[];
  }> | null>(null);

  useEffect(() => {
    (async () => {
      if (dataset && showReplicates && selectedCurves.size > 0) {
        // setIsLoading(true);

        const promise = dapi.getCompoundModelDoseReplicatePoints!(
          compoundId,
          dataset.replicate_dataset,
          Array.from(selectedCurves),
          dataset.drc_dataset_label
        );

        latestPromise.current = promise;
        promise
          .then((fetchedData) => {
            if (promise === latestPromise.current) {
              setDoseRepPoints(fetchedData);
            }
          })
          .catch((e) => {
            if (promise === latestPromise.current) {
              window.console.error(e);
              // setError(true);
              // setIsLoading(false);
            }
          })
          .finally(() => {
            if (promise === latestPromise.current) {
              // setIsLoading(false);
            }
          });
      } else {
        setDoseRepPoints(null);
      }
    })();
  }, [selectedCurves, setDoseRepPoints, dapi]);

  const selectedLabels = useMemo(() => {
    const displayNameModelIdMap = new Map<string, string>();
    doseCurveData?.curve_params.forEach((curveParams: CurveParams) => {
      displayNameModelIdMap.set(curveParams.id!, curveParams.displayName!);
    });
    const displayNames: string[] = [];
    [...selectedCurves].forEach((modelId: string) => {
      const displayName = displayNameModelIdMap.get(modelId);
      if (displayName) {
        displayNames.push(displayName);
      }
    });

    return displayNames;
  }, [selectedCurves, doseCurveData]);

  const handleClickSaveSelectionAsContext = () => {
    const labels = [...selectedCurves];

    const context = {
      name: defaultContextName(selectedCurves.size),
      context_type: "depmap_model",
      expr: { in: [{ var: "entity_label" }, labels] },
    };

    saveNewContext(context as DataExplorerContext);
  };

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

  return (
    <div style={{ marginLeft: "10px", marginRight: "10px" }}>
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <h3>Dose Curve</h3>
        <p style={{ maxWidth: "780px" }}>
          Each cell line is represented as a line, with doses on the x axis and
          viability on the y axis. Hover over plot points for tooltip
          information. Click on items to select from the plot or table.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gridTemplateAreas: "'plot plot selections'",
          gap: "1rem",
        }}
      >
        <div style={{ gridArea: "plot" }}>
          <DoseCurvesPlotSection
            compoundName={compoundName}
            plotElement={plotElement}
            curvesData={visibleCurveData}
            doseRepPoints={showReplicates ? doseRepPoints : null}
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
            onClickSaveSelectionAsContext={handleClickSaveSelectionAsContext}
            onClickClearSelection={() => {
              setSelectedCurves(new Set([]));
              setSelectedTableRows(new Set([]));
              setDoseRepPoints(null);
              handleShowUnselectedLinesOnSelectionsCleared();
            }}
            onClickSetSelectionFromContext={async () => {
              const allLabels = new Set(
                doseCurveData?.curve_params.map(
                  (curveParam: CurveParams) => curveParam.id!
                )
              );
              const labels = await doseCurvesPromptForSelectionFromContext(
                api,
                allLabels
              );

              if (labels === null) {
                return;
              }

              setSelectedCurves(labels);
              setSelectedTableRows(labels);
            }}
          />
        </div>
      </div>
      <hr
        style={{
          borderTop: "1px solid #b8b8b8",
          marginTop: "30px",
        }}
      />
      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <h3>Cell Lines</h3>
        <p style={{ maxWidth: "780px" }}>
          Lines selected in the plot will appear checked in this table. Click on
          the cell line name for more information or uncheck the box to deselect
          from the plot.
        </p>
      </div>
      {doseTable && (
        <WideTable
          idProp="modelId"
          rowHeight={28}
          data={
            selectedTableRows.size === 0
              ? doseTable
              : sortBySelectedModel(doseTable, selectedTableRows)
          }
          columns={Object.keys(doseTable![0]).map((colName: string) => {
            return {
              accessor: colName,
              Header: colName,
              maxWidth: 150,
              minWidth: 150,
            };
          })}
          selectedTableLabels={selectedTableRows}
          onChangeSelections={handleChangeSelection}
          hideSelectAllCheckbox
          allowDownloadFromTableDataWithMenu
          allowDownloadFromTableDataWithMenuFileName="dose-curve-data.csv"
          // defaultColumnsToShow={defaultColumns}
        />
      )}
    </div>
  );
}

export default DoseCurvesMainContent;
