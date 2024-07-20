import React from "react";
import { Typeahead } from "react-bootstrap-typeahead";

export interface FileSearchOption {
  filename: string;
  releasename: string;
  description: string;
}

export interface FileSearchProps {
  searchOptions: FileSearchOption[];
  onSearch: (selection: FileSearchOption) => void;
  searchPlaceholder: string;
  selected?: any[];
  handleClearSearch?: () => void;
}

export const FileSearch = (fileSearchProps: FileSearchProps) => {
  const {
    searchOptions,
    onSearch,
    searchPlaceholder,
    handleClearSearch,
    selected = [],
  } = fileSearchProps;

  const filterByFields = ["filename", "releasename", "description"];

  return (
    <div style={{ maxWidth: "74ch" }}>
      <Typeahead
        filterBy={filterByFields}
        id="file-search"
        labelKey="filename"
        clearButton
        onChange={(options: FileSearchOption[]) => {
          if (options[0]) {
            onSearch(options[0]);
          }
          if (handleClearSearch) {
            handleClearSearch();
          }
        }}
        disabled={!searchOptions}
        options={searchOptions || []}
        selected={selected}
        minLength={1}
        placeholder={searchPlaceholder}
        renderMenuItemChildren={(option: FileSearchOption) => (
          <div>
            {option.filename}
            <div>
              <small>{`Release: ${option.releasename}`}</small>
            </div>
          </div>
        )}
        highlightOnlyResult
      />
    </div>
  );
};
