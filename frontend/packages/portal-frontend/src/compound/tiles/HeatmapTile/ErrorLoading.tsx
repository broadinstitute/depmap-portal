import React from "react";
import styles from "../CompoundTiles.scss";

const ErrorLoading: React.FC = () => {
  return (
    <article
      className={`${styles.HeatmapTile} card_wrapper stacked-boxplot-tile`}
    >
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Heatmap</h2>
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
