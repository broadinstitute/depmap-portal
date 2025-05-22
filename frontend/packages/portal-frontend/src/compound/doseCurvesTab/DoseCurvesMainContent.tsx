import WideTable from "@depmap/wide-table";
import React, { useCallback, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import useDoseCurvesData from "./hooks/useDoseCurvesData";

interface DoseCurvesMainContentProps {
  dataset: CompoundDataset | null;
  doseUnits: string;
}

function DoseCurvesMainContent({
  dataset,
  doseUnits,
}: DoseCurvesMainContentProps) {
  const dapi = getDapi();

  const [showReplicates, setShowReplicates] = useState<boolean>(true);

  const { error, isLoading, doseCurveData, doseTable } = useDoseCurvesData(
    dataset
  );

  console.log(isLoading);
  console.log(error);

  const [selectedCurves, setSelectedCurves] = useState<Set<number>>(
    new Set([])
  );
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
    new Set([])
  );

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  const handleClickCurve = useCallback(
    (curveNumber: number) => {
      if (doseCurveData) {
        setSelectedCurves((xs) => {
          if (!xs?.has(curveNumber)) {
            xs.add(curveNumber);
          }
          return xs;
        });

        const selectedModelId = doseCurveData.curve_params[curveNumber].id!;
        setSelectedModelIds((xs) => {
          if (!xs?.has(selectedModelId)) {
            xs.add(selectedModelId);
          }
          return xs;
        });
      }
    },
    [doseCurveData, setSelectedCurves, setSelectedModelIds]
  );

  const findIndexByProperty = (
    array: any[],
    property: keyof any,
    value: any
  ): number => {
    return array.findIndex((item) => item[property] === value);
  };

  const handleChangeTableSelection = useCallback(
    (selections: string[]) => {
      if (doseCurveData) {
        const curveNumbers = selections.map((modelId: string) => {
          return findIndexByProperty(doseCurveData.curve_params, "id", modelId);
        });

        setSelectedModelIds((xs) => {
          selections.forEach((selection: string) => {
            if (!xs?.has(selection)) {
              xs.add(selection);
            }
          });
          return xs;
        });

        setSelectedCurves((xs) => {
          curveNumbers.forEach((curveNumber: number) => {
            if (!xs?.has(curveNumber)) {
              xs.add(curveNumber);
            }
          });

          return xs;
        });
      }
    },
    [doseCurveData, setSelectedCurves, setSelectedModelIds]
  );

  return (
    <div>
      <DoseCurvesPlotSection
        plotElement={plotElement}
        curvesData={doseCurveData}
        doseUnits={doseUnits}
        selectedCurves={selectedCurves}
        handleClickCurve={handleClickCurve}
        handleSetPlotElement={(element: ExtendedPlotType | null) => {
          setPlotElement(element);
        }}
      />
      {doseTable && (
        <WideTable
          idProp="modelId"
          rowHeight={28}
          data={doseTable}
          columns={Object.keys(doseTable![0]).map((colName: string) => {
            return {
              accessor: colName,
              Header: colName,
              maxWidth: 150,
              minWidth: 150,
            };
          })}
          selectedTableLabels={selectedModelIds}
          onChangeSelections={handleChangeTableSelection}
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
