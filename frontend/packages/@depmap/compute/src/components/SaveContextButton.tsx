import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { DepMap, isElara } from "@depmap/globals";

import styles from "../styles/CustomAnalysisResult.scss";

interface Props {
  entityType: string;
  selectedLabels: string[];
}

export default function SaveContextButton({
  entityType,
  selectedLabels,
}: Props) {
  if (isElara) {
    window.console.warn("SaveContextButton not implemented in Elara!");
    return null;
  }

  return (
    <Button
      className={styles.SaveContextButton}
      disabled={selectedLabels.length === 0}
      onClick={() => {
        DepMap.saveNewContext({
          name: null,
          context_type: entityType,
          expr: { in: [{ var: "entity_label" }, selectedLabels] },
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
