import React, { useEffect, useRef, useState } from "react";
import { Button, Checkbox } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import { renderConditionally } from "@depmap/data-explorer-2";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import PrecomputedAssociationsTable from "src/data-explorer-2/components/ConfigurationPanel/PrecomputedAssociations/PrecomputedAssociationsTable";
import { useAssociationsData } from "src/data-explorer-2/components/ConfigurationPanel/PrecomputedAssociations/utils";
import styles from "src/data-explorer-2/styles/PrecomputedAssociations.scss";

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
  const [sortByAbsoluteValue, setSortByAbsoluteValue] = useState(true);
  const scrollOnLoad = useRef(true);

  const {
    xDatasetId,
    xEntityLabel,
    yDatasetId,
    yEntityLabel,
    associations,
    isLoading,
  } = useAssociationsData(plot);

  useEffect(() => {
    if (associations && scrollOnLoad.current) {
      scrollOnLoad.current = false;

      if (sectionRef.current) {
        setTimeout(() => {
          sectionRef.current!.parentElement!.scrollTo({
            top: sectionRef.current!.offsetTop - 50,
            behavior: "smooth",
          });
        }, 0);
      }
    }
  }, [associations, sectionRef]);

  if (!associations) {
    return <Spinner className={styles.spinner} left="0px" position="static" />;
  }

  return (
    <div>
      <div>
        Top 100 correlates per dataset for <b>{xEntityLabel}</b> in
        <b> {associations.datasetLabel}</b>
        <i>
          {" "}
          ({associations.associatedDatasets.length}{" "}
          {associations.associatedDatasets.length === 1
            ? "dataset"
            : "datasets"}
          )
        </i>
      </div>
      <Button
        className={styles.exportButton}
        bsSize="small"
        bsStyle="primary"
        disabled={isLoading || associations.data.length === 0}
        onClick={() => {
          const sliceId = `slice/${xDatasetId}/${xEntityLabel}/label`;
          window.location.href = `../interactive/api/associations-csv?x=${sliceId}`;
        }}
      >
        Download table{" "}
        <span className="glyphicon glyphicon-download-alt" aria-hidden="true" />
      </Button>
      <Checkbox
        className={styles.checkbox}
        checked={sortByAbsoluteValue}
        onChange={() => setSortByAbsoluteValue((prev) => !prev)}
      >
        <span>Sort by absolute value</span>
      </Checkbox>
      <PrecomputedAssociationsTable
        associations={associations}
        isLoading={isLoading}
        yDatasetId={yDatasetId}
        yEntityLabel={yEntityLabel}
        sortByAbsoluteValue={sortByAbsoluteValue}
        onClickRow={onSelectY}
      />
    </div>
  );
}

export default renderConditionally(PrecomputedAssociations);
