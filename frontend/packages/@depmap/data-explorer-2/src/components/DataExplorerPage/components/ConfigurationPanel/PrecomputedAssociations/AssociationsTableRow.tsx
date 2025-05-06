import React, { useEffect, useRef } from "react";
import { WordBreaker } from "@depmap/common-components";
import usePrecomputedAssocationData from "../../../hooks/usePrecomputedAssocationData";
import styles from "../../../styles/PrecomputedAssociations.scss";

type AssociatedDimension = ReturnType<
  typeof usePrecomputedAssocationData
>["associatedDimensions"][number];

type DatasetLookup = ReturnType<
  typeof usePrecomputedAssocationData
>["datasetLookup"];

interface Props {
  selected: boolean;
  associatedDimension: AssociatedDimension;
  onClickRow: (
    dataset_id: string,
    slice_label: string,
    slice_type: string,
    given_id?: string
  ) => void;

  datasetLookup: DatasetLookup;
}

function AssociationsTableRow({
  associatedDimension,
  selected,
  onClickRow,
  datasetLookup,
}: Props) {
  const elementRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (selected && elementRef.current) {
      setTimeout(() => {
        const el = elementRef.current;
        const container = el?.closest("[data-inner-scroll]");

        if (!el || !container) {
          return;
        }

        const stickyHeaderOffset = 50;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        const viewTop = container.scrollTop + stickyHeaderOffset;
        const viewBottom = container.scrollTop + container.clientHeight;

        if (elTop >= viewTop && elBottom <= viewBottom) {
          return;
        }

        const alignTopDelta = elTop - stickyHeaderOffset - container.scrollTop;
        const alignBottomDelta =
          elBottom - container.clientHeight - container.scrollTop;

        const shouldAlignTop =
          Math.abs(alignTopDelta) < Math.abs(alignBottomDelta);

        const targetScrollTop = shouldAlignTop
          ? elTop - stickyHeaderOffset
          : elBottom - container.clientHeight;

        container.scrollTo({ top: targetScrollTop });
      });
    }
  }, [selected]);

  const {
    other_dataset_id,
    other_dimension_given_id,
    other_dimension_label,
    correlation,
    log10qvalue,
  } = associatedDimension;

  const other_dimension_type = datasetLookup[other_dataset_id].dimension_type;

  const onClick = () => {
    onClickRow(
      other_dataset_id,
      other_dimension_label,
      other_dimension_type,
      other_dimension_given_id
    );
  };

  return (
    <tr
      ref={elementRef}
      tabIndex={0}
      className={selected ? styles.selectedRow : ""}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <td>
        <WordBreaker text={other_dimension_label} />
      </td>
      <td>
        <WordBreaker text={datasetLookup[other_dataset_id].name} />
      </td>
      <td>{correlation.toFixed(3)}</td>
      <td>{log10qvalue.toFixed(3)}</td>
    </tr>
  );
}

export default AssociationsTableRow;
