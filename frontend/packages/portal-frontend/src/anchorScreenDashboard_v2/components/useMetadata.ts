import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";

export interface AnchorPlotMetadata {
  DrugArmScreenID: Record<string, string>;
  ControlArmScreenID: Record<string, string>;
}

function useMetadata() {
  const [metadata, setMetadata] = useState<unknown>(null);

  useEffect(() => {
    breadboxAPI
      .getTabularDatasetData("anchor_experiment_metadata", {
        columns: ["DrugArmScreenID", "ControlArmScreenID"],
      })
      .then(setMetadata);
  }, []);

  return metadata as AnchorPlotMetadata | null;
}

export default useMetadata;
