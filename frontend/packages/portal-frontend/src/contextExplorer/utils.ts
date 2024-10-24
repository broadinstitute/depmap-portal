import {
  ContextNode,
  ContextSummary,
  ContextTree,
  DataType,
  DataTypeStrings,
  OutGroupType,
} from "./models/types";
import { DataExplorerContext } from "@depmap/types";
import qs from "qs";
import { Filter } from "src/common/models/discoveryAppFilters";
import { deleteSpecificQueryParams } from "@depmap/utils";

function isWholeNumberNotZero(num: number) {
  return num % 1 === 0 && num !== 0;
}

export const ALL_SEARCH_OPTION = {
  name: "All",
  display_name: "All",
};

export const OUTGROUP_TYPE_ALL_OPTION = {
  value: OutGroupType.All,
  label: "All other cell lines",
};

export const DATATYPE_TOOLTIP_TEXT = new Map<string, string>([
  [
    DataTypeStrings.CRISPR.toString(),
    "Cell lines that have been screened with at least one of the Avana, Humagne, or KY libraries.",
  ],
  [
    DataTypeStrings.PRISM.toString(),
    "Cell lines that have been screened in at least one of PRISM’s Repurposing screens.",
  ],
  [
    DataTypeStrings.RNASeq.toString(),
    "Cell lines that have been profiled in RNA-seq.",
  ],
  [
    DataTypeStrings.RNAi.toString(),
    "Cell lines that have been screened in an RNAi library.",
  ],
  [
    DataTypeStrings.WES.toString(),
    "Cell lines that have had whole exome sequencing.",
  ],
  [
    DataTypeStrings.WGS.toString(),
    "Cell lines that have had whole genome sequencing.",
  ],
]);

export const BLOOD_LINEAGES = ["Myeloid", "Lymphoid"];

export function getSortedDataAvailVals(
  checkedValues: number[][],
  checkedRowIndexes: number[],
  allDepmapIds: [number, string][]
): {
  depmapId: string;
  val: number;
}[][] {
  const checkedValuesByDepmapId = [];
  for (let index = 0; index < checkedValues.length; index++) {
    const row = checkedValues[index];

    const rowDicts = row.map((val, rowIndex) => {
      const depmapId = allDepmapIds[rowIndex][1];
      return { depmapId, val };
    });

    checkedValuesByDepmapId.push(rowDicts);
  }

  const transpose = (
    matrix: {
      depmapId: string;
      val: number;
    }[][]
  ) => {
    return matrix[0].map((col, i) => matrix.map((row) => row[i]));
  };
  const transposedVals = transpose(checkedValuesByDepmapId);

  /* eslint-disable no-nested-ternary */
  const sortedTransposedVals = [...transposedVals].sort((a, b) =>
    checkedRowIndexes.includes(5)
      ? b[5].val - a[5].val
      : 0 || checkedRowIndexes.includes(4)
      ? b[4].val - a[4].val
      : 0 || checkedRowIndexes.includes(3)
      ? b[3].val - a[3].val
      : 0 || checkedRowIndexes.includes(2)
      ? b[2].val - a[2].val
      : 0 || checkedRowIndexes.includes(1)
      ? b[1].val - a[1].val
      : 0 || checkedRowIndexes.includes(0)
      ? b[0].val - a[0].val
      : 0
  );

  /* eslint-enable no-nested-ternary */
  const sortedVals = transpose(sortedTransposedVals);

  return sortedVals;
}

export function getDatasetOverlapCount(
  sortedVals: {
    depmapId: string;
    val: number;
  }[][],
  sortIndexes: number[]
) {
  const columnCount = sortedVals[0].length;

  const overlapDepmapIds = [];

  for (
    let cellLineColIndex = 0;
    cellLineColIndex < columnCount;
    cellLineColIndex += 1
  ) {
    let overlap = true;
    let currentDepmapId = "";
    sortIndexes.forEach((selectedRowIndex) => {
      const selected = sortedVals[selectedRowIndex][cellLineColIndex];
      currentDepmapId = selected.depmapId;

      // We only count the overlap of the checked datatypes. In order to tell the Plotly
      // Heatmap to decrease opacity if the datatype is NOT checked, we add .5 to each of that
      // datatype's values. As a result, we can tell if a datatype has been checked off by
      // looking at the whole-numberness of the values for that row.
      if (!isWholeNumberNotZero(selected.val)) {
        overlap = false;
      }
    });

    if (overlap) {
      overlapDepmapIds.push(currentDepmapId);
    }
  }

  return overlapDepmapIds;
}

export function changeSelectedDataAvailGraphVals(
  originalData: ContextSummary,
  selectedDataTypes: Set<string>
) {
  const newVals: number[][] = [];
  const selectedRowIndexes: number[] = [];
  originalData.data_types.forEach((datatype: string) => {
    const typeIndex = DataType[datatype as keyof typeof DataType];

    if (selectedDataTypes.size > 0 && !selectedDataTypes.has(datatype)) {
      const newValues = originalData.values[typeIndex].map(
        (oldValue: number) => oldValue + 0.5
      );
      newVals.push(newValues);
    } else {
      newVals.push(originalData.values[typeIndex]);
      selectedRowIndexes.push(typeIndex);
    }
  });

  return { newVals, selectedRowIndexes };
}

// From: https://stackoverflow.com/a/1026087
export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getDataExplorerContextFromSelections(
  selectedContextName: string,
  checkedDatatypes: Set<string>,
  selectedContextDepmapIds: string[],
  topContextName: string,
  allDepmapIds: string[]
): DataExplorerContext {
  const selectedDataTypes = [...checkedDatatypes].join(" ");
  const de2ContextName = `${selectedContextName} Cell Lines available in ${selectedDataTypes}`;
  const labelSliceId =
    topContextName === selectedContextName
      ? "slice/lineage/1/label"
      : "slice/primary_disease/all/label";

  // We don't have "datatype" information for some cell lines, and datatype information is
  // required for a cell line to show up in Context Explorer (datatype information = information
  // on whether the cell line has data available in CRISPR, RNAi, RNASeq, WES, WGS, and PRISM).
  // We add a depmapId list to the context we build off of Context Explorer to ensure the cell lines
  // in Context Explorer match the cell lines shown in Data Explorer 2 using a Context Explorer Context.
  const exp =
    selectedContextName === "All"
      ? {
          and: [
            {
              in: [{ var: "entity_label" }, selectedContextDepmapIds],
            },
          ],
        }
      : {
          and: [
            {
              in: [
                { var: "entity_label" },
                checkedDatatypes.size > 0
                  ? selectedContextDepmapIds
                  : allDepmapIds,
              ],
            },
            { "==": [{ var: labelSliceId }, selectedContextName] },
          ],
        };

  const context = {
    name: de2ContextName,
    context_type: "depmap_model",
    expr: exp,
  };

  return context;
}

export function getGeneDependencyContexts(
  selectedContextName: string,
  topContextName: string,
  outgroupType: OutGroupType
): {
  inGroupContext: DataExplorerContext;
  outGroupContext: DataExplorerContext;
} {
  const context_type = "depmap_model";
  const lineageLabelSliceId = "slice/lineage/1/label";
  const primaryDiseaseSliceId = "slice/primary_disease/all/label";

  const ingroupSliceId =
    selectedContextName === topContextName
      ? lineageLabelSliceId
      : primaryDiseaseSliceId;

  const exp = {
    and: [
      {
        "==": [
          {
            var: ingroupSliceId,
          },
          selectedContextName,
        ],
      },
    ],
  };

  const inGroupContext = {
    name: `${selectedContextName}`,
    context_type,
    expr: exp,
  };

  function getOutgroupContext(
    outgroup: OutGroupType,
    inGroupSliceId: string | number | symbol | undefined,
    lSliceId: string | number | symbol | undefined,
    topContext: string,
    ingroupName: string
  ) {
    switch (outgroup) {
      case OutGroupType.All:
        return {
          name: `Not ${ingroupName}`,
          context_type: "depmap_model",
          expr: {
            and: [{ "!=": [{ var: inGroupSliceId }, ingroupName] }],
          },
        };
      case OutGroupType.Lineage:
        return {
          name: `Other ${topContext}`,
          context_type: "depmap_model",
          expr: {
            and: [
              { "!=": [{ var: inGroupSliceId }, ingroupName] },
              { "==": [{ var: lSliceId }, topContext] },
            ],
          },
        };
      case OutGroupType.Type: {
        const bloodLineages = ["Myeloid", "Lymphoid"];
        if (bloodLineages.includes(topContext)) {
          return {
            name: `Other Heme`,
            context_type: "depmap_model",
            expr: {
              and: [
                { "!=": [{ var: inGroupSliceId }, ingroupName] },
                { in: [{ var: lSliceId }, bloodLineages] },
              ],
            },
          };
        }
        return {
          name: `Other Solid`,
          context_type: "depmap_model",
          expr: {
            and: [
              { "!=": [{ var: inGroupSliceId }, ingroupName] },
              { "!=": [{ var: lSliceId }, "Myeloid"] },
              { "!=": [{ var: lSliceId }, "Lymphoid"] },
            ],
          },
        };
      }
      default:
        throw new Error(`Unrecognized outgroup type: ${outgroup}`);
    }
  }

  const outGroupContext = getOutgroupContext(
    outgroupType,
    ingroupSliceId,
    lineageLabelSliceId,
    topContextName,
    selectedContextName
  );

  return { inGroupContext, outGroupContext };
}

export const GENE_DATASET_ID = "Chronos_Combined";
export const COMPOUND_DATASET_ID = "Rep_all_single_pt";

export const GENE_BOX_PLOT_X_AXIS_TITLE = "CRISPR Gene Effect";
export const COMPOUND_BOX_PLOT_X_AXIS_TITLE = "log2(viability)";

const de2PageHref = window.location.href
  .split("?")[0]
  .replace("context_explorer", "data_explorer_2");

export function getDataExplorerUrl(
  topContextName: string,
  ingroupName: string,
  outgroupType: OutGroupType,
  entityType: string
): string {
  const xDataset =
    entityType === "gene" ? GENE_DATASET_ID : COMPOUND_DATASET_ID;
  const yDataset =
    entityType === "gene" ? GENE_DATASET_ID : COMPOUND_DATASET_ID;
  const { inGroupContext, outGroupContext } = getGeneDependencyContexts(
    ingroupName,
    topContextName,
    outgroupType
  );

  const queryString = qs.stringify({
    xDataset,
    yDataset,
    xContext: JSON.stringify(inGroupContext),
    yContext: JSON.stringify(outGroupContext),
  });

  return `${de2PageHref}?${queryString}`;
}

export function getBoxPlotFilterVariables(filters: Filter[]) {
  let fdr: number[] = [];
  let effectSize: number[] = [];
  let fracDepIn: number[] = [];

  filters.forEach((filter) => {
    if (filter.kind === "range") {
      const valueRange = filter.value;
      if (filter.key === "t_qval") {
        fdr = valueRange;
      } else if (filter.key === "abs_effect_size") {
        effectSize = valueRange;
      } else if (filter.key === "frac_dep_in") {
        fracDepIn = valueRange;
      }
    }
  });

  return { fdr, effectSize, fracDepIn };
}

export const getUpdatedGraphInfoForSelection = (
  newCheckedDatatypes: Set<string>,
  data: ContextSummary
) => {
  // Add .5 to each unselected row so that the opacity will be reduced.
  // Also, keep track of the indexes that have been selected.
  const updatedGraphInfo = changeSelectedDataAvailGraphVals(
    data,
    newCheckedDatatypes
  );

  const { newVals, selectedRowIndexes } = updatedGraphInfo;

  // Each list in checkedValues corresponds to a datatype row of values (e.g. Crispr values: [1, 1, 1, 0, 0, 0, 0])]
  // We sort, always giving preference to CRISPR (which will always be at index 5), moving numbers greater than 0
  // (meaning we have that cell line for that datatype) to the left of the graph.
  const sortedVals = getSortedDataAvailVals(
    newVals,
    selectedRowIndexes,
    data.all_depmap_ids
  );

  const overlapDepmapIds =
    newCheckedDatatypes.size > 0
      ? getDatasetOverlapCount(sortedVals, selectedRowIndexes)
      : [];

  return {
    sortedSelectedValues: sortedVals.map((row) => row.map((val) => val.val)),
    overlapDepmapIds,
  };
};

function getSelectedContextData(
  selectedContextNode: ContextNode,
  allContextData: ContextSummary
) {
  const filteredDepmapIds = allContextData.all_depmap_ids.filter((item) =>
    selectedContextNode.depmap_ids.includes(item[1])
  );

  const newDataVals = [];
  for (let index = 0; index < allContextData.values.length; index += 1) {
    const dataTypeVals = allContextData.values[index];
    const newDataTypeVals = filteredDepmapIds.map(
      (item) => dataTypeVals[item[0]]
    );
    newDataVals.push(newDataTypeVals);
  }

  const newContextData = {
    values: newDataVals,
    data_types: allContextData.data_types,
    all_depmap_ids: filteredDepmapIds,
  };

  return {
    selectedContextData: newContextData,
    selectedContextNameInfo: {
      name: selectedContextNode.name,
      display_name: selectedContextNode.display_name,
    },
  };
}

export function getSelectionInfo(
  allContextData: ContextSummary,
  selectedContextNode: ContextNode | null,
  checkedDatatypes: Set<string>
) {
  let overlappingDepmapIds: string[] = [];

  const { selectedContextData, selectedContextNameInfo } = selectedContextNode
    ? getSelectedContextData(selectedContextNode, allContextData)
    : {
        selectedContextData: allContextData,
        selectedContextNameInfo: ALL_SEARCH_OPTION,
      };

  let checkedDataValues = selectedContextNode
    ? selectedContextData.values
    : allContextData.values;

  if (selectedContextData && checkedDatatypes.size > 0) {
    const newSelectedValuesOverlap = getUpdatedGraphInfoForSelection(
      checkedDatatypes,
      selectedContextData
    );

    const newSelectedValues = newSelectedValuesOverlap.sortedSelectedValues;
    const newOverlappingDepmapIds = newSelectedValuesOverlap.overlapDepmapIds;

    checkedDataValues = newSelectedValues;
    overlappingDepmapIds = newOverlappingDepmapIds;
  }

  return {
    selectedContextNameInfo,
    selectedContextData,
    checkedDataValues,
    overlappingDepmapIds,
  };
}

export function getSelectedContextNode(
  contextTrees:
    | {
        [key: string]: ContextTree;
      }
    | undefined,
  lineageQueryParam: string | null,
  primaryDiseaseQueryParam: string | null
) {
  let selectedNode = null;
  let topContextNameInfo = ALL_SEARCH_OPTION;
  if (contextTrees) {
    if (lineageQueryParam) {
      const selectedTree = contextTrees[lineageQueryParam];

      // Make sure the lineageQueryParam is a valid contextTree key
      if (selectedTree) {
        topContextNameInfo = {
          name: selectedTree.root.name,
          display_name: selectedTree.root.display_name,
        };
        selectedNode = selectedTree.root;
        if (primaryDiseaseQueryParam) {
          const node = selectedTree.children.find(
            (child) => child.name === primaryDiseaseQueryParam
          );

          if (node) {
            selectedNode = node;
          }
        }
      } else {
        // Invalid params, so default to loading All data
        deleteSpecificQueryParams(["lineage", "primary_disease"]);
      }
    }
  }

  return { selectedContextNode: selectedNode, topContextNameInfo };
}
