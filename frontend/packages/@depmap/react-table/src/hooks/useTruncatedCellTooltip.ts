import { useState } from "react";

export function useTruncatedCellTooltip() {
  const [truncatedCellId, setTruncatedCellId] = useState("");

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLTableDataCellElement>,
    cellId: string
  ) => {
    const td = e.currentTarget;
    const isTruncated = td.scrollWidth > td.clientWidth;
    setTruncatedCellId(isTruncated ? cellId : "");
  };

  const resetTruncatedCell = () => setTruncatedCellId("");

  return {
    truncatedCellId,
    handleMouseEnter,
    resetTruncatedCell,
  };
}
