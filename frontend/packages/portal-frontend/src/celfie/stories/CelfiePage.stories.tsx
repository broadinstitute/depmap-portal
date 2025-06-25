import * as React from "react";
import { TopFeatureValue } from "@depmap/types";
import CelfiePage, { defaultData } from "src/celfie/components/CelfiePage";
import { expressionData } from "src/celfie/stories/expressionData";
import { copyNumberData } from "src/celfie/stories/copyNumData";
import copyNumTaskResponse from "src/celfie/stories/copyNumTaskResponse.json";
import expressionTaskResponse from "src/celfie/stories/expressionTaskResponse.json";
import { combinedData } from "src/celfie/stories/combinedData";
import { UnivariateAssociationsParams, ComputeResponse } from "@depmap/compute";
import { combinedDataPVal } from "src/celfie/stories/combinedDataPVal";
import { ConnectivityValue } from "src/constellation/models/constellation";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  title: "Components/Celfie/CelfiePage",
  component: CelfiePage,
};

const apiDelay: number = 0;
// turn this on to develop on celfie loading
// const apiDelay: number = 3000;

const getApiProps = (sleepDelay: number) => {
  async function getGraphData(
    task: string,
    numGenes: number = 200,
    similarityMeasure: string = "codependency",
    connectivity: ConnectivityValue = 2,
    topFeature: TopFeatureValue
  ) {
    if (task === "ade61531-6ccf-406a-91b2-e0fafe549571") {
      await sleep(sleepDelay);
      return Promise.resolve(expressionData);
    }
    if (task === "2475ee15-31e2-4244-9e9c-f41cbb926dd1") {
      await sleep(sleepDelay);
      return Promise.resolve(copyNumberData);
    }
    if (task === "") {
      await sleep(sleepDelay);
      return Promise.resolve(defaultData);
    }
    if (topFeature === TopFeatureValue.NegLogP) {
      await sleep(sleepDelay);
      return Promise.resolve(combinedDataPVal);
    }
    await sleep(sleepDelay);
    return Promise.resolve(combinedData);
  }

  async function getVolcanoResponse(taskId: string) {
    if (taskId === "ade61531-6ccf-406a-91b2-e0fafe549571") {
      await sleep(sleepDelay);
      return Promise.resolve(
        (expressionTaskResponse as any) as ComputeResponse
      );
    }
    if (taskId === "2475ee15-31e2-4244-9e9c-f41cbb926dd1") {
      await sleep(sleepDelay);
      return Promise.resolve(copyNumTaskResponse as ComputeResponse);
    }
    return {} as ComputeResponse;
  }

  async function getComputeResponse(params: UnivariateAssociationsParams) {
    if (params.datasetId === "expression") {
      await sleep(sleepDelay);
      return Promise.resolve(
        (expressionTaskResponse as any) as ComputeResponse
      );
    }
    if (params.datasetId === "copyNumber") {
      await sleep(sleepDelay);
      return Promise.resolve(copyNumTaskResponse as ComputeResponse);
    }
    return {} as ComputeResponse;
  }

  const apiProps = {
    getGraphData,
    getVolcanoResponse,
    getComputeResponse,
  };
  return apiProps;
};

const datasetList = [
  { value: "expression", label: "Expression" },
  { value: "copyNumber", label: "Copy Number" },
];

export function CelfieStory() {
  return (
    <CelfiePage
      getGraphData={getApiProps(apiDelay).getGraphData}
      getVolcanoData={getApiProps(apiDelay).getVolcanoResponse}
      similarityOptions={[
        { label: "CRISPR (Avana) Codependency", value: "codependency" },
        { label: "CCLE Coexpression", value: "expression" },
        { label: "MSigDB Curated Pathways", value: "misgdb" },
        { label: "STRING PPi", value: "string_db_experimental" },
        { label: "STRING Literature", value: "string_db_textmining" },
        { label: "STRING All", value: "string_db_combined" },
      ]}
      colorOptions={[
        { label: "Correlation", value: "effect" },
        { label: "Direction", value: "direction" },
        { label: "-log10(P)", value: "-log10(P)" },
      ]}
      connectivityOptions={[
        { label: "High", value: 3 },
        { label: "Medium", value: 2 },
        { label: "Low", value: 1 },
      ]}
      targetFeatureLabel="SOX"
      datasets={datasetList}
      getComputeUnivariateAssociations={
        getApiProps(apiDelay).getComputeResponse
      }
      dependencyProfileOptions={[
        {
          dataset: "Avana",
          entity: 11,
          id: "Avana_11",
          label: "CRISPR CERES (Achilles Avana) Internal 18Q3",
        },
        {
          dataset: "RNAi_merged",
          entity: 11,
          id: "RNAi_merged_11",
          label: "RNAi (Combined Broad, Novartis, Marcotte)",
        },
        {
          dataset: "RNAi_Ach",
          entity: 11,
          id: "RNAi_Ach_11",
          label: "RNAi (Broad)",
        },
        {
          dataset: "RNAi_Nov_DEM",
          entity: 11,
          id: "RNAi_Nov_DEM_11",
          label: "RNAi (Novartis)",
        },
      ]}
      howToImg="image-path"
      methodIcon="icon_path"
      methodPdf="pdf_path"
      onCelfieInitialized={() => {
        "sending trace info";
      }}
    />
  );
}
