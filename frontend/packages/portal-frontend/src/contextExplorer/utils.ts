import { ContextSummary, DataTypeStrings, DataType } from "./models/types";
import update from "immutability-helper";
import {
  ContextExplorerDatasets,
  ContextNameInfo,
  ContextNode,
  DataExplorerContext,
} from "@depmap/types";
import qs from "qs";
import { Filter } from "src/common/models/discoveryAppFilters";
import { deleteSpecificQueryParams } from "@depmap/utils";

export const CONTEXT_EXPL_BAR_THICKNESS = 40;
export const BOX_THICKNESS = 40;
export const BOX_PLOT_BOTTOM_MARGIN = 40;
export const BOX_PLOT_TOP_MARGIN = 0;

export function getSelectivityValLabel(entityType: string) {
  return entityType === "gene" ? "log(OR)" : "Bimodality Coefficient";
}

function isWholeNumberNotZero(num: number) {
  return num % 1 === 0 && num !== 0;
}

export const ALL_SEARCH_OPTION = {
  name: "All",
  subtype_code: "All",
  node_level: 0,
};

export const OUTGROUP_TYPE_ALL_OPTION = {
  value: "All Others",
  label: "All other",
};

export const DATATYPE_TOOLTIP_TEXT = new Map<string, string>([
  [
    DataTypeStrings.CRISPR.toString(),
    "Models that have been screened with at least one genome-wide CRISPR library.",
  ],
  [
    DataTypeStrings.PRISMOncRef.toString(),
    "Models that have been included in at least one PRISM OncRef screen.",
  ],
  [
    DataTypeStrings.PRISMRepurposing.toString(),
    "Models that have been included in at least one PRISM Repurposing screen.",
  ],
  [DataTypeStrings.RNASeq.toString(), "Models with RNAseq profiling."],
  [
    DataTypeStrings.RNAi.toString(),
    "Models that have been screened with at least one RNAi library.",
  ],
  [DataTypeStrings.WGS.toString(), "Models with whole genome sequencing."],
  [DataTypeStrings.WES.toString(), "Models with whole exome sequencing."],
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
  originalData.data_types.forEach((datatype: string, index: number) => {
    if (selectedDataTypes.size > 0 && !selectedDataTypes.has(datatype)) {
      const newValues = originalData.values[index].map(
        (oldValue: number) => oldValue + 0.5
      );
      newVals.push(newValues);
    } else {
      newVals.push(originalData.values[index]);
      selectedRowIndexes.push(index);
    }
  });

  return { newVals, selectedRowIndexes };
}

// From: https://stackoverflow.com/a/1026087
export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getDataExplorerContextFromSelections(
  selectedContextNameInfo: ContextNameInfo,
  checkedDatatypes: Set<string>,
  selectedContextDepmapIds: string[]
): DataExplorerContext {
  const selectedContextCode = selectedContextNameInfo.subtype_code;
  const selectedDataTypes = [...checkedDatatypes].join(" ");
  const de2ContextName =
    checkedDatatypes.size > 0
      ? `${selectedContextNameInfo.name} Cell Lines available in ${selectedDataTypes}`
      : selectedContextNameInfo.name;

  // We don't have "datatype" information for some cell lines, and datatype information is
  // required for a cell line to show up in Context Explorer (datatype information = information
  // on whether the cell line has data available in CRISPR, RNAi, RNASeq, WES, WGS, and PRISM).
  // We add a depmapId list to the context we build off of Context Explorer to ensure the cell lines
  // in Context Explorer match the cell lines shown in Data Explorer 2 using a Context Explorer Context.
  const exp =
    selectedContextCode === "All" || checkedDatatypes.size > 0
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
              "==": [
                {
                  var: `slice/Context_Matrix/${selectedContextCode}/label`,
                },
                1,
              ],
            },
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
  selectedContextCode: string,
  outgroup: { value: string; label: string }
): {
  inGroupContext: DataExplorerContext;
  outGroupContext: DataExplorerContext;
} {
  const context_type = "depmap_model";
  const inGroupSliceId = `slice/Context_Matrix/${selectedContextCode}/label`;

  const exp = {
    and: [
      {
        "==": [
          {
            var: inGroupSliceId,
          },
          1,
        ],
      },
    ],
  };

  const inGroupContext = {
    name: `${selectedContextCode}`,
    context_type,
    expr: exp,
  };

  function getOutgroupContext(
    outgroupCode: string,
    outGroupLabel: string,
    ingroupName: string
  ) {
    const outGroupSliceId = `slice/Context_Matrix/${outgroupCode}/label`;
    const outGroupHemeExp = [
      { "==": [{ var: `slice/Context_Matrix/MYELOID/label` }, 1] },
      { "==": [{ var: `slice/Context_Matrix/LYMPH/label` }, 1] },
    ];

    switch (outgroupCode) {
      case "All Others":
        return {
          name: `Not ${ingroupName}`,
          context_type: "depmap_model",
          expr: {
            and: [{ "==": [{ var: inGroupSliceId }, 0] }],
          },
        };
      case "Other Heme":
        return {
          name: `${outGroupLabel}`,
          context_type: "depmap_model",
          expr: {
            and: [{ "==": [{ var: inGroupSliceId }, 0] }],
            or: [outGroupHemeExp[0], outGroupHemeExp[1]],
          },
        };
      default:
        return {
          name: `${outGroupLabel}`,
          context_type: "depmap_model",
          expr: {
            and: [
              { "==": [{ var: inGroupSliceId }, 0] },
              { "==": [{ var: outGroupSliceId }, 1] },
            ],
          },
        };
    }
  }

  const outGroupContext = getOutgroupContext(
    outgroup.value,
    outgroup.label,
    selectedContextCode
  );

  return { inGroupContext, outGroupContext };
}

export const GENE_BOX_PLOT_X_AXIS_TITLE = "CRISPR Gene Effect";
export const COMPOUND_BOX_PLOT_X_AXIS_TITLE = "log2(viability)";

const de2PageHref = window.location.href
  .split("?")[0]
  .replace("context_explorer", "data_explorer_2");

export function getDataExplorerUrl(
  ingroupCode: string,
  outgroup: { value: string; label: string },
  datasetId: ContextExplorerDatasets
): string {
  const xDataset = datasetId;
  const yDataset = datasetId;
  const { inGroupContext, outGroupContext } = getGeneDependencyContexts(
    ingroupCode,
    outgroup
  );

  const queryString = qs.stringify({
    xDataset,
    yDataset,
    xContext: JSON.stringify(inGroupContext),
    yContext: JSON.stringify(outGroupContext),
  });

  return `${de2PageHref}?${queryString}`;
}

export function getShowPositiveEffectSizesFilter(filters: Filter[]) {
  let showPositiveEffectSizes: boolean = false;

  filters.forEach((filter) => {
    if (filter.key === "depletion" && typeof filter.value === "boolean") {
      showPositiveEffectSizes = filter.value;
    }
  });

  return showPositiveEffectSizes;
}

export function getBoxPlotFilterVariables(filters: Filter[]) {
  let maxFdr: number = 0.1;
  let minEffectSize: number = 0.1;
  let minFracDepIn: number = 0.1;

  filters.forEach((filter) => {
    if (filter.kind === "numberInput") {
      const value = filter.value;
      if (filter.key === "t_qval") {
        maxFdr = value;
      } else if (filter.key === "abs_effect_size") {
        minEffectSize = value;
      } else if (filter.key === "frac_dep_in") {
        minFracDepIn = value;
      }
    }
  });

  return { maxFdr, minEffectSize, minFracDepIn };
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

function getFilteredData(
  selectedContextNode: ContextNode,
  data: ContextSummary
) {
  if (!selectedContextNode) {
    return data;
  }
  const nodeChildrenCodes = selectedContextNode.children.map(
    (node) => node.subtype_code
  );
  const datasetDataTypes = Object.keys(DataType).filter((item) => {
    return Number.isNaN(Number(item));
  });

  const includedDataTypes: string[] = [];
  const includedValueRows: number[][] = [];
  data.values.forEach((row: number[], index) => {
    const dataType = data.data_types[index];

    if (
      datasetDataTypes.includes(dataType) ||
      nodeChildrenCodes.includes(dataType)
    ) {
      includedDataTypes.push(dataType);
      includedValueRows.push(row);
    }
  });

  return {
    all_depmap_ids: data.all_depmap_ids,
    values: includedValueRows,
    data_types: includedDataTypes,
  };
}

function mergeDataAvailability(
  allContextDatasetDataAvail: ContextSummary,
  subtypeDataAvail: ContextSummary
) {
  const selectedModelIds = subtypeDataAvail.all_depmap_ids.map(
    (item) => item[1]
  );

  const orderedModelIds = allContextDatasetDataAvail.all_depmap_ids.filter(
    (indexedModel) => selectedModelIds.includes(indexedModel[1])
  );
  const indexedOrderedModelIds: [
    number,
    string
  ][] = orderedModelIds.map((modelId: [number, string], index: number) => [
    index,
    modelId[1],
  ]);

  const vals: number[][] = [];
  const dataTypes: string[] = [];
  allContextDatasetDataAvail.values.forEach((row: number[], index: number) => {
    const filteredRow = row.filter((rowVals: number, j: number) =>
      selectedModelIds.includes(allContextDatasetDataAvail.all_depmap_ids[j][1])
    );
    vals.push(filteredRow);
    dataTypes.push(allContextDatasetDataAvail.data_types[index]);
  });

  const orderedDataTypes = [...dataTypes];
  const orderedVals = [...vals];
  const mergedDataAvail = {
    all_depmap_ids: indexedOrderedModelIds,
    data_types: [...orderedDataTypes, ...subtypeDataAvail.data_types].reverse(),
    values: [...orderedVals, ...subtypeDataAvail.values].reverse(),
  };

  return mergedDataAvail;
}

function getSelectedContextData(
  selectedContextNode: ContextNode,
  allContextDatasetDataAvail: ContextSummary,
  selectedContextDataAvailability: ContextSummary
) {
  const mergedDataAvailability = mergeDataAvailability(
    allContextDatasetDataAvail,
    selectedContextDataAvailability
  );

  const filteredData = getFilteredData(
    selectedContextNode,
    mergedDataAvailability
  );

  const availableDepmapIds = mergedDataAvailability.all_depmap_ids;

  const newDataVals = [];
  for (let index = 0; index < filteredData.values.length; index += 1) {
    const dataTypeVals = filteredData.values[index];
    const newDataTypeVals = availableDepmapIds.map(
      (item) => dataTypeVals[item[0]]
    );
    newDataVals.push(newDataTypeVals);
  }

  const newContextData = {
    values: newDataVals,
    data_types: filteredData.data_types,
    all_depmap_ids: availableDepmapIds,
  };

  return {
    selectedContextData: newContextData,
    selectedContextNameInfo: {
      subtype_code: selectedContextNode.subtype_code,
      name: selectedContextNode.name,
      node_level: selectedContextNode.node_level,
    },
  };
}

export function getSelectionInfo(
  allContextDatasetDataAvail: ContextSummary,
  selectedContextDataAvailability: ContextSummary,
  selectedContextNode: ContextNode | null,
  checkedDatatypes: Set<string>
) {
  let overlappingDepmapIds: string[] = [];

  let validCheckedDataTypes: Set<string> = new Set();
  checkedDatatypes.forEach((dataType) => {
    if (!Object.values(DataTypeStrings)) {
      validCheckedDataTypes = update(checkedDatatypes, {
        $remove: [dataType],
      });
    } else {
      validCheckedDataTypes = update(checkedDatatypes, {
        $add: [dataType],
      });
    }
  });

  const { selectedContextData, selectedContextNameInfo } = selectedContextNode
    ? getSelectedContextData(
        selectedContextNode,
        allContextDatasetDataAvail,
        selectedContextDataAvailability
      )
    : {
        selectedContextData: {
          all_depmap_ids: [...allContextDatasetDataAvail.all_depmap_ids],
          values: [...allContextDatasetDataAvail.values].reverse(),
          data_types: [...allContextDatasetDataAvail.data_types].reverse(),
        },
        selectedContextNameInfo: ALL_SEARCH_OPTION,
      };

  let checkedDataValues = selectedContextNode
    ? selectedContextData.values
    : [...allContextDatasetDataAvail.values].reverse();

  if (selectedContextData && validCheckedDataTypes.size > 0) {
    const newSelectedValuesOverlap = getUpdatedGraphInfoForSelection(
      validCheckedDataTypes,
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
  contextPath: string[] | null,
  contextTree: ContextNode | undefined
) {
  let selectedNode: ContextNode | null = null;
  let topContextNameInfo: {
    name: string;
    subtype_code: string;
    node_level: number;
    numModels?: number;
  } = ALL_SEARCH_OPTION;

  if (contextTree && contextPath && contextPath.length > 0) {
    if (contextPath[0]) {
      const selectedTree = contextTree;

      if (selectedTree) {
        topContextNameInfo = {
          subtype_code: selectedTree.subtype_code,
          name: selectedTree.name,
          numModels: selectedTree.model_ids.length,
          node_level: 0,
        };
        selectedNode = selectedTree;

        if (contextPath.length > 1 && selectedTree.children.length > 0) {
          // For each subtype code in contextPath, find the node amongst the children
          const getSelectedNode = (
            node: ContextNode,
            selectedCode: string
          ): ContextNode | null => {
            if (!node) {
              return null; // Base case: reached the end of a branch without finding the target
            }

            if (node?.subtype_code === selectedCode) {
              return node; // Base case: found the target node
            }

            // Recursive case: search in children
            for (let index = 0; index < node.children.length; index++) {
              const child = node.children[index];
              const result: ContextNode | null = getSelectedNode(
                child,
                selectedCode
              );
              if (result !== null) {
                return result; // Found the target in a child node
              }
            }

            return null; // Target not found in this subtree
          };

          const node = selectedTree.children.find(
            (childNode) => childNode.subtype_code === contextPath[1]
          );
          selectedNode = getSelectedNode(
            node!,
            contextPath[contextPath.length - 1]
          );
        }
      } else {
        // Invalid params, so default to loading All data
        deleteSpecificQueryParams(["context"]);
      }
    }
  }
  return { selectedContextNode: selectedNode, topContextNameInfo };
}

export function getNewContextUrl(
  newCode: string,
  urlPrefix?: string,
  tab?: string
) {
  if (urlPrefix) {
    return urlPrefix.concat(
      `?tab=${tab}&context=${encodeURIComponent(newCode)}`
    );
  }
  const currentLocation = window.location.href;
  const currentUrl = new URL(currentLocation);

  const currentContext = currentUrl.searchParams.get("context");

  const newUrl = currentContext
    ? // Do not include & in the string replacement. Cannot guarantee that the context query string
      // will come after the tab query string.
      currentLocation.replace(
        `context=${encodeURIComponent(currentContext)}`,
        `context=${encodeURIComponent(newCode)}`
      )
    : // & is okay here because no context query string exists yet, but a tab will always exist.
      currentLocation.concat(`&context=${encodeURIComponent(newCode)}`);

  return newUrl;
}

export const GENE_DEP_TEXT_BEFORE_1_HELP_ICON =
  "Gene dependencies enriched within models of the selected lineage/tumor subtype vs. a chosen out-group (all other CRISPR screened models by default) are calculated using a two-sided T-test on the Chronos CRISPR Gene Effect scores. P-values are corrected for multiple hypothesis testing using the Benjamini-Hochberg procedure. Only genes that are ‘strongly selective’ ";

export const GENE_DEP_BETWEEN_1_AND_2 = " or dependent ";

export const GENE_DEP_END =
  " in min. 3 and max. 95% of CRISPR screened models are considered for this analysis.";

export const GENE_LOG_OR_LEGEND_TOOL_TIP =
  "Points are colored according to the logged odd’s ratio (OR) of in-group to out-group dependency; e.g. a value of 1 indicates the gene is 10x more likely to be a dependency in the in-group vs. the out-group.";

export const REPURPOSING_SIDE_BAR_TEXT =
  "Compound sensitivities enriched within models of the selected lineage/tumor subtype vs. a chosen out-group (all other PRISM Repurposing screened models by default) are calculated using a two-sided T-test on the log viability from the Repurposing dataset. P-values are corrected for multiple hypothesis testing using the Benjamini-Hochberg procedure. Only compounds that are sensitivities in at least one and max. 75% of models are considered for this analysis.";

export const ONCREF_SIDEBAR_TEXT =
  "Compound sensitivities enriched within models of the selected lineage/tumor subtype vs. a chosen out-group (all other PRISM OncRef screened models by default) are calculated using a two-sided T-test on the log AUC of the dose response curves from the OncRef dataset. P-values are corrected for multiple hypothesis testing using the Benjamini-Hochberg procedure. ";

export const OVERVIEW_SIDEBAR_TEXT =
  "Context Explorer helps researchers see how many datasets are available for their chosen tissue context type and subtype, as well as showing the overlap in data.";

export const GENE_DEP_TABLE_DESCRIPTION =
  "The filters below can be used to adjust the data displayed in the plots and table. By default only enriched dependencies are shown, but relatively depleted dependencies can be viewed by checking “include positive effect sizes”.";

export const GENE_DETAIL_NO_GENE_SELECTED =
  "Select a gene to see the distribution of its CRISPR gene effects in the selected lineage/subtype vs. related groups, as well as other lineages/subtypes (if any) where the gene is an enriched dependency.";

export const ONCREF_DETAIL_NO_COMPOUND_SELECTED =
  "Select a compound to see (a) the median in- and out-group dose response curves; and (b) the distribution of dose response AUCs in the selected lineage/subtype vs. related groups, as well as other lineages/subtypes (if any) where the compound is an enriched sensitivity.";

export const REPURPOSING_DETAIL_NO_COMPOUND_SELECTED =
  "Select a compound to see the distribution of log viability in the selected lineage/subtype vs. related groups, as well as other lineages/subtypes (if any) where the compound is an enriched sensitivity.";

export const ONCREF_TABLE_DESCRIPTION =
  "The filters below can be used to adjust the data displayed in the plots and table. By default only enriched sensitivities are shown, but relatively depleted sensitivities can be viewed by checking “include positive effect sizes”.";
export const REPURPOSING_TABLE_DESCRIPTION =
  "The filters below can be used to adjust the data displayed in the plots and table. By default only enriched sensitivities are shown, but relatively depleted sensitivities can be viewed by checking “include positive effect sizes”.";

export const GENE_DETAIL_TOOLTIP =
  "Lineages and/or subtypes that have, on average, a stronger dependency on this gene compared to all other models. Enriched lineages/subtypes are selected based on default Context Explorer filters (T-test FDR<0.1, avg. gene effect difference < -0.25 and min. 1 dependent in-group model).";

export const ONC_DETAIL_TOOLTIP =
  "Lineages and/or subtypes that have, on average, a stronger sensitivity to this compound compared to all other models. Enriched lineages/subtypes are selected based on default Context Explorer filters (T-test FDR<0.1, avg. AUC difference < -0.1).";

export const REP_DETAIL_TOOLTIP =
  "Lineages and/or subtypes that have, on average, a stronger sensitivity to this compound compared to all other models. Enriched lineages/subtypes are selected based on default Context Explorer filters (T-test FDR<0.1, avg. log2(Viability) difference < -0.5).";

export function getDetailPanelTooltip(datasetId: ContextExplorerDatasets) {
  if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
    return ONC_DETAIL_TOOLTIP;
  }

  if (datasetId === ContextExplorerDatasets.Rep_all_single_pt) {
    return REP_DETAIL_TOOLTIP;
  }

  return GENE_DETAIL_TOOLTIP;
}
