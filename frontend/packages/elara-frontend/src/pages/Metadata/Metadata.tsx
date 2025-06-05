import React, { useEffect, useState } from "react";

import { Spinner } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";

import { DimensionMetadata, DimensionMetadataTableData } from "@depmap/types";
import styles from "src/pages/Metadata/styles.scss";
import { useSearchParams } from "react-router-dom";
import { breadboxAPI } from "@depmap/api";

const formatTableData = (
  dimensionMetadata: DimensionMetadata | null
): DimensionMetadataTableData[] => {
  if (!dimensionMetadata || !dimensionMetadata.metadata) {
    return [];
  }

  return dimensionMetadata.metadata.map((metadata: any) => {
    return {
      metadataName: metadata.name,
      metadataValue: metadata.value,
    };
  });
};

export default function Metadata() {
  const [
    selectedDimension,
    setSelectedDimension,
  ] = useState<DimensionMetadata | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [initError, setInitError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const selectedDimensionLabel = searchParams.get("label");

        const searchLabel =
          selectedDimensionLabel != null ? selectedDimensionLabel : "";
        const dimension = await breadboxAPI.getMetadata(searchLabel);
        setSelectedDimension(dimension);
        setSearchParams({ label: searchLabel });
      } catch (e) {
        console.error(e);
        setInitError(true);
      }
    })();
  }, [searchParams, setSearchParams]);

  if (!selectedDimension) {
    return initError ? (
      <div className={styles.container}>
        Sorry, there was an error fetching metadata.
      </div>
    ) : (
      <Spinner />
    );
  }

  return (
    <div className={styles.metadataPage}>
      <h1
        className="inline-block"
        style={{
          paddingBottom: "20px",
          paddingTop: "20px",
          paddingLeft: "2vw",
          margin: "0px",
        }}
      >
        {selectedDimension.label} Metadata
      </h1>
      <div className={styles.metadataTable}>
        <WideTable
          rowHeight={40}
          idProp="id"
          data={formatTableData(selectedDimension)}
          columns={[
            {
              accessor: "metadataName",
              Header: "Name",
            },
            { accessor: "metadataValue", Header: "Value" },
          ]}
        />
      </div>
    </div>
  );
}
