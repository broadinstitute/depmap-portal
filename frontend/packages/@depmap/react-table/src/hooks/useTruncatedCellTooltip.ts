import { useRef, useState } from "react";

export function useTruncatedCellTooltip() {
  const [truncatedCellId, setTruncatedCellId] = useState("");
  const prevElement = useRef<HTMLTableDataCellElement | null>(null);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLTableDataCellElement>,
    cellId: string
  ) => {
    const td = e.currentTarget;

    if (td !== prevElement.current) {
      const isTruncated = td.scrollWidth > td.clientWidth;
      setTruncatedCellId(isTruncated ? cellId : "");

      if (!isTruncated) {
        td.style.textOverflow = "clip";
      }
    }

    prevElement.current = td;
  };

  const resetTruncatedCell = () => setTruncatedCellId("");

  return {
    truncatedCellId,
    handleMouseEnter,
    resetTruncatedCell,
  };
}
