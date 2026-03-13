import React, { useState } from "react";
import styles from "../CompoundTiles.scss";
import useDataAvailabilityTileData from "../hooks/useDataAvailabilityTileData";
import { MatrixDataset } from "@depmap/types";
import PlotSpinner from "src/plot/components/PlotSpinner";

interface DatasetAvailabilityTileProps {
  compoundName: string;
  compoundId: string;
  datasets: MatrixDataset[];
}

export const DatasetAvailabilityTile: React.FC<DatasetAvailabilityTileProps> = ({
  compoundId,
  compoundName,
  datasets,
}) => {
  const {
    dataAvailabilityData,
    error,
    isLoading,
  } = useDataAvailabilityTileData(compoundId, datasets);

  const [isExpanded, setIsExpanded] = useState(false);

  if (error) {
    return (
      <div
        className="card_wrapper"
        style={{ color: "#d93025", padding: "20px" }}
      >
        <strong>Error:</strong> Failed to load dataset availability for{" "}
        {compoundName}.
      </div>
    );
  }

  if (
    !isLoading &&
    (!dataAvailabilityData || dataAvailabilityData.length === 0)
  ) {
    return null;
  }

  const initialData = dataAvailabilityData.slice(0, 5);
  const extraData = dataAvailabilityData.slice(5, 50);
  const hasMore = dataAvailabilityData.length > 5;

  return (
    <article
      className={`${styles.DatasetAvailabilityTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_wrapper">
        <div className="card_border container_fluid">
          <div>
            <h2 className="no_margin cardtitle_text">
              Datasets with data for {compoundName}
            </h2>
          </div>

          <div
            className="card_padding"
            style={{ overflowX: "auto", width: "100%" }}
          >
            {isLoading && <PlotSpinner />}
            {!isLoading && (
              <table className={styles.infoTable}>
                <thead>
                  <tr>
                    {/* Fixed width for the first column to force wrapping */}
                    <th className={styles.datasetColth}>Dataset</th>
                    <th className={styles.cellLinesColth}>Cell Lines</th>
                    <th className={styles.doseRangeColth}>Dose Range</th>
                    <th className={styles.assayColth}>Assay</th>
                  </tr>
                </thead>
                <tbody>
                  {initialData.map((entry, index: number) => (
                    <tr key={index}>
                      <td className={styles.datasetColContent}>
                        <a href={entry.datasetUrl || ""}>
                          {entry.datasetDisplayName}
                        </a>
                      </td>
                      <td className={styles.cellLineColContent}>
                        {entry.cellLineCount}
                      </td>
                      <td className={styles.doseRangeLabelColContent}>
                        {entry.doseRangeLabel}
                      </td>
                      <td className={styles.assayLabelColContent}>
                        {entry.assayLabel}
                      </td>
                    </tr>
                  ))}

                  {isExpanded &&
                    extraData.map((entry, index) => (
                      <tr key={index + 5}>
                        <td
                          style={{
                            wordWrap: "break-word",
                            whiteSpace: "normal",
                          }}
                        >
                          <a href={entry.datasetUrl || ""}>
                            {entry.datasetDisplayName}
                          </a>
                        </td>
                        <td>{entry.cellLineCount}</td>
                        <td>{entry.doseRangeLabel}</td>
                        <td>{entry.assayLabel}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {!isLoading && hasMore && (
              <div style={{ marginTop: "25px", marginBottom: "16px" }}>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={styles.buttonLink}
                >
                  {isExpanded ? "View Less" : "View More"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default DatasetAvailabilityTile;
