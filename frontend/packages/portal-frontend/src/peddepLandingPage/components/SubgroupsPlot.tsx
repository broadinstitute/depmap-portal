import React, { useEffect, useMemo, useState } from "react";
import GroupedBarSuplots from "./GroupedBarSuplots";
import { breadboxAPI } from "@depmap/api";
import {
  BarSubplotData,
  Subgroup,
  SubgroupSubtypes,
} from "../models/subplotData";

export default function SubGroupsPlot() {
  const [data, setData] = React.useState<SubgroupSubtypes | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Get depmap models data
        const dimensionType = await breadboxAPI.getDimensionType(
          "depmap_model"
        );
        if (dimensionType.metadata_dataset_id) {
          const modelSubsetColData = await breadboxAPI.getTabularDatasetData(
            dimensionType.metadata_dataset_id,
            {
              columns: [
                "OncotreeLineage",
                "OncotreeSubtype",
                "PediatricModelType",
              ],
            }
          );

          // Transform data to use models as index instead of col names
          const modelSubsetIndexData: { [key: string]: any } = {};

          // eslint-disable-next-line no-restricted-syntax
          for (const [colName, colData] of Object.entries(modelSubsetColData)) {
            // eslint-disable-next-line no-restricted-syntax
            for (const [index, value] of Object.entries(colData)) {
              if (!modelSubsetIndexData[index]) {
                modelSubsetIndexData[index] = {};
              }
              modelSubsetIndexData[index][colName] = value;
            }
          }

          // Filter by pediatric models and group by subtype groups
          const pedModelData: SubgroupSubtypes = Object.entries(
            modelSubsetIndexData
          ).reduce(
            (acc, [, modelData]) => {
              if (modelData.PediatricModelType === "TRUE") {
                const subtype: string = modelData.OncotreeSubtype;
                if (modelData.OncotreeLineage === "CNS/Brain") {
                  acc["CNS/Brain"].push(subtype);
                } else if (
                  ["Myeloid", "Lymphoid"].includes(modelData.OncotreeLineage)
                ) {
                  acc.Heme.push(subtype);
                } else {
                  acc.Solid.push(subtype);
                }
              }
              return acc;
            },
            {
              "CNS/Brain": new Array<string>(),
              Heme: new Array<string>(),
              Solid: new Array<string>(),
            }
          );
          setData(pedModelData);
        } else {
          setHasError(true);
        }
      } catch (e) {
        console.log(e);
        setHasError(true);
      }
    })();
  }, []);

  const subplotsData = useMemo(() => {
    if (data) {
      const subgroupSubtypesCounts: {
        key: Subgroup;
        subtypeLabels: string[];
        labels: string[];
        values: number[];
        maxCount: number;
      }[] = Object.entries(data).map(([subgroup, subtypes]) => {
        // Count subtype labels
        const subtypesCountMap = subtypes.reduce((acc, label) => {
          acc[label] = (acc[label] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        // Sort subtype labels by count descending
        const sortedEntries = Object.entries(subtypesCountMap).sort(
          (a, b) => b[1] - a[1]
        );

        // Extract subtype labels and values. Additionally, truncate label, if necessary for subtype label in x axis
        const labels: string[] = [];
        const subtypeLabels: string[] = [];
        const counts: number[] = [];
        sortedEntries.forEach(([label, count]) => {
          subtypeLabels.push(
            label.length > 25 ? label.substring(0, 25).concat("...") : label
          );
          labels.push(label);
          counts.push(count);
        });

        // Track the max value for top-level sorting
        const maxCount = counts[0];

        return {
          key: subgroup,
          subtypeLabels,
          labels,
          values: counts,
          maxCount,
        } as {
          key: Subgroup;
          subtypeLabels: string[];
          labels: string[];
          values: number[];
          maxCount: number;
        };
      });

      // Sort by maxCount descending
      subgroupSubtypesCounts.sort((a, b) => b.maxCount - a.maxCount);

      // Define subgroup colors
      const subgroupToColor: {
        [key in Subgroup]: { color: string; line: string };
      } = {
        "CNS/Brain": { color: "#f5db84", line: "#f5c422" },
        Heme: { color: "#d3b2db", line: "#ba37db" },
        Solid: { color: "#a3bce6", line: "#1154bf" },
      };

      const subgroupSubtypesData: BarSubplotData[] = subgroupSubtypesCounts.map(
        ({ key, subtypeLabels, labels, values }) => {
          return {
            xAxisLabels: subtypeLabels,
            labels,
            values,
            name: key,
            color: subgroupToColor[key].color,
            lineColor: subgroupToColor[key].line,
          };
        }
      );
      return subgroupSubtypesData;
    }
    return [];
  }, [data]);

  if (hasError) {
    return (
      <div
        style={{
          display: "flex",
          height: "200px",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <i>Plot failed to load! Try again later.</i>
      </div>
    );
  }
  if (data) {
    return (
      <div>
        <GroupedBarSuplots subplotsData={subplotsData} />
      </div>
    );
  }
  return <div>Loading...</div>;
}
