/* eslint-disable jsx-a11y/control-has-associated-label */
import React from "react";
import { DependencyMeter } from "./DependencyMeter";
import { toStaticUrl } from "@depmap/globals";
import styles from "../../styles/correlated_dependencies_tile.scss";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";

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
      <h3 style={{ fontSize: "16px" }}>{dataType}</h3>
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th />
            <th>{featureType === "gene" ? "Gene" : "Compound"}</th>
            <th>Correlation</th>
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
                  <a
                    href={`${urlPrefix}/${featureType}/${datasetCor.other_dimension_label}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {datasetCor.other_dimension_label}
                  </a>
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
