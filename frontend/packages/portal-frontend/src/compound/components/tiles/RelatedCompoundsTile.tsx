import React from "react";
import { CorrelationBar } from "./CorrelationBar";
import useRelatedCompoundsData from "src/compound/hooks/useRelatedCompoundsData";

// Reusable style for truncation + tooltip
const ellipsisStyle: React.CSSProperties = {
  maxWidth: "30%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

interface RelatedCompoundsTileProps {
  entityLabel: string;
  datasetId: string;
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">;
}

const RelatedCompoundsTile = ({
  entityLabel,
  datasetId,
  datasetToDataTypeMap,
}: RelatedCompoundsTileProps) => {
  const urlPrefix = window.location.origin;

  const {
    datasetName,
    targetCorrelationData,
    topGeneTargets,
    topCompoundCorrelates,
    isLoading,
    error,
  } = useRelatedCompoundsData(datasetId, entityLabel, datasetToDataTypeMap);
  const dataTypes = Object.values(datasetToDataTypeMap);

  return (
    topGeneTargets.length > 0 &&
    topCompoundCorrelates.length > 0 && (
      <article className="card_wrapper">
        <div className="card_border container_fluid">
          <h2 className="no_margin cardtitle_text">Related Compounds</h2>
          <h3 className="no_margin cardtitle_text">{datasetName}</h3>
          <div className="card_padding">
            <table style={{ width: "100%", tableLayout: "fixed" }}>
              {" "}
              {/* use fixed layout so column widths are based on width/maxWidth, not content size */}
              <thead>
                <tr>
                  {/* Data type columns */}
                  {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                  <th
                    rowSpan={2}
                    style={{ textAlign: "left", padding: "8px" }}
                  />
                  {dataTypes.map((dataType) => (
                    <th
                      key={dataType}
                      colSpan={topGeneTargets.length}
                      style={{ textAlign: "center", padding: "8px" }}
                    >
                      {dataType}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dataTypes.flatMap((dataType) =>
                    topGeneTargets.map((target) => (
                      <th
                        key={`${dataType}-${target}`}
                        style={{
                          textAlign: "center",
                          padding: "8px",
                          ...ellipsisStyle,
                        }}
                        title={target} // Tooltip for full name
                      >
                        {target}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {topCompoundCorrelates.map((compound) => (
                  <tr key={compound}>
                    <td
                      style={{
                        padding: "4px",
                        ...ellipsisStyle, // hover for full name
                      }}
                      title={compound}
                    >
                      <a
                        href={`${urlPrefix}/compound/${compound}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {compound === entityLabel ? (
                          <b>{compound}</b>
                        ) : (
                          compound
                        )}
                      </a>
                    </td>
                    {dataTypes.flatMap((dataType) =>
                      topGeneTargets.map((target) => (
                        <td
                          key={`${compound}-${dataType}-${target}`}
                          style={{ padding: "4px" }}
                        >
                          <CorrelationBar
                            correlation={
                              targetCorrelationData[compound][dataType][target]
                                ? targetCorrelationData[compound][dataType][
                                    target
                                  ].toFixed(2)
                                : null
                            }
                          />
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    )
  );
};

export default RelatedCompoundsTile;
