import { useDataExplorerApi } from "../../../../contexts/DataExplorerApiContext";

const REGEX = /(.*) ((?<!-)\(.*)/;
const getCaptureGroup = (s: string, n: number) => (REGEX.exec(s) || [])[n];

export const extractCompoundName = (label?: string | null) => {
  if (!label) {
    return null;
  }

  return getCaptureGroup(label, 1);
};

export const extractExperiment = (label?: string | null) => {
  if (!label) {
    return null;
  }

  return getCaptureGroup(label, 2).replace(/^\(/, "").replace(/\)$/, "");
};

export const extractCompoundNames = (labels: string[]) => {
  const names = labels.map((label) => getCaptureGroup(label, 1));
  return [...new Set(names)].sort();
};

export const fetchCompoundDatasets = async (
  api: ReturnType<typeof useDataExplorerApi>,
  compoundName: string
) => {
  const datasets = await api.fetchDatasetsMatchingContextIncludingEntities({
    context_type: "compound_experiment",
    expr: {
      "==": [
        { var: "slice/compound_experiment/compound_name/label" },
        compoundName,
      ],
    },
  });

  return datasets.sort(
    (a: { dataset_label: string }, b: { dataset_label: string }) => {
      const labelA = a.dataset_label;
      const labelB = b.dataset_label;

      if (labelA.startsWith("PRISM") && !labelB.startsWith("PRISM")) {
        return -1;
      }

      if (!labelA.startsWith("PRISM") && labelB.startsWith("PRISM")) {
        return 1;
      }

      return labelA < labelB ? -1 : 1;
    }
  );
};
