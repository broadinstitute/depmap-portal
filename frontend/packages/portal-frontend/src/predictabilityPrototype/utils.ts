import qs from "qs";
import { fetchUrlPrefix } from "src/common/utilities/context";
import { ScreenType } from "./models/types";

export function getDataExplorerUrl(
  featureDatasetId: string,
  featureLabel: string | null,
  featureType: string,
  geneLabel: string,
  screenType: string,
  cellLines: string[] // TODO: Take this out completely, we don't need a cell lines list anywhere
): string {
  const yDatasetId =
    screenType === ScreenType.CRISPR ? "Chronos_Combined" : "RNAi_merged";
  const xDatasetId = featureDatasetId;

  let relativeUrlPrefix = fetchUrlPrefix();

  if (relativeUrlPrefix === "/") {
    relativeUrlPrefix = "";
  }

  const urlPrefix = `${window.location.protocol}//${window.location.host}${relativeUrlPrefix}`;

  const xContext =
    featureLabel !== null
      ? {
          name: featureLabel,
          context_type: featureType,
          expr: { "==": [{ var: "entity_label" }, featureLabel] },
        }
      : {
          name: geneLabel,
          context_type: "gene",
          expr: { "==": [{ var: "entity_label" }, geneLabel] },
        };

  const yContext = {
    name: geneLabel,
    context_type: "gene",
    expr: { "==": [{ var: "entity_label" }, geneLabel] },
  };

  const queryString =
    featureLabel === null
      ? qs.stringify({
          xDataset: xDatasetId,
          yDataset: yDatasetId,
          xContext: JSON.stringify(xContext),
          yContext: JSON.stringify(yContext),
        })
      : qs.stringify({
          xDataset: xDatasetId,
          yDataset: yDatasetId,
          xContext: JSON.stringify(xContext),
          yContext: JSON.stringify(yContext),
        });

  return `${urlPrefix}/data_explorer_2/?${queryString}`;
}
