import React, { useMemo, useRef, useState } from "react";
import cx from "classnames";
import { WordBreaker } from "@depmap/common-components";
import { Associations, sliceToDataset } from "./utils";
import DatasetFilterModal from "./DatasetFilterModal";
import styles from "../../../../styles/LegacyPrecomputedAssociations.scss";

interface Props {
  associations: Associations;
  isLoading: boolean;
  yDatasetId: string | null;
  yEntityLabel: string | null;
  sortByAbsoluteValue: boolean;
  onClickRow: (
    other_dataset_id: string,
    other_entity_label: string,
    other_entity_type: string
  ) => void;
}

function PrecomputedAssociationsTable({
  associations,
  isLoading,
  yDatasetId,
  yEntityLabel,
  sortByAbsoluteValue,
  onClickRow,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [hiddenDatasets, setHiddenDatasets] = useState<Set<string>>(new Set());

  const sortedFilteredData = useMemo(() => {
    return associations.data
      .filter((d) => !hiddenDatasets.has(d.other_dataset))
      .sort((a, b) => {
        let corrA = sortDirection === "desc" ? a.correlation : b.correlation;
        let corrB = sortDirection === "desc" ? b.correlation : a.correlation;

        if (sortByAbsoluteValue) {
          corrA = Math.abs(corrA);
          corrB = Math.abs(corrB);
        }

        return corrB - corrA;
      });
  }, [associations, hiddenDatasets, sortDirection, sortByAbsoluteValue]);

  if (associations.data.length === 0) {
    return <div className={styles.noData}>(no associations found)</div>;
  }

  const textHeight = ref.current
    ? (ref.current.parentElement!.firstChild! as HTMLDivElement).offsetHeight
    : 0;

  return (
    <div
      ref={ref}
      data-inner-scroll
      className={styles.tableWrapper}
      key={`${sortByAbsoluteValue}-${sortedFilteredData[0].other_entity_label}`}
      style={{
        maxHeight: `calc(100vh - ${textHeight + 237}px)`,
      }}
    >
      <table
        className={cx("table", styles.associationsTable, {
          [styles.isLoading]: isLoading,
        })}
      >
        <thead>
          <tr>
            <th>Gene / Compound</th>
            <th>
              <button type="button" onClick={() => setShowModal(true)}>
                <span>Dataset</span>
                <i className="glyphicon glyphicon-filter" />
              </button>
            </th>
            <th>
              <button
                type="button"
                onClick={() => {
                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
              >
                <span>Correlation</span>
                <i
                  className={`glyphicon ${
                    sortDirection === "asc"
                      ? "glyphicon-triangle-top"
                      : "glyphicon-triangle-bottom"
                  }`}
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedFilteredData.map((d) => {
            const dataset_id = sliceToDataset(d.other_slice_id);
            const selected =
              d.other_entity_label === yEntityLabel &&
              dataset_id === yDatasetId;

            return (
              <tr
                key={d.other_slice_id}
                tabIndex={0}
                className={selected ? styles.selectedRow : ""}
                onClick={() =>
                  onClickRow(
                    dataset_id,
                    d.other_entity_label,
                    d.other_entity_type
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();

                    onClickRow(
                      dataset_id,
                      d.other_entity_label,
                      d.other_entity_type
                    );
                  }
                }}
              >
                <td>
                  <WordBreaker text={d.other_entity_label} />
                </td>
                <td>
                  <WordBreaker text={d.other_dataset} />
                </td>
                <td>{d.correlation}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <DatasetFilterModal
        show={showModal}
        onHide={() => setShowModal(false)}
        associatedDatasets={associations?.associatedDatasets || []}
        initialValue={hiddenDatasets}
        onChange={setHiddenDatasets}
      />
    </div>
  );
}

export default PrecomputedAssociationsTable;
