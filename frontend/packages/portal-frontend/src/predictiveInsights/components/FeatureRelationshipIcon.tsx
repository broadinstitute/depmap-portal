import React from "react";
import { FeatureRelationship } from "../featureRelationship";
import styles from "../styles/PredictiveInsights.scss";

interface Props {
  relationship: FeatureRelationship;
}

const ABBREVIATIONS: Record<FeatureRelationship, string> = {
  Self: "S",
  Related: "R",
  Target: "T",
};

export default function FeatureRelationshipIcon({ relationship }: Props) {
  return (
    <span
      className={styles.relationshipIcon}
      title={relationship}
      aria-label={relationship}
    >
      {ABBREVIATIONS[relationship]}
    </span>
  );
}
