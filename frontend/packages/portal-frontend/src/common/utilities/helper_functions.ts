/* eslint-disable */
import { Release, DownloadFile } from "@depmap/data-slicer";

export function sentenceCase(str: string, preserveExistingUpperCases = false) {
  if (preserveExistingUpperCases) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  return str.toLowerCase().charAt(0).toUpperCase() + str.toLowerCase().slice(1);
}

export function getReleaseForFile(
  releaseData: Array<Release>,
  file: DownloadFile
): Release {
  const out = releaseData.find(
    (release) => release.releaseName == file.releaseName
  );

  if (!out) {
    throw new Error(`Could not find release for file "${file.fileName}"`);
  }

  return out;
}

export function getReleaseGroupFromSelection(
  releases: Release[],
  selectedOption: string // Could be a release name OR a releaseVersionGroup name
): string {
  // First check if the selectedOption is a valid releaseGroupName. A valid releaseGroupName is one that is
  // available for selection in the top left dropdown of AllDownloads.tsx (aka the File Downloads page).
  let validReleaseGroup = releases.find(
    (release) =>
      release.releaseVersionGroup == selectedOption ||
      release.releaseGroup == selectedOption
  );

  // Some older releases have been grouped together so that there are multiple release names per release group.
  // As a result, we need to match selectedOption to releaseName, and then return the releaseGroup.
  if (!validReleaseGroup) {
    let validRelease = releases.find(
      (release) =>
        release.releaseVersionGroup == selectedOption ||
        release.releaseName == selectedOption
    );

    validReleaseGroup = validRelease;
  }

  if (validReleaseGroup) {
    return validReleaseGroup.releaseGroup;
  } else {
    return "";
  }
}

export function areVersionsValidReleases(
  versions: string[],
  releaseData: Release[]
): boolean {
  let isValidRelease = false;
  versions.forEach((version) => {
    isValidRelease = getReleaseByReleaseName(version, releaseData) != null;
  });

  return isValidRelease;
}

export function getReleaseByReleaseName(
  releaseName: string,
  releaseData: Array<Release>
): Release | null {
  if (!releaseData) {
    return null;
  }

  let result = releaseData.find(
    (release) => release.releaseName == releaseName
  );

  // Old releases need to be matched on releaseGroup rather than releaseName
  if (!result) {
    result = releaseData.find((release) => release.releaseGroup == releaseName);
  }

  return result || null;
}

export function getReleaseDescriptionByName(
  releaseName: string,
  releaseData: Array<Release>
): string {
  let release = getReleaseByReleaseName(releaseName, releaseData);

  // Grab the first paragraph of release description
  let description = "";
  if (release) {
    const regex = /<p>(.*?)<\/p>/;
    const corresp = regex.exec(release.description);
    description = corresp ? corresp[0] : "";
    if (description == "") {
      description = release.description;
    }
  }
  if (release) {
    return release.description;
  }

  return "";
}

export function arraysShallowlyEqual<T>(arr1: Array<T>, arr2: Array<T>) {
  if (!arr1 || !arr2) {
    // If either of the arrays are null or undefined
    return false;
  }

  if (!(arr1.length == arr2.length)) {
    return false;
  }

  for (let i = 0, l = arr1.length; i < l; i++) {
    if (arr1[i] != arr2[i]) {
      return false;
    }
  }
  return true;
}
