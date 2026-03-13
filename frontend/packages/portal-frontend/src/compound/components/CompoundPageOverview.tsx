import React from "react";
import AsyncTile from "src/common/components/AsyncTile";
import { CardContainer, CardColumn } from "src/common/components/Card";

interface Props {
  compoundName: string;
  showPredictability: boolean;
  showHeatmap: boolean;
  showEnrichedLineages: boolean;
  showCorrelatedDependenciesTile: boolean;
  showRelatedCompoundsTile: boolean;
  orderedTiles: [CompoundTileTypeEnum, number][][];
  hasDatasets: boolean;
  isMobile: boolean;
}

export enum CompoundTileTypeEnum {
  Selectivity = "selectivity",
  Predictability = "predictability",
  Description = "description",
  Sensitivity = "sensitivity",
  Availability = "availability",
  Celfie = "celfie",
  Heatmap = "heatmap",
  Correlated_dependencies = "correlated_dependencies",
  Related_compounds = "related_compounds",
  Correlated_expression = "correlated_expression",
}
/* match to portal-backend tile enum */

const CompoundPageOverview = ({
  compoundName,
  showPredictability,
  showHeatmap,
  showEnrichedLineages,
  showCorrelatedDependenciesTile,
  showRelatedCompoundsTile,
  orderedTiles,
  hasDatasets,
  isMobile,
}: Props) => {
  // We have an array of arrays. Each child array represents the tiles of a single column. Each tile is a tuple,
  // with the name of the tile (i.e. essentiality) at index 0

  const shouldShowTile = (tile: [CompoundTileTypeEnum, number]) => {
    switch (tile[0]) {
      case CompoundTileTypeEnum.Heatmap:
        return showHeatmap;
      case CompoundTileTypeEnum.Selectivity:
        return showEnrichedLineages;
      case CompoundTileTypeEnum.Predictability:
        return showPredictability;
      case CompoundTileTypeEnum.Correlated_dependencies:
        return showCorrelatedDependenciesTile;
      case CompoundTileTypeEnum.Related_compounds:
        return showRelatedCompoundsTile;

      default:
        return true;
    }
  };

  const getTileIfOkayToShow = (
    tile: [CompoundTileTypeEnum, number],
    key: [CompoundTileTypeEnum, number]
  ) => {
    let resultTile: JSX.Element | null = (
      <AsyncTile
        key={key[0]}
        url={`/tile/compound/${tile[0]}/${compoundName}`}
      />
    );

    // Match tiles with tabs... On occasion we have to show a tab, but not the tile (i.e. Celfie tab but not tile for HNF1B)
    if (!shouldShowTile(tile)) {
      resultTile = null;
    }

    return resultTile;
  };

  return (
    <>
      {isMobile ? (
        <CardContainer>
          <CardColumn>
            {orderedTiles.map((column) => (
              <div key={column.toString()}>
                {column.map((tile) =>
                  hasDatasets ? getTileIfOkayToShow(tile, tile) : <></>
                )}
              </div>
            ))}
          </CardColumn>
        </CardContainer>
      ) : (
        <CardContainer>
          {orderedTiles.map((column) => (
            <CardColumn key={column.toString()}>
              {column.map((tile) => getTileIfOkayToShow(tile, tile))}
            </CardColumn>
          ))}
        </CardContainer>
      )}
    </>
  );
};

export default CompoundPageOverview;
