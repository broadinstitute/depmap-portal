import React, { useContext, useEffect, useState } from "react";
import GroupedBarSuplots from "./GroupedBarSuplots";
import { ApiContext } from "@depmap/api";
import { ModelDataWithSubgroup, Subgroup } from "../models/subplotData";
import PlotSpinner from "src/plot/components/PlotSpinner";

export default function SubGroupsPlot() {
  const { getApi } = useContext(ApiContext);
  const [bapi] = useState(() => getApi());

  const [data, setData] = useState<any | null>(null);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([
    "CNS/Brain",
    "Heme",
    "Solid",
  ]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [subtypeCounts, setSubtypeCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Get depmap models data
        const dimensionType = await bapi.getDimensionType("depmap_model");
        if (dimensionType.metadata_dataset_id) {
          const modelSubsetColData = await bapi.getTabularDatasetData(
            dimensionType.metadata_dataset_id,
            {
              columns: [
                "OncotreeLineage",
                "OncotreeSubtype",
                "ModelSubtypeFeatures",
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

          // Filter by pediatric models, add lineage subgroup, add subtype feature
          const pedModelData: ModelDataWithSubgroup[] = Object.values(
            modelSubsetIndexData
          )
            .filter((modelInfo) => {
              return modelInfo.PediatricModelType === "True";
            })
            .map((modelInfo) => {
              const subtype: string = modelInfo.OncotreeSubtype;
              // if model subtype feature is null, set subtype as subtype feature
              const subtypeFeature: string = modelInfo.ModelSubtypeFeatures
                ? modelInfo.ModelSubtypeFeatures
                : modelInfo.OncotreeSubtype;

              // define subgroup for models based on lineage
              let subgroup: Subgroup;
              if (modelInfo.OncotreeLineage === "CNS/Brain") {
                subgroup = "CNS/Brain";
              } else if (
                ["Myeloid", "Lymphoid"].includes(modelInfo.OncotreeLineage)
              ) {
                subgroup = "Heme";
              } else {
                subgroup = "Solid";
              }

              return {
                // NOTE: (subtype, subtypeFeature) is unique within subgroups but (subgroup, subtypeFeature) can be repeated. We will make each (subgroup, subtype, subtypeFeature) unique in case
                key: `${subgroup}-${subtype}-${subtypeFeature}`, // key used as unique identifier for count map
                subgroup,
                subtype,
                subtypeFeature,
              };
            });

          // NOTE: The following sort/group is important to ensure the bars are displayed accurately.
          // Data with same subgroups are next to each other and total subtype counts are displayed in descending order

          // Count map: { [parent_type,type,subtype] -> count }
          const allCounts: Record<string, number> = {};
          const subtypeTotalCount: Record<string, number> = {};
          const subgroupTotalCount: Record<string, number> = {};
          const subgroupToModel: Record<Subgroup, ModelDataWithSubgroup[]> = {
            "CNS/Brain": [],
            Heme: [],
            Solid: [],
          };
          pedModelData.forEach((d) => {
            allCounts[d.key] = (allCounts[d.key] || 0) + 1;
            subtypeTotalCount[d.subtype] =
              (subtypeTotalCount[d.subtype] || 0) + 1;
            subgroupTotalCount[d.subgroup] =
              (subgroupTotalCount[d.subgroup] || 0) + 1;
            subgroupToModel[d.subgroup].push(d);
          });

          // Sort subgroups from highest to lowest based on how many models with subgroup
          const sortedSubgroups = Object.entries(subgroupTotalCount)
            .sort((a, b) => b[1] - a[1])
            .map(([key]) => key) as Subgroup[];
          setSubgroups(sortedSubgroups);

          // Sort the model data by its subgroup and total counts across subtypes
          let pedModelSorted: ModelDataWithSubgroup[] = [];
          sortedSubgroups.forEach((subgroup) => {
            subgroupToModel[subgroup].sort((a, b) => {
              const totalA = subtypeTotalCount[a.subtype];
              const totalB = subtypeTotalCount[b.subtype];
              if (totalB !== totalA) {
                return totalB - totalA; // descending
              }
              return allCounts[b.key] - allCounts[a.key];
            });
            pedModelSorted = pedModelSorted.concat(subgroupToModel[subgroup]);
          });

          setData(pedModelSorted);
          setCounts(allCounts);
          setSubtypeCounts(subtypeTotalCount);
        } else {
          setHasError(true);
        }
      } catch (e) {
        console.log(e);
        setHasError(true);
      }
    })();
  }, [bapi]);

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
  if (data && counts && subtypeCounts) {
    return (
      <div>
        <GroupedBarSuplots
          subgroups={subgroups}
          subplotsData={data}
          countData={counts}
          subtypeCountData={subtypeCounts}
        />
      </div>
    );
  }
  return (
    <div>
      <PlotSpinner />
    </div>
  );
}
