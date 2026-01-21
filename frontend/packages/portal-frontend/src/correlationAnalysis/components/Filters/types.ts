import { DRCDatasetOptions } from "@depmap/types";
import { GeneCorrelationDatasetOption } from "src/correlationAnalysis/types";

export const customFilterStyles = {
  multiValue: (s: any) => ({
    ...s,
    maxWidth: "100%",
    flex: "1 1 auto",
    margin: "2px 4px",
    backgroundColor: "#eef2ff",
  }),

  multiValueLabel: (s: any) => ({
    ...s,
    whiteSpace: "normal",
    wordBreak: "break-word",
    padding: "2px 8px",
    fontSize: "1.1rem",
    lineHeight: "1.25",
  }),

  valueContainer: (s: any) => ({
    ...s,
    flexWrap: "wrap",
  }),
};

interface CommonFiltersProps {
  selectedDatasetOption: { value: string; label: string } | null;
  onChangeDataset: (selection: { value: string; label: string } | null) => void;
  correlatedDatasets: string[];
}

interface GeneFiltersProps extends CommonFiltersProps {
  featureType: "gene";
  geneDatasetOptions: GeneCorrelationDatasetOption[];
}

interface CompoundFiltersProps extends CommonFiltersProps {
  featureType: "compound";
  compoundDatasetOptions: DRCDatasetOptions[];
  doses: string[];
}

export type CorrelationFiltersProps = GeneFiltersProps | CompoundFiltersProps;
