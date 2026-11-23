import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { ReleaseFile, ReleaseVersion } from "@depmap/types";

export const ALL_TAGS_OPTION = "";

function stripHtml(html: string): string {
  if (!html) return "";
  const parsedDocument = new DOMParser().parseFromString(html, "text/html");
  return parsedDocument.body.textContent ?? "";
}

export function matchesFileFilters(
  file: ReleaseFile,
  selectedTag: string,
  normalizedQuery: string
): boolean {
  const matchesTag =
    selectedTag === ALL_TAGS_OPTION ||
    Boolean(file.tags?.includes(selectedTag));

  if (!matchesTag) return false;
  if (!normalizedQuery) return true;

  const matchesFilename = file.file_name
    ?.toLowerCase()
    .includes(normalizedQuery);

  const plainDescription = file.description ? stripHtml(file.description) : "";
  const matchesDescription = plainDescription
    .toLowerCase()
    .includes(normalizedQuery);

  return Boolean(matchesFilename || matchesDescription);
}

export function useVersionFiles(version: ReleaseVersion) {
  const bapi = cached(breadboxAPI);
  const hasProvidedFiles = Boolean(version.files && version.files.length > 0);

  const [files, setFiles] = useState<ReleaseFile[]>(() => version.files ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!hasProvidedFiles);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (version.files && version.files.length > 0) {
      setFiles(version.files);
      setIsLoading(false);
      return;
    }

    async function loadVersionFiles() {
      if (!version.id) {
        setErrorMessage("Missing release version identifier.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const fullVersion = await bapi.getReleaseVersion(version.id, true);

        setFiles(fullVersion.files ?? []);
      } catch (error) {
        console.error("Failed to load files for release version:", error);
        setErrorMessage("Unable to load files for this release version.");
      } finally {
        setIsLoading(false);
      }
    }

    loadVersionFiles();
  }, [bapi, version]);

  return { files, isLoading, errorMessage };
}
