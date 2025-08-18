import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { SectionStackContext } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/SectionStack";
import { SortOption } from "../types";

interface TermOptionsPanelProps {
  sortBy: SortOption;
  handleSetSortBy: (sortBy: SortOption) => void;
}

const TermOptionsPanel: React.FC<TermOptionsPanelProps> = ({
  sortBy,
  handleSetSortBy,
}) => {
  const ref = useRef<HTMLTableElement>(null);
  const [hasScrollBar, setHasScrollBar] = useState(false);
  const { sectionHeights } = useContext(SectionStackContext);

  const checkScrollBar = useCallback(() => {
    if (ref.current) {
      const stack = ref.current.closest("#section-stack") as Element;
      setHasScrollBar(stack.scrollHeight > stack.clientHeight);
    }
  }, []);

  useEffect(checkScrollBar, [checkScrollBar, sectionHeights]);

  useEffect(() => {
    window.addEventListener("resize", checkScrollBar);
    return () => window.removeEventListener("resize", checkScrollBar);
  }, [checkScrollBar]);

  return (
    <div ref={ref} style={{ backgroundColor: "#ffffff" }}>
      <p style={{ fontWeight: 600, marginBottom: 12 }}>
        Sort order for selecting top terms
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="sortBy"
            value="Effect Size"
            checked={sortBy === "Effect Size"}
            onChange={() => handleSetSortBy("Effect Size")}
          />
          Effect Size &gt; FDR
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="sortBy"
            value="Significance"
            checked={sortBy === "Significance"}
            onChange={() => handleSetSortBy("Significance")}
          />
          FDR &gt; Effect Size
        </label>
      </div>
    </div>
  );
};

export default TermOptionsPanel;
