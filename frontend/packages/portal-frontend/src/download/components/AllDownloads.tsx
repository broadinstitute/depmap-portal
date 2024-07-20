/* eslint-disable */
import * as React from "react";
import update from "immutability-helper";
import { getDapi } from "src/common/utilities/context";
import { assert, deleteQueryParams } from "@depmap/utils";
import {
  areVersionsValidReleases,
  getReleaseByReleaseName,
  getReleaseDescriptionByName,
  getReleaseForFile,
  getReleaseGroupFromSelection,
} from "src/common/utilities/helper_functions";
import DataSlicer from "src/dataSlicer/components/DataSlicer";
import {
  DownloadTableData,
  Release,
  DownloadFile,
  ViewMode,
  ExportDataQuery,
  ExportMergedDataQuery,
  ExportMutationTableQuery,
  FeatureValidationQuery,
} from "@depmap/data-slicer";
import { DownloadTable, DownloadTableProps } from "./DownloadTable";
import { TypeGroup, TypeGroupOption } from "./CheckboxPanel";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { FileCardModal } from "./FileCardModal";
import { ReleaseCardModal } from "./ReleaseCardModal";
import qs from "qs";
import { FileSearch, FileSearchOption } from "./FileSearch";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import {
  findReleaseVersionGroupName,
  findReleaseVersions,
  formatReleaseGroupByType,
} from "../utils";

interface AllDownloadsState {
  stateInitialized: boolean;
  searchOptions: FileSearchOption[];
  dropdownSelector: {
    fileType: {
      selected: Set<string>;
    };
    releaseGroup: {
      selected: Set<string>;
    };
    source: {
      selected: Set<string>;
    };
    showUnpublished: boolean;
    selection: TypeGroupOption[];
  };
  versionSelector: {
    releaseGroup: {
      selected: Set<string>;
    };
    selection: string[];
  };
  releaseModalShown: boolean;
  fileModalShown: boolean;
  dropdownOpen: boolean;
  versionDropdownOpen: boolean;
  card: DownloadFile;
  view: ViewMode;
}

export interface AllDownloadsProps {
  releases?: Set<string>;
  file?: string;
  modal?: boolean;
  bulkDownloadCsvUrl?: string;
  termsDefinitions: { [key: string]: string };
  mode?: ViewMode;
  updateReactLoadStatus: () => void;
}

export class AllDownloads extends React.Component<
  AllDownloadsProps,
  AllDownloadsState
> {
  static defaultProps = {
    releases: new Set() as Set<string>,
    file: "",
    modal: false,
  };

  constructor(props: AllDownloadsProps) {
    super(props);
    this.state = {
      searchOptions: [],
      stateInitialized: false,
      dropdownSelector: {
        fileType: {
          selected: new Set([]),
        },
        releaseGroup: {
          selected: new Set([]),
        },
        source: {
          selected: new Set([]),
        },
        showUnpublished: false,
        selection: [],
      },
      versionSelector: {
        releaseGroup: {
          selected: new Set([]),
        },
        selection: [],
      },
      releaseModalShown: false,
      fileModalShown: false,
      dropdownOpen: false,
      versionDropdownOpen: false,
      card: {
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
      } as any,
      view: this.props.mode ? this.props.mode : ViewMode.topDownloads,
    };

    this.handleToggleFileModal = this.handleToggleFileModal.bind(this);
    this.handleToggleReleaseModal = this.handleToggleReleaseModal.bind(this);
  }

  table: DownloadTableData = [];

  dropdownSelectorOptions?: {
    fileType: Array<string>;
    releaseGroupByType: Array<TypeGroup>;
    source: Array<string>;
  };

  versionSelectorOptions?: {
    fileType: string[];
    // Sometimes, the dropdownSelector selection will be a releaseGroup that contains multiple versions.
    // For example, if dropdownSelector's selection is "DepMap Public", the versionSelector will list each
    // specific quarterly/bi-annual release.
    releaseGroupVersions: string[];
    source: string[];
  };

  releaseData: Array<Release> = [];

  publishedReleases: Set<string> = new Set();

  dataUsageUrl?: string;

  componentDidMount() {
    this.initDownloads();
  }

  componentDidUpdate(_: AllDownloadsProps, prevState: AllDownloadsState) {
    if (!prevState.stateInitialized && this.state.stateInitialized) {
      this.props.updateReactLoadStatus();
    }
  }

  initDownloads = () => {
    Promise.resolve().then(() => {
      return getDapi()
        .getDownloads()
        .then((downloads) => {
          const releaseGroups = downloads.releaseData.map((release: any) => {
            return {
              group: release.releaseGroup,
              versionGroup: release.releaseVersionGroup,
            };
          });

          const topReleaseGroup = releaseGroups.slice(0, 1)[0];
          let releaseGroupByType = formatReleaseGroupByType(
            downloads.releaseData,
            downloads.releaseType
          );

          const { fileType: fileType } = downloads;
          const { source: source } = downloads;

          this.table = downloads.table;
          this.releaseData = downloads.releaseData;
          this.dataUsageUrl = downloads.dataUsageUrl;
          this.dropdownSelectorOptions = {
            fileType,
            releaseGroupByType,
            source,
          };

          const topReleaseGroupVersions = topReleaseGroup.versionGroup
            ? downloads.releaseData
                .filter(
                  (release: Release) =>
                    release.releaseVersionGroup === topReleaseGroup.versionGroup
                )
                .map((release: Release) => release.releaseGroup)
            : null;

          this.versionSelectorOptions = {
            fileType,
            releaseGroupVersions: topReleaseGroupVersions ?? [],
            source,
          };
          this.publishedReleases = new Set(
            downloads.releaseData
              .filter((release: any) => release.citation)
              .map((release: any) => release.releaseName)
          );

          const newState: Partial<AllDownloadsState> = {
            stateInitialized: true,
            searchOptions: [],
            dropdownSelector: {
              fileType: {
                selected: new Set(fileType),
              },
              releaseGroup: {
                selected: new Set([topReleaseGroup.group]),
              },
              source: {
                selected: new Set([]),
              },
              showUnpublished: false,
              selection: [
                {
                  name: topReleaseGroup.versionGroup ?? topReleaseGroup.group,
                  versions: topReleaseGroupVersions ?? [],
                },
              ],
            },
            versionSelector: {
              releaseGroup: {
                selected: new Set([topReleaseGroup.group]),
              },
              selection: topReleaseGroup.versionGroup
                ? [topReleaseGroup.group]
                : [],
            },
            releaseModalShown: false,
            fileModalShown: false,
          };

          const fileSearchOptions: FileSearchOption[] = [];
          downloads.table.map((row: any) => {
            fileSearchOptions.push({
              releasename: row.releaseName,
              filename: row.fileName,
              description: row.fileDescription,
            });
          });
          newState.searchOptions =
            fileSearchOptions.length > 0 ? fileSearchOptions : [];

          if (this.props.releases!.size > 0 && this.props.file) {
            newState.view = ViewMode.allDownloads;

            if (this.props.file) {
              const row = this.table.find(
                (row) =>
                  row.fileName == this.props.file &&
                  this.props.releases!.has(row.releaseName)
              );
              assert(row);
              newState.card = row;
            }

            // file must be specified with a release
            const selectedReleaseGroups = this.releaseData
              .filter((r) => this.props.releases!.has(r.releaseName))
              .map((r) => r.releaseGroup);

            const selectedReleaseGroupVersions = this.releaseData
              .filter(
                (release: Release) =>
                  release.releaseVersionGroup === selectedReleaseGroups[0]
              )
              .map((release: Release) => release.releaseGroup);

            let newSelection: string[] = [];
            newSelection.push(selectedReleaseGroups[0]);

            newState.dropdownSelector!.releaseGroup.selected = new Set(
              newSelection
            );
            newState.dropdownSelector!.selection = [
              { name: newSelection[0], versions: selectedReleaseGroupVersions },
            ];
          }

          this.setState(newState as AllDownloadsState);

          // Gets hit if the URL has a release name at the end - user wants to be linked directly to that release modal
          this.handleReleaseFileNameUrls();
        });
    });
  };

  handleReleaseFileNameUrls() {
    const params = qs.parse(window.location.search.substr(1));

    if (params["releasename"] || params["release"]) {
      const releaseNameParam = params["releasename"]
        ? params["releasename"]
        : params["release"];
      let releaseName: string = releaseNameParam!.toString();

      if (params["filename"] || params["file"]) {
        const fileNameParam = params["filename"]
          ? params["filename"]
          : params["file"];
        let fileName: string = fileNameParam!.toString();
        this.loadToSpecificFileModal(releaseName, fileName);
      } else {
        this.loadToReleaseModalFromUrl(releaseName);
      }
    }
  }

  loadToSpecificFileModal = (releaseName: string, fileName: string) => {
    // Check if the releaseName is part of a releaseVersionGroup (e.g. "DepMap Public 23Q4" is part of "DepMap Public")
    const releaseVersionGroupName = findReleaseVersionGroupName(
      this.releaseData,
      releaseName
    );

    if (releaseVersionGroupName && releaseVersionGroupName.length > 0) {
      // The releaseName is part of a releaseVersionGroup, so find the versions
      const versions = findReleaseVersions(
        this.releaseData,
        releaseVersionGroupName
      );

      // Handle selection of releaseVersionGroupName (e.g. "DepMap Public") in the dropdownSelector and releaseName  (e.g. "DepMap Public 23Q4")
      // in the Version selector.
      this.onDropdownSelectionChange(
        releaseName,
        releaseVersionGroupName,
        versions
      );
    } else {
      // Handle selection of the releaseName in the dropdownSelector. These releases are not part of a release version group, so
      // they do not have versions. versionSelector should be hidden.
      this.onDropdownSelectionChange(releaseName);
    }

    const row = this.table.find(
      // Not sure how this worked before when it was only checking for a fileName match. fileNames
      // aren't necessarily unique across releaseNames, so only checking for fileName should result
      // in bugs.
      (row) => row.fileName === fileName && row.releaseName === releaseName
    );
    if (!row) {
      alert("The specified release or file does not exist. Please try again.");
      return;
    }
    this.onTableRowClick(row);
  };

  loadToReleaseModalFromUrl = (releaseName: string) => {
    const releaseVersionGroupName = findReleaseVersionGroupName(
      this.releaseData,
      releaseName
    );

    if (releaseVersionGroupName && releaseVersionGroupName.length > 0) {
      const versions = findReleaseVersions(
        this.releaseData,
        releaseVersionGroupName
      );

      this.onDropdownSelectionChange(
        releaseName,
        releaseVersionGroupName,
        versions
      );
    } else {
      this.onDropdownSelectionChange(releaseName);
    }
    this.handleToggleReleaseModal();
  };

  onTableRowClick = (row: DownloadFile) => {
    const newState: Partial<AllDownloadsState> = {
      card: row,
      view: ViewMode.allDownloads,
      releaseModalShown: false,
      fileModalShown: true,
    };
    this.setState(newState as AllDownloadsState);
  };

  // react bootstrap dropdown wouldn't close on selection so we handle the state here.
  onDropdownToggle = () => {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen,
    });
  };

  onVersionDropdownToggle = () => {
    this.setState({
      versionDropdownOpen: !this.state.versionDropdownOpen,
    });
  };

  onVersionSelectionChange = (version: string) => {
    // Selected Option might come from a url query param. Url query params use release name, which might
    // not match a release group in the top left dropdown of the File Downloads page. The following
    // method matches the release name to the appropriate release group.
    let validatedSelection = getReleaseGroupFromSelection(
      this.releaseData,
      version
    );
    if (validatedSelection == "") {
      return;
    }

    let selected: Set<string> = new Set([]);
    if (selected != undefined) selected.add(validatedSelection);

    let selection: string[] = [];
    selection.push(validatedSelection);

    const newState: Partial<AllDownloadsState> = {};

    newState.versionSelector = update(this.state.versionSelector, {
      releaseGroup: {
        selected: { $set: selected },
      },
      selection: { $set: [version] },
    });

    newState.releaseModalShown = false;
    this.setState(newState as AllDownloadsState);
  };

  handleSelectDropdown = (eventKey: any) => {
    const releaseVersionGroupName = findReleaseVersionGroupName(
      this.releaseData,
      eventKey.releaseNameOrVersionGroupName
    );

    if (releaseVersionGroupName) {
      const versions = findReleaseVersions(
        this.releaseData,
        releaseVersionGroupName
      );

      this.onDropdownSelectionChange(
        eventKey.releaseOrVersionGroupName,
        releaseVersionGroupName,
        versions
      );
    } else {
      if (eventKey.versions && eventKey.versions.length > 0) {
        // If the dropdown options selected is a release version group, such as "DepMap Public",
        // select the first version within that release version group.
        this.onDropdownSelectionChange(
          eventKey.versions[0],
          eventKey.releaseNameOrVersionGroupName,
          eventKey.versions
        );
      } else {
        this.onDropdownSelectionChange(
          eventKey.releaseNameOrVersionGroupName,
          eventKey.versions
        );
      }
    }
  };

  onDropdownSelectionChange = (
    releaseName: string,
    releaseVersionGroupName?: string,
    versions?: string[]
  ) => {
    // Selected Option might come from a url query param. Url query params use release name, which might
    // not match a release group in the top left dropdown of the File Downloads page. The following
    // method matches the release name to the appropriate release group.
    let validatedSelection = getReleaseGroupFromSelection(
      this.releaseData,
      releaseName
    );
    if (validatedSelection == "") {
      return;
    }

    let selected: Set<string> = new Set([]);
    if (selected != undefined) selected.add(validatedSelection);

    let selection: string[] = [];
    selection.push(releaseVersionGroupName ?? releaseName);

    const newState: Partial<AllDownloadsState> = {};
    newState.dropdownSelector = update(this.state.dropdownSelector, {
      releaseGroup: {
        selected: { $set: selected },
      },
      selection: { $set: [{ name: selection[0], versions }] },
    });

    if (versions && versions.length > 0) {
      newState.versionSelector = update(this.state.versionSelector, {
        releaseGroup: {
          selected: { $set: selected },
        },
        selection: { $set: [releaseName] },
      });
    } else {
      // Setting the versionSelector selection to None hides that control in the UI
      newState.versionSelector = update(this.state.versionSelector, {
        releaseGroup: {
          selected: { $set: selected },
        },
        selection: { $set: [] },
      });
    }
    newState.releaseModalShown = false;
    this.setState(newState as AllDownloadsState);
  };

  handleSelectVersion = (eventKey: any) => {
    this.onVersionSelectionChange(eventKey.version);
  };

  handleFileSearch = (selected: FileSearchOption) => {
    const fileName = selected.filename;
    const releaseName = selected.releasename;
    this.loadToSpecificFileModal(releaseName, fileName);
  };

  handleToggleReleaseModal = () => {
    this.setState({
      releaseModalShown: !this.state.releaseModalShown,
    });

    if (this.state.releaseModalShown) {
      // Remove release name param from url (were added on open of the modal)
      deleteQueryParams();
    }
  };

  handleToggleFileModal = () => {
    this.setState({
      fileModalShown: !this.state.fileModalShown,
    });

    // Remove release and file name params from url (were added on open of the modal)
    if (this.state.fileModalShown) {
      deleteQueryParams();
    }
  };

  renderVersionSelectorOptions = (typeGroupOption: TypeGroupOption) => {
    return (
      <>
        {typeGroupOption.versions!.map((option) =>
          getReleaseByReleaseName(option, this.releaseData) ? (
            <MenuItem
              eventKey={{
                version: option,
              }}
              key={option}
              onSelect={this.handleSelectVersion}
              onClick={this.onVersionDropdownToggle}
              active={option === this.state.versionSelector.selection[0]}
            >
              {option}
            </MenuItem>
          ) : null
        )}
      </>
    );
  };

  renderOptions = (group: TypeGroup) => {
    return (
      <React.Fragment key={group.name + group.options.toString()}>
        {group.options.length > 0 ? (
          <>
            <MenuItem
              header
              className="downloads-dropdown-menu"
              eventKey={group.name}
              key={group.name}
              disabled
            >
              {group.name}
            </MenuItem>
            {group.options.map((option) =>
              (
                option.versions
                  ? areVersionsValidReleases(option.versions, this.releaseData)
                  : getReleaseByReleaseName(option.name, this.releaseData)
              ) ? (
                <MenuItem
                  eventKey={{
                    releaseNameOrVersionGroupName: option.name,
                    versions: option.versions,
                    group,
                  }}
                  key={option.name}
                  onSelect={this.handleSelectDropdown}
                  onClick={this.onDropdownToggle}
                  active={
                    option.name ===
                    this.state.dropdownSelector.selection[0].name
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
    );
  };

  render() {
    const { termsDefinitions } = this.props;
    let titleLabel: string = "File Downloads";
    if (this.state.view === ViewMode.customDownloads) {
      titleLabel = "Custom Downloads";
    }

    // Get the release description for display under the dropdown. If a version is selected, display the
    // description for the specific version of this release. If a version is NOT selected, the dropdownSelector
    // selection is a release that is not part of a specific version group. This means the dropdownSelector selection
    // contains all info needed to determine the description.
    const description =
      this.releaseData.length > 0
        ? getReleaseDescriptionByName(
            this.state.versionSelector.selection[0] ??
              this.state.dropdownSelector.selection[0].name,
            this.releaseData
          )
        : "";

    // Put description into html element so we don't have messy looking html tags in our desscription string
    const descriptionElement: JSX.Element = (
      <div>
        {
          <div
            style={{ maxWidth: "75ch" }}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        }
      </div>
    );

    var headerStyle = {
      paddingBottom: "20px",
      margin: "0px",
    };

    const title = (
      <div className={"downloads-title-div-wrapper"}>
        {" "}
        <div className="title_div">
          <h1 className="inline-block" style={headerStyle}>
            {titleLabel}
          </h1>
          {this.state.view == ViewMode.allDownloads && (
            <>
              <div>
                <FileSearch
                  searchOptions={this.state.searchOptions}
                  onSearch={this.handleFileSearch}
                  searchPlaceholder="Search for a download file..."
                />
              </div>
              <p style={{ maxWidth: "75ch", marginTop: "10px" }}>
                File Downloads allows you to browse and access the complete
                collection of datasets available in the DepMap portal. By
                default the latest DepMap data release of CRISPR and genomics
                data  is shown, but you can select other datasets and data types
                using the drop downs, and can search for specific files by name.
              </p>
              <br />
              <div>
                <p className="select-file-set-label">
                  Select a file set to view:
                </p>
                <div
                  className="iconContainer"
                  style={{ marginRight: "auto", float: "right" }}
                >
                  <p style={{ color: "#337ab7" }}>
                    <span
                      style={{
                        fontSize: 14,
                        paddingRight: 8,
                        cursor: "pointer",
                      }}
                      onClick={(event) => {
                        this.handleToggleReleaseModal();
                        event.preventDefault();
                      }}
                    >
                      View full release details
                    </span>
                    <span
                      className="glyphicon glyphicon-resize-full"
                      style={{ color: "#337ab7", fontSize: 14 }}
                      onClick={(event) => {
                        this.handleToggleReleaseModal();
                        event.preventDefault();
                      }}
                    />
                  </p>
                </div>
                {this.dropdownSelectorOptions && (
                  <div className="file-set-selector">
                    <DropdownButton
                      bsStyle="default"
                      title={this.state.dropdownSelector.selection[0].name}
                      id="all-downloads"
                      onToggle={this.onDropdownToggle}
                      open={this.state.dropdownOpen}
                    >
                      {this.dropdownSelectorOptions.releaseGroupByType.map(
                        (group) => this.renderOptions(group)
                      )}
                    </DropdownButton>{" "}
                  </div>
                )}
                {this.versionSelectorOptions &&
                  this.state.dropdownSelector.selection[0].versions &&
                  this.state.dropdownSelector.selection[0].versions.length >
                    0 && (
                    <div className="version-selector">
                      <span className="version-selector-label">Version:</span>
                      <DropdownButton
                        bsStyle="default"
                        title={this.state.versionSelector.selection}
                        id="all-downloads-version-selector"
                        onToggle={this.onVersionDropdownToggle}
                        open={this.state.versionDropdownOpen}
                      >
                        {this.renderVersionSelectorOptions(
                          this.state.dropdownSelector.selection[0]
                        )}
                      </DropdownButton>
                    </div>
                  )}
              </div>
              {this.state.releaseModalShown && (
                <ReleaseCardModal
                  termsDefinitions={termsDefinitions}
                  dataUsageUrl={this.dataUsageUrl as string}
                  file={this.state.card}
                  release={getReleaseByReleaseName(
                    this.state.versionSelector.selection[0] ??
                      this.state.dropdownSelector.selection[0].name,
                    this.releaseData
                  )}
                  show={this.state.releaseModalShown}
                  toggleShowReleaseModalHandler={this.handleToggleReleaseModal}
                ></ReleaseCardModal>
              )}
            </>
          )}
          {this.state.view == ViewMode.customDownloads && (
            <p style={{ maxWidth: "75ch" }}>
              Only download what you need! Custom Downloads lets you create data
              files that subsets any of the available dataset in the DepMap
              portal using your list of cell lines, genes, and/or compounds of
              interest.
            </p>
          )}
        </div>
        <div>{descriptionElement}</div>
      </div>
    );

    if (!this.state.stateInitialized) {
      return (
        <div>
          {title}
          <p>Loading...</p>
        </div>
      );
    }

    const downloadTableProps: DownloadTableProps = {
      onViewClick: this.onTableRowClick,
      unfilteredData: this.table,
      fileType: this.state.dropdownSelector.fileType.selected,
      releaseData: this.releaseData,
      releaseGroup:
        this.state.versionSelector.releaseGroup.selected ??
        this.state.dropdownSelector.releaseGroup.selected,
      source: this.state.dropdownSelector.source.selected,
      publishedReleases: this.publishedReleases,
      showUnpublished: this.state.dropdownSelector.showUnpublished,
      showOnlyMainFiles: false,
      card: this.state.card,
      termsDefinitions: this.props.termsDefinitions,
    };

    const mainFilesDownloadTableProps: DownloadTableProps = {
      onViewClick: this.onTableRowClick,
      unfilteredData: this.table,
      fileType: this.state.dropdownSelector.fileType.selected,
      releaseData: this.releaseData,
      releaseGroup:
        this.state.versionSelector.releaseGroup.selected ??
        this.state.dropdownSelector.releaseGroup.selected,
      source: this.state.dropdownSelector.source.selected,
      publishedReleases: this.publishedReleases,
      showUnpublished: this.state.dropdownSelector.showUnpublished,
      showOnlyMainFiles: true,
      card: this.state.card,
      termsDefinitions: this.props.termsDefinitions,
    };

    let mainDivContents;
    if (this.state.view == ViewMode.customDownloads && this.table) {
      mainDivContents = (
        <div>
          <DataSlicer
            getMorpheusUrl={(csvUrl: string) =>
              getDapi().getMorpheusUrl(csvUrl)
            }
            getCitationUrl={(datasetId: string) => {
              return getDapi().getCitationUrl(datasetId);
            }}
            getMutationTableCitation={() => {
              return getDapi().getMutationTableCitation();
            }}
            getDatasetsList={() => getDapi().getDatasetsList()}
            exportMutationTable={(query: ExportMutationTableQuery) =>
              getDapi().exportMutationTable(query)
            }
            exportData={(query: ExportDataQuery) => getDapi().exportData(query)}
            exportDataForMerge={(query: ExportMergedDataQuery) =>
              getDapi().exportDataForMerge(query)
            }
            getTaskStatus={(taskId: string) => getDapi().getTaskStatus(taskId)}
            validateFeatures={(query: FeatureValidationQuery) =>
              getDapi().validateFeaturesInDataset(query)
            }
            fileInformation={this.table}
            dapi={getDapi()}
          />
        </div>
      );
    } else {
      mainDivContents = (
        <div>
          <div>
            <DownloadTable {...mainFilesDownloadTableProps} />
          </div>
          <br />
          <div>
            <DownloadTable {...downloadTableProps} />
          </div>
          {this.state.card.releaseName &&
            this.state.view == ViewMode.allDownloads &&
            this.state.fileModalShown && (
              <div>
                <FileCardModal
                  file={this.state.card}
                  release={getReleaseForFile(this.releaseData, this.state.card)}
                  show={this.state.fileModalShown}
                  toggleShowFileModalHandler={this.handleToggleFileModal}
                  termsDefinitions={this.props.termsDefinitions}
                />
              </div>
            )}
        </div>
      );
    }

    return (
      <div className="all-downloads">
        <div id="selenium-ready">
          <div>
            <br />
            {title}

            <br />
            <div>{mainDivContents}</div>
            <br />
          </div>
        </div>
      </div>
    );
  }
}
