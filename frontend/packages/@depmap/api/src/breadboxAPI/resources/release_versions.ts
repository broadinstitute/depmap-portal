import { ReleaseVersion, GetReleaseVersionsParams } from "@depmap/types";
import { getJson } from "../client";
import { GetReleaseVersionParams } from "@depmap/types/src/ReleaseVersion";

export function getReleaseVersions(
  params: GetReleaseVersionsParams = {}
): Promise<ReleaseVersion[]> {
  return getJson<ReleaseVersion[]>("/release-versions/", { ...params });
}

export function getReleaseVersion(
  releaseVersionId: string,
  includeFiles: boolean
): Promise<ReleaseVersion> {
  const params: GetReleaseVersionParams = { include_files: includeFiles };
  return getJson<ReleaseVersion>(
    `/release-versions/${encodeURIComponent(releaseVersionId)}`,
    { ...params }
  );
}
