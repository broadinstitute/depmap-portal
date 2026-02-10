import React from "react";
import styles from "../CompoundTiles.scss";

interface Props {
  tileName: string;
}

const ErrorLoading: React.FC<Props> = ({ tileName }) => {
  return (
    <article
      className={`${styles.HeatmapTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        {/* Replaced hardcoded "Heatmap" with the tileName prop */}
        <h2 className="no_margin cardtitle_text">{tileName}</h2>
        <div className="card_padding">
          <div className={styles.errorMessage}>
            There was an error loading this tile.
          </div>
        </div>
      </div>
    </article>
  );
};

export default ErrorLoading;
