import * as React from "react";

import { correlationAnalysisData } from "./correlationAnalysisData";
import { TagOption } from "@depmap/common-components";
import CorrelationAnalysis from "../components";

export default {
  title: "Components/CorrelationAnalysis/CorrelationAnalysisPage",
  component: CorrelationAnalysis,
};

const featureTypeOptions: TagOption[] = [
  { label: "CRISPR knock-out", value: "CRISPR knock-out", isDisabled: false },
  { label: "Copy number", value: "Copy number", isDisabled: true },
  { label: "Gene expression", value: "Gene expression", isDisabled: false },
  { label: "Metabolomics", value: "Metabolomics", isDisabled: true },
  { label: "Micro RNA", value: "Micro RNA", isDisabled: true },
  { label: "Proteomics", value: "Proteomics", isDisabled: true },
  {
    label: "Repurposing compounds",
    value: "Repurposing compounds",
    isDisabled: false,
  },
  { label: "shRNA knockdown", value: "shRNA knockdown", isDisabled: true },
];

const featureTypesPromise = () => {
  return new Promise<any[]>((resolve) => {
    setTimeout(() => {
      resolve(featureTypeOptions);
    }, 1000);
  });
};

const correlationAnalysisDataPromise = () => {
  return new Promise<
    {
      Compound: string;
      Dose: string;
      "Feature Type": string;
      Feature: string;
      "Correlation Coefficient": number;
      "-log10 qval": number;
      Rank: number;
    }[]
  >((resolve) => {
    setTimeout(() => {
      // add index as unique id to use for selection
      resolve(
        correlationAnalysisData.map((data, i) => {
          return { id: i, ...data };
        })
      );
    }, 1000);
  });
};

export function Story() {
  return (
    <CorrelationAnalysis
      compound="imatinib"
      getCorrelationData={correlationAnalysisDataPromise}
      getFeatureTypes={featureTypesPromise}
    />
  );
}
