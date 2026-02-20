import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";

export interface ScreenPairMetadata {
  label: Record<string, string>;
  ComparisonType: Record<string, string>;
  TestArmScreenID: Record<string, string>;
  CtrlArmScreenID: Record<string, string>;
}

function useMetadata() {
  const [metadata, setMetadata] = useState<unknown>(null);

  useEffect(() => {
    breadboxAPI
      .getTabularDatasetData("screen_pair_metadata", {
        columns: [
          "label",
          "ComparisonType",
          "TestArmScreenID",
          "CtrlArmScreenID",
        ],
      })
      .then(setMetadata);
  }, []);

  return metadata as ScreenPairMetadata | null;
}

export default useMetadata;
