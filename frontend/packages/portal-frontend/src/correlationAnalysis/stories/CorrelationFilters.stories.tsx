import * as React from "react";
import CorrelationFilters from "../components/CorrelationFilters";

export default {
  title: "Components/CorrelationAnalysis/CorrelationFilters",
  component: CorrelationFilters,
};

const featureTypeOptions = [
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

export function CorrelationFiltersStory() {
  return (
    <div style={{ width: "300px" }}>
      <CorrelationFilters
        getDatasets={featureTypesPromise}
        onChangeDataset={(val) => console.log(val)}
        getFeatureTypes={featureTypesPromise}
        onChangeFeatureTypes={(val) => console.log(val)}
        doses={["dose1", "dose2", "dose3"]}
        onChangeDoses={(val) => console.log(val)}
      />
    </div>
  );
}
