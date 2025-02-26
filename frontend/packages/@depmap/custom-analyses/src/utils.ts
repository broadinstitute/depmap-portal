import qs from "qs";
import stableStringify from "json-stable-stringify";
import { CustomList } from "@depmap/cell-line-selector";
import { AnalysisType, ComputeResponseResult } from "@depmap/compute";

// Convert the cell line to a context and persists it to Content Addressable
// Storage so we can refer to it simply by hash.
async function cellLineListToContextHash(list: CustomList) {
  // If this list originated as a Model Context, we can skip this process.
  if (list.fromContext) {
    return list.fromContext.negated
      ? `not_${list.fromContext.hash}`
      : list.fromContext.hash;
  }

  let hash;

  const context = {
    name: list.name,
    context_type: "depmap_model",
    expr: { in: [{ var: "entity_label" }, [...list.lines]] },
  };

  const json = stableStringify(context);
  const data = new URLSearchParams();
  data.append("value", json);
  const options = { method: "POST", body: data };

  try {
    const response = await fetch("../cas/", options);
    const responseJson = await response.json();
    hash = responseJson.key;
  } catch (e) {
    window.console.error(e);
    throw new Error("Failed to persist context");
  }

  return hash;
}

export async function getDataExplorer2Url(
  analysisType: AnalysisType,
  result: ComputeResponseResult,
  cellLineLists: Record<string, CustomList>,
  vectorCatalogSelections?: any[]
): Promise<string> {
  const task = result.taskId;
  const firstFeature = result.data[0].label;
  const firstDataset = decodeURIComponent(
    result.data[0].vectorId.replace(/slice\/([^/]+)\/.*/, "$1")
  );

  if (analysisType === "two_class") {
    const color1 = await cellLineListToContextHash(cellLineLists.inGroup);
    let color2;
    let filter;

    if (cellLineLists.outGroup.lines.size > 0) {
      const combinedList = {
        name: "in/out groups combined",
        lines: new Set([
          ...cellLineLists.inGroup.lines,
          ...cellLineLists.outGroup.lines,
        ]),
      };

      color2 = await cellLineListToContextHash(cellLineLists.outGroup);
      filter = await cellLineListToContextHash(combinedList);
    }

    const queryString = qs.stringify({
      task,
      xFeature: firstFeature,
      xDataset: firstDataset,
      color1,
      color2,
      filter,
    });

    return `../data_explorer_2/?${queryString}`;
  }

  if (!vectorCatalogSelections) {
    throw new Error(
      `vectorCatalogSelections should be defined for ${analysisType} analyses`
    );
  }

  const xEntityType = vectorCatalogSelections[0].value;
  let featureIndex;
  let datasetIndex;

  if (xEntityType === "gene") {
    featureIndex = 1;
    datasetIndex = 2;
  } else if (xEntityType === "compound") {
    featureIndex = 3;
    datasetIndex = 2;
  } else {
    featureIndex = 2;
    datasetIndex = 1;
  }

  let filter;

  if (cellLineLists.selectedList.lines.size > 0) {
    filter = await cellLineListToContextHash(cellLineLists.selectedList);
  }

  const queryString = qs.stringify({
    task,
    xFeature: vectorCatalogSelections[featureIndex].value,
    xDataset: vectorCatalogSelections[datasetIndex].value,
    yFeature: firstFeature,
    yDataset: firstDataset,
    filter,
  });

  return `../data_explorer_2/?${queryString}`;
}
