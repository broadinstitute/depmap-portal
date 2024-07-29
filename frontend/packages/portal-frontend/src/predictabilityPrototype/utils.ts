import qs from "qs";
import { fetchUrlPrefix } from "src/common/utilities/context";
import { GENE_DATASET_ID } from "src/contextExplorer/utils";


export function getDataExplorerUrl(
  featureDatasetId: string,
  featureLabel: string,
  featureType: string,
  geneLabel: string
): string {
  const yDatasetId = GENE_DATASET_ID;
  const xDatasetId = featureDatasetId;

  let relativeUrlPrefix = fetchUrlPrefix();

  if (relativeUrlPrefix === "/") {
    relativeUrlPrefix = "";
  }

  const urlPrefix = `${window.location.protocol}//${window.location.host}${relativeUrlPrefix}`;

  const xContext = {
    name: featureLabel,
    // TODO: take out toLowerCase --> temporary mapping for prototype
    context_type: featureType.toLowerCase(),
    expr: { "==": [{ var: "entity_label" }, featureLabel] },
  };

  const yContext = {
    name: geneLabel,
    context_type: "gene",
    expr: { "==": [{ var: "entity_label" }, geneLabel] },
  };

  const queryString = qs.stringify({
    xDataset: xDatasetId,
    yDataset: yDatasetId,
    xContext: JSON.stringify(xContext),
    yContext: JSON.stringify(yContext),
  });

  return `${urlPrefix}/data_explorer_2/?${queryString}`;
}
