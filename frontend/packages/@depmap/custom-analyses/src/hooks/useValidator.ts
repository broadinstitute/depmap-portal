import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { AnalysisConfiguration } from "../types/AnalysisConfiguration";

function useValidator(analysis: Partial<AnalysisConfiguration>) {
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    (async () => {
      setIsValidated(false);
      let isDatasetIdValid = false;
      let isSliceValid = false;

      if (analysis.datasetId) {
        try {
          await cached(breadboxAPI).getDataset(analysis.datasetId);
          isDatasetIdValid = true;
        } catch (e) {
          isDatasetIdValid = false;
        }
      }

      if (analysis.kind === "pearson_correlation") {
        if (analysis.sliceQuery) {
          try {
            await cached(breadboxAPI).getDimensionData(analysis.sliceQuery);
            isSliceValid = true;
          } catch (e) {
            isSliceValid = false;
          }
        }
      }

      if (analysis.kind === "pearson_correlation") {
        setIsValidated(isDatasetIdValid && isSliceValid);
      } else {
        setIsValidated(isDatasetIdValid);
      }
    })();
  }, [analysis]);

  return isValidated;
}

export default useValidator;
