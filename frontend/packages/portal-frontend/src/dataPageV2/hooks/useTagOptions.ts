import { useCallback, useMemo, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ReleaseVersion } from "@depmap/types";

interface Option {
  value: string;
  label: string;
}

/**
 * Lazily fetches and formats unique file-level `tags` values for the filter dropdown.
 *
 * TODO in Breadbox: Replace `getReleaseVersions({ include_files: true })` once Breadbox
 * has a dedicated endpoint for distinct file tags. Until then, fetching is
 * deferred until the user opens the dropdown (`onMenuOpen`).
 */
export const useTagOptions = () => {
  const bapi = useMemo(() => cached(breadboxAPI), []);
  const [options, setOptions] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadOptions = useCallback(async () => {
    if (hasLoaded || isLoading) return;

    try {
      setIsLoading(true);
      const versions: ReleaseVersion[] = await bapi.getReleaseVersions({
        include_files: true,
      });

      const uniqueTypes = new Set<string>();
      versions.forEach((version) => {
        version.files?.forEach((file) => {
          file.tags?.forEach((tag) => {
            if (tag) {
              uniqueTypes.add(tag);
            }
          });
        });
      });

      setOptions(
        Array.from(uniqueTypes)
          .sort()
          .map((type) => ({ value: type, label: type }))
      );
      setHasLoaded(true);
    } catch (err) {
      console.error("Failed to fetch tag filter options:", err);
    } finally {
      setIsLoading(false);
    }
  }, [bapi, hasLoaded, isLoading]);

  return { options, isLoading, loadOptions };
};
