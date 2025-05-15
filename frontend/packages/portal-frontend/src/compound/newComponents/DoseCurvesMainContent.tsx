import { ApiContext } from "@depmap/api";
import React, { useContext, useEffect, useState } from "react";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { CompoundDataset } from "../components/DoseResponseTab";

interface DoseCurvesMainContentProps {
  datasetOptions: CompoundDataset;
  doseUnits: string;
}

function DoseCurvesTab({
  datasetOptions,
  doseUnits,
}: DoseCurvesMainContentProps) {
  const { getApi } = useContext(ApiContext);

  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const plot = await getApi();
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, []);

  return <></>;
}

export default DoseCurvesTab;
