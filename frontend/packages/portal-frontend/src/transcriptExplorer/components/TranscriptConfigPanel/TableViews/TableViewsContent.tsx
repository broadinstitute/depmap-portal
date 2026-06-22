import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { Button } from "react-bootstrap";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfig,
  SliceQuery,
} from "@depmap/types";
import useContextResult from "../useContextResult";
import useAvailableTranscriptIds from "../useAvailableTranscriptIds";
import showGeneTranscriptTable from "./showGeneTranscriptTable";
import showModelTranscriptTable from "./showModelTranscriptTable";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  plot: DataExplorerPlotConfig;
  expansionAxis: "x" | "y";
}

function TableViewsContent({ plot, expansionAxis }: Props) {
  const expansionDim = plot.dimensions[expansionAxis];

  const { result, isLoading } = useContextResult(
    expansionDim!.context as DataExplorerContextV2
  );

  const availableIds = useAvailableTranscriptIds(plot, expansionAxis);
  const [datasetName, setDatasetName] = useState("");

  useEffect(() => {
    cached(breadboxAPI)
      .getDataset(expansionDim!.dataset_id)
      .then((d) => setDatasetName(d.name));
  }, [expansionDim]);

  if (isLoading || !result || !availableIds || !datasetName) {
    return <div>Loading...</div>;
  }

  const geneSymbol = plot.dimensions[expansionAxis]?.context.name as string;

  const slices = result.ids
    .filter((id) => availableIds.has(id))
    .map((identifier) => ({
      identifier,
      identifier_type: "feature_id",
      dataset_id: expansionDim!.dataset_id,
    })) as SliceQuery[];

  const otherDim = plot.dimensions[expansionAxis === "x" ? "y" : "x"];

  if (otherDim) {
    const context = otherDim.context as DataExplorerContextV2;
    let slice = Object.values(context.vars)[0] as SliceQuery;

    if (Object.keys(context.vars)[0] === "symbol") {
      slice = {
        dataset_id: "expression",
        identifier_type: "feature_label",
        identifier: context.name,
      };
    }

    if (!slice) {
      slice = {
        dataset_id: otherDim.dataset_id,
        identifier_type: "feature_id",
        identifier: (context.expr as Record<"==", [unknown, string]>)["=="][1],
      };
    }

    slices.unshift(slice);
  }

  return (
    <div className={styles.TableViewsContent}>
      <Button
        bsStyle="info"
        onClick={() =>
          showModelTranscriptTable(geneSymbol, datasetName, slices)
        }
      >
        <span>Model/Transcript table</span>{" "}
        <span className="glyphicon glyphicon-new-window" />
      </Button>
      <Button onClick={() => showGeneTranscriptTable(geneSymbol)}>
        <span>Gene/Transcript table</span>{" "}
        <span className="glyphicon glyphicon-new-window" />
      </Button>
    </div>
  );
}

export default TableViewsContent;
