import React from "react";
import VirtualList from "react-tiny-virtual-list";
import styles from "../../../styles/DataExplorer2.scss";

// PairsVirtualList
//
// Presentational sibling of PlotSelections/LabelsVirtualList for expanded
// plots. The list stays flat and fixed-item-size (so virtualization stays
// trivial), but rows come in two kinds: a `header` row per selected index
// entity (model) and a `member` row per selected expansion (transcript)
// beneath it. Members are indented with a margin so the flat list reads as a
// grouped one. ExpandedPlotSelections builds the rows; this just renders them.
//
// `key` carries a stable id per row (entityRefKey for members, a header-
// prefixed index id for headers) so React keys survive reordering and never
// collide.
export interface SelectionRow {
  kind: "header" | "member";
  label: string;
  key: string;
}

const ITEM_SIZE = 20;

function PairsVirtualList({
  items,
  maxHeight,
}: {
  items: SelectionRow[];
  maxHeight: number;
}) {
  const height = Math.min(items.length * ITEM_SIZE, maxHeight);

  return (
    <VirtualList
      className={styles.plotSelectionsList}
      width="100%"
      height={height}
      itemCount={items.length}
      itemSize={ITEM_SIZE}
      data-overflow
      renderItem={({ index, style }) => {
        const item = items[index];

        return (
          <div
            className={styles.pairsVirtualListItem}
            key={item.key}
            style={style}
            data-kind={item.kind}
          >
            <div style={{ marginLeft: item.kind === "member" ? 16 : 0 }}>
              {item.label}
            </div>
          </div>
        );
      }}
    />
  );
}

export default PairsVirtualList;
