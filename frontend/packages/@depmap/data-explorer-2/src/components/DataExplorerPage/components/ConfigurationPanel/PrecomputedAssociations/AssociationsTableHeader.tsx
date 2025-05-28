import React, { useState } from "react";
import usePrecomputedAssocationData from "../../../hooks/usePrecomputedAssocationData";
import DatasetFilterModal from "./DatasetFilterModal";

interface Props {
  hiddenDatasets: Set<string>;
  onChangeHiddenDatasets: (nextValue: Set<string>) => void;
  sortDirection: "desc" | "asc";
  onChangeSortDirection: (nextValue: "desc" | "asc") => void;
  sortColumn: "correlation" | "log10qvalue";
  onChangeSortColumn: (nextValue: "correlation" | "log10qvalue") => void;
  associatedDatasets: ReturnType<
    typeof usePrecomputedAssocationData
  >["associatedDatasets"];
}

const SortButton = ({
  sortDirection,
  onClick,
  children,
}: {
  sortDirection: "asc" | "desc" | null;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  return (
    <button type="button" onClick={onClick}>
      {children}
      {sortDirection && (
        <i
          className={`glyphicon ${
            sortDirection === "asc"
              ? "glyphicon-triangle-top"
              : "glyphicon-triangle-bottom"
          }`}
        />
      )}
    </button>
  );
};

function AssociationsTableHeader({
  hiddenDatasets,
  onChangeHiddenDatasets,
  sortDirection,
  onChangeSortDirection,
  sortColumn,
  onChangeSortColumn,
  associatedDatasets,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <tr>
        <th>Gene / Compound</th>
        <th>
          <button type="button" onClick={() => setShowModal(true)}>
            <span>Dataset</span>
            <i className="glyphicon glyphicon-filter" />
          </button>
        </th>
        <th>
          <SortButton
            sortDirection={sortColumn === "correlation" ? sortDirection : null}
            onClick={() => {
              if (sortColumn === "correlation") {
                onChangeSortDirection(sortDirection === "asc" ? "desc" : "asc");
              } else {
                onChangeSortDirection("desc");
                onChangeSortColumn("correlation");
              }
            }}
          >
            <span>
              Cor-
              <br />
              relation
            </span>
          </SortButton>
        </th>
        <th>
          <SortButton
            sortDirection={sortColumn === "log10qvalue" ? sortDirection : null}
            onClick={() => {
              if (sortColumn === "log10qvalue") {
                onChangeSortDirection(sortDirection === "asc" ? "desc" : "asc");
              } else {
                onChangeSortDirection("desc");
                onChangeSortColumn("log10qvalue");
              }
            }}
          >
            <span>
              Log<sub>10</sub>
              <br />
              q-value
            </span>
          </SortButton>
        </th>
      </tr>
      <DatasetFilterModal
        show={showModal}
        onHide={() => setShowModal(false)}
        associatedDatasets={associatedDatasets}
        initialValue={hiddenDatasets}
        onChange={onChangeHiddenDatasets}
      />
    </>
  );
}

export default AssociationsTableHeader;
