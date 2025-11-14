/* eslint-disable jsx-a11y/control-has-associated-label */
import React from "react";
import { DependencyMeter } from "./DependencyMeter";
import { toStaticUrl } from "@depmap/globals";
import styles from "../../styles/CorrelationTile.scss";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";
import { Tooltip } from "@depmap/common-components";

interface TopDatasetDependencyProps {
  featureId: string;
  datasetId: string;
  dataType: string;
  featureType: string;
  topDatasetCorrelations: AssociatedFeatures[];
  geneTargets: string[];
}

export const TopDatasetDependencies: React.FC<TopDatasetDependencyProps> = ({
  featureId,
  datasetId,
  dataType,
  featureType, // should be gene
  topDatasetCorrelations,
  geneTargets,
}) => {
  const urlPrefix = window.location.origin;
  return (
    <div>
      <h3 className={styles.tableDatasetTitle}>{dataType}</h3>
      <table style={{ width: "80%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: "15%" }} />
            <th style={{ width: "45%" }}>
              {featureType === "gene" ? "Gene" : "Compound"}
            </th>
            <th style={{ width: "40%" }}>Correlation</th>
          </tr>
        </thead>
        <tbody>
          {topDatasetCorrelations.map((datasetCor, i) => {
            return (
              <tr key={`${datasetCor.other_dataset_id}-${i}`}>
                <td>
                  <a
                    href={`${urlPrefix}/data_explorer_2/?xDataset=${datasetId}&xFeature=${featureId}&yDataset=${datasetCor.other_dataset_given_id}&yFeature=${datasetCor.other_dimension_label}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Plot
                  </a>
                </td>

                <td className={styles.targetIconContainer}>
                  {geneTargets.includes(datasetCor.other_dimension_label) ? (
                    <img
                      src={toStaticUrl("img/compound/target.svg")}
                      onLoad={() => console.log("image loaded")}
                      alt="Target Feature"
                    />
                  ) : (
                    <p style={{ paddingLeft: "12px" }} />
                  )}
                  <Tooltip
                    id="correlated-gene-tooltip"
                    content={datasetCor.other_dimension_label}
                    placement="top"
                  >
                    <a
                      className={styles.ellipsisStyle}
                      href={`${urlPrefix}/${featureType}/${datasetCor.other_dimension_label}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {datasetCor.other_dimension_label}
                    </a>
                  </Tooltip>
                </td>

                <td>
                  <td style={{ paddingRight: "3rem" }}>
                    {datasetCor.correlation.toFixed(2)}
                  </td>
                  <td>
                    <DependencyMeter correlation={datasetCor.correlation} />
                  </td>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
