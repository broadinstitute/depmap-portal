import React, { useMemo, useState } from "react";
import { Spinner } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import PrototypeBrushableHeatmap from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap";
import useData from "src/doseViabilityPrototype/hooks/useData";

function DoseViabilityPrototypePage() {
  const compoundName = "ETOPOSIDE";

  const { heatmapFormattedData, tableFormattedData, isLoading } = useData(
    compoundName
  );

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const tableConfig = useMemo(() => {
    return {
      columns: [
        { accessor: "dose" },
        { accessor: "model" },
        { accessor: "viability" },
      ],
      sorted: [{ id: "dose", desc: false }],
    };
  }, []);

  if (isLoading || !tableFormattedData || !heatmapFormattedData) {
    return <Spinner />;
  }

  return (
    <div>
      <div style={{ padding: "30px 30px 0 26px", marginBottom: -40 }}>
        <PrototypeBrushableHeatmap
          data={heatmapFormattedData}
          xAxisTitle="Cell Lines"
          yAxisTitle="Dose (μM)"
          legendTitle="Viability"
          selectedCells={selectedCells}
          onClickColumn={(x: number, shiftKey: boolean) => {
            const columnCells = heatmapFormattedData.y.map(
              (_, y: number) => `${x},${y}`
            );

            setSelectedCells((prev) => {
              if (shiftKey) {
                const next = new Set(prev);

                columnCells.forEach((cell) => {
                  if (prev.has(columnCells[0])) {
                    next.delete(cell);
                  } else {
                    next.add(cell);
                  }
                });

                return next;
              }

              return new Set(columnCells);
            });
          }}
        />
      </div>
      <WideTable {...tableConfig} data={tableFormattedData} />
    </div>
  );
}

export default DoseViabilityPrototypePage;
