import { breadboxAPI, cached } from "@depmap/api";
import { useEffect, useState } from "react";
import { ReleaseVersion } from "@depmap/types";

function useReleaseVersions() {
  const bapi = cached(breadboxAPI);

  // 1. Data and Status State
  const [releases, setReleases] = useState<ReleaseVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // 2. Filter State
  const [datatype, setDatatype] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await bapi.getReleaseVersions({
          datatype: datatype || undefined,
          start_date: dateRange.start || undefined,
          end_date: dateRange.end || undefined,
          include_files: false,
        });

        setReleases(data);
      } catch (e) {
        console.error("Error fetching release versions:", e);
        setError(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [datatype, dateRange, bapi]);

  return {
    releases,
    isLoading,
    error,
    filters: {
      datatype,
      setDatatype,
      dateRange,
      setDateRange,
    },
  };
}

export default useReleaseVersions;
