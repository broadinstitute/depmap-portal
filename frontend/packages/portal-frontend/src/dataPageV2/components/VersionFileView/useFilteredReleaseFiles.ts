import { useEffect, useMemo, useState } from "react";
import { ReleaseFile } from "@depmap/types";
import { ALL_TAGS_OPTION, matchesFileFilters } from "./useVersionFiles";

export interface TagTab {
  value: string;
  label: string;
  count: number;
}

export function useFilteredReleaseFiles(files: ReleaseFile[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>(ALL_TAGS_OPTION);

  const tagTabs = useMemo<TagTab[]>(() => {
    const counts = new Map<string, number>();

    files.forEach((file) => {
      const uniqueTypes = new Set(
        (file.tags ?? []).filter((dt): dt is string => Boolean(dt))
      );
      uniqueTypes.forEach((dt) => counts.set(dt, (counts.get(dt) ?? 0) + 1));
    });

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [files]);

  // Reset active tab if the selected tag doesn't exist in the current file set
  useEffect(() => {
    const isValidSelection =
      selectedTag === ALL_TAGS_OPTION ||
      tagTabs.some((tab) => tab.value === selectedTag);

    if (!isValidSelection) {
      setSelectedTag(ALL_TAGS_OPTION);
    }
  }, [tagTabs, selectedTag]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return files.filter((file) =>
      matchesFileFilters(file, selectedTag, normalizedQuery)
    );
  }, [files, selectedTag, searchQuery]);

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
    searchQuery.trim().length > 0 || selectedTag !== ALL_TAGS_OPTION;

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTag(ALL_TAGS_OPTION);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    tagTabs,
    filteredFiles,
    primaryFiles,
    secondaryFiles,
    hasActiveFilters,
    resetFilters,
  };
}
