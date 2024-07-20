/* eslint-disable */
import * as React from "react";
import {
  Modal,
  Button,
  ListGroup,
  ListGroupItem,
  Alert,
} from "react-bootstrap";
import * as Papa from "papaparse";
import { LongTableCellLineSelector } from "./LongTableCellLineSelector";
import { CellLineSelectorUsage } from "./CellLineSelectorUsage";
import {
  CellignerColorsForCellLineSelector,
  CellLineSelectorLines,
} from "../models/CellLineSelectorLines";
import { CellData, loadCellLines } from "../models/cellLines";
import { ListStorage, LocalStorageListStore, CustomList } from "./ListStorage";
import SaveConfirmationModal from "./SaveConfirmationModal";

import "../styles/cell_line_selector.scss";

type ModalMode = "hidden" | "shown";

const setsAreEqual = (
  setA: Set<unknown> | ReadonlySet<unknown>,
  setB: Set<unknown> | ReadonlySet<unknown>
) => {
  if (setA == null || setB == null) return false;
  if (setA.size !== setB.size) return false;
  for (const a of setA) if (!setB.has(a)) return false;
  return true;
};

interface CellLineSelectorModalProps {
  getCellLineSelectorLines: () => Promise<CellLineSelectorLines>;
  getCellLineUrlRoot: () => Promise<string>;
  getCellignerColors: () => Promise<CellignerColorsForCellLineSelector>;
  getFeedbackUrl: () => Promise<string>;
}
interface CellLineSelectorModalState {
  store: ListStorage;
  mode: ModalMode;

  cellLineUrlRoot: string;
  cellLineData?: Map<string, CellData>;
  colorMaps?: Map<string, Map<string, string>>;
  feedbackUrl?: string;

  selection: ReadonlySet<string>;
}

class CellLineSelectorModal extends React.Component<
  CellLineSelectorModalProps,
  CellLineSelectorModalState
> {
  constructor(props: CellLineSelectorModalProps) {
    super(props);
    this.state = {
      store: new LocalStorageListStore(),
      mode: "shown",
      cellLineUrlRoot: "",
      cellLineData: undefined,
      colorMaps: undefined,
      feedbackUrl: undefined,
      selection: new Set([]),
    };
  }

  componentDidMount() {
    Promise.resolve().then(() => {
      this.props.getCellLineUrlRoot().then((cellLineUrlRoot: string) => {
        this.setState({
          cellLineUrlRoot,
        });
      });
      this.props.getFeedbackUrl().then((url: string) => {
        this.setState({
          feedbackUrl: url,
        });
      });
      this.props
        .getCellLineSelectorLines()
        .then((cellLines: CellLineSelectorLines) => {
          this.setState({
            cellLineData: loadCellLines(cellLines),
          });
        });

      this.props
        .getCellignerColors()
        .then((colorsObj: CellignerColorsForCellLineSelector) => {
          const lineageMap: Map<string, string> = new Map<string, string>();
          const diseaseMap: Map<string, string> = new Map<string, string>();
          const numEntries = colorsObj.color.length;
          for (let i = 0; i < numEntries; i++) {
            lineageMap.set(colorsObj.lineage[i], colorsObj.color[i]);
            diseaseMap.set(colorsObj.primaryDisease[i], colorsObj.color[i]);
          }

          const colorMaps = new Map<string, Map<string, string>>([
            ["lineage", lineageMap],
            ["primaryDisease", diseaseMap],
          ]);
          this.setState({
            colorMaps,
          });
        });
    });
  }

  updateSelection(s: ReadonlySet<string>) {
    this.setState({ selection: s });
  }

  hideCellLineSelector = () => {
    this.setState({
      mode: "hidden",
    });
  };

  render() {
    let modalContents = null;
    if (this.state.cellLineData) {
      modalContents = (
        <CellLineSelector
          tableData={Array.from(this.state.cellLineData.values())}
          startingSelected={{ name: "", lines: this.state.selection }}
          onChange={(e: CustomList) => this.updateSelection(e.lines)}
          getCellLineUrlRoot={this.props.getCellLineUrlRoot}
          colorMaps={this.state.colorMaps}
        />
      );
    } else {
      modalContents = <div>Loading</div>;
    }
    return (
      <Modal
        show={this.state.mode == "shown"}
        onHide={this.hideCellLineSelector}
        dialogClassName="cell-line-selector-modal"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Cell Line Selector
            {this.state.feedbackUrl && (
              <span>
                <a
                  className="hotlink"
                  style={{ float: "right", marginRight: "10px" }}
                  href={this.state.feedbackUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Give us feedback on this tool!
                </a>
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalContents}</Modal.Body>
      </Modal>
    );
  }
}

// todo: remove this interface (since we're using depmap ID's instead of CCLE names, there shouldn't be any unrecognized lines...?)
interface ListForDisplay {
  validLines: ReadonlySet<string>;
  unrecognizedLines: ReadonlySet<string>;
}

interface CellLineSelectorProps {
  startingSelected?: CustomList;
  tableData: Array<CellData>;
  onChange: (selectedList: CustomList) => void;
  store?: ListStorage;
  getCellLineUrlRoot: () => Promise<string>;
  colorMaps?: Map<string, Map<string, string>>;
}

type CellLineSelectorMode = "Edit" | "View" | "EditListNameOnly";

interface CellLineSelectorState {
  linesSelected: ReadonlySet<string>;
  linesSelectedAndHidden: ReadonlySet<string>;

  savedLinesAndNamesArray: ReadonlyArray<CustomList>;
  selectedList?: CustomList;
  mode: CellLineSelectorMode;

  store: ListStorage;

  depmapIdToDisplayNameMap: ReadonlyMap<string, string>;
  CCLENameToDepmapIdMap: ReadonlyMap<string, string>;

  newListName?: string;
  showCloseConfirmationModal: boolean;
  showSaveConfirmationModal: boolean;
}

export class CellLineSelector extends React.Component<
  CellLineSelectorProps,
  CellLineSelectorState
> {
  cellLineUrlRoot = "";

  constructor(props: CellLineSelectorProps) {
    super(props);
    const store = this.props.store
      ? this.props.store
      : new LocalStorageListStore();

    store.importFromOldCellLineHighlighterIfExists();
    const idToName: [string, string][] = [];
    const nameToId: [string, string][] = [];

    // tableData is for populating the table of all cell lines, not specific lists
    this.props.tableData.forEach((x) => {
      idToName.push([x.depmapId, x.displayName]);
      nameToId.push([x.lineName, x.depmapId]);
    });

    const readListsFromStorage = store.getLists();

    this.state = {
      linesSelected: new Set<string>(),
      linesSelectedAndHidden: new Set<string>(),

      savedLinesAndNamesArray: readListsFromStorage,
      selectedList: undefined,
      mode: "View",

      store,

      depmapIdToDisplayNameMap: new Map(idToName),
      CCLENameToDepmapIdMap: new Map(nameToId),

      newListName: undefined,
      showCloseConfirmationModal: false,
      showSaveConfirmationModal: false,
    };
  }

  componentDidMount() {
    this.loadSavedSelections(this.props.startingSelected);
    this.props
      .getCellLineUrlRoot()
      .then((cellLineUrlRoot) => (this.cellLineUrlRoot = cellLineUrlRoot));
  }

  populateExisting() {
    const readListsFromStorage = this.state.store.getLists();
    this.setState({
      savedLinesAndNamesArray: readListsFromStorage,
    });
  }

  loadSavedSelections = (selectedList?: CustomList) => {
    if (selectedList) {
      const selectedCellLines: ReadonlySet<string> = new Set(
        selectedList.lines
      );
      if (selectedCellLines != null) {
        this.setState({
          linesSelected: selectedCellLines,
        });
        this.props.onChange(selectedList);
      }
    }
  };

  // for generating default names for new lists
  getSmallestNumNotInList(list: number[]) {
    if (list.length < 1) {
      return 1;
    }
    const max = Math.max(...list.filter(Boolean));
    for (let i = 1; i < max; i++) {
      if (!list.includes(i)) {
        return i;
      }
    }
    return max + 1;
  }

  createNewList = (lines: ReadonlySet<string>) => {
    const newListNameRoot = "New List ";
    this.setState({ mode: "Edit" });

    const listOfCurrentListNames = this.state.savedLinesAndNamesArray.map(
      (list) => list.name
    );
    const listOfUsedDefaultNamedListNames = listOfCurrentListNames.filter(
      (listName) => listName.startsWith(newListNameRoot)
    );
    const listOfUsedNumbers = listOfUsedDefaultNamedListNames
      .map((listName) => listName.replace(newListNameRoot, ""))
      .map(Number);
    const suffixNum = this.getSmallestNumNotInList(listOfUsedNumbers);
    const newListName = `New List ${suffixNum}`;
    const newListContents = lines;
    this.saveCellLinesList(newListName, newListContents);
    this.selectCellLinesList(newListName, newListContents, false);
    this.props.onChange({ name: newListName, lines: newListContents });
  };

  saveCellLinesList = (
    newListName: string,
    newListContents: ReadonlySet<string>,
    index = 0
  ) => {
    // if the list name is already in the set, maintain position
    const insertionIndex = index;
    const newList: CustomList = {
      name: newListName,
      lines: newListContents,
    };
    this.state.store.add(newList, insertionIndex);
    this.setState({
      selectedList: newList,
    });
    this.populateExisting();
  };

  editListName = (name: string) => {
    this.setState({
      newListName: name,
    });
  };

  onSaveButtonClick = () => {
    if (!this.state.selectedList) {
      return;
    }
    const oldName = this.state.selectedList.name;
    const newName = this.state.newListName;
    const takenNames = this.state.savedLinesAndNamesArray.map((item) => {
      return item.name;
    });
    let nameToSave = newName;
    if (
      newName == "" ||
      newName == null ||
      newName == "None" ||
      takenNames.indexOf(newName) != -1
    ) {
      nameToSave = oldName;
    }
    const index = this.state.store
      .getLists()
      .map((list) => {
        return list.name;
      })
      .indexOf(oldName);
    if (oldName != nameToSave) {
      this.deleteCellLinesList(oldName);
    }
    this.saveCellLinesList(
      nameToSave as string,
      this.state.linesSelected,
      index
    );
    this.selectCellLinesList(
      nameToSave as string,
      this.state.linesSelected,
      false
    );
    this.setState({
      mode: "View",
    });
  };

  deleteCellLinesList = (listToBeDeletedName: string) => {
    this.state.store.delete(listToBeDeletedName);
    this.populateExisting();
    if (
      this.state.selectedList &&
      this.state.selectedList.name == listToBeDeletedName
    ) {
      this.setState({
        selectedList: undefined,
        mode: "View",
        newListName: undefined,
      });
    }
  };

  selectCellLinesList = (
    customListName: string,
    customListLines: ReadonlySet<string>,
    allowToggle: boolean
  ) => {
    // if the selected list is clicked on again, deselect it
    if (
      allowToggle &&
      this.state.selectedList &&
      this.state.selectedList.name === customListName &&
      this.state.mode == "View"
    ) {
      this.setState({
        selectedList: undefined,
      });
    } else {
      this.setState({
        selectedList: { name: customListName, lines: customListLines },
      });
      this.props.onChange({ name: customListName, lines: customListLines });
      const allLineNames = new Set(
        this.props.tableData.map((cellLine) => cellLine.depmapId)
      );
      const sortedLines = this.validateListContents(
        customListName,
        customListLines,
        allLineNames
      );
      if (sortedLines) {
        this.loadSavedSelections({
          name: customListName,
          lines: sortedLines.validLines,
        });
      }
    }
  };

  // todo:  since we are only using depmap ID's to identify cell lines, redo this
  validateListContents = (
    listName: string,
    list: ReadonlySet<string>,
    allValidLineNames: ReadonlySet<string>
  ) => {
    if (list) {
      let triggerSave = false;
      const validLines = new Set<string>();
      const unrecognizedLines = new Set<string>();
      list.forEach((item) => {
        if (allValidLineNames.has(item)) {
          validLines.add(item);
        } else {
          // if unrecognized, see if we can convert ccle name to depmap id
          const depmapId = this.state.CCLENameToDepmapIdMap.get(item);
          if (depmapId) {
            validLines.add(depmapId);
            triggerSave = true;
          } else {
            unrecognizedLines.add(item);
          }
        }
      });
      if (triggerSave) {
        this.saveCellLinesList(listName, validLines, 0);
      }
      // convert from depmap id to display name
      const display: ListForDisplay = {
        validLines,
        unrecognizedLines,
      };
      return display;
    }
    return null;
  };

  onCheckboxClickLongTable = (cellLines: ReadonlySet<string>) => {
    this.setState({
      linesSelected: cellLines,
    });
  };

  formatCellLines = (cellLines: ReadonlySet<string>) => {
    const lines = new Set(cellLines);
    const data = this.props.tableData.filter((row) => {
      return lines.has(row.depmapId);
    });
    if (data.length == 0) {
      return <span className="italicize">No cell lines in this list</span>;
    }
    return (
      <ul className="cell-line-list-preview-container">
        {data.map((line) => (
          <li key={line.displayName}>
            <a href={`${this.cellLineUrlRoot}${line.depmapId}`}>
              {line.displayName}
            </a>
          </li>
        ))}
      </ul>
    );
  };

  discardChanges = () => {
    this.setState({
      linesSelected: new Set(
        this.state.selectedList ? this.state.selectedList.lines : []
      ),
      mode: "View",
    });
  };

  hideCloseConfirmationModal = () => {
    this.setState({
      showCloseConfirmationModal: false,
    });
  };

  hideSaveConfirmationModal = () => {
    this.setState({
      showSaveConfirmationModal: false,
    });
  };

  render() {
    const allLineNames = new Set(
      this.props.tableData.map((cellLine) => cellLine.depmapId)
    );

    const helpOverlay =
      this.state.selectedList == null && this.state.mode == "View" ? (
        <div className="help-overlay">
          <p className="main-instruction">
            Click on a list to the left or create a new list to get started
          </p>
          <p>
            Use this tool to download slices of datasets for subsets of cell
            lines or define lists of cell lines that you can use around the
            portal.
          </p>
          <CellLineSelectorUsage />
          <br />

          <Alert bsStyle="warning">
            <p>
              <strong>WARNING: </strong> Clearing your browser cache will delete
              all of your cell line lists!
            </p>
            <p>
              To permanently save a list, please click the{" "}
              <span
                className="glyphicon glyphicon-download-alt"
                aria-label="download"
              />{" "}
              icon to download it.
            </p>
          </Alert>
        </div>
      ) : null;

    const listPreviewOverlay =
      this.state.selectedList != null && this.state.mode != "Edit" ? (
        <div className="help-overlay">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ paddingBottom: "5px" }}>
              {this.state.selectedList.lines.size} cell lines in{" "}
              <span className="italicize">{this.state.selectedList.name}</span>:
            </h3>
            <div className="list-of-lines">
              {this.formatCellLines(this.state.selectedList.lines)}
            </div>
            <div>
              <Button
                style={{ marginTop: "auto", width: "100%" }}
                bsClass="custom-button"
                onClick={() => {
                  this.setState({
                    mode: "Edit",
                  });
                }}
              >
                Edit this list
              </Button>
            </div>
          </div>
        </div>
      ) : null;

    return (
      <div className="cell-line-selector-parent">
        <div className="cellLineSelector">
          <CustomListsMenu
            currentlySelectedLines={this.state.linesSelected}
            allLineNames={allLineNames}
            store={this.state.store}
            savedLinesAndNamesArray={this.state.savedLinesAndNamesArray}
            selectedList={
              this.state.selectedList || { name: "", lines: new Set([]) }
            }
            createNewList={this.createNewList}
            saveCellLinesList={this.saveCellLinesList}
            deleteCellLinesList={this.deleteCellLinesList}
            editListName={this.editListName}
            selectCellLinesList={this.selectCellLinesList}
            mode={this.state.mode}
            setMode={(newMode: CellLineSelectorMode) => {
              this.setState({ mode: newMode });
            }}
            saveListName={this.onSaveButtonClick}
          />

          <div className="selectorPanel">
            {helpOverlay}
            {listPreviewOverlay}
            {this.state.selectedList && this.state.mode == "Edit" && (
              <>
                <LongTableCellLineSelector
                  key={
                    this.state.selectedList
                      ? this.state.selectedList.name + this.state.mode
                      : ""
                  }
                  idCol="depmapId"
                  frozenCols={["displayName"]}
                  initialData={this.props.tableData}
                  onCheckboxClick={this.onCheckboxClickLongTable}
                  defaultChecked={
                    this.state.selectedList
                      ? this.state.selectedList.lines
                      : new Set([])
                  }
                  cellLineUrlRoot={this.cellLineUrlRoot}
                  colorMaps={this.props.colorMaps}
                  onLongTableFilterChange={(visibleLines: string[]) => {
                    const hiddenLines = new Set<string>(
                      this.state.linesSelected
                    );
                    visibleLines.forEach((line: string) => {
                      hiddenLines.delete(line);
                    });
                    this.setState({
                      linesSelectedAndHidden: hiddenLines,
                    });
                  }}
                />

                <div className="saveAndDiscardButtons">
                  <Button
                    bsClass="custom-button"
                    bsSize="small"
                    onClick={() => {
                      if (
                        this.state.linesSelected.size > 0 &&
                        this.state.linesSelectedAndHidden.size == 0
                      ) {
                        this.onSaveButtonClick();
                      } else {
                        this.setState({
                          showSaveConfirmationModal: true,
                        });
                      }
                    }}
                  >
                    <span
                      className="glyphicon glyphicon-floppy-disk interactive-glyphicon-button"
                      aria-hidden="true"
                    />{" "}
                    Save List
                  </Button>
                  <Button
                    bsSize="small"
                    onClick={() => {
                      if (
                        this.state.selectedList &&
                        setsAreEqual(
                          this.state.selectedList.lines,
                          this.state.linesSelected
                        )
                      ) {
                        this.discardChanges();
                      } else {
                        this.setState({
                          showCloseConfirmationModal: true,
                        });
                      }
                    }}
                  >
                    <span
                      className="glyphicon glyphicon-trash interactive-glyphicon-button"
                      aria-hidden="true"
                    />{" "}
                    Discard Changes
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <Modal
          show={this.state.showCloseConfirmationModal}
          onHide={this.hideCloseConfirmationModal}
        >
          <Modal.Body>
            Are you sure you want to discard your changes? <br />
          </Modal.Body>
          <Modal.Footer>
            <Button bsSize="small" onClick={this.hideCloseConfirmationModal}>
              Do Not Discard Changes
            </Button>
            <Button
              bsStyle="danger"
              bsSize="small"
              onClick={() => {
                this.discardChanges();
                this.hideCloseConfirmationModal();
              }}
            >
              Discard Changes
            </Button>
          </Modal.Footer>
        </Modal>

        <SaveConfirmationModal
          show={this.state.showSaveConfirmationModal}
          onHide={this.hideSaveConfirmationModal}
          linesSelected={this.state.linesSelected}
          linesSelectedAndHidden={this.state.linesSelectedAndHidden}
          formatCellLines={this.formatCellLines}
          onSaveButtonClick={this.onSaveButtonClick}
          onSaveFilteredLines={() => {
            this.hideSaveConfirmationModal();

            this.setState(
              {
                linesSelected: new Set(
                  [...this.state.linesSelected].filter(
                    (x) => !this.state.linesSelectedAndHidden.has(x)
                  )
                ),
              },
              () => {
                this.onSaveButtonClick();
              }
            );
          }}
        />
      </div>
    );
  }
}

interface CustomListsMenuProps {
  currentlySelectedLines: ReadonlySet<string>;
  allLineNames: ReadonlySet<string>;
  store: ListStorage;

  savedLinesAndNamesArray: ReadonlyArray<CustomList>;
  selectedList: CustomList;

  createNewList: (lines: ReadonlySet<string>) => void;
  saveCellLinesList: (
    newListName: string,
    newListContents: ReadonlySet<string>,
    index?: number
  ) => void;
  deleteCellLinesList: (listToBeDeletedName: string) => void;
  editListName: (newName: string) => void;
  selectCellLinesList: (
    customListName: string,
    customListLines: ReadonlySet<string>,
    allowToggle: boolean
  ) => void;

  mode: CellLineSelectorMode;
  setMode: (mode: CellLineSelectorMode) => void;
  saveListName: () => void;
}

interface CustomListsMenuState {
  store: ListStorage;
  showDeleteConfirmationModal: boolean;
  listToDelete: string;

  showUploadModal: boolean;
  cellLinesFromUploadFile: ReadonlySet<string>;
}

export class CustomListsMenu extends React.Component<
  CustomListsMenuProps,
  Partial<CustomListsMenuState>
> {
  private clickTimeout?: ReturnType<typeof setTimeout>;

  constructor(props: CustomListsMenuProps) {
    super(props);

    this.state = {
      store: this.props.store ? this.props.store : new LocalStorageListStore(),
      showDeleteConfirmationModal: false,
      showUploadModal: false,
      cellLinesFromUploadFile: undefined,
    };
  }

  downloadList(listName: string, listContents: ReadonlySet<string>) {
    const outputString = Array.from(listContents).join(",");
    const element = document.createElement("a");
    const file = new Blob([outputString], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${listName}.txt`;
    document.body.appendChild(element);
    element.click();
  }

  uploadList = () => {
    this.props.createNewList(this.state.cellLinesFromUploadFile || new Set([]));
    this.hideUploadModal();
  };

  // for a single click, select the list (or deselect the list if you clicked the one that is currently selected)
  // for a double click, if the list you double clicked is the same as the one you have selected, go into edit list name mode
  handleListClick(customList: CustomList) {
    // if the user clicks on a different list than what is selected, select the list (no need to check double vs single click)
    if (
      !this.props.selectedList ||
      this.props.selectedList.name != customList.name
    ) {
      this.props.selectCellLinesList(customList.name, customList.lines, true);
    }
    // if the user clicks on the selected list, we need to see if it was a double or single click
    else {
      console.log("selected list has been clicked");
      // if a double click, we should go into EditListNameOnly mode
      if (this.clickTimeout !== undefined) {
        // double-clicking to edit a list name should only be allowed when we're not in the edit mode
        if (this.props.mode != "Edit") {
          // this may be redundant
          // if we don't have a list selected, we'll select that and put the name up for editing
          this.props.setMode("EditListNameOnly");
        }
        clearTimeout(this.clickTimeout);
        this.clickTimeout = undefined;
      } else {
        // for a single click, we need to wait to confirm that the user is not doing a double-click, then execute the single-click action
        this.clickTimeout = setTimeout(() => {
          if (this.props.mode != "Edit") {
            this.props.selectCellLinesList(
              customList.name,
              customList.lines,
              true
            );
          }
          if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = undefined;
          }
        }, 200);
      }
    }
  }

  formatListOfListsForDisplay(lists: ReadonlyArray<CustomList>) {
    const selectedListName = this.props.selectedList
      ? this.props.selectedList.name
      : "";

    return (
      <ListGroup>
        {lists.map((customList) => (
          <ListGroupItem
            onClick={() => {
              if (
                !(
                  this.props.mode == "Edit" &&
                  customList.name != selectedListName
                )
              )
                this.handleListClick(customList);
            }}
            disabled={
              this.props.mode == "Edit" && customList.name != selectedListName
            }
            active={customList.name == selectedListName}
            key={customList.name}
          >
            <div className="cell-line-list-button-group">
              {(this.props.mode == "Edit" ||
                this.props.mode == "EditListNameOnly") &&
              customList.name == selectedListName ? (
                <input
                  type="text"
                  className="edit-list-name-input"
                  defaultValue={customList.name}
                  onChange={(event) =>
                    this.props.editListName(event.target.value)
                  }
                  onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                    if (this.props.mode == "EditListNameOnly") {
                      this.props.setMode("View");
                      if (event.target.value != this.props.selectedList.name) {
                        this.props.saveListName();
                      }
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span>{customList.name}</span>
              )}

              <span
                className="glyphicon glyphicon-download-alt action-button interactive-glyphicon-button"
                onClick={(e) => {
                  this.downloadList(customList.name, customList.lines);
                  e.stopPropagation();
                }}
              />
              <span
                className="glyphicon glyphicon-trash action-button interactive-glyphicon-button"
                onClick={(e) => {
                  this.showDeleteConfirmationModal(customList.name);
                  e.stopPropagation();
                }}
              />
            </div>
          </ListGroupItem>
        ))}
      </ListGroup>
    );
  }

  showDeleteConfirmationModal(listName: string) {
    this.setState({
      showDeleteConfirmationModal: true,
      listToDelete: listName,
    });
  }

  hideDeleteConfirmationModal = () => {
    this.setState({
      showDeleteConfirmationModal: false,
      listToDelete: undefined,
    });
  };

  hideUploadModal = () => {
    this.setState({
      showUploadModal: false,
    });
  };

  handleFiles(files: FileList | null) {
    if (files) {
      Papa.parse(files[0], {
        complete: this.updateStateOnFileRead,
        skipEmptyLines: true,
      });
    }
  }

  updateStateOnFileRead = (results: Papa.ParseResult) => {
    if (results && results.data.length > 0) {
      let lines = new Set<string>();
      for (let i = 0; i < results.data.length; i++) {
        lines = new Set([
          ...lines,
          ...results.data[i].map((item: string) => item.trim()),
        ]);
      }
      lines.delete("");
      this.setState({
        cellLinesFromUploadFile: lines,
      });
    } else {
      alert("Please upload a valid file");
    }
  };

  render() {
    const listDisplay = this.formatListOfListsForDisplay(
      this.props.savedLinesAndNamesArray
    );

    return (
      <div className="parentDiv">
        <div className="listOfListsPanel">
          <div className="new-list-buttons-container">
            <Button
              onClick={() => this.props.createNewList(new Set<string>())}
              disabled={this.props.mode == "Edit"}
            >
              <div>
                <span
                  className="glyphicon glyphicon-plus interactive-glyphicon-button"
                  aria-hidden="true"
                />{" "}
                <span>Create custom list</span>
              </div>
            </Button>

            <Button
              onClick={() =>
                this.setState({
                  showUploadModal: true,
                })
              }
              disabled={this.props.mode == "Edit"}
            >
              <div>
                <span
                  className="glyphicon glyphicon-arrow-up interactive-glyphicon-button"
                  aria-hidden="true"
                />
                <span>Upload your own list</span>
              </div>
            </Button>
          </div>

          {listDisplay}
        </div>

        <Modal
          show={this.state.showDeleteConfirmationModal}
          onHide={this.hideDeleteConfirmationModal}
        >
          <Modal.Body>
            Are you sure you want to delete: <br />
            {this.state.listToDelete}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.hideDeleteConfirmationModal}>Cancel</Button>
            <Button
              onClick={() => {
                if (this.state.listToDelete) {
                  this.props.deleteCellLinesList(this.state.listToDelete);
                }
                this.hideDeleteConfirmationModal();
              }}
              bsStyle="danger"
            >
              Delete
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={this.state.showUploadModal} onHide={this.hideUploadModal}>
          <Modal.Body>
            Choose a file for upload. List must be a comma-separated list of
            cell line Depmap ID&apos;s <br />
            (e.g. ACH-000001,ACH-000002,...) <br />
            <input
              type="file"
              accept=".txt,.csv"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                this.handleFiles(e.target.files)
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.hideUploadModal}>Cancel</Button>
            <Button onClick={this.uploadList}>Upload</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default CellLineSelectorModal;
