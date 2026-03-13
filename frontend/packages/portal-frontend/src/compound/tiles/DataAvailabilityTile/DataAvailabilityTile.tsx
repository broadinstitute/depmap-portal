import React, { useState } from "react";
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

  // 1. Handle Loading State with PlotSpinner
  if (isLoading) {
    return (
      <div
        className="card_wrapper"
        style={{
          height: "200px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PlotSpinner />
      </div>
    );
  }

  // 2. Handle Error State
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

  if (!dataAvailabilityData || dataAvailabilityData.length === 0) {
    return null;
  }

  const initialData = dataAvailabilityData.slice(0, 5);
  const extraData = dataAvailabilityData.slice(5, 50);
  const hasMore = dataAvailabilityData.length > 5;

  return (
    <div className="card_wrapper">
      <div className="card_border">
        <div>
          <h2 className="no_margin cardtitle_text">
            Datasets with data for {compoundName}
          </h2>
        </div>

        <div
          className="card_padding"
          style={{ overflowX: "auto", width: "100%" }}
        >
          <table
            style={{
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                {/* Fixed width for the first column to force wrapping */}
                <th
                  style={{
                    width: "30%",
                    textAlign: "left",
                    padding: "8px 4px",
                  }}
                >
                  Dataset
                </th>
                <th
                  style={{
                    width: "17%",
                    textAlign: "left",
                    padding: "8px 4px",
                  }}
                >
                  Cell Lines
                </th>
                <th
                  style={{
                    width: "37%",
                    textAlign: "left",
                    padding: "8px 4px",
                  }}
                >
                  Dose Range
                </th>
                <th
                  style={{
                    width: "16%",
                    textAlign: "left",
                    padding: "8px 4px",
                  }}
                >
                  Assay
                </th>
              </tr>
            </thead>
            <tbody>
              {initialData.map((entry, index: number) => (
                <tr key={index}>
                  <td
                    style={{
                      padding: "16px 8px 16px 4px", // Significant top/bottom padding
                      verticalAlign: "top", // Keep rows aligned
                      wordWrap: "break-word",
                      whiteSpace: "normal",
                    }}
                  >
                    <a href={entry.datasetUrl || ""}>
                      {entry.datasetDisplayName}
                    </a>
                  </td>
                  <td style={{ padding: "16px 4px", verticalAlign: "top" }}>
                    {entry.cellLineCount}
                  </td>
                  <td style={{ padding: "16px 4px", verticalAlign: "top" }}>
                    {entry.doseRangeLabel}
                  </td>
                  <td style={{ padding: "16px 4px", verticalAlign: "top" }}>
                    {entry.assayLabel}
                  </td>
                </tr>
              ))}

              {isExpanded &&
                extraData.map((entry, index) => (
                  <tr key={index + 5}>
                    <td
                      style={{ wordWrap: "break-word", whiteSpace: "normal" }}
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

          {hasMore && (
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  cursor: "pointer",
                  color: "#007bff",
                  background: "none",
                  border: "none",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                {isExpanded ? "View Less" : "View More"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatasetAvailabilityTile;
