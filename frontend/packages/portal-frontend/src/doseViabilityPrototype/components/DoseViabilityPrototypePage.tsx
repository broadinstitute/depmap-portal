import React, { useMemo, useState } from "react";
import { Spinner } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import PrototypeBrushableHeatmap from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap";
import useData from "src/doseViabilityPrototype/hooks/useData";
import styles from "src/doseViabilityPrototype/styles/DoseViabilityPrototypePage.scss";

function DoseViabilityPrototypePage() {
  const compoundName = "ETOPOSIDE";
  const compoundNameFormatted = `${compoundName[0].toUpperCase()}${compoundName
    .slice(1)
    .toLowerCase()}`;

  const {
    heatmapFormattedData,
    tableFormattedData,
    doseColumnNames,
    isLoading,
  } = useData(compoundName);

  const [selectedModels, setSelectedModels] = useState(new Set<string>());
  const selectedColumns = useMemo(() => {
    const out = new Set<number>();

    heatmapFormattedData?.modelIds.forEach((id, index) => {
      if (selectedModels.has(id)) {
        out.add(index);
      }
    });

    return out;
  }, [selectedModels, heatmapFormattedData]);

  const tableConfig = useMemo(() => {
    return {
      columns: [
        { accessor: "Cell Line" },
        ...doseColumnNames.map((name) => ({
          id: name,
          accessor: name,
        })),
      ],
      sorted: [{ id: "Cell Line", desc: false }],
    };
  }, [doseColumnNames]);

  if (isLoading || !tableFormattedData || !heatmapFormattedData) {
    return <Spinner />;
  }

  return (
    <div>
      <div className={styles.heatmapContainer}>
        <PrototypeBrushableHeatmap
          data={heatmapFormattedData}
          xAxisTitle="Cell Lines"
          yAxisTitle={`${compoundNameFormatted} Dose (μM)`}
          legendTitle="Viability"
          hovertemplate={[
            "Cell line: %{x}",
            "Dose: %{y} µM",
            "Viability: %{z}",
            "<extra></extra>",
          ].join("<br>")}
          selectedColumns={selectedColumns}
          onClearSelection={() => setSelectedModels(new Set())}
          onSelectColumnRange={(
            start: number,
            end: number,
            shiftKey: boolean
          ) => {
            setSelectedModels((prev) => {
              const next: Set<string> = shiftKey ? new Set(prev) : new Set();

              for (let i = start; i <= end; i += 1) {
                next.add(heatmapFormattedData.modelIds[i]);
              }

              return next;
            });
          }}
        />
      </div>
      <WideTable {...tableConfig} data={tableFormattedData} />
    </div>
  );
}

export default DoseViabilityPrototypePage;
