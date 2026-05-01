import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ReleaseFile } from "@depmap/types";

function useReleaseFileData(versionId: string) {
  const [files, setFiles] = useState<ReleaseFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const bapi = cached(breadboxAPI);

        const data = await bapi.getReleaseVersion(versionId, {
          include_files: true,
        });
        setFiles(data?.files || []);
        setError(null);
      } catch (e) {
        console.error(`Error fetching files for version ${versionId}:`, e);
        setError(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [versionId]);

  return { files, isLoading, error };
}

export default useReleaseFileData;
