import { useEffect, useState } from "react";
import { TDASummaryTable } from "src/tda/models/types";
import { getDapi } from "src/common/utilities/context";

export default function useTargetDiscoveryData() {
  const [data, setData] = useState<TDASummaryTable | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const dapi = getDapi();
        const nextData = await dapi.getTDASummaryTable();
        setData(nextData);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, [setData]);

  return { data, error };
}
