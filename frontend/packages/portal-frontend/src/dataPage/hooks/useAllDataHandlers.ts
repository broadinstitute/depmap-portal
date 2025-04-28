import { DownloadFile, DownloadTableData, Release } from "@depmap/data-slicer";
import { deleteQueryParams } from "@depmap/utils";
import qs from "qs";
import { useCallback } from "react";
import { getReleaseGroupFromSelection } from "src/common/utilities/helper_functions";
import { FileSearchOption } from "../components/FileSearch";
import { findReleaseVersionGroupName, findReleaseVersions } from "../utils";
import { TypeGroupOption } from "../models/types";

export default function useReleaseNameAndVersionSelectionHandlers(
  releaseData: Release[],
  downloadTable: DownloadTableData,
  setReleaseModalShown: React.Dispatch<React.SetStateAction<boolean>>,
  setVersionSelector: React.Dispatch<
    React.SetStateAction<{
      versionGroup: {
        options: Set<string>;
      };
      selection: string[];
    }>
  >,
  setDropdownSelector: React.Dispatch<
    React.SetStateAction<{
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
    }>
  >,
  setFileToAutoOpenFullSearch: React.Dispatch<React.SetStateAction<boolean>>,
  setFileToAutoOpenFromFileSetSearch: React.Dispatch<
    React.SetStateAction<boolean>
  >,
  setFileToAutoOpen: React.Dispatch<React.SetStateAction<DownloadFile | null>>,
  dropdownSelector: {
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
  },
  versionSelector: {
    selection: string[];
  },
  singleFileAutoOpenedFromFullSearch: boolean,
  singleFileAutoOpenedFromFileSetSearch: boolean
) {
  const allFilesSearchOptions = downloadTable.map((row: any) => {
    return {
      releasename: row.releaseName,
      filename: row.fileName,
      description: row.fileDescription,
    };
  });

  const handleExitSingleFileFocusModeFullSearch = useCallback(() => {
    if (singleFileAutoOpenedFromFullSearch) {
      setFileToAutoOpenFullSearch(false);

      setFileToAutoOpen(null);

      // Remove release and file name params from url (were added on open of the modal)
      deleteQueryParams();
    }
  }, [
    setFileToAutoOpenFullSearch,
    setFileToAutoOpen,
    singleFileAutoOpenedFromFullSearch,
  ]);

  const handleExitSingleFileFocusModeFileSetSearch = useCallback(() => {
    if (singleFileAutoOpenedFromFileSetSearch) {
      setFileToAutoOpenFromFileSetSearch(false);

      setFileToAutoOpen(null);

      // Remove release and file name params from url (were added on open of the modal)
      deleteQueryParams();
    }
  }, [
    setFileToAutoOpenFromFileSetSearch,
    setFileToAutoOpen,
    singleFileAutoOpenedFromFileSetSearch,
  ]);

  const handleDropdownSelectionChange = useCallback(
    (
      releaseName: string,
      releaseVersionGroupName?: string,
      versions?: string[]
    ) => {
      // Selected Option might come from a url query param. Url query params use release name, which might
      // not match a release group in the top left dropdown of the File Downloads page. The following
      // method matches the release name to the appropriate release group.
      const validatedSelection = getReleaseGroupFromSelection(
        releaseData,
        releaseName
      );
      if (validatedSelection === "") {
        return;
      }

      const selected: Set<string> = new Set([]);
      if (selected !== undefined) selected.add(validatedSelection);

      const selection: string[] = [];
      selection.push(releaseVersionGroupName ?? releaseName);

      setDropdownSelector({
        ...dropdownSelector,
        ...{
          releaseGroup: {
            selected: { selected },
          },
          selection: [{ name: selection[0], versions }],
        },
      });

      if (versions && versions.length > 0) {
        setVersionSelector({
          ...versionSelector,
          ...{
            versionGroup: {
              options: new Set(versions),
            },
            selection: [releaseName] as string[],
          },
        });
      } else {
        // Setting the versionSelector selection to None hides that control in the UI
        setVersionSelector({
          ...versionSelector,
          ...{
            versionGroup: {
              options: new Set<string>([]),
            },
            selection: [] as string[],
          },
        });
      }

      setReleaseModalShown(false);
      handleExitSingleFileFocusModeFullSearch();
      handleExitSingleFileFocusModeFileSetSearch();
    },
    [
      dropdownSelector,
      releaseData,
      setDropdownSelector,
      setReleaseModalShown,
      setVersionSelector,
      versionSelector,
      handleExitSingleFileFocusModeFullSearch,
      handleExitSingleFileFocusModeFileSetSearch,
    ]
  );

  const handleSelectDropdown = useCallback(
    (eventKey: any) => {
      const releaseVersionGroupName = findReleaseVersionGroupName(
        releaseData,
        eventKey.releaseNameOrVersionGroupName
      );

      if (releaseVersionGroupName) {
        const versions = findReleaseVersions(
          releaseData,
          releaseVersionGroupName
        );

        handleDropdownSelectionChange(
          eventKey.releaseOrVersionGroupName,
          releaseVersionGroupName,
          versions
        );
      }
      if (eventKey.versions && eventKey.versions.length > 0) {
        // If the dropdown options selected is a release version group, such as "DepMap Public",
        // select the first version within that release version group.
        handleDropdownSelectionChange(
          eventKey.versions[0],
          eventKey.releaseNameOrVersionGroupName,
          eventKey.versions
        );
      } else {
        handleDropdownSelectionChange(
          eventKey.releaseNameOrVersionGroupName,
          eventKey.versions
        );
      }
    },
    [handleDropdownSelectionChange, releaseData]
  );

  const handleVersionSelectionChange = useCallback(
    (version: string) => {
      // Selected Option might come from a url query param. Url query params use release name, which might
      // not match a release group in the top left dropdown of the File Downloads page. The following
      // method matches the release name to the appropriate release group.
      const validatedSelection = getReleaseGroupFromSelection(
        releaseData,
        version
      );
      if (validatedSelection === "") {
        return;
      }

      const selected: Set<string> = new Set([]);
      if (selected !== undefined) selected.add(validatedSelection);

      const selection: string[] = [];
      selection.push(validatedSelection);

      setVersionSelector({
        ...versionSelector,

        versionGroup: {
          options: selected,
        },
        selection: [version],
      });

      setReleaseModalShown(false);
      handleExitSingleFileFocusModeFullSearch();
      handleExitSingleFileFocusModeFileSetSearch();
    },
    [
      releaseData,
      setReleaseModalShown,
      setVersionSelector,
      versionSelector,
      handleExitSingleFileFocusModeFileSetSearch,
      handleExitSingleFileFocusModeFullSearch,
    ]
  );

  const handleSelectVersion = useCallback(
    (eventKey: any) => {
      handleVersionSelectionChange(eventKey.version);
    },
    [handleVersionSelectionChange]
  );

  return {
    allFilesSearchOptions,
    handleDropdownSelectionChange,
    handleSelectDropdown,
    handleSelectVersion,
    handleExitSingleFileFocusModeFullSearch,
    handleExitSingleFileFocusModeFileSetSearch,
  };
}

export function useReleaseModalAndAutoOpenSingleFilePanelModeHandlers(
  downloadTable: DownloadTableData,
  releaseData: Release[],
  releaseModalShown: boolean,
  handleDropdownSelectionChange: (
    releaseName: string,
    releaseVersionGroupName?: string | undefined,
    versions?: string[] | undefined
  ) => void,
  setFileToAutoOpenFromFullSearch: React.Dispatch<
    React.SetStateAction<boolean>
  >,
  setFileToAutoOpenFromFileSetSearch: React.Dispatch<
    React.SetStateAction<boolean>
  >,
  setFileToAutoOpenOnSearch: React.Dispatch<
    React.SetStateAction<DownloadFile | null>
  >,
  setReleaseModalShown: React.Dispatch<React.SetStateAction<boolean>>,
  forceUpdate: () => void
) {
  const handleToggleReleaseModal = useCallback(() => {
    setReleaseModalShown(!releaseModalShown);
    if (releaseModalShown) {
      // Remove release name param from url (were added on open of the modal)
      deleteQueryParams();
    }
  }, [releaseModalShown, setReleaseModalShown]);

  // If this is fromFullSearch or url params might need to select the appropriate fileset before
  // anything else.
  const loadToSpecificFilePanel = useCallback(
    (releaseName: string, fileName: string, fromFullSearch: boolean) => {
      // Check if the releaseName is part of a releaseVersionGroup (e.g. "DepMap Public 23Q4" is part of "DepMap Public")
      const releaseVersionGroupName = findReleaseVersionGroupName(
        releaseData,
        releaseName
      );

      if (releaseVersionGroupName && releaseVersionGroupName.length > 0) {
        // The releaseName is part of a releaseVersionGroup, so find the versions
        const versions = findReleaseVersions(
          releaseData,
          releaseVersionGroupName
        );

        // Handle selection of releaseVersionGroupName (e.g. "DepMap Public") in the dropdownSelector and releaseName  (e.g. "DepMap Public 23Q4")
        // in the Version selector.
        handleDropdownSelectionChange(
          releaseName,
          releaseVersionGroupName,
          versions
        );
      } else {
        // Handle selection of the releaseName in the dropdownSelector. These releases are not part of a release version group, so
        // they do not have versions. versionSelector should be hidden.
        handleDropdownSelectionChange(releaseName);
      }

      const downloadTableRow = downloadTable.find(
        // Not sure how this worked before when it was only checking for a fileName match. fileNames
        // aren't necessarily unique across releaseNames, so only checking for fileName should result
        // in bugs.
        (row) => row.fileName === fileName && row.releaseName === releaseName
      );
      if (!downloadTableRow) {
        alert(
          "The specified release or file does not exist. Please try again."
        );
        return;
      }

      if (fromFullSearch) {
        setFileToAutoOpenFromFullSearch(true);
      } else {
        setFileToAutoOpenFromFileSetSearch(true);
      }

      setFileToAutoOpenOnSearch(downloadTableRow);
    },
    [
      setFileToAutoOpenFromFullSearch,
      setFileToAutoOpenFromFileSetSearch,
      setFileToAutoOpenOnSearch,
      handleDropdownSelectionChange,
      downloadTable,
      releaseData,
    ]
  );

  const loadToReleaseModalFromUrl = useCallback(
    (releaseName: string) => {
      const releaseVersionGroupName = findReleaseVersionGroupName(
        releaseData,
        releaseName
      );

      if (releaseVersionGroupName && releaseVersionGroupName.length > 0) {
        const versions = findReleaseVersions(
          releaseData,
          releaseVersionGroupName
        );

        handleDropdownSelectionChange(
          releaseName,
          releaseVersionGroupName,
          versions
        );
      } else {
        handleDropdownSelectionChange(releaseName);
      }
      handleToggleReleaseModal();
    },
    [handleDropdownSelectionChange, handleToggleReleaseModal, releaseData]
  );

  const handleReleaseFileNameUrls = useCallback(() => {
    if (releaseData.length > 0) {
      const params = qs.parse(window.location.search.substr(1));

      if (params.releasename || params.release) {
        const releaseNameParam = params.releasename
          ? params.releasename
          : params.release;
        const releaseName: string = releaseNameParam!.toString();

        if (params.filename || params.file) {
          const fileNameParam = params.filename ? params.filename : params.file;
          const fileName: string = fileNameParam!.toString();
          loadToSpecificFilePanel(releaseName, fileName, true);
        } else {
          loadToReleaseModalFromUrl(releaseName);
        }
      }
    }
  }, [releaseData, loadToReleaseModalFromUrl, loadToSpecificFilePanel]);

  const handleFileSearch = useCallback(
    (selected: FileSearchOption, fromFullSearch: boolean) => {
      if (releaseData && releaseData.length > 0) {
        const fileName = selected.filename;
        const releaseName = selected.releasename;
        forceUpdate();
        loadToSpecificFilePanel(releaseName, fileName, fromFullSearch);
      }
    },
    [releaseData, forceUpdate, loadToSpecificFilePanel]
  );

  return {
    forceUpdate,
    handleReleaseFileNameUrls,
    handleToggleReleaseModal,
    handleFileSearch,
  };
}
