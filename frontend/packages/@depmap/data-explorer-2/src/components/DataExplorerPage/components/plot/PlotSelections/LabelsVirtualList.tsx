import React from "react";
import VirtualList from "react-tiny-virtual-list";
import styles from "../../../styles/DataExplorer2.scss";

const toHyperlink = (dimensionType: string, id: string, label: string) => {
  if (dimensionType === "compound_experiment") {
    const compound = label.replace(/\s*\(BRD:.*\)/, "");

    return (
      <span>
        <a href={`../compound/${compound}`} target="_blank" rel="noreferrer">
          {compound}
        </a>
      </span>
    );
  }

  const urlFor: Record<string, string | undefined> = {
    gene: `../gene/${label}`,
    depmap_model: `../cell_line/${id}`,
  };

  if (!urlFor[dimensionType]) {
    return label;
  }

  return (
    <a href={urlFor[dimensionType]} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
};

function LabelsVirtualList({
  ids,
  labels,
  index_type,
  slice_type,
  plot_type,
  maxHeight,
}: {
  ids: string[];
  labels: string[];
  index_type: string;
  slice_type: string;
  plot_type: string;
  maxHeight: number;
}) {
  const height = Math.min(labels.length * 20, maxHeight);

  return (
    <VirtualList
      className={styles.plotSelectionsList}
      width="100%"
      height={height}
      itemCount={labels.length}
      itemSize={20}
      data-overflow
      renderItem={({ index, style }) => {
        return (
          <div
            className={styles.virtualListItem}
            key={labels[index]}
            style={style}
          >
            {toHyperlink(
              plot_type === "correlation_heatmap" ? slice_type : index_type,
              ids[index],
              labels[index]
            )}
          </div>
        );
      }}
    />
  );
}

export default LabelsVirtualList;
