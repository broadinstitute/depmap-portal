import { useState, useEffect } from "react";
import { legacyPortalAPI } from "@depmap/api";
import { DataAvailability } from "@depmap/types";

function useDataAvailability() {
  const [data, setData] = useState<DataAvailability | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await legacyPortalAPI.getDataPageDataAvailability();

        setData(result);
      } catch (e) {
        console.error("Error fetching data availability:", e);
        setError(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return { data, isLoading, error };
}

export default useDataAvailability;
