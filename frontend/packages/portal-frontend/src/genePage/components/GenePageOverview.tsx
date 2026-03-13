import React from "react";
import AsyncTile from "src/common/components/AsyncTile";
import { CardContainer, CardColumn } from "src/common/components/Card";

interface Props {
  symbol: string;
  showDependencyTab: boolean;
  showCharacterizationTab: boolean;
  showPredictabilityTab: boolean;
  orderedTiles: [TileTypeEnum, number][][];
  hasDatasets: boolean;
  isMobile: boolean;
  showMutationsTile: boolean;
  showOmicsExpressionTile: boolean;
  showTargetingCompoundsTile: boolean;
  showEnrichmentTile: boolean;
}

export enum TileTypeEnum {
  Essentiality = "essentiality",
  Selectivity = "selectivity",
  Omics = "omics",
  Predictability = "predictability",
  Tda_predictability = "tda_predictability",
  Target_tractability = "target_tractability",
  Codependencies = "codependencies",
  Targeting_compounds = "targeting_compounds",
  Mutations = "mutations",
  Description = "description",
}

const GenePageOverview = ({
  symbol,
  orderedTiles,
  showDependencyTab,
  showCharacterizationTab,
  showPredictabilityTab,
  hasDatasets,
  isMobile,
  showMutationsTile,
  showOmicsExpressionTile,
  showTargetingCompoundsTile,
  showEnrichmentTile,
}: Props) => {
  // We have an array of arrays. Each child array represents the tiles of a single column. Each tile is a tuple,
  // with the name of the tile (i.e. essentiality) at index 0

  const shouldShowTile = (tile: [TileTypeEnum, number]) => {
    switch (tile[0]) {
      case TileTypeEnum.Essentiality:
      case TileTypeEnum.Codependencies:
        return showDependencyTab;

      case TileTypeEnum.Omics:
        return showCharacterizationTab && showOmicsExpressionTile;

      case TileTypeEnum.Predictability:
        return showPredictabilityTab;

      case TileTypeEnum.Selectivity:
        return showEnrichmentTile;

      case TileTypeEnum.Mutations:
        return showMutationsTile && showCharacterizationTab;

      case TileTypeEnum.Targeting_compounds:
        return showTargetingCompoundsTile;

      default:
        return true;
    }
  };

  const getTileIfOkayToShow = (
    tile: [TileTypeEnum, number],
    key: [TileTypeEnum, number]
  ) => {
    let resultTile: JSX.Element | null = (
      <AsyncTile key={key[0]} url={`/tile/gene/${tile[0]}/${symbol}`} />
    );

    // Match tiles with tabs... On occasion we have to show a tab, but not the tile
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

export default GenePageOverview;
