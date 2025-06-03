import React, { useCallback, useEffect, useRef, useState } from "react";
import { getBreadboxApi } from "src/common/utilities/context";

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
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          {"Correlated Dependencies"}
        </h2>
        <div className="card_padding">
          {/* {entityType === "gene" ? (
            <h4 className="crispr">{tileData?.dataset_display_name}</h4>
          ) : (
            <h4>{tileData?.dataset_display_name}</h4>
          )} */}
        </div>
      </div>
    </article>
  );
};
