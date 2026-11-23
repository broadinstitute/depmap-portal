import { useEffect, useMemo, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { GetReleaseVersionsParams, ReleaseVersion } from "@depmap/types";

interface Option {
  value: string;
  label: string;
}

export type DateRangePreset = "" | "6M" | "12M" | "24M";

export const DATE_RANGE_OPTIONS: Option[] = [
  { value: "6M", label: "Last 6 months" },
  { value: "12M", label: "Last 12 months" },
  { value: "24M", label: "Last 24 months" },
];

const MONTHS_BY_PRESET: Record<Exclude<DateRangePreset, "">, number> = {
  "6M": 6,
  "12M": 12,
  "24M": 24,
};

type BreadboxApi = typeof breadboxAPI;

function formatDateAsISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDateRangeParams(
  dateRange: DateRangePreset,
  defaultStartDate?: string,
  defaultEndDate?: string
): Pick<GetReleaseVersionsParams, "start_date" | "end_date"> {
  if (dateRange === "") {
    return {
      ...(defaultStartDate ? { start_date: defaultStartDate } : {}),
      ...(defaultEndDate ? { end_date: defaultEndDate } : {}),
    };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_BY_PRESET[dateRange]);

  return {
    start_date: formatDateAsISO(startDate),
    end_date: formatDateAsISO(endDate),
  };
}

/**
 * Isolated helper for retrieving all distinct file-level tag strings.
 * Currently derives them from releases with files included; once a dedicated
 * file-tags endpoint exists, replace only the body of this function.
 */
const fetchFileTags = async (bapi: BreadboxApi): Promise<string[]> => {
  const releasesWithFiles = await bapi.getReleaseVersions({
    include_files: true,
  });

  // TEMP: This nested loop will not be needed once bapi.getReleaseVersionsTagss is available
  const types = new Set<string>();
  releasesWithFiles.forEach((version) => {
    version.files?.forEach((file) => {
      file.tags?.forEach((tag) => {
        if (tag) {
          types.add(tag);
        }
      });
    });
  });

  return Array.from(types).sort();
};

const useReleaseVersions = (initialParams: GetReleaseVersionsParams = {}) => {
  const { include_files, start_date, end_date } = initialParams;

  const bapi = cached(breadboxAPI);

  const [releases, setReleases] = useState<ReleaseVersion[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const [tag, setTag] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRangePreset>("");

  // Fetch all available tags once on mount
  useEffect(() => {
    (async () => {
      try {
        const tags = await fetchFileTags(bapi);
        setAvailableTags(tags);
      } catch (err) {
        console.error("Failed to load file tags:", err);
      }
    })();
  }, [bapi]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const hasSpecificTag = Boolean(tag) && tag !== "";

        const params: GetReleaseVersionsParams = {
          ...(include_files !== undefined ? { include_files } : {}),
          ...getDateRangeParams(dateRange, start_date, end_date),
          ...(hasSpecificTag ? { tag } : {}),
        };

        const releasesData = await bapi.getReleaseVersions(params);
        setReleases(releasesData);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to load releases")
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [bapi, include_files, start_date, end_date, tag, dateRange]);

  const tagOptions = useMemo<Option[]>(() => {
    return availableTags.map((type) => ({ value: type, label: type }));
  }, [availableTags]);

  return {
    allReleaseVersions: releases,
    tagOptions,
    dateRangeOptions: DATE_RANGE_OPTIONS,
    isLoading,
    error,
    filters: {
      tag,
      setTag,
      dateRange,
      setDateRange,
    },
  };
};

export default useReleaseVersions;
