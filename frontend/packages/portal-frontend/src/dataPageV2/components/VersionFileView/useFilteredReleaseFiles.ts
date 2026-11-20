import { useEffect, useMemo, useState } from "react";
import { ReleaseFile } from "@depmap/types";
import { ALL_DATATYPES_OPTION, matchesFileFilters } from "./useVersionFiles";

export interface DatatypeTab {
  value: string;
  label: string;
  count: number;
}

export function useFilteredReleaseFiles(files: ReleaseFile[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDatatype, setSelectedDatatype] = useState<string>(
    ALL_DATATYPES_OPTION
  );

  const datatypeTabs = useMemo<DatatypeTab[]>(() => {
    const counts = new Map<string, number>();

    files.forEach((file) => {
      const uniqueTypes = new Set(
        (file.datatypes ?? []).filter((dt): dt is string => Boolean(dt))
      );
      uniqueTypes.forEach((dt) => counts.set(dt, (counts.get(dt) ?? 0) + 1));
    });

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [files]);

  // Reset active tab if the selected datatype doesn't exist in the current file set
  useEffect(() => {
    const isValidSelection =
      selectedDatatype === ALL_DATATYPES_OPTION ||
      datatypeTabs.some((tab) => tab.value === selectedDatatype);

    if (!isValidSelection) {
      setSelectedDatatype(ALL_DATATYPES_OPTION);
    }
  }, [datatypeTabs, selectedDatatype]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return files.filter((file) =>
      matchesFileFilters(file, selectedDatatype, normalizedQuery)
    );
  }, [files, selectedDatatype, searchQuery]);

  const { primaryFiles, secondaryFiles } = useMemo(() => {
    const primary: ReleaseFile[] = [];
    const secondary: ReleaseFile[] = [];

    filteredFiles.forEach((file) => {
      if (file.is_main_file) {
        primary.push(file);
      } else {
        secondary.push(file);
      }
    });

    return { primaryFiles: primary, secondaryFiles: secondary };
  }, [filteredFiles]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedDatatype !== ALL_DATATYPES_OPTION;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedDatatype(ALL_DATATYPES_OPTION);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedDatatype,
    setSelectedDatatype,
    datatypeTabs,
    filteredFiles,
    primaryFiles,
    secondaryFiles,
    hasActiveFilters,
    resetFilters,
  };
}
