/* eslint-disable */
import {
  getSelectedCellLineListName,
  setSelectedCellLineListName,
} from "@depmap/utils";

const prefix = "DTable-";

export interface CustomList {
  // Name of the list
  name: string;
  // Set of Depmap IDs
  lines: ReadonlySet<string>;
  // Tracks whether this list was derived from a Model Context.
  // Custom Analysis still wants a flat list of lines as input,
  // but the output is displayed in Data Explorer 2. It's nicer
  // to show the original context there than the throwaway list.
  fromContext?: {
    hash: string;
    negated: boolean;
  };
}

export interface ListStorage {
  getLists: () => Array<CustomList>;
  add: (list: CustomList, index: number) => void;
  delete: (key: string) => void;
  importFromOldCellLineHighlighterIfExists: () => void;
}

export const DEFAULT_EMPTY_CELL_LINE_LIST: CustomList = {
  name: "None",
  lines: new Set(),
};
export class LocalStorageListStore implements ListStorage {
  getLists(): Array<CustomList> {
    const namesList = this.getListOfListNames();
    const readListsFromStorage = namesList.map((name) => this.readList(name));
    return readListsFromStorage;
  }

  importFromOldCellLineHighlighterIfExists() {
    /**
     * We previously had cell line highlighter, which was like this cell line selector, except that it only allowed storing one list
     * We now have this new, multi-list cell line selector, and are removing the old single-list highlighter
     * This removal would mean that people now longer have access to their previously saved lists. Thus, we automatically import and create a list from the old highlighter.
     */
    const oldCellLineHighlighterList = localStorage.getItem(
      "favoriteCellLinesGroup"
    );
    if (oldCellLineHighlighterList != null) {
      // old thing exists
      if (oldCellLineHighlighterList != "[]") {
        // a cell line list was created
        const imported = JSON.parse(oldCellLineHighlighterList);
        this.add({ name: "Imported from existing", lines: new Set(imported) });
      }
      localStorage.removeItem("favoriteCellLinesGroup"); // remove old localstorage key
    }
  }

  removeNameFromList(name: string, list: ReadonlyArray<CustomList>) {
    // returns the list, excluding those with the specified name
    return list.filter((x) => {
      return x.name != name;
    });
  }

  getListOfListNames(): ReadonlyArray<string> {
    const raw = localStorage.getItem(`${prefix}ListOfListNames`);
    if (raw != null && raw != "") {
      const lists = JSON.parse(raw);
      return lists.filter((listName: unknown) => typeof listName === "string");
    }
    return [];
  }

  saveListOfListNames(names: ReadonlyArray<string>) {
    localStorage.setItem(`${prefix}ListOfListNames`, JSON.stringify(names));
  }

  saveList(name: string, lines: ReadonlySet<string>) {
    localStorage.setItem(`${prefix}List:${name}`, JSON.stringify([...lines]));
  }

  removeList(name: string) {
    localStorage.removeItem(`${prefix}List:${name}`);
  }

  readList(name: string): CustomList {
    const listName = `${prefix}List:${name}`;
    const json = localStorage.getItem(listName);
    return {
      name,
      lines: new Set(json ? JSON.parse(json) : []),
    };
  }

  readSelectedList(): CustomList {
    const selectedList = getSelectedCellLineListName();
    return this.readList(selectedList);
  }

  add(list: CustomList, index = 0) {
    const listNames = this.getListOfListNames();
    const updatedListNames = listNames.filter((x) => x != list.name);
    updatedListNames.splice(index, 0, list.name);
    this.saveList(list.name, list.lines);
    this.saveListOfListNames(updatedListNames);

    // Note: the 'storage' event only fires when localStorage is updated in a
    // different document
    const event = new Event("celllinelistsupdated");
    window.dispatchEvent(event);
  }

  delete(name: string) {
    const listNames = this.getListOfListNames();
    const updatedListNames = listNames.filter((x) => x != name);
    this.saveListOfListNames(updatedListNames);
    this.removeList(name);

    // modify the localStorage indicated the selected list
    if (name == getSelectedCellLineListName()) {
      setSelectedCellLineListName(DEFAULT_EMPTY_CELL_LINE_LIST.name);
    }

    // Note: the 'storage' event only fires when localStorage is updated in a
    // different document
    const event = new Event("celllinelistsupdated");
    window.dispatchEvent(event);
  }
}
