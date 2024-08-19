import React from "react";
import VirtualList from "react-tiny-virtual-list";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

const toHyperlink = (
  index_type: string,
  plot_type: string,
  label: string,
  displayLabel: string
) => {
  // FIXME: The correlation heatmap is weird. The index_type does not actually
  // reflect what you're selecting. We would need slice_type for that.
  if (plot_type === "correlation_heatmap") {
    return displayLabel;
  }

  if (index_type === "compound_experiment") {
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
    depmap_model: `../cell_line/${label}`,
  };

  if (!urlFor[index_type]) {
    return label;
  }

  return (
    <a href={urlFor[index_type]} target="_blank" rel="noreferrer">
      {displayLabel}
    </a>
  );
};

function LabelsVirtualList({
  displayLabels,
  labels,
  index_type,
  plot_type,
  maxHeight,
}: {
  displayLabels: string[];
  labels: string[];
  index_type: string;
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
              index_type,
              plot_type,
              labels[index],
              displayLabels[index]
            )}
          </div>
        );
      }}
    />
  );
}

export default LabelsVirtualList;
