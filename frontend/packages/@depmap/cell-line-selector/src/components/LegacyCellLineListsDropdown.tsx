import * as React from "react";
import { MenuItem, DropdownButton } from "react-bootstrap";
import { setSelectedCellLineListName } from "@depmap/utils";

import {
  CustomList,
  LocalStorageListStore,
  DEFAULT_EMPTY_CELL_LINE_LIST,
} from "./ListStorage";

export type LegacyCellLineListsDropdownProps = {
  id?: string;
  defaultNone?: boolean;
  onListSelect: (cellLineList: CustomList) => void;
  launchCellLineSelectorModal: () => void;
};

type State = {
  selectedCellLineList: CustomList;
  cellLineLists: ReadonlyArray<string>;
};

export default class LegacyCellLineListsDropdown extends React.Component<
  LegacyCellLineListsDropdownProps,
  State
> {
  cellLineListStorage = new LocalStorageListStore();

  ref: React.RefObject<HTMLDivElement>;

  static defaultProps: Partial<LegacyCellLineListsDropdownProps> = {
    id: "",
    defaultNone: false,
  };

  constructor(props: LegacyCellLineListsDropdownProps) {
    super(props);

    this.state = {
      selectedCellLineList: props.defaultNone
        ? DEFAULT_EMPTY_CELL_LINE_LIST
        : this.cellLineListStorage.readSelectedList(),
      cellLineLists: this.cellLineListStorage.getListOfListNames(),
    };

    props.onListSelect(this.state.selectedCellLineList);
    this.ref = React.createRef();
  }

  renderOption(cellLineListName: string, key: number) {
    const { onListSelect } = this.props;
    const { selectedCellLineList } = this.state;

    const cellLineListSelected = selectedCellLineList.name === cellLineListName;
    return (
      <MenuItem
        eventKey={key}
        key={key}
        active={cellLineListSelected}
        onSelect={() => {
          setSelectedCellLineListName(cellLineListName);
          const newSelectedCellLineList = this.cellLineListStorage.readList(
            cellLineListName
          );
          onListSelect(newSelectedCellLineList);
          this.setState({ selectedCellLineList: newSelectedCellLineList });
        }}
      >
        {cellLineListName}
      </MenuItem>
    );
  }

  render() {
    const { selectedCellLineList, cellLineLists } = this.state;

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div
        ref={this.ref}
        onClick={() => {
          const wrapperDiv = this.ref.current;

          if (wrapperDiv) {
            const maxHeight =
              window.innerHeight -
              wrapperDiv.offsetTop -
              wrapperDiv.clientHeight -
              20;

            const ul = wrapperDiv.querySelector("ul") as HTMLElement;
            ul.style.maxHeight = `${maxHeight}px`;
            ul.style.overflow = "auto";
          }
        }}
      >
        <DropdownButton
          className="wrap-text"
          bsStyle="default"
          title={selectedCellLineList.name}
          id={this.props.id || "cell_line_lists_dropdown"}
        >
          {this.renderOption(DEFAULT_EMPTY_CELL_LINE_LIST.name, -1)}
          <MenuItem divider />

          {cellLineLists.length > 0 &&
            cellLineLists.map(this.renderOption.bind(this))}
          {cellLineLists.length > 0 && <MenuItem divider />}

          <MenuItem
            eventKey={cellLineLists.length}
            onSelect={() => {
              this.props.launchCellLineSelectorModal();
            }}
          >
            Create/edit a list
          </MenuItem>
        </DropdownButton>
      </div>
    );
  }
}
