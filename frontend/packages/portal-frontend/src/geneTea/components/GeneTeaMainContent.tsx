import React, { useMemo, useState } from "react";
import styles from "../styles/GeneTea.scss";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { groupStringsByCondition, tableColumns } from "../utils";
import useData from "../hooks/useData";
import { useGeneTeaFiltersContext } from "../context/GeneTeaFiltersContext";
import {
  TopTermsContextProvider,
  useTopTermsContext,
} from "../context/TopTermsContext";
import {
  AllTermsContextProvider,
  useAllTermsContext,
} from "../context/AllTermsContext";
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
    isLoading,
    error,
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

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  // Get the table data and prefferedTableDataForDownload. Combined in this useMemo so we don't
  // have to iterate through allEnrichedTerms twice. The only difference is that the tableData is
  // rounded, while the prefferedTableDataForDownload is NOT rounded.
  const roundedAndUnroundedTableData = useMemo(() => {
    // TODO give these a real type
    const roundedData: any = [];
    const unroundedData: any = [];
    if (rawData?.allEnrichedTerms) {
      rawData.allEnrichedTerms.term.forEach((term, index) => {
        roundedData.push({
          term,
          termGroup: rawData.allEnrichedTerms!.termGroup[index],
          synonyms: rawData.allEnrichedTerms!.synonyms[index].join(";"),
          matchingGenesInList: rawData.allEnrichedTerms!.matchingGenesInList[
            index
          ],
          nMatchingGenesOverall: rawData.allEnrichedTerms!
            .nMatchingGenesOverall[index],
          nMatchingGenesInList: rawData.allEnrichedTerms!.nMatchingGenesInList[
            index
          ],
          fdr: rawData.allEnrichedTerms!.fdr[index].toExponential(5),
          effectSize: rawData.allEnrichedTerms!.effectSize[index].toFixed(4),
        });
        unroundedData.push({
          term,
          termGroup: rawData.allEnrichedTerms!.termGroup[index],
          synonyms: rawData.allEnrichedTerms!.synonyms[index].join(";"),
          matchingGenesInList: rawData.allEnrichedTerms!.matchingGenesInList[
            index
          ],
          nMatchingGenesOverall: rawData.allEnrichedTerms!
            .nMatchingGenesOverall[index],
          nMatchingGenesInList: rawData.allEnrichedTerms!.nMatchingGenesInList[
            index
          ],
          fdr: rawData.allEnrichedTerms!.fdr[index].toExponential(),
          effectSize: rawData.allEnrichedTerms!.effectSize[index],
        });
      });
    }
    return { roundedData, unroundedData };
  }, [rawData]);

  if (tab === "all-matching-terms") {
    return (
      <AllTermsContextProvider>
        <AllMatchingTermsTab
          allTermsScatterPlotData={allTermsScatterPlotData}
        />
      </AllTermsContextProvider>
    );
  }

  return (
    <TopTermsContextProvider>
      <TopTermsTab
        heatmapData={heatmapData}
        barChartData={barChartData}
        heatmapXAxisLabel={heatmapXAxisLabel}
        rawData={rawData}
      />
    </TopTermsContextProvider>
  );
}

export default GeneTeaMainContent;
