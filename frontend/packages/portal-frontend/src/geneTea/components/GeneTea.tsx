import React, { useEffect } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
import { TabsWithHistory } from "src/common/components/tabs/TabsWithHistory";
import { Tab, TabList, TabPanel, TabPanels } from "src/common/components/tabs";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../styles/GeneTea.scss";
import SearchOptionsContainer from "./SearchOptionsContainer";
import { useGeneTeaContext } from "../context/GeneTeaContext";
import { breadboxAPI } from "@depmap/api";
import { fetchMetadata } from "../utils";
import glossary from "src/geneTea/json/glossary.json";
import Glossary from "src/common/components/Glossary";
import { GlossaryItem } from "src/common/components/Glossary/types";

function GeneTea() {
  const { handleSetAllAvailableGenes } = useGeneTeaContext();
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
        <h1>
          Tea Party{" "}
          <span style={{ fontSize: "14px", color: "#b00020" }}>
            (Under Development)
          </span>
        </h1>
        <p>
          GeneTEA (Gene-Term Enrichment Analysis) is a model that takes in
          free-text gene descriptions and incorporates several natural language
          processing methods to learn a sparse gene-by-term embedding, which can
          be treated as a de novo gene set database.
        </p>
      </header>
      <main className={styles.main}>
        <div className={styles.geneTeaTabLayout}>
          <div className={styles.geneTeaFilters}>
            <SearchOptionsContainer />
          </div>
          <div className={styles.geneTeaTabsWrapper}>
            <TabsWithHistory
              className={styles.Tabs}
              onChange={() => {
                /* add something later */
              }}
              onSetInitialIndex={() => {
                /* add something later */
              }}
              isManual
              isLazy
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
          </div>
        </div>
        <Glossary
          data={glossary as GlossaryItem[]}
          sidePanelButtonText="Help and Information"
          customBackgroundColor={"#D0D7E7"}
        />
      </main>
    </div>
  );
}

export default GeneTea;
