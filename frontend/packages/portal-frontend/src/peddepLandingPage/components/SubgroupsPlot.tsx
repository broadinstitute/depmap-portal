import React, { useContext, useEffect, useMemo, useState } from "react";
import GroupedBarSuplots from "./GroupedBarSuplots";
import { ApiContext } from "@depmap/api";
import { Subgroup } from "../models/subplotData";

export default function SubGroupsPlot() {
  const { getApi } = useContext(ApiContext);
  const [bapi] = useState(() => getApi());

  const [data, setData] = React.useState<any | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
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
          console.log(modelSubsetColData);

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
          console.log(modelSubsetIndexData);

          // create count map for subtype feature counts

          // Filter by pediatric models, add lineage subgroup, add subtype feature
          const pedModelData = Object.values(modelSubsetIndexData)
            .filter((modelInfo) => {
              return modelInfo.PediatricModelType === "True";
            })
            .map((modelInfo) => {
              let subgroup: Subgroup;
              const subtype: string = modelInfo.OncotreeSubtype;
              // if model subtype feature is null, set subtype as subtype feature
              const subtypeFeature: string = modelInfo.ModelSubtypeFeatures
                ? modelInfo.ModelSubtypeFeatures
                : modelInfo.OncotreeSubtype;
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
                key: `${subgroup}-${subtype}-${subtypeFeature}`,
                subgroup,
                subtype,
                subtypeFeature,
              };
            });
          // Count map: { parent_type -> type -> subtype -> count }
          const allCounts: Record<string, number> = {};

          pedModelData.forEach(({ key }) => {
            allCounts[key] = (allCounts[key] || 0) + 1;
          });

          const sortedPedModelData = pedModelData.map((d) => {
            return { ...d, count: allCounts[d.key] };
          });
          // Step 1: Compute total counts per `subtype`
          const subtypeTotalCount: Record<string, number> = {};
          sortedPedModelData.forEach(({ subtype, count }) => {
            subtypeTotalCount[subtype] =
              (subtypeTotalCount[subtype] || count) + count;
          });

          sortedPedModelData.sort((a, b) => {
            if (a.subgroup !== b.subgroup) {
              return a.subgroup.localeCompare(b.subgroup);
            }
            const totalA = subtypeTotalCount[a.subtype];
            const totalB = subtypeTotalCount[b.subtype];
            if (totalB === totalA) {
              return a.subtype.localeCompare(b.subtype);
            }
            return totalB - totalA; // descending
          });
          console.log(sortedPedModelData);

          setData(sortedPedModelData);
          setCounts(allCounts);
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
  if (data && counts) {
    return (
      <div>
        <GroupedBarSuplots subplotsData={data} countData={counts} />
      </div>
    );
  }
  return <div>Loading...</div>;
}
