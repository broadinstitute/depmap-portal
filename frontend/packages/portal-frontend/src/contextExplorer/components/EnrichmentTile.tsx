import React from "react";

interface EnrichmentTileProps {
  geneSymbol: string;
}

export const EnrichmentTile: React.FC<EnrichmentTileProps> = ({
  geneSymbol,
}) => {
  return <div>The gene symbol was {geneSymbol}</div>;
};
