import WideTable from "@depmap/wide-table";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { CurveParams } from "../components/DoseResponseCurve";
import { CompoundDataset } from "../components/DoseResponseTab";
import DoseCurvesPlotSection from "./DoseCurvesPlotSection";
import { CompoundDoseCurveData } from "./types";

interface DoseCurvesMainContentProps {
  dataset: CompoundDataset | null;
  doseUnits: string;
}

type DoseTableRow = {
  modelId: string;
  cell_line_display_name: string;
} & {
  [dose: string]: number;
};

function DoseCurvesMainContent({
  dataset,
  doseUnits,
}: DoseCurvesMainContentProps) {
  const dapi = getDapi();

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);
  const [doseTable, setDoseTable] = useState<DoseTableRow[] | null>(null);

  const latestPromise = useRef<Promise<CompoundDoseCurveData> | null>(null);
  const latestTablePromise = useRef<Promise<any> | null>(null);

  // Get the data and options for the selected dataset
  useEffect(() => {
    (async () => {
      if (dataset) {
        setIsLoading(true);
        const promise = dapi.getCompoundDoseCurveData!(
          dataset.dataset,
          dataset.compound_label,
          dataset.dose_replicate_dataset
        );

        latestPromise.current = promise;
        promise
          .then((fetchedData) => {
            if (promise === latestPromise.current) {
              setDoseCurveData(fetchedData);
            }
          })
          .catch((e) => {
            if (promise === latestPromise.current) {
              window.console.error(e);
              setError(true);
              setIsLoading(false);
            }
          })
          .finally(() => {
            if (promise === latestPromise.current) {
              setIsLoading(false);
            }
          });

        const tablePromise = dapi.getDoseResponseTable!(
          dataset.dose_replicate_dataset,
          dataset.compound_xref_full
        );

        latestTablePromise.current = tablePromise;
        tablePromise
          .then((fetchedData) => {
            if (tablePromise === latestTablePromise.current) {
              const modelIds = Object.keys(fetchedData).sort();
              const formattedTableData: DoseTableRow[] = modelIds.map(
                (modelId) => {
                  return { ...fetchedData[modelId], modelId };
                }
              );

              setDoseTable(formattedTableData);
            }
          })
          .catch((e) => {
            if (tablePromise === latestPromise.current) {
              window.console.error(e);
              //setError(true);
              //setIsLoading(false);
            }
          })
          .finally(() => {
            if (tablePromise === latestTablePromise.current) {
              //xwsetIsLoading(false);
            }
          });
      }
    })();
  }, [setDoseCurveData, setIsLoading, dataset, dapi, setDoseTable]);

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

  const handleChangeTableSelection = (selections: string[]) => {
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
  };

  // THIS IS WHERE I LEFT OFF!!!!!
  // NOTE: how to make the plot do a relstyle when the table is used to select/deselect a point?

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
          //defaultColumnsToShow={defaultColumns}
        />
      )}
    </div>
  );
}

export default DoseCurvesMainContent;
