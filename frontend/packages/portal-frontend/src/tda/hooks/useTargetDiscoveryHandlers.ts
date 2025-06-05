import { useCallback, useRef } from "react";
import { getDapi } from "src/common/utilities/context";
import { TDASummaryTable } from "src/tda/models/types";
import useDiscoveryAppHandlers from "src/common/hooks/useDiscoveryAppHandlers";

export default function useTargetDiscoveryHandlers(
  data: TDASummaryTable | null,
  pointVisibility: boolean[],
  setSelectedPoint: (pointIndex: number) => void
) {
  const cachedCsv = useRef<string | null>(null);

  const handleDownload = useCallback(async () => {
    if (!cachedCsv.current) {
      cachedCsv.current = await getDapi().getTDATableAsOriginalCSV();
    }

    const visibleGenes = new Set();

    data?.symbol.forEach((gene, index) => {
      if (pointVisibility[index]) {
        visibleGenes.add(gene);
      }
    });

    const filteredCsv = cachedCsv.current
      .split("\n")
      .filter(
        (line, index) => index === 0 || visibleGenes.has(line.split(",")[1])
      )
      .join("\n");

    const link = document.createElement("a");
    link.href = `data:text/csv,${encodeURIComponent(filteredCsv)}`;
    link.download = "tda_summary_filtered.csv";
    link.click();
  }, [data, pointVisibility]);

  const { handleSearch } = useDiscoveryAppHandlers(
    data,
    pointVisibility,
    setSelectedPoint
  );
  return { handleDownload, handleSearch };
}
