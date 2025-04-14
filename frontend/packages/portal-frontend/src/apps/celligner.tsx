import "src/public-path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { DeprecatedDataExplorerApiProvider } from "@depmap/data-explorer-2";
import { evaluateLegacyContext } from "src/data-explorer-2/deprecated-api";
import ErrorBoundary from "src/common/components/ErrorBoundary";
import CellignerPage from "src/celligner/components/CellignerPage";
import {
  Alignments,
  CellignerSampleType,
  CellignerTumorTypes,
  CellignerModelTypes,
  Tumor as CellignerTumor,
  Model as CellignerModel,
} from "src/celligner/models/types";

const dataElement = document.getElementById("react-celligner-data");
if (!dataElement || !dataElement.textContent) {
  throw new Error(
    `Expected a DOM element like <script type="application/json">{ ... }</script>'`
  );
}

const data = JSON.parse(dataElement.textContent);

const {
  alignments,
  subtypes,
  cellLineUrl,
  downloadUrl,
  methodologyUrl,
} = data as {
  alignments: Alignments;
  subtypes: { [primarySite: string]: Array<string> };
  cellLineUrl: string;
  downloadUrl: string;
  methodologyUrl: string;
};

const tumors: Array<CellignerTumor> = [];
const cellLines: Array<CellignerModel> = [];
alignments.type.forEach((t, i) => {
  if (
    t === CellignerSampleType.MET500_TUMOR ||
    t === CellignerSampleType.TCGA_TUMOR
  ) {
    tumors.push({
      displayName: alignments.displayName[i],
      profileId: alignments.profileId[i],
      modelConditionId: alignments.modelConditionId[i],
      sampleId: alignments.sampleId[i],
      type: alignments.type[i] as CellignerTumorTypes,
      umap1: alignments.umap1[i],
      umap2: alignments.umap2[i],
      lineage: alignments.lineage[i],
      subtype: alignments.subtype[i],
      cluster: alignments.cluster[i],
      pointIndex: i, // To keep track of umap and table indexes so filtering on umap filters table
    });
  } else {
    cellLines.push({
      displayName: alignments.displayName[i],
      profileId: alignments.profileId[i],
      modelConditionId: alignments.modelConditionId[i],
      sampleId: alignments.sampleId[i],
      type: alignments.type[i] as CellignerModelTypes,
      modelLoaded: alignments.modelLoaded[i],
      umap1: alignments.umap1[i],
      umap2: alignments.umap2[i],
      lineage: alignments.lineage[i],
      subtype: alignments.subtype[i],
      cluster: alignments.cluster[i],
      pointIndex: i,
    });
  }
});

const App = () => {
  return (
    <ErrorBoundary>
      <DeprecatedDataExplorerApiProvider
        evaluateLegacyContext={evaluateLegacyContext}
      >
        <CellignerPage
          alignmentsArr={alignments}
          tumors={tumors}
          models={cellLines}
          subtypes={new Map(Object.entries(subtypes))}
          cellLineUrl={cellLineUrl}
          downloadUrl={downloadUrl}
          methodologyUrl={methodologyUrl}
        />
      </DeprecatedDataExplorerApiProvider>
    </ErrorBoundary>
  );
};

ReactDOM.render(<App />, document.getElementById("react-celligner-root"));
