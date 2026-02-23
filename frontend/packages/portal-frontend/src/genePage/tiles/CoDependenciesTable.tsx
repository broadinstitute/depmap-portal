/* eslint-disable jsx-a11y/control-has-associated-label */
import React from "react";
import styles from "./styles/TopCoDependencies.scss";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";
import { Tooltip } from "@depmap/common-components";
import CorrelationMeter from "src/predictability/components/CorrelationMeter";
import { toPortalLink } from "@depmap/globals";

interface CoDependenciesTableProps {
  featureName: string;
  datasetId: string;
  datasetName: string;
  featureType: string;
  topDatasetCorrelations: AssociatedFeatures[];
}

export const CoDependenciesTable: React.FC<CoDependenciesTableProps> = ({
  featureName,
  datasetId,
  datasetName,
  featureType, // should be gene
  topDatasetCorrelations,
}) => {
  const dataExplorerBase = "/data_explorer_2/";
  return (
    <div className={styles.CoDependenciesTable}>
      <h3
        className={styles.tableDatasetTitle}
        style={
          datasetId === "Chronos_Combined"
            ? { color: "#3584b5" }
            : { color: "#532E8C" }
        }
      >
        {datasetName}
      </h3>
      <table
        style={{
          width: "100%",
          tableLayout: "fixed",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={{ width: "17%" }} />
            <th style={{ width: "28%" }}>
              {featureType === "gene" ? "Gene" : "Compound"}
            </th>
            <th style={{ width: "18%", overflow: "visible" }}>Correlation</th>
            <th style={{ width: "37%" }} />
          </tr>
        </thead>
        <tbody>
          {topDatasetCorrelations.map((datasetCor, i) => {
            return (
              <tr key={`${datasetCor.other_dataset_id}-${i}`}>
                <td>
                  <a
                    href={toPortalLink(
                      `${dataExplorerBase}?xDataset=${datasetId}&xFeature=${featureName}&yDataset=${datasetCor.other_dataset_given_id}&yFeature=${datasetCor.other_dimension_label}`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Plot
                  </a>
                </td>
                <td className={styles.ellipsisStyle}>
                  <Tooltip
                    id="correlated-gene-tooltip"
                    content={datasetCor.other_dimension_label}
                    placement="top"
                  >
                    <a
                      href={toPortalLink(
                        `/${featureType}/${datasetCor.other_dimension_label}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {datasetCor.other_dimension_label}
                    </a>
                  </Tooltip>
                </td>

                <td>{datasetCor.correlation.toFixed(2)}</td>
                <td>
                  <CorrelationMeter
                    showLabel={false}
                    correlation={datasetCor.correlation}
                    customWidth={"95px"}
                    useGradedColorScheme
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
