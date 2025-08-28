import React from "react";
import styles from "../../styles/CorrelationTile.scss";
import { CorrelationBar } from "../CorrelationBar";
import { Tooltip } from "@depmap/common-components";

interface TopRelatedCompoundsProps {
  entityLabel: string;
  datasetName: string;
  dataTypes: string[];
  topGeneTargets: string[];
  topCompoundCorrelates: string[];
  targetCorrelationData: any;
}

export const TopRelatedCompounds = ({
  entityLabel,
  datasetName,
  dataTypes,
  topGeneTargets,
  topCompoundCorrelates,
  targetCorrelationData,
}: TopRelatedCompoundsProps) => {
  const urlPrefix = window.location.origin;
  return (
    <div>
      <h3 className={styles.tileDatasetTitle}>{datasetName}</h3>
      <table style={{ width: "100%", tableLayout: "fixed" }}>
        {/* use fixed layout so column widths are based on width/maxWidth, not content size */}
        <thead>
          <tr>
            {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
            <th
              rowSpan={2}
              style={{ textAlign: "left", padding: "8px", width: "25%" }}
            />
            {dataTypes.map((dataType) => (
              <th
                key={dataType}
                colSpan={topGeneTargets.length}
                className={styles.columnStyle}
              >
                {dataType}
              </th>
            ))}
          </tr>
          <tr>
            {dataTypes.flatMap((dataType) =>
              topGeneTargets.map((target) => (
                <Tooltip
                  key={`${dataType}-${target}`}
                  id="top-gene-targets-tooltip"
                  content={target}
                  placement="top"
                >
                  <th
                    className={`${styles.ellipsisStyle} ${styles.columnStyle}`}
                  >
                    {target}
                  </th>
                </Tooltip>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {topCompoundCorrelates.map((compound) => (
            <tr key={compound}>
              <Tooltip
                id="compound-name-tooltip"
                content={compound}
                placement="top"
              >
                <td className={`${styles.ellipsisStyle} ${styles.cellStyle}`}>
                  {compound === entityLabel ? (
                    <b>{compound}</b>
                  ) : (
                    <a
                      href={`${urlPrefix}/compound/${compound}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {compound}
                    </a>
                  )}
                </td>
              </Tooltip>

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
  );
};
