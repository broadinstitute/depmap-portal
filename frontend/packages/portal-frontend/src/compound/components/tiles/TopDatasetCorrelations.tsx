import React, { useCallback, useEffect, useRef, useState } from "react";
import { DependencyMeter } from "./DependencyMeter";
import { toStaticUrl } from "@depmap/globals";
import styles from "../../styles/correlated_dependencies_tile.scss";

interface TopDatasetCorrelationsProps {
  datasetName: string;
  //   entityLabel: string;
  //   entityType: string;
}

export const TopDatasetCorrelations: React.FC<TopDatasetCorrelationsProps> = ({
  datasetName,
  //   entityLabel,
  //   entityType,
}) => {
  return (
    <div>
      <h3>{datasetName}</h3>
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th />
            <th>Gene</th>
            <th>Correlation</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {[0.26, 0.5, 0.8].map((cor) => {
            return (
              <tr key={cor}>
                <td>
                  <a href="#" target="_blank">
                    Plot
                  </a>
                </td>
                <td className={styles.targetIconContainer}>
                  <img
                    src={toStaticUrl("img/compound/target.svg")}
                    onLoad={() => console.log("image loaded")}
                    alt="Target Feature"
                  />
                  <a href="#">FEATURE</a>
                </td>
                <td>
                  <td style={{ paddingRight: "3rem" }}>{cor.toFixed(2)}</td>
                  <td>
                    <DependencyMeter correlation={cor} />
                  </td>
                </td>
                <td>{Math.random().toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
