import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ReleaseVersion } from "@depmap/types";
import useReleaseVersions from "src/dataPageV2/hooks/useReleaseVersions";
import { useReleaseVersionsUrlSync } from "src/dataPageV2/hooks/useReleaseVersionsUrlSync";

interface ReleaseVersionsContextValue {
  groupedReleases: Record<string, ReleaseVersion[]>;
  isLoading: boolean;
  error: Error | null;
  filters: ReturnType<typeof useReleaseVersions>["filters"];
  dateRangeOptions: ReturnType<typeof useReleaseVersions>["dateRangeOptions"];
  selectedVersion: ReleaseVersion | null;
  setSelectedVersion: (version: ReleaseVersion | null) => void;
}

interface ReleaseVersionsProviderProps {
  children: React.ReactNode;
  // When true, syncs active filters and selected version with URL query params.
  syncWithUrl?: boolean;
}

const ReleaseVersionsContext = createContext<ReleaseVersionsContextValue | null>(
  null
);

export const ReleaseVersionsProvider: React.FC<ReleaseVersionsProviderProps> = ({
  children,
  syncWithUrl = false,
}) => {
  const {
    allReleaseVersions: releases,
    dateRangeOptions,
    isLoading,
    error,
    filters,
  } = useReleaseVersions();

  const [
    selectedVersion,
    setSelectedVersionState,
  ] = useState<ReleaseVersion | null>(null);

  const { pushVersionToUrl } = useReleaseVersionsUrlSync({
    enabled: syncWithUrl,
    releases,
    tag: filters.tag,
    setTag: filters.setTag,
    dateRange: filters.dateRange,
    setDateRange: filters.setDateRange,
    selectedVersion,
    setSelectedVersionState,
  });

  const setSelectedVersion = useCallback(
    (version: ReleaseVersion | null) => {
      setSelectedVersionState(version);
      pushVersionToUrl(version);
    },
    [pushVersionToUrl]
  );

  const groupedReleases = useMemo(() => {
    return releases.reduce<Record<string, ReleaseVersion[]>>((acc, version) => {
      (acc[version.release_name] ??= []).push(version);
      return acc;
    }, {});
  }, [releases]);

  const value = useMemo(
    () => ({
      groupedReleases,
      isLoading,
      error,
      filters,
      dateRangeOptions,
      selectedVersion,
      setSelectedVersion,
    }),
    [
      groupedReleases,
      isLoading,
      error,
      filters,
      dateRangeOptions,
      selectedVersion,
      setSelectedVersion,
    ]
  );

  return (
    <ReleaseVersionsContext.Provider value={value}>
      {children}
    </ReleaseVersionsContext.Provider>
  );
};

export const useReleaseVersionsContext = () => {
  const ctx = useContext(ReleaseVersionsContext);
  if (!ctx) {
    throw new Error(
      "useReleaseVersionsContext must be used within a ReleaseVersionsProvider"
    );
  }
  return ctx;
};
