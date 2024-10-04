import React, { useCallback, useMemo, useState } from "react";
import Heatmap from "src/plot/components/Heatmap";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import {
  COLOR_SCALE,
  DataAvailability,
  DataPageDataType,
  DataPageDataTypeCategoryStrings,
  getDataPageDataTypeColorCategoryString,
  getDataPageDataTypeString,
} from "../models/types";
import styles from "src/dataPage/styles/DataPage.scss";
import DataPageDatatypeSelector from "./DataPageDatatypeSelector";
import { BAR_THICKNESS, getFileUrl } from "./utils";
import LineageAvailabilityPlot from "./LineageAvailabilityPlot";

interface DataAvailabilityPlotProps {
  currentReleaseDataAvil: DataAvailability;
  handleSetPlotElement: (element: any) => void;
  plotElement: ExtendedPlotType | null;
  isCurrentRelease?: boolean;
}

const DataAvailabilityPlot = ({
  currentReleaseDataAvil,
  handleSetPlotElement,
  plotElement,
  isCurrentRelease = false,
}: DataAvailabilityPlotProps) => {
  const xVals = useMemo(() => {
    return currentReleaseDataAvil.all_depmap_ids.map((item) => item[1]);
  }, [currentReleaseDataAvil]);
  const totalCellLines = xVals.length;

  // Split the data avail values into separate array by data type category
  const dataValuesByDataTypeCategory = useMemo(() => {
    if (currentReleaseDataAvil && currentReleaseDataAvil.values.length > 0) {
      const dataByCategory: {
        category: DataPageDataTypeCategoryStrings;
        dataTypeValues: {
          dataType: DataPageDataType;
          values: number[];
        };
      }[] = [];

      // Values are split up by "row", with each value corresponding to a different data type.
      currentReleaseDataAvil.values.forEach((row, index) => {
        const dType =
          DataPageDataType[
            currentReleaseDataAvil.data_types[
              index
            ] as keyof typeof DataPageDataType
          ];

        const category = getDataPageDataTypeColorCategoryString(dType);

        dataByCategory.push({
          category,
          dataTypeValues: {
            dataType: dType,
            values: row,
          },
        });
      });

      const groups: { [key: string]: any } = {};
      const groupedVals = dataByCategory.reduce((group, option) => {
        groups[option.category] = group[option.category] || [];
        groups[option.category].push(option.dataTypeValues);
        return groups;
      }, Object.create(null));

      return groupedVals;
    }
    return null;
  }, [currentReleaseDataAvil]);

  const getZVals = useCallback(
    (categoryKey: string) => {
      return dataValuesByDataTypeCategory[categoryKey]
        .map((category: any) => category.values)
        .reverse();
    },
    [dataValuesByDataTypeCategory]
  );

  const getDataTypeUrlMapping = (categoryKey: string) => {
    const graphSectionUrlMapping: { [key: string]: string | undefined } = {};
    dataValuesByDataTypeCategory[categoryKey].forEach((category: any) => {
      const dataTypeString = getDataPageDataTypeString(category.dataType);

      const dataUrl =
        currentReleaseDataAvil.data_type_url_mapping[category.dataType];

      graphSectionUrlMapping[dataTypeString] = getFileUrl(dataUrl);
    });

    return graphSectionUrlMapping;
  };

  const getDrugCountMapping = (categoryKey: string) => {
    const graphSectionDrugCountMapping: {
      [key: string]: number | undefined;
    } = {};
    dataValuesByDataTypeCategory[categoryKey].forEach((category: any) => {
      const dataTypeString = getDataPageDataTypeString(category.dataType);

      const count =
        currentReleaseDataAvil.drug_count_mapping[category.dataType];

      graphSectionDrugCountMapping[dataTypeString] = count;
    });

    return graphSectionDrugCountMapping;
  };

  const [showLineageModal, setShowLineageModal] = useState<boolean>(false);
  const [selectedDataType, setSelectedDataType] = useState<string | null>(null);
  const openLineagePlotModal = (dataTypeCategory: string) => {
    setSelectedDataType(dataTypeCategory);
    setShowLineageModal(true);
  };

  return (
    <div>
      {dataValuesByDataTypeCategory && (
        <div className={styles.plot}>
          {(!plotElement || !totalCellLines) && <PlotSpinner />}
          {selectedDataType && showLineageModal && (
            <LineageAvailabilityPlot
              show={showLineageModal}
              selectedDataType={selectedDataType}
              data={dataValuesByDataTypeCategory[selectedDataType]}
              onCloseLineageModal={() => {
                setSelectedDataType(null);
                setShowLineageModal(false);
              }}
              handleSetPlotElement={() => {}}
              plotElement={null}
            />
          )}
          {Object.keys(dataValuesByDataTypeCategory).map((categoryKey: any) => (
            <div key={categoryKey} className={styles.dataAvailabilityPlot}>
              {plotElement && (
                <div className={styles.dataAvailabilityPlotContainer}>
                  <DataPageDatatypeSelector
                    key={`${categoryKey}datatypeSelector`}
                    datatypes={dataValuesByDataTypeCategory[categoryKey].map(
                      (category: any) => category.dataType
                    )}
                    dataTypeUrlMapping={getDataTypeUrlMapping(categoryKey)}
                    drugCountMapping={getDrugCountMapping(categoryKey)}
                    dataTypeGroupName={categoryKey}
                    isCurrentRelease={isCurrentRelease}
                  />
                </div>
              )}
              <Heatmap
                key={`${categoryKey}heatmap`}
                dataTypeLabels={dataValuesByDataTypeCategory[
                  categoryKey
                ].map((category: any) =>
                  getDataPageDataTypeString(category.dataType)
                )}
                zVals={getZVals(categoryKey)}
                xVals={xVals}
                onLoad={handleSetPlotElement}
                height={
                  BAR_THICKNESS *
                  dataValuesByDataTypeCategory[categoryKey].length
                }
                customWidth={350}
                customColorScale={COLOR_SCALE}
                margin={{
                  l: 0,

                  r: 0,

                  b: 0,

                  t: 0,

                  pad: 0,
                }}
              />
              {plotElement && dataValuesByDataTypeCategory && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: `repeat(${dataValuesByDataTypeCategory[categoryKey].length}, ${BAR_THICKNESS}px)`,
                    marginLeft: "8px",
                  }}
                >
                  {dataValuesByDataTypeCategory[categoryKey].map(
                    (category: any, row: number) => (
                      <p
                        key={`${categoryKey}cellLineCount${row + 1}`}
                        style={{
                          margin: 0,
                          gridRow: `${row + 1}`,
                          alignSelf: "center",
                        }}
                        onClick={() => openLineagePlotModal(categoryKey)}
                      >
                        {
                          category.values.filter((val: number) => val > 0)
                            .length
                        }
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataAvailabilityPlot;
