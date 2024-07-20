import React, { useEffect, useState } from "react";
import { PlotFeatures, Feature } from "@depmap/interactive";
import { LineUp } from "lineupjsx";
import "src/lineup/styles/Lineup.scss";

export default function LineupTable() {
  const [selectedFeatures, setSelectedFeatures] = useState<
    PlotFeatures | undefined
  >(undefined);
  const [labeledFeaturesByRow, setLabeledFeaturesByRow] = useState<
    Array<unknown>
  >([]);

  function getColumnLabelForFeature(feature: Feature) {
    const datasetName = feature.feature_id.split("/")[1];
    return datasetName ? `${feature.label}: ${datasetName}` : feature.label;
  }

  // listen for feature data from outside the iframe this is run in
  window.addEventListener(
    "message",
    (event) => {
      const eventArray = event.data.selectionValue;
      if (eventArray) {
        setSelectedFeatures(event.data.selectionValue);
      }
    },
    false
  );

  useEffect(() => {
    if (selectedFeatures) {
      // reorganize feature data from an array of columns into an array of rows
      const featuresByRow: Array<Record<string, any>> = [];
      const rowCount = selectedFeatures.depmap_ids.length;
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        // create a row object with each value keyed by its column label
        const rowData: Record<string, any> = {};
        selectedFeatures.features.forEach((feature) => {
          const cellValue = feature.values[rowIndex];
          rowData[getColumnLabelForFeature(feature)] = cellValue;
        });
        featuresByRow.push(rowData);
      }

      setLabeledFeaturesByRow(featuresByRow);
    }
  }, [selectedFeatures]);

  // only render the table if there's data to show
  if (labeledFeaturesByRow.length > 0) {
    return <LineUp data={labeledFeaturesByRow} />;
  }
  return null;
}
