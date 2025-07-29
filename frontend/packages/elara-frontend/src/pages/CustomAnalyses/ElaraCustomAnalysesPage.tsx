import * as React from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

export default function ElaraCustomAnalysesPage() {
  const fetchSimplifiedCellLineData = async () => {
    const identifiers = await cached(breadboxAPI).getDimensionTypeIdentifiers(
      "depmap_model"
    );

    return new Map(
      identifiers.map(({ id, label }) => [id, { displayName: label }])
    );
  };

  return (
    <CustomAnalysesPage
      fetchSimplifiedCellLineData={fetchSimplifiedCellLineData}
    />
  );
}
