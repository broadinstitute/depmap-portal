import React, { useLayoutEffect, useState } from "react";
import cx from "classnames";
import usePrecomputedAssocationData from "../../../hooks/usePrecomputedAssocationData";
import AssociationsTableHeader from "./AssociationsTableHeader";
import AssociationsTableRow from "./AssociationsTableRow";
import styles from "../../../styles/PrecomputedAssociations.scss";

interface Props {
  data: ReturnType<typeof usePrecomputedAssocationData>;
  yDatasetId: string | null;
  yDimensionId: string | null;
  onClickRow: (
    dataset_id: string,
    slice_label: string,
    slice_type: string,
    given_id?: string
  ) => void;
  staticContentRef: React.RefObject<HTMLDivElement>;
  hiddenDatasets: Set<string>;
  onChangeHiddenDatasets: (nextValue: Set<string>) => void;
  sortDirection: "desc" | "asc";
  onChangeSortDirection: (nextValue: "desc" | "asc") => void;
  sortColumn: "correlation" | "log10qvalue";
  onChangeSortColumn: (nextValue: "correlation" | "log10qvalue") => void;
}

function AssociationsTable({
  data,
  yDatasetId,
  yDimensionId,
  onClickRow,
  staticContentRef,
  hiddenDatasets,
  onChangeHiddenDatasets,
  sortDirection,
  onChangeSortDirection,
  sortColumn,
  onChangeSortColumn,
}: Props) {
  const [textHeight, setTextHeight] = useState(0);

  useLayoutEffect(() => {
    if (staticContentRef.current) {
      setTextHeight(staticContentRef.current.offsetHeight);
    }
  }, [data, staticContentRef]);

  return (
    <div
      data-inner-scroll
      className={styles.tableWrapper}
      style={{ maxHeight: `calc(100vh - ${textHeight}px - 168px)` }}
    >
      <table className={cx("table", styles.associationsTable)}>
        <thead>
          <AssociationsTableHeader
            hiddenDatasets={hiddenDatasets}
            onChangeHiddenDatasets={onChangeHiddenDatasets}
            sortDirection={sortDirection}
            onChangeSortDirection={onChangeSortDirection}
            sortColumn={sortColumn}
            onChangeSortColumn={onChangeSortColumn}
            associatedDatasets={data.associatedDatasets}
          />
        </thead>
        <tbody>
          {data.sortedFilteredAssociatedDimensions.map((d) => (
            <AssociationsTableRow
              key={d.other_dataset_id + d.other_dimension_given_id}
              onClickRow={onClickRow}
              datasetLookup={data.datasetLookup}
              associatedDimension={d}
              selected={
                d.other_dataset_id === yDatasetId &&
                d.other_dimension_given_id === yDimensionId
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AssociationsTable;
