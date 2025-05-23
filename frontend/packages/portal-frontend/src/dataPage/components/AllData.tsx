import React, { useEffect, useMemo, useState } from "react";
import {
  DownloadFile,
  DownloadTableData,
  Release,
  ReleaseType,
} from "@depmap/data-slicer";
import {
  deleteSpecificQueryParams,
  setQueryStringsWithoutPageReload,
} from "@depmap/utils";
import { DropdownButton, MenuItem } from "react-bootstrap";
import {
  areVersionsValidReleases,
  getReleaseByReleaseName,
} from "src/common/utilities/helper_functions";
import { formatReleaseGroupByType } from "../utils";
import useReleaseNameAndVersionSelectionHandlers, {
  useReleaseModalAndSelectFileHandlers,
} from "../hooks/useAllDataHandlers";
import styles from "src/dataPage/styles/DataPage.scss";
import DataFilePanel from "./DataFilePanel";
import { ReleaseCardModal } from "./ReleaseCardModal";
import { TypeGroupOption } from "../models/types";

interface AllDataProps {
  downloadTable: DownloadTableData;
  releaseData: Release[];
  releaseTypes: ReleaseType[];
  fileTypes: string[];
  sources: string[];
  dataUsageUrl: string;
  termsDefinitions: { [key: string]: string };
}
export const AllData = ({
  downloadTable,
  releaseData,
  releaseTypes,
  termsDefinitions,
  fileTypes,
  sources,
  dataUsageUrl,
}: AllDataProps) => {
  const [releaseModalShown, setReleaseModalShown] = useState<boolean>(false);

  const [
    urlOrGlobalSearchSelectedFile,
    setUrlOrGlobalSearchSelectedFile,
  ] = useState<DownloadFile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState<boolean>(
    false
  );

  const releaseGroups = useMemo(() => {
    return releaseData.map((release: any) => {
      return {
        group: release.releaseGroup,
        versionGroup: release.releaseVersionGroup,
      };
    });
  }, [releaseData]);

  const topReleaseGroup = useMemo(() => {
    return releaseGroups.slice(0, 1)[0];
  }, [releaseGroups]);

  const releaseGroupByType = useMemo(() => {
    return formatReleaseGroupByType(releaseData, releaseTypes);
  }, [releaseData, releaseTypes]);

  const topReleaseGroupVersions = useMemo(() => {
    return topReleaseGroup && topReleaseGroup.versionGroup
      ? releaseData
          .filter(
            (release: Release) =>
              release.releaseVersionGroup === topReleaseGroup.versionGroup
          )
          .map((release: Release) => release.releaseGroup)
      : null;
  }, [releaseData, topReleaseGroup]);

  const dropdownSelectorOptions = useMemo(() => {
    return {
      fileTypes,
      releaseGroupByType,
      sources,
    };
  }, [fileTypes, releaseGroupByType, sources]);

  const [dropdownSelector, setDropdownSelector] = useState<{
    fileType: {
      selected: Set<string>;
    };
    releaseName: {
      selected: Set<string>;
    };
    source: {
      selected: Set<string>;
    };
    selection: TypeGroupOption[];
  }>({
    fileType: {
      selected: new Set(fileTypes),
    },
    releaseName: {
      selected: new Set([topReleaseGroup.group]),
    },
    source: {
      selected: new Set([]),
    },
    selection: [
      {
        name: topReleaseGroup.versionGroup ?? topReleaseGroup.group,
        versions: topReleaseGroupVersions ?? [],
      },
    ],
  });

  const versionSelectorOptions = useMemo(() => {
    return {
      fileTypes,
      releaseGroupVersions: topReleaseGroupVersions ?? [],
      sources,
    };
  }, [fileTypes, topReleaseGroupVersions, sources]);

  const [versionSelector, setVersionSelector] = useState<{
    versionGroup: {
      options: Set<string>;
    };
    selection: string[];
  }>({
    versionGroup: {
      options: new Set([topReleaseGroup.group] ?? []),
    },
    selection: [topReleaseGroup.group] ?? [],
  });

  // Hack to make the accordion isOpen state update on file search and exit. This is necessary due to
  // a problematic Accordion.tsx component that will eventually be replace. This component is problematic
  // because it's trying to be controlled (isOpen prop controls its state) and uncontrolled at the same
  // time (has its own isOpen state that it toggles internally without notifying its parent).
  const [keySuffix, setKeySuffix] = useState(0);
  const forceUpdate = () => setKeySuffix((n) => n + 1);

  const {
    handleDropdownSelectionChange,
    handleSelectDropdown,
    handleSelectVersion,
  } = useReleaseNameAndVersionSelectionHandlers(
    releaseData,
    setReleaseModalShown,
    setVersionSelector,
    setDropdownSelector,
    setUrlOrGlobalSearchSelectedFile,
    urlOrGlobalSearchSelectedFile,
    dropdownSelector,
    versionSelector
  );

  const {
    handleReleaseFileNameUrls,
    handleToggleReleaseModal,
  } = useReleaseModalAndSelectFileHandlers(
    downloadTable,
    releaseData,
    releaseModalShown,
    handleDropdownSelectionChange,
    setUrlOrGlobalSearchSelectedFile,
    setReleaseModalShown,
    forceUpdate
  );

  useEffect(() => {
    if (releaseData.length > 0) {
      handleReleaseFileNameUrls();
    }
  }, [releaseData, handleReleaseFileNameUrls]);

  useEffect(() => {
    const releaseFileNameParams: [string, string][] | null =
      urlOrGlobalSearchSelectedFile?.releaseName !== undefined
        ? [
            ["releasename", urlOrGlobalSearchSelectedFile?.releaseName],
            ["filename", urlOrGlobalSearchSelectedFile.fileName],
          ]
        : null;

    if (releaseFileNameParams) {
      setQueryStringsWithoutPageReload(releaseFileNameParams);
    } else {
      deleteSpecificQueryParams(["releasename", "release", "filename", "file"]);
    }
  }, [urlOrGlobalSearchSelectedFile]);

  const groups: { [key: string]: any } = {};
  const releaseDataGroupedByReleaseName = downloadTable.reduce(
    (group, option) => {
      groups[option.releaseName] = group[option.releaseName] || [];
      groups[option.releaseName].push(option);
      return groups;
    },
    Object.create(null)
  );

  return (
    <div className={styles.AllDataTab}>
      <div className={styles.allDataTabHeader}>
        <div className={styles.allDataFileSearchSection}>
          <p style={{ marginBottom: "0px" }}>
            By default the latest DepMap data release of CRISPR and genomics
            data is shown.
          </p>
        </div>
        <p className={styles.selectFileSetLabel}>Select a file set to view:</p>
        <div className={styles.fileVersionSelectorContainer}>
          {dropdownSelectorOptions && (
            <div style={{ paddingLeft: "80px" }}>
              <DropdownButton
                bsStyle="default"
                title={dropdownSelector.selection[0].name}
                id="all-data"
                onToggle={() => setDropdownOpen(!dropdownOpen)}
                open={dropdownOpen}
              >
                {dropdownSelectorOptions.releaseGroupByType.map((group) => (
                  <React.Fragment key={group.name + group.options.toString()}>
                    {group.options.length > 0 ? (
                      <>
                        <MenuItem
                          header
                          className="all-data-dropdown-menu"
                          eventKey={group.name}
                          key={group.name}
                          disabled
                        >
                          {group.name}
                        </MenuItem>
                        {group.options.map((option) =>
                          (
                            option.versions
                              ? areVersionsValidReleases(
                                  option.versions,
                                  releaseData
                                )
                              : getReleaseByReleaseName(
                                  option.name,
                                  releaseData
                                )
                          ) ? (
                            <MenuItem
                              eventKey={{
                                releaseNameOrVersionGroupName: option.name,
                                versions: option.versions,
                                group,
                              }}
                              key={option.name}
                              onSelect={handleSelectDropdown}
                              onClick={() => setDropdownOpen(!dropdownOpen)}
                              active={
                                option.name ===
                                dropdownSelector.selection[0].name
                              }
                            >
                              {option.name}
                            </MenuItem>
                          ) : null
                        )}
                        <MenuItem divider />
                      </>
                    ) : null}
                  </React.Fragment>
                ))}
              </DropdownButton>
            </div>
          )}
          {versionSelector &&
            versionSelectorOptions &&
            dropdownSelector.selection[0].versions &&
            dropdownSelector.selection[0].versions.length > 0 && (
              <div className={styles.versionSelector}>
                <span className={styles.versionSelectorLabel}>Version:</span>
                <DropdownButton
                  bsStyle="default"
                  title={versionSelector.selection}
                  id="all-data-version-selector"
                  onToggle={() => setVersionDropdownOpen(!versionDropdownOpen)}
                  open={versionDropdownOpen}
                >
                  {dropdownSelector.selection[0].versions!.map((option) =>
                    getReleaseByReleaseName(option, releaseData) ? (
                      <MenuItem
                        eventKey={{
                          version: option,
                        }}
                        key={option}
                        onSelect={handleSelectVersion}
                        onClick={() =>
                          setVersionDropdownOpen(!versionDropdownOpen)
                        }
                        active={option === versionSelector.selection[0]}
                      >
                        {option}
                      </MenuItem>
                    ) : null
                  )}
                </DropdownButton>
              </div>
            )}
        </div>
      </div>
      {releaseModalShown && (
        <ReleaseCardModal
          termsDefinitions={termsDefinitions}
          dataUsageUrl={dataUsageUrl as string}
          file={
            {
              releaseName: null,
              fileName: null,
              fileDescription: null,
              isMainFile: false,
              retractionOverride: null,
              downloadUrl: null,
              sources: null,
              taigaUrl: null,
              terms: null,
              fileType: null,
              size: null,
            } as any
          }
          release={getReleaseByReleaseName(
            versionSelector?.selection[0] ?? dropdownSelector.selection[0].name,
            releaseData
          )}
          show={releaseModalShown}
          toggleShowReleaseModalHandler={handleToggleReleaseModal}
        />
      )}
      {dropdownSelector.selection &&
        dropdownSelector.selection.length > 0 &&
        dropdownSelector.selection[0].name && (
          <>
            <div className={styles.allDataFilePanel}>
              <h2>
                {versionSelector.selection[0] ??
                  dropdownSelector.selection[0].name}{" "}
                Files
              </h2>
              <button
                type="button"
                className={styles.linkButton}
                onClick={(event) => {
                  handleToggleReleaseModal();
                  event.preventDefault();
                }}
              >
                View full release details
              </button>
              <div
                className={styles.releaseDescription}
                dangerouslySetInnerHTML={{
                  __html:
                    getReleaseByReleaseName(
                      versionSelector?.selection[0] ??
                        dropdownSelector.selection[0].name,
                      releaseData
                    )?.description ?? "",
                }}
              />
              <div className={styles.dataFilePanelContainer}>
                <DataFilePanel
                  data={
                    releaseDataGroupedByReleaseName[
                      versionSelector?.selection[0] ??
                        dropdownSelector.selection[0].name
                    ]
                  }
                  release={
                    getReleaseByReleaseName(
                      versionSelector?.selection[0] ??
                        dropdownSelector.selection[0].name,
                      releaseData
                    )!
                  }
                  termsDefinitions={termsDefinitions}
                  urlOrGlobalSearchSelectedFile={urlOrGlobalSearchSelectedFile}
                  keySuffix={keySuffix}
                />
              </div>
            </div>
          </>
        )}
    </div>
  );
};

export default AllData;
