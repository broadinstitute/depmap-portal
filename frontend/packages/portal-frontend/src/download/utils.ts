import { Release, ReleaseType } from "@depmap/data-slicer";
import { TypeGroupOption } from "./components/CheckboxPanel";

export const formatReleaseGroupByType = (
  releaseData: Release[],
  releaseTypes: ReleaseType[]
) => {
  const unordered: { [key: string]: TypeGroupOption[] } = {};
  releaseData.forEach((release: Release) => {
    // Step 1 ---> For each release, add to a list of TypeGroupOption. Don't worry about having repeat releaseVersionGroupNames,
    // such as multiple {name: "DepMap Public", versions: [<some_version_name>]}. We'll combine those in the next step.
    const type = release.releaseType;
    if (type in unordered) {
      if (
        release.releaseVersionGroup &&
        !unordered[type].includes({
          name: release.releaseVersionGroup,
          versions: [release.releaseName],
        })
      ) {
        unordered[type].push({
          name: release.releaseVersionGroup,
          versions: [release.releaseName],
        });
      } else if (
        !release.releaseVersionGroup &&
        !unordered[type].includes({
          name: release.releaseName,
        })
      ) {
        unordered[type].push({ name: release.releaseName });
      }
    } else {
      unordered[type] = release.releaseVersionGroup
        ? [
            {
              name: release.releaseVersionGroup,
              versions: [release.releaseName],
            },
          ]
        : [{ name: release.releaseName }];
    }
  });

  // Step 2 ---> Order the unordered list by releaseType and flatten Versions so that
  // all versions with the same "name" value appear in the same dictionary.
  // Example: [{name: "DepMap Public", versions: ["DepMap Public 23Q2"]},
  // {name: "DepMap Public", versions: ["DepMap Public 23Q4"]}] becomes
  // [{name: "DepMap Public", versions: ["DepMap Public 23Q2", "DepMap Public 23Q4"]}]
  const formatOptions = (options: TypeGroupOption[]) => {
    // Group by name
    const groups: { [key: string]: any } = {};
    const groupedOptions: {
      [key: string]: TypeGroupOption[];
    } = options.reduce((group, option) => {
      groups[option.name] = group[option.name] || [];
      groups[option.name].push(option);
      return groups;
    }, Object.create(null));

    const result = Object.keys(groupedOptions).map(
      (releaseVersionGroupName) => {
        if (
          groupedOptions[releaseVersionGroupName].length === 1 &&
          !groupedOptions[releaseVersionGroupName][0].versions
        ) {
          return groupedOptions[releaseVersionGroupName][0];
        }

        const flattenedVersions = groupedOptions[
          releaseVersionGroupName
        ].flatMap((option) => option.versions as string[]);

        return {
          name: groupedOptions[releaseVersionGroupName][0].name,
          versions: flattenedVersions,
        };
      }
    );

    return result;
  };

  const ordered = releaseTypes.map((releaseType) => {
    return {
      name: releaseType,
      options:
        releaseType in unordered ? formatOptions(unordered[releaseType]) : [],
    };
  });
  return ordered;
};

export const findReleaseVersionGroupName = (
  releaseData: Release[],
  releaseName: string
) => {
  return releaseData
    .filter((release: Release) => release.releaseGroup === releaseName)
    .map((release: Release) => release.releaseVersionGroup)[0];
};

export const findReleaseVersions = (
  releaseData: Release[],
  releaseVersionGroupName: string
) => {
  return releaseData
    .filter(
      (release: Release) =>
        release.releaseVersionGroup === releaseVersionGroupName
    )
    .map((release: Release) => release.releaseGroup);
};
