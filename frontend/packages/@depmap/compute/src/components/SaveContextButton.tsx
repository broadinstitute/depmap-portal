import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import { showInfoModal } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import { Dataset, DimensionType } from "@depmap/types";

import styles from "../styles/CustomAnalysisResult.scss";

interface Props {
  entityType: string;
  selectedLabels: string[];
}

function resolveMetadataGivenId(
  dimensionTypeName: string,
  dimTypes: DimensionType[],
  datasets: Dataset[]
): string | undefined {
  const dimType = dimTypes.find((dt) => dt.name === dimensionTypeName);
  if (!dimType) return undefined;

  const dataset = datasets.find((ds) => ds.id === dimType.metadata_dataset_id);
  return dataset?.given_id || dataset?.id || undefined;
}

export default function SaveContextButton({
  entityType,
  selectedLabels,
}: Props) {
  return (
    <Button
      className={styles.SaveContextButton}
      disabled={selectedLabels.length === 0}
      onClick={async () => {
        const dimTypes = await cached(breadboxAPI).getDimensionTypes();
        const datasets = await cached(breadboxAPI).getDatasets();
        const metadataDataset = resolveMetadataGivenId(
          entityType,
          dimTypes,
          datasets
        );

        if (!metadataDataset) {
          showInfoModal({
            title: "Error",
            content: "Sorry, there was an error saving the context.",
          });

          return;
        }

        DepMap.saveNewContext({
          name: "",
          dimension_type: entityType,
          expr: { in: [{ var: "entity_label" }, selectedLabels] },
          vars: {
            entity_label: {
              dataset_id: metadataDataset,
              identifier_type: "column" as const,
              identifier: "label",
            },
          },
        });
      }}
    >
      Save context
    </Button>
  );
}

export function SelectionState({
  children,
}: {
  children: (
    selectedLabel: string[],
    setSelectedLabels: (labels: string[]) => void
  ) => React.ReactNode;
}) {
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  return children(selectedLabels, setSelectedLabels);
}
