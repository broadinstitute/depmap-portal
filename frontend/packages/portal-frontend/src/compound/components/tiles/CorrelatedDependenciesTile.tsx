import React, { useCallback, useEffect, useRef, useState } from "react";
import StyledMeter from "src/common/components/StyledMeter";
import { getBreadboxApi } from "src/common/utilities/context";
import { DependencyMeter } from "./DependencyMeter";
import { toStaticUrl } from "@depmap/globals";
import styles from "../../styles/correlated_dependencies_tile.scss";
import { TopDatasetCorrelations } from "./TopDatasetCorrelations";

interface CorrelatedDependenciesTileProps {
  entityLabel: string;
  entityType: string;
}

export const CorrelatedDependenciesTile: React.FC<CorrelatedDependenciesTileProps> = ({
  entityLabel,
  entityType,
}) => {
  const bapi = getBreadboxApi();

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          {"Correlated Dependencies"}
        </h2>
        <div className="card_padding">
          <TopDatasetCorrelations datasetName="" />
        </div>
      </div>
    </article>
  );
};
