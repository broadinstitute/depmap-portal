export function getDataExplorerUrl(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  featureDatasetId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  featureLabel: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  featureType: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  geneLabel: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  screenType: string
  // cellLines: string[] // TODO: Take this out completely, we don't need a cell lines list anywhere
): string {
  console.log("getDataExplorerUrl is not implemented. Returning stub value");
  return "/invalid-url-from-getDataExplorerUrl";

  //throw Error("getDataExplorerUrl not implemented");
  // need some guidance on how to update this.
  // const yDatasetId =
  //   screenType === ScreenType.CRISPR ? "Chronos_Combined" : "RNAi_merged";
  // const xDatasetId = featureDatasetId;
  //
  // let relativeUrlPrefix = fetchUrlPrefix();
  //
  // if (relativeUrlPrefix === "/") {
  //   relativeUrlPrefix = "";
  // }
  //
  // const urlPrefix = `${window.location.protocol}//${window.location.host}${relativeUrlPrefix}`;
  //
  // const xContext =
  //   featureLabel !== null
  //     ? {
  //         name: featureLabel,
  //         context_type: featureType,
  //         expr: { "==": [{ var: "entity_label" }, featureLabel] },
  //       }
  //     : {
  //         name: geneLabel,
  //         context_type: "gene",
  //         expr: { "==": [{ var: "entity_label" }, geneLabel] },
  //       };
  //
  // const yContext = {
  //   name: geneLabel,
  //   context_type: "gene",
  //   expr: { "==": [{ var: "entity_label" }, geneLabel] },
  // };
  //
  // const queryString =
  //   featureLabel === null
  //     ? qs.stringify({
  //         xDataset: xDatasetId,
  //         yDataset: yDatasetId,
  //         xContext: JSON.stringify(xContext),
  //         yContext: JSON.stringify(yContext),
  //       })
  //     : qs.stringify({
  //         xDataset: xDatasetId,
  //         yDataset: yDatasetId,
  //         xContext: JSON.stringify(xContext),
  //         yContext: JSON.stringify(yContext),
  //       });
  //
  // return `${urlPrefix}/data_explorer_2/?${queryString}`;
}
