import React, { useRef, useState } from "react";
import { Button, Checkbox } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { downloadCsv } from "@depmap/utils";
import { isCompleteDimension } from "../../../../../utils/misc";
import usePrecomputedAssocationData from "../../../hooks/usePrecomputedAssocationData";
import useScrollOnLoad from "./useScrollOnLoad";
import AssociationsTable from "./AssociationsTable";
import styles from "../../../styles/PrecomputedAssociations.scss";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  onSelectY: (
    other_dataset_id: string,
    other_entity_label: string,
    other_entity_type: string
  ) => void;
  sectionRef: React.MutableRefObject<HTMLDivElement | null>;
}

function PrecomputedAssociations({ plot, onSelectY, sectionRef }: Props) {
  const staticContentRef = useRef<HTMLDivElement>(null);
  const [hiddenDatasets, setHiddenDatasets] = useState<Set<string>>(new Set());
  const [sortByAbsoluteValue, setSortByAbsoluteValue] = useState(true);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [sortColumn, setSortColumn] = useState<"correlation" | "log10qvalue">(
    "correlation"
  );

  const data = usePrecomputedAssocationData({
    dimension: isCompleteDimension(plot.dimensions?.x)
      ? plot.dimensions!.x
      : null,
    hiddenDatasets,
    sortByAbsoluteValue,
    sortDirection,
    sortColumn,
  });

  useScrollOnLoad({ data, sectionRef });

  if (data.error) {
    return <div>⚠️ There was an error loading the assocations table.</div>;
  }

  if (data.isLoading) {
    return <Spinner className={styles.spinner} left="0px" position="static" />;
  }

  if (data.associatedDimensions.length === 0) {
    return (
      <div>
        No associations could be found for <b>{data.dimensionLabel}</b> in
        <b> {data.datasetName}</b>.
      </div>
    );
  }

  const yDatasetId = plot.dimensions!.y?.dataset_id || null;
  let yDimensionId: string | null = null;

  if (plot.dimensions?.y?.axis_type === "raw_slice") {
    const expr = plot.dimensions.y.context?.expr;

    if (expr !== null && typeof expr === "object" && "==" in expr) {
      yDimensionId = (expr["=="]![1] as unknown) as string;
    }
  }

  return (
    <div>
      <div ref={staticContentRef}>
        <p>
          Top 250 features (or top 25 negative and positive correlations with
          q-values {"<"} 0.1) for <b>{data.dimensionLabel}</b> in
          <b> {data.datasetName}</b>.
        </p>
        <p>
          For each dataset, the q-values are computed from p-values using the{" "}
          <a
            href="https://www.jstor.org/stable/2346101"
            rel="noreferrer"
            target="_blank"
          >
            Benjamini-Hochberg algorithm
          </a>
          .
        </p>
        <div className={styles.buttons}>
          <Checkbox
            className={styles.checkbox}
            checked={sortByAbsoluteValue}
            onChange={() => setSortByAbsoluteValue((prev) => !prev)}
          >
            <span>Sort by absolute value</span>
          </Checkbox>
          <Button
            className={styles.exportButton}
            bsSize="small"
            bsStyle="primary"
            disabled={data.isLoading || data.associatedDimensions.length === 0}
            onClick={() => {
              const filename =
                `${data.dimensionLabel} in ${data.datasetName} ` +
                "associations.csv";
              downloadCsv(data.csvFriendlyFormat, "Gene/Compound", filename);
            }}
          >
            Download table{" "}
            <span
              className="glyphicon glyphicon-download-alt"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
      <AssociationsTable
        data={data}
        yDatasetId={yDatasetId}
        yDimensionId={yDimensionId}
        onClickRow={onSelectY}
        staticContentRef={staticContentRef}
        hiddenDatasets={hiddenDatasets}
        onChangeHiddenDatasets={setHiddenDatasets}
        sortDirection={sortDirection}
        onChangeSortDirection={setSortDirection}
        sortColumn={sortColumn}
        onChangeSortColumn={setSortColumn}
      />
    </div>
  );
}

export default PrecomputedAssociations;
