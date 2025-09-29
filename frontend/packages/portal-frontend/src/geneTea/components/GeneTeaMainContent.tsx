import React, { useMemo } from "react";
import { groupStringsByCondition } from "../utils";
import useData from "../hooks/useData";
import { useGeneTeaFiltersContext } from "../context/GeneTeaFiltersContext";
import AllMatchingTermsTab from "./AllMatchingTermsTab/AllMatchingTermsTab";
import TopTermsTab from "./TopTermsTab/TopTermsTab";

interface GeneTeaMainContentProps {
  tab: "top-tea-terms" | "all-matching-terms";
}

function GeneTeaMainContent({ tab }: GeneTeaMainContentProps) {
  const {
    geneSymbolSelections,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    sortBy,
    maxTopTerms,
    maxFDR,
    maxMatchingOverall,
    minMatchingQuery,
    effectSizeThreshold,
    handleSetValidGeneSymbols,
    handleSetInValidGeneSymbols,
    handleSetIsLoading,
    handleSetError,
    handleSetErrorMessage,
    selectedTopTermsTableRows,
  } = useGeneTeaFiltersContext();

  const topTermsPlotSelections = useMemo(
    () =>
      selectedTopTermsTableRows.size > 0
        ? selectedTopTermsTableRows
        : new Set([]),
    [selectedTopTermsTableRows]
  );

  // HACK: GeneTEA returns an error if any searchTerm is less
  // than 2 characters long. Instead of erroring completely,
  // we want to treat these search terms the same as any other invalid
  //  term (i.e. ["SOX10", "KRAS", "NRAS", "NOT_A_GENE"] will still
  // return a response with invalid_genes = ["NOT_A_GENE"], so ["SOX10", "KRAS", "NRAS", "A"]
  // will still return a response with invalid_genes = ["A"]). Separate
  // our definitely invalid less than 2 characters out from the possiblyValidTerms
  // before sending a request to GeneTEA.
  const [specialCaseInvalidGenes, possiblyValidGenes] = useMemo(
    () =>
      groupStringsByCondition(
        Array.from(geneSymbolSelections),
        (term) => term.length < 2
      ),
    [geneSymbolSelections]
  );

  const {
    rawData,
    heatmapData,
    barChartData,
    heatmapXAxisLabel,
    allTermsScatterPlotData,
  } = useData(
    topTermsPlotSelections,
    specialCaseInvalidGenes,
    possiblyValidGenes,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    sortBy,
    maxFDR,
    maxTopTerms,
    maxMatchingOverall,
    minMatchingQuery,
    effectSizeThreshold,
    handleSetInValidGeneSymbols,
    handleSetValidGeneSymbols,
    handleSetIsLoading,
    handleSetError,
    handleSetErrorMessage
  );

  if (tab === "all-matching-terms") {
    return (
      <AllMatchingTermsTab data={allTermsScatterPlotData} rawData={rawData} />
    );
  }

  return (
    <TopTermsTab
      heatmapData={heatmapData}
      barChartData={barChartData}
      heatmapXAxisLabel={heatmapXAxisLabel}
      rawData={rawData}
    />
  );
}

export default GeneTeaMainContent;
