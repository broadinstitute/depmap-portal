import { ReleaseVersion } from "@depmap/types";
import { getJson } from "../client";

/**
 * Get all release versions with options to filter by name, datatype, and dates.
 */
export function getReleaseVersions(
  params?: Partial<{
    release_name: string;
    datatype: string;
    start_date: string;
    end_date: string;
    include_files: boolean;
  }>
) {
  return getJson<ReleaseVersion[]>("/releases/", params);
}

/**
 * Get a single release by its ID.
 */
export function getReleaseVersion(
  release_version_id: string,
  params?: Partial<{
    include_files: boolean;
  }>
) {
  return getJson<ReleaseVersion>(`/releases/${release_version_id}`, params);
}
