import React, { useCallback } from "react";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import { breadboxAPI, cached } from "@depmap/api";
import { AsyncPlot } from "./AsyncPlot";

interface DatasetCorrelationActualsVsFeatureProps {
  featureDatasetId: string;
  featureGivenId: string;
  actualsDatasetId: string;
  actualsGivenId: string;
}

function buildIdToIndexMapping(ids: string[]): Map<string, number> {
  const map = new Map<string, number>();
  ids.forEach((id, index) => {
    map.set(id, index);
  });
  return map;
}

interface DatasetCorrelationActualsVsFeatureChildProps {
  plotData: {
    x: number[];
    y: number[];
    hoverText: string[];
    xLabel: string;
    yLabel: string;
  };
}
const DatasetCorrelationActualsVsFeatureChild = ({
  plotData,
}: DatasetCorrelationActualsVsFeatureChildProps) => {
  return (
    <ScatterPlot
      margin={{ t: 80, l: 80, r: 80 }}
      data={plotData as any}
      colorVariable={[]}
      height={350}
      xKey="x"
      yKey="y"
      hoverTextKey="hoverText"
      xLabel={plotData.xLabel}
      yLabel={plotData.yLabel}
      // onLoad={(element: ExtendedPlotType | null) => {
      //   if (element) {
      //     setWaterfallPlotElement(element);
      //   }
      // }}
      showYEqualXLine={false}
      // renderAsSvg
    />
  );
};

export const DatasetCorrelationActualsVsFeature = ({
  featureDatasetId,
  featureGivenId,
  actualsDatasetId,
  actualsGivenId,
}: DatasetCorrelationActualsVsFeatureProps) => {
  const loader = useCallback(async () => {
    const correlationWithActualPromise = cached(
      breadboxAPI
    ).computeAssociations({
      dataset_id: featureDatasetId,
      slice_query: {
        dataset_id: actualsDatasetId,
        identifier_type: "feature_id",
        identifier: actualsGivenId,
      },
    });

    const correlationWithFeaturePromise = cached(
      breadboxAPI
    ).computeAssociations({
      dataset_id: featureDatasetId,
      slice_query: {
        dataset_id: featureDatasetId,
        identifier_type: "feature_id",
        identifier: featureGivenId,
      },
    });

    const [correlationWithActual, correlationWithFeature] = await Promise.all([
      correlationWithActualPromise,
      correlationWithFeaturePromise,
    ]);

    // make an index to join these together
    const correlationWithFeatureIndex = buildIdToIndexMapping(
      correlationWithFeature.given_id
    );

    const x: number[] = [];
    const y: number[] = [];
    const labels: string[] = [];

    correlationWithActual.given_id.forEach((givenId, withActualIndex) => {
      const withFeatureIndex = correlationWithFeatureIndex.get(givenId);
      if (withFeatureIndex !== undefined) {
        x.push(correlationWithFeature.cor[withFeatureIndex]);
        y.push(correlationWithActual.cor[withActualIndex]);
        labels.push(correlationWithActual.label[withActualIndex]);
      }
    });

    const plotData = {
      plotData: {
        x,
        y,
        hoverText: labels,
        xLabel: "Correlation with feature",
        yLabel: "Correlation with actual",
      },
    };

    return plotData;
  }, [featureDatasetId, featureGivenId, actualsDatasetId, actualsGivenId]);

  return (
    <AsyncPlot
      loader={loader}
      childComponent={DatasetCorrelationActualsVsFeatureChild}
    />
  );
};
