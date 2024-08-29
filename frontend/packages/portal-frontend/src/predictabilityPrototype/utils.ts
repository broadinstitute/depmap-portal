import qs from "qs";
import { fetchUrlPrefix } from "src/common/utilities/context";
import { ScreenType } from "./models/types";

export function getDataExplorerUrl(
  featureDatasetId: string,
  featureLabel: string | null,
  featureType: string,
  geneLabel: string,
  screenType: string,
  cellLines: string[]
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
          name: "all_cell_lines",
          context_type: "depmap_model",
          expr: { in: [{ var: "depmap_model" }, cellLines] },
        };

  const yContext =
    featureLabel !== null
      ? {
          name: geneLabel,
          context_type: "gene",
          expr: { "==": [{ var: "entity_label" }, geneLabel] },
        }
      : {
          name: "all_cell_lines2",
          context_type: "depmap_model",
          expr: { in: [{ var: "depmap_model" }, cellLines] },
        };

  console.log({ xContext });
  console.log({ yContext });
  console.log({ xDatasetId });
  console.log({ yDatasetId });

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
