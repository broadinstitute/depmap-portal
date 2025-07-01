import { useEffect, useState } from "react";
import { legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";

type TDASummaryTable = LegacyPortalApiResponse["getTDASummaryTable"];

export default function useTargetDiscoveryData() {
  const [data, setData] = useState<TDASummaryTable | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const nextData = await legacyPortalAPI.getTDASummaryTable();
        setData(nextData);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, [setData]);

  return { data, error };
}
