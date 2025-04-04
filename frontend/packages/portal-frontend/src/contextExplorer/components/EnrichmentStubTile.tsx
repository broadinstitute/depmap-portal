import React from "react";

interface EnrichmentStubTileProps {
  geneSymbol: string;
}

export const EnrichmentStubTile: React.FC<EnrichmentStubTileProps> = ({
  geneSymbol,
}) => {
  return <div>The gene symbol was {geneSymbol}</div>;
};
