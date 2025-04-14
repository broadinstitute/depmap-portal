import { AsyncTypeahead } from "react-bootstrap-typeahead";

import React from "react";

export interface SearchProps {
  options: string[];
  handleSearch: (query: string) => void;
  handleChange: (selected: string[]) => void;
  searchPlaceholder: string;
  isLoading: boolean;
}

export interface SearchResponse {
  labels: string[];
}

export const SearchBar = (searchProps: SearchProps) => {
  const {
    options,
    handleSearch,
    handleChange,
    searchPlaceholder,
    isLoading,
  } = searchProps;

  const filterBy = () => true;

  return (
    <div className="metadata-search-container">
      <AsyncTypeahead
        delay={0}
        useCache={false}
        onInputChange={(input: string) => {
          if (input === "") {
            handleSearch("");
          }
        }}
        filterBy={filterBy}
        id="metadata-search"
        isLoading={isLoading}
        minLength={1}
        onSearch={handleSearch}
        onChange={handleChange}
        options={options}
        selected={[]}
        placeholder={searchPlaceholder}
        renderMenuItemChildren={(option: string) => (
          <div style={{ padding: "3px" }}>{option}</div>
        )}
        highlightOnlyResult
      />
    </div>
  );
};
