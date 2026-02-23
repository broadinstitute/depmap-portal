import React, { useEffect } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
import { TabsWithHistory } from "src/common/components/tabs/TabsWithHistory";
import { Tab, TabList, TabPanel, TabPanels } from "src/common/components/tabs";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../styles/GeneTea.scss";
import SearchOptionsContainer from "./SearchOptionsContainer";
import { useGeneTeaFiltersContext } from "../context/GeneTeaFiltersContext";
import { breadboxAPI } from "@depmap/api";
import { fetchMetadata } from "../utils";
import glossary from "src/geneTea/json/glossary.json";
import Glossary from "src/common/components/Glossary";
import { GlossaryItem } from "src/common/components/Glossary/types";
import Tutorial from "./Tutorial/Tutorial";
import { enabledFeatures } from "@depmap/globals";

function GeneTea() {
  const {
    handleSetAllAvailableGenes,
    geneSymbolSelections,
  } = useGeneTeaFiltersContext();

  // Show tutorial every time the search is empty
  const showTutorialAsMain = geneSymbolSelections.size === 0;

  useEffect(() => {
    (async () => {
      const geneMetadata = await fetchMetadata<any>(
        "gene",
        null,
        ["label"],
        breadboxAPI,
        "id"
      );

      handleSetAllAvailableGenes(new Set(Object.values(geneMetadata.label)));
    })();
  }, [handleSetAllAvailableGenes]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>TEA party - An Interactive App for GeneTEA</h1>
        <p>
          GeneTEA (Gene-Term Enrichment Analysis) is a model that ingests
          free-text gene descriptions and incorporates natural language
          processing methods to learn a sparse gene-by-term embedding that can
          be used for overrepresentation analysis (ORA). To read about the
          methodology and comparisons to existing ORA tools, please see our
          paper (
          <a
            href="https://doi.org/10.1186/s13059-025-03844-8"
            target="_blank"
            rel="noreferrer noopener"
          >
            Boyle et al. 2025
          </a>
          ).
        </p>
      </header>
      <main className={styles.main}>
        <div className={styles.geneTeaTabLayout}>
          <div className={styles.geneTeaFilters}>
            <SearchOptionsContainer />
          </div>
          <div className={styles.geneTeaTabsWrapper}>
            {showTutorialAsMain && enabledFeatures.gene_tea_tutorial_page ? (
              <div className={styles.tutorialContainer}>
                <Tutorial />
              </div>
            ) : (
              <TabsWithHistory
                className={styles.Tabs}
                isManual
                isLazy
                defaultId="top-tea-terms"
                qsParseOptions={{ arrayFormat: "repeat" }}
              >
                <TabList className={styles.TabList}>
                  <Tab id="top-tea-terms" className={styles.Tab}>
                    Top Tea Terms
                  </Tab>
                  <Tab id="all-matching-terms" className={styles.Tab}>
                    All Matching Terms
                  </Tab>
                </TabList>
                <TabPanels className={styles.TabPanels}>
                  <TabPanel className={styles.TabPanel}>
                    <GeneTeaMainContent tab="top-tea-terms" />
                  </TabPanel>
                  <TabPanel className={styles.TabPanel}>
                    <GeneTeaMainContent tab="all-matching-terms" />
                  </TabPanel>
                </TabPanels>
              </TabsWithHistory>
            )}
          </div>
        </div>
        <Glossary
          data={glossary as GlossaryItem[]}
          sidePanelButtonText="Help and Information"
          customBackgroundColor={"#D0D7E7"}
          customTabBackgroundColor={"#A8529D"}
          customTabTextColor={"#ffffff"}
        />
      </main>
    </div>
  );
}

export default GeneTea;
