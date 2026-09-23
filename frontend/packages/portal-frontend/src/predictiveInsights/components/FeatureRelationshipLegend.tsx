import React from "react";
import InfoIcon from "src/common/components/InfoIcon";

interface Props {
  dimType: string;
}

export default function FeatureRelationshipLegend({ dimType }: Props) {
  const isCompound = dimType === "compound";

  return (
    <InfoIcon
      popoverId="feature-relationship-legend"
      popoverTitle="Feature relationship"
      placement="right"
      popoverContent={
        <div>
          <p>
            <strong>Self</strong> — the feature is derived from the{" "}
            {isCompound ? "compound" : "gene"} itself.
          </p>
          {isCompound ? (
            <p>
              <strong>Target</strong> — the feature relates to one of the
              compound&apos;s known targets. See the{" "}
              <a
                href="https://clue.io/repurposing"
                target="_blank"
                rel="noreferrer"
              >
                Repurposing Hub
              </a>{" "}
              for target annotations.
            </p>
          ) : (
            <p>
              <strong>Related</strong> — the feature comes from a biologically
              related gene (e.g. same complex or pathway).
            </p>
          )}
        </div>
      }
    />
  );
}
