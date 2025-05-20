/* eslint-disable @typescript-eslint/dot-notation */
import * as React from "react";

import CorrelationsTable from "./CorrelationsTable";
import CorrelationsPlots from "./CorrelationsPlots";
import CorrelationFilters from "./CorrelationFilters";
import { DimensionType, SliceQuery } from "@depmap/types";
import {
  createDoseRangeColorScale,
  getAllCorrelates,
  transformAndGroupByDataset,
} from "../utilities/helper";

interface CorrelationAnalysisProps {
  compound: string;
  getDimensionType: (name: string) => Promise<DimensionType>;
  getTabularDatasetData: (
    datasetId: string,
    args: {
      identifier: "id" | "label";
      columns?: string[] | null;
    }
  ) => Promise<{ [key: string]: { [key: string]: any } }>;
  getDatasetFeatures: (
    datasetId: string
  ) => Promise<{ id: string; label: string }[]>;
  getCorrelationData: (
    sliceQuery: SliceQuery
  ) => Promise<{
    dataset_name: string;
    dimension_label: string;
    associated_datasets: {
      name: string;
      dimension_type: string;
      dataset_id: string;
    }[];
    associated_dimensions: {
      correlation: number;
      log10qvalue: number;
      other_dataset_id: string;
      other_dimension_given_id: string;
      other_dimension_label: string;
    }[];
  }>;
  //   getFeatureTypes: () => Promise<any[]>;
}

const datasetMap: Record<string, { auc: string; viability: string }> = {
  OncRef: {
    auc: "Prism_oncology_AUC_collapsed",
    viability: "Prism_oncology_viability",
  },
  // TBD: Add more after correlations are generated
};

export default function CorrelationAnalysis(props: CorrelationAnalysisProps) {
  const {
    compound,
    getDimensionType,
    getTabularDatasetData,
    getDatasetFeatures,
    getCorrelationData,
  } = props;
  const [selectedDataset, setSelectedDataset] = React.useState<string>(
    "OncRef"
  );
  const [featureTypes, setFeatureTypes] = React.useState<string[]>([]);
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
  const [doseColors, setDoseColors] = React.useState<
    { hex: string | undefined; dose: string }[]
  >([]);

  React.useEffect(() => {
    (async () => {
      try {
        // get compound id by label
        const compoundDimType = await getDimensionType("compound_v2");
        const allCompoundMetadata = await getTabularDatasetData(
          compoundDimType.metadata_dataset_id,
          { identifier: "label", columns: ["CompoundID"] }
        );
        const compoundID = allCompoundMetadata["CompoundID"][compound];

        // get selected datasets
        const datasets = datasetMap[selectedDataset];
        const aucDataset = datasets.auc;
        const doseViabilityDataset = datasets.viability;

        const compoundDoseToDose = new Map();

        const compoundDoseDatasets: [string, string][] = [
          [compoundID, aucDataset],
        ];
        const compoundDoseFeatures = (
          await getDatasetFeatures(doseViabilityDataset)
        ).filter((feature) => feature.id.includes(compoundID));
        compoundDoseFeatures.forEach((feature) => {
          const dose = feature.id.replace(compoundID, "").trim();
          console.log(feature.id, dose);
          compoundDoseToDose.set(feature.id, dose);
          compoundDoseDatasets.push([feature.id, doseViabilityDataset]);
        });

        const dosesAndColors: { hex: string | undefined; dose: string }[] = [
          { hex: "#CC4778", dose: "AUC" },
          ...createDoseRangeColorScale(Array.from(compoundDoseToDose.values())),
        ];
        setDoseColors(dosesAndColors);
        compoundDoseToDose.set(compound, "AUC");

        const featureDatasetDoseCorrelates: Record<
          string,
          Record<string, any[]>
        > = {};
        const allCorrelatesForFeatureDataset = await Promise.all(
          compoundDoseDatasets.map(([feature, dataset]) =>
            getCorrelationData({
              dataset_id: dataset,
              identifier: feature,
              identifier_type: "feature_id",
            })
          )
        );
        allCorrelatesForFeatureDataset.forEach((compoundDoseCorrelates) => {
          const datasetLookup = compoundDoseCorrelates.associated_datasets.reduce(
            (acc, item) => {
              acc[item.dataset_id] = item.name;
              return acc;
            },
            {} as Record<string, string>
          );
          const doseAssociationsByFeatureDataset = transformAndGroupByDataset(
            compoundDoseCorrelates.associated_dimensions,
            compoundDoseCorrelates.dimension_label,
            datasetLookup,
            compoundDoseToDose
          );
          console.log("Dosedict: \n", doseAssociationsByFeatureDataset);
          Object.entries(doseAssociationsByFeatureDataset).forEach(
            ([featureDataset, associations]) => {
              console.log(
                compoundDoseCorrelates.dimension_label,
                featureDataset,
                associations,
                featureDatasetDoseCorrelates
              );
              if (featureDataset in featureDatasetDoseCorrelates) {
                if (
                  compoundDoseCorrelates.dimension_label in
                  featureDatasetDoseCorrelates[featureDataset]
                ) {
                  featureDatasetDoseCorrelates[featureDataset][
                    compoundDoseCorrelates.dimension_label
                  ] = featureDatasetDoseCorrelates[featureDataset][
                    compoundDoseCorrelates.dimension_label
                  ].concat(associations);
                } else {
                  featureDatasetDoseCorrelates[featureDataset][
                    compoundDoseCorrelates.dimension_label
                  ] = associations;
                }
              } else {
                featureDatasetDoseCorrelates[featureDataset] = {
                  [compoundDoseCorrelates.dimension_label]: associations,
                };
              }
            }
          );
        });
        console.log(allCorrelatesForFeatureDataset);
        console.log(Object.keys(featureDatasetDoseCorrelates));
        setFeatureTypes(Object.keys(featureDatasetDoseCorrelates));
        const tabledata = getAllCorrelates(featureDatasetDoseCorrelates);
        console.log(tabledata);
        setCorrelationAnalysisData(tabledata);
      } catch (e) {
        console.log(e);
      }
    })();
  }, [
    compound,
    selectedDataset,
    getCorrelationData,
    getDatasetFeatures,
    getDimensionType,
    getTabularDatasetData,
  ]);

  console.log(correlationAnalysisData);

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
            selectedFeatureTypes.includes(data["featureDataset"]) &&
            selectedDoses.includes(data["dose"]);
        }
        // keep data where feature type is selected
        else if (selectedFeatureTypes.length) {
          keepCondition = selectedFeatureTypes.includes(data["featureDataset"]);
        }
        // keep data where dose is selected
        else if (selectedDoses.length) {
          keepCondition = selectedDoses.includes(data["dose"]);
        } else {
          keepCondition = data !== null;
        }

        // We also want to remove features that are selected so that we can move those data to front of list later
        const removeCondition =
          data["featureDataset"] in allSelectedLabels &&
          allSelectedLabels[data["featureDataset"]].includes(data["feature"]);
        // data that should be moved to front must additionally be filtered
        if (removeCondition && keepCondition) {
          selectedDataWithLabelFront.push(data);
        }

        return keepCondition && !removeCondition;
      });

      // Sort by feature label first, then by dose
      selectedDataWithLabelFront.sort((a, b) => {
        if (a["feature"] === b["feature"]) {
          return a["dose"] - b["dose"]; // sort by dose within the same feature
        }
        return a["feature"].localeCompare(b["feature"]); // otherwise sort by type
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
        const key = curRecord["featureDataset"];
        if (!acc[key]) {
          acc[key] = {};
        }
        const doseCategory = curRecord["dose"];
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
        const columnNamesToPlotVariables = {
          correlation: "x",
          log10qvalue: "y",
          feature: "text",
        };
        const columnNames = Object.keys(correlationAnalysisData[0]);
        columnNames.forEach((colName) => {
          if (colName in columnNamesToPlotVariables) {
            const value = curRecord[colName];
            if (colName === "log10qvalue") {
              const val = Math.pow(10, value);
              // VolcanoPlotProp `y` data by default log transforms values. To do the complement: Math.exp(-x)
              acc[key][doseCategory][columnNamesToPlotVariables[colName]].push(
                val
              );
            } else if (colName === "feature") {
              const label = curRecord[colName];
              const text =
                `<b>${label}</b><br>` +
                `<b>Dose (uM)</b>: ${curRecord["dose"]}<br>` +
                `<b>Correlation:</b> ${curRecord["correlation"].toFixed(
                  2
                )}<br>` +
                `<b>-log10(q value):</b> ${curRecord["log10qvalue"].toFixed(
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
  // }, [correlationAnalysisData, doseColors]);
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
      <div
        style={{
          gridArea: "a",
        }}
      >
        <CorrelationFilters
          datasets={Object.keys(datasetMap)}
          onChangeDataset={(dataset: string) => setSelectedDataset(dataset)}
          featureTypes={featureTypes}
          onChangeFeatureTypes={(newFeatureTypes: string[]) =>
            setSelectedFeatureTypes(
              newFeatureTypes !== null ? newFeatureTypes : []
            )
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
