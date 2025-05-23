/* eslint-disable @typescript-eslint/dot-notation */
import * as React from "react";

import CorrelationsTable from "./CorrelationsTable";
import CorrelationsPlots from "./CorrelationsPlots";
import CorrelationFilters from "./CorrelationFilters";

interface CorrelationAnalysisProps {
  compound: string;
  getCorrelationData: () => Promise<
    {
      Compound: string;
      Dose: string;
      "Feature Type": string;
      Feature: string;
      "Correlation Coefficient": number;
      "-log10 qval": number;
      Rank: number;
    }[]
  >;
  getFeatureTypes: () => Promise<any[]>;
  getCompoundDatasets: () => Promise<any[]>;
}

export default function CorrelationAnalysis(props: CorrelationAnalysisProps) {
  const {
    compound,
    getCorrelationData,
    getFeatureTypes,
    getCompoundDatasets,
  } = props;
  const [selectedFeatureTypes, setSelectedFeatureTypes] = React.useState<
    string[]
  >([]);
  const [selectedDoses, setSelectedDoses] = React.useState<string[]>([]);
  const [allSelectedLabels, setAllSelectedLabels] = React.useState<{
    [key: string]: string[];
  }>({});
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(
    new Set()
  );
  const [correlationAnalysisData, setCorrelationAnalysisData] = React.useState<
    any[]
  >([]);
  const [
    filteredTableCorrelationAnalysisData,
    setFilteredTableCorrelationAnalysisData,
  ] = React.useState<any[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getCorrelationData();
        const roundedData = data.map((d) => {
          const dataMod = {};
          // eslint-disable-next-line no-restricted-syntax, guard-for-in
          for (const key in d) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const value = d[key];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            dataMod[key] =
              typeof value === "number" ? parseFloat(value.toFixed(2)) : value;
          }
          return dataMod;
        });
        setCorrelationAnalysisData(roundedData);
      } catch (e) {
        console.log(e);
      }
    })();
  }, [getCorrelationData]);

  console.log(correlationAnalysisData);

  const doseColors = React.useMemo(() => {
    let doses: any[] = [];
    if (correlationAnalysisData.length) {
      const colorScale = [
        { hex: "#ADFF2F" }, // Yellow-Green
        { hex: "#97E34F" },
        { hex: "#81C76E" },
        { hex: "#6BAB8D" },
        { hex: "#559FAC" },
        { hex: "#4083CC" },
        { hex: "#3365B6" },
        { hex: "#26479F" },
        { hex: "#1A2A89" },
        { hex: "#4B0082" }, // Dark Purple
      ];
      const columnData: { [key: string]: any } = {};
      const columnNames = Object.keys(correlationAnalysisData[0]);
      columnNames.forEach(
        (colName) =>
          (columnData[colName] = correlationAnalysisData.map(
            (record) => record[colName]
          ))
      );
      console.log(columnNames);
      console.log(columnData);
      doses = Array.from(new Set(columnData["Dose"])).sort((a: any, b: any) => {
        return a - b;
      }); // log2auc should be first
      console.log("DOSES: ", doses);
      const doseRanges = doses.slice(1);
      const doseAndColors: { hex: string | undefined; dose: string }[] = [
        { hex: "#CC4778", dose: "log2.auc" },
      ];
      doseRanges.forEach((dose, i) => {
        if (i >= colorScale.length) {
          doseAndColors.push({ hex: undefined, dose });
        }
        doseAndColors.push({ ...colorScale[i], dose });
      });
      return doseAndColors;
    }
    return doses;
  }, [correlationAnalysisData]);

  React.useEffect(() => {
    // if no filter applied, show all correlation analysis data
    if (
      selectedFeatureTypes.length === 0 &&
      selectedDoses.length === 0 &&
      Object.keys(allSelectedLabels).length === 0
    ) {
      setFilteredTableCorrelationAnalysisData(correlationAnalysisData);
    } else {
      // keep list of all selected plot or table features
      const selectedDataWithLabelFront: any[] = [];

      // keep only selected feature types and selected doses and unselected features in plot or table
      const filtered = correlationAnalysisData.filter((data) => {
        let keepCondition;
        // We want to keep data where feature type and dose is selected
        if (selectedFeatureTypes.length && selectedDoses.length) {
          keepCondition =
            selectedFeatureTypes.includes(data["Feature Type"]) &&
            selectedDoses.includes(data["Dose"]);
        }
        // keep data where feature type is selected
        else if (selectedFeatureTypes.length) {
          keepCondition = selectedFeatureTypes.includes(data["Feature Type"]);
        }
        // keep data where dose is selected
        else if (selectedDoses.length) {
          keepCondition = selectedDoses.includes(data["Dose"]);
        } else {
          keepCondition = data !== null;
        }

        // We also want to remove features that are selected so that we can move those data to front of list later
        const removeCondition =
          data["Feature Type"] in allSelectedLabels &&
          allSelectedLabels[data["Feature Type"]].includes(data["Feature"]);
        // data that should be moved to front must additionally be filtered
        if (removeCondition && keepCondition) {
          selectedDataWithLabelFront.push(data);
        }

        return keepCondition && !removeCondition;
      });

      // Sort by feature label first, then by dose
      selectedDataWithLabelFront.sort((a, b) => {
        if (a["Feature"] === b["Feature"]) {
          return a["Dose"] - b["Dose"]; // sort by dose within the same feature
        }
        return a["Feature"].localeCompare(b["Feature"]); // otherwise sort by type
      });
      const selectedIds = selectedDataWithLabelFront.map((data) => {
        return data.id;
      });
      setSelectedRows(new Set(selectedIds));

      // move selected features from plot or table up to front of data list
      setFilteredTableCorrelationAnalysisData(
        selectedDataWithLabelFront.concat(filtered)
      );
    }
  }, [
    selectedFeatureTypes,
    selectedDoses,
    allSelectedLabels,
    correlationAnalysisData,
    compound,
  ]);

  const volcanoDataForFeatureType = React.useMemo(() => {
    if (correlationAnalysisData.length) {
      return correlationAnalysisData.reduce((acc, curRecord) => {
        const key = curRecord["Feature Type"];
        if (!acc[key]) {
          acc[key] = {};
        }
        const doseCategory = curRecord["Dose"];
        if (!(doseCategory in acc[key])) {
          acc[key][doseCategory] = {
            x: [],
            y: [],
            label: [],
            text: [],
            isSignificant: [],
            name: doseCategory,
            color: doseColors.find(
              (doseColor) => doseColor.dose === doseCategory
            )?.hex,
          };
        }
        const columnNamesToPlotVariables: any = {
          "Correlation Coefficient": "x",
          "-log10 qval": "y",
          // Feature: "label",
          Feature: "text",
        };
        const columnNames = Object.keys(correlationAnalysisData[0]);
        columnNames.forEach((colName) => {
          if (colName in columnNamesToPlotVariables) {
            const value = curRecord[colName];
            if (colName === "-log10 qval") {
              const val = Math.pow(10, -value);
              // VolcanoPlotProp `y` data by default log transforms values. To do the complement: Math.exp(-x)
              acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
                val
              );
            } else if (colName === "Feature") {
              const label = curRecord[colName];
              const text =
                `<b>${label}</b><br>` +
                `<b>Dose (uM)</b>: ${curRecord["Dose"]}<br>` +
                `<b>Correlation:</b> ${curRecord[
                  "Correlation Coefficient"
                ].toFixed(2)}<br>` +
                `<b>-log10(q value):</b> ${curRecord["-log10 qval"].toFixed(
                  2
                )}<br>`;
              acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
                text
              );
              acc[key][doseCategory]["label"].push(label);
            } else {
              acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
                value
              );
            }
          }
        });
        acc[key][doseCategory]["isSignificant"].push(false);
        return acc;
      }, {});
    }
    return {};
  }, [correlationAnalysisData, doseColors]);
  console.log("volcanodata: \n", volcanoDataForFeatureType);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 7fr",
        gridAutoRows: "1fr 1fr",
        gridTemplateAreas: "'a b b b b b b b''a c c c c c c c'",
        gap: "2rem",
        // marginBottom: "50px",
      }}
    >
      {/* {JSON.stringify(selectedFeatureTypes)} */}
      <div
        style={{
          gridArea: "a",
        }}
      >
        <CorrelationFilters
          getDatasets={getCompoundDatasets}
          onChangeDataset={(dataset: string | null) => console.log(dataset)}
          getFeatureTypes={getFeatureTypes}
          onChangeFeatureTypes={(featureTypes: string[]) =>
            setSelectedFeatureTypes(featureTypes !== null ? featureTypes : [])
          }
          doses={doseColors.map((doseColor) => doseColor.dose)}
          onChangeDoses={(newDoses) => setSelectedDoses(newDoses || [])}
          compoundName={compound}
        />
      </div>

      <div style={{ gridArea: "b" }}>
        <h2>Correlation Analysis</h2>
        <p>
          Univariate associations between sensitivity profiles and the genomic
          features or genetic dependencies are presented in the table and
          plots.Click on a plot to enlarge it. Hover over plot points for
          tooltip information.
        </p>
        <hr style={{ borderTop: "1px solid black", marginBottom: "40px" }} />
        <CorrelationsPlots
          featureTypesToShow={
            selectedFeatureTypes.length
              ? selectedFeatureTypes
              : Object.keys(volcanoDataForFeatureType)
          }
          dosesToFilter={selectedDoses}
          doseColors={doseColors}
          volcanoDataForFeatureTypes={volcanoDataForFeatureType}
          featureTypeSelectedLabels={allSelectedLabels}
          forwardSelectedLabels={(
            featureType: string,
            newSelectedLabels: string[]
          ) => {
            setAllSelectedLabels({
              ...allSelectedLabels,
              [featureType]: newSelectedLabels,
            });
          }}
        />
      </div>

      <div style={{ gridArea: "c" }}>
        <h2>Associated Features</h2>
        <p>Clicking on rows highlights features in the plots above</p>
        <CorrelationsTable
          data={filteredTableCorrelationAnalysisData}
          compound={compound}
          selectedRows={selectedRows}
          onChangeSelections={(selections: any[]) => {
            const prevSelections = Array.from(selectedRows);
            // if selections size decreases then a row was deselected. Deselect all selected features for that feature type
            if (selections.length < prevSelections.length) {
              // should only be one unselected at a time
              // TODO: use set difference once es2024 supported
              const unselectedId = prevSelections.filter(
                (x) => !selections.includes(x)
              )[0];
              const featureTypeFeatureToRemove = filteredTableCorrelationAnalysisData.find(
                (data) => data.id === unselectedId
              );
              if (featureTypeFeatureToRemove) {
                const feature = featureTypeFeatureToRemove["Feature"];
                const featureType = featureTypeFeatureToRemove["Feature Type"];
                setAllSelectedLabels({
                  ...allSelectedLabels,
                  [featureType]: allSelectedLabels[featureType].filter(
                    (label) => label !== feature
                  ),
                });
              }
            }
            // if selections size increases then a row was selected and all doses for the selected feature type's feature should be selected
            else {
              // should only be one new selected at a time
              const newSelectedId = selections.filter(
                (x) => !prevSelections.includes(x)
              )[0];
              const featureTypeFeatureToAdd = filteredTableCorrelationAnalysisData.find(
                (data) => data.id === newSelectedId
              );
              if (featureTypeFeatureToAdd) {
                const featureType = featureTypeFeatureToAdd["Feature Type"];
                const feature = featureTypeFeatureToAdd["Feature"];
                const newSelectedLabels =
                  featureType in allSelectedLabels
                    ? [...allSelectedLabels[featureType]].concat(feature)
                    : [feature];
                setAllSelectedLabels({
                  ...allSelectedLabels,
                  [featureType]: newSelectedLabels,
                });
              }
            }
          }}
        />
        <p>
          Showing {filteredTableCorrelationAnalysisData.length} of{" "}
          {correlationAnalysisData.length} entries
        </p>
      </div>
    </div>
  );
}
