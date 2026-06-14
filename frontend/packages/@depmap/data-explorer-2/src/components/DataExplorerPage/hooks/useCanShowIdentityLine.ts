import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { MatrixDataset } from "@depmap/types";

export default function useCanShowIdentityLine(
  xDatasetId: string | null | undefined,
  yDatasetId: string | null | undefined
) {
  const [datasets, setDatasets] = useState<MatrixDataset[]>([]);

  useEffect(() => {
    cached(breadboxAPI)
      .getDatasets()
      .then((allDatasets) => {
        const matrixDatasets = allDatasets.filter(
          (d) => d.format === "matrix_dataset"
        ) as MatrixDataset[];

        setDatasets(matrixDatasets);
      });
  }, []);

  const xUnits = datasets.find(
    (d) => d.id === xDatasetId || d.given_id === xDatasetId
  )?.units;

  const yUnits = datasets.find(
    (d) => d.id === yDatasetId || d.given_id === yDatasetId
  )?.units;

  if (!xDatasetId || !yDatasetId || !xUnits || !yUnits) {
    return false;
  }

  if (xDatasetId === yDatasetId) {
    return true;
  }

  if (xUnits === "unitless" || yUnits === "unitless") {
    return false;
  }

  return xUnits === yUnits;
}
