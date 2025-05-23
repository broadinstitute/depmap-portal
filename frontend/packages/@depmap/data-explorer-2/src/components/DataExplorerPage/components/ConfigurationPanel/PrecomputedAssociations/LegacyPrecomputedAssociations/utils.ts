import { useEffect, useState } from "react";
import {
  DataExplorerContext,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import {
  DeprecatedDataExplorerApiResponse,
  useDeprecatedDataExplorerApi,
} from "../../../../../../contexts/DeprecatedDataExplorerApiContext";

export type Associations = DeprecatedDataExplorerApiResponse["fetchLegacyAssociations"];
export const sliceToDataset = (slice_id: string) => {
  return slice_id.replace("slice/", "").replace(/\/\d+\/entity_id/, "");
};

const labelFromContext = (context: DataExplorerContext | undefined) => {
  if (!context || typeof context?.expr !== "object") {
    return null;
  }

  const { expr } = context;

  // Compounds have their labels split into compound / experiement
  if (expr.and) {
    return expr.and[0]["=="][1] + " " + expr.and[1]["=="][1];
  }

  return expr?.["=="]?.[1] || null;
};

export function useAssociationsData(plot: PartialDataExplorerPlotConfig) {
  const api = useDeprecatedDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);
  const [associations, setAssociations] = useState<Associations | null>(null);

  const xDatasetId = plot.dimensions!.x!.dataset_id as string;
  const yDatasetId = plot.dimensions!.y?.dataset_id || null;

  const xEntityLabel = labelFromContext(
    plot.dimensions!.x!.context as DataExplorerContext
  );

  const yEntityLabel = labelFromContext(
    plot.dimensions!.y?.context as DataExplorerContext | undefined
  );

  useEffect(() => {
    setIsLoading(true);

    api.fetchLegacyAssociations(xDatasetId, xEntityLabel).then((data) => {
      setAssociations(data);
      setIsLoading(false);
    });
  }, [api, xDatasetId, xEntityLabel]);

  return {
    xDatasetId,
    xEntityLabel,
    yDatasetId,
    yEntityLabel,
    associations,
    isLoading,
  };
}
