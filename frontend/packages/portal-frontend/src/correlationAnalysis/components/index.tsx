/* eslint-disable @typescript-eslint/dot-notation */
import * as React from "react";
import { DRCDatasetOptions } from "@depmap/types";
import { GeneCorrelationDatasetOption } from "../types";
import { GeneCorrelationContainer } from "./CorrelationContainer/GeneCorrelationContainer";
import { CompoundCorrelationContainer } from "./CorrelationContainer/CompoundCorrelationContainer";
import { CorrelationProvider } from "../context/useCorrelationContext";

interface CorrelationAnalysisProps {
  compoundDatasetOptions: DRCDatasetOptions[];
  geneDatasetOptions: GeneCorrelationDatasetOption[];
  featureId: string;
  featureName: string;
  featureType: "gene" | "compound";
}

export default function CorrelationAnalysis({
  compoundDatasetOptions,
  geneDatasetOptions,
  featureId,
  featureName,
  featureType,
}: CorrelationAnalysisProps) {
  return (
    <CorrelationProvider>
      {featureType === "gene" ? (
        <GeneCorrelationContainer
          geneDatasetOptions={geneDatasetOptions}
          featureId={featureId}
          featureName={featureName}
        />
      ) : (
        <CompoundCorrelationContainer
          compoundDatasetOptions={compoundDatasetOptions}
          featureId={featureId}
          featureName={featureName}
        />
      )}
    </CorrelationProvider>
  );
}
