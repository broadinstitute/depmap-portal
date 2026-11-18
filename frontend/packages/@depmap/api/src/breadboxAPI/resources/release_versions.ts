import { ReleaseVersion, GetReleaseVersionsParams } from "@depmap/types";
import { getJson } from "../client";

export function getReleaseVersions(
  params: GetReleaseVersionsParams = {}
): Promise<ReleaseVersion[]> {
  return getJson<ReleaseVersion[]>("/release-versions/", { ...params });
}
